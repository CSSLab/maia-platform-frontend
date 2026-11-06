import {
  checkPuzzleResponse,
  fetchPuzzleData,
  PuzzleUnavailableError,
} from './train'

const PUZZLE = {
  puzzle_id: { game_source: 'lichess', game_id: 'abc', move_ply: 12 },
  puzzle_elo: 1500,
}

const respond = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () =>
    body === undefined
      ? Promise.reject(new SyntaxError('Unexpected token <'))
      : Promise.resolve(body),
})

const reasonOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(PuzzleUnavailableError)
    return (error as PuzzleUnavailableError).reason
  }
  throw new Error('expected a PuzzleUnavailableError')
}

describe('fetchPuzzleData', () => {
  afterEach(() => {
    delete window.__puzzle
  })

  it("takes the puzzle the page's HTML asked for, once", async () => {
    window.__puzzle = Promise.resolve({ ...PUZZLE, puzzle_elo: 1500 })
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        respond(200, { ...PUZZLE, puzzle_elo: 1700 }),
      ) as unknown as typeof fetch

    expect(await fetchPuzzleData()).toMatchObject({ puzzle_elo: 1500 })
    expect(global.fetch).not.toHaveBeenCalled()
    // The next puzzle is a new request.
    expect(await fetchPuzzleData()).toMatchObject({ puzzle_elo: 1700 })
  })

  it('asks again when that request failed (a first visit, without the cookie)', async () => {
    window.__puzzle = Promise.reject(new Error('401'))
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        respond(200, { ...PUZZLE, puzzle_elo: 1700 }),
      ) as unknown as typeof fetch

    expect(await fetchPuzzleData()).toMatchObject({ puzzle_elo: 1700 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('reports running out when the early response has no puzzle', async () => {
    window.__puzzle = Promise.resolve({})
    global.fetch = jest.fn() as unknown as typeof fetch

    await expect(fetchPuzzleData()).rejects.toMatchObject({
      reason: 'exhausted',
    })
  })

  it('reports a server error as an error', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        respond(500, { detail: 'Internal Server Error' }),
      ) as unknown as typeof fetch

    await expect(fetchPuzzleData()).rejects.toMatchObject({ reason: 'error' })
  })

  it('reports a lost connection as an error', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new TypeError('Failed to fetch'),
      ) as unknown as typeof fetch

    await expect(fetchPuzzleData()).rejects.toMatchObject({ reason: 'error' })
  })
})

describe('checkPuzzleResponse', () => {
  it('passes a puzzle through', () => {
    expect(checkPuzzleResponse(200, PUZZLE)).toBe(PUZZLE)
  })

  it('counts an answer without a puzzle as having run out', () => {
    expect(reasonOf(() => checkPuzzleResponse(200, null))).toBe('exhausted')
    expect(reasonOf(() => checkPuzzleResponse(200, {}))).toBe('exhausted')
    expect(reasonOf(() => checkPuzzleResponse(200, []))).toBe('exhausted')
    expect(reasonOf(() => checkPuzzleResponse(204, undefined))).toBe(
      'exhausted',
    )
    expect(
      reasonOf(() => checkPuzzleResponse(404, { detail: 'Not found' })),
    ).toBe('exhausted')
    expect(
      reasonOf(() =>
        checkPuzzleResponse(400, { detail: 'No more puzzles for this user' }),
      ),
    ).toBe('exhausted')
  })

  it('counts other failures as errors', () => {
    expect(reasonOf(() => checkPuzzleResponse(500, null))).toBe('error')
    expect(reasonOf(() => checkPuzzleResponse(401, { detail: 'x' }))).toBe(
      'error',
    )
    // A 200 that isn't JSON is more likely a proxy's page than an answer.
    expect(reasonOf(() => checkPuzzleResponse(200, undefined))).toBe('error')
  })
})
