import {
  fetchGameMove,
  MoveRequestError,
  retryUnlessRejected,
  startGame,
  startGameWithRetry,
} from './play'

const respond = (status: number, body: unknown) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch
}

describe('fetchGameMove', () => {
  it("returns Maia's move", async () => {
    respond(200, { top_move: 'e2e4', move_delay: 0.4 })
    await expect(fetchGameMove([])).resolves.toEqual({
      top_move: 'e2e4',
      move_delay: 0.4,
    })
  })

  it('throws, with the status, when the server rejects the request', async () => {
    respond(400, { detail: 'Illegal move order given' })
    const error = await fetchGameMove(['e2e5']).catch((e) => e)
    expect(error).toBeInstanceOf(MoveRequestError)
    expect(error.status).toBe(400)
    expect(error.message).toBe("Maia's move: HTTP 400 Illegal move order given")
    expect(retryUnlessRejected(error)).toBe(false)
  })

  it('throws, and is retried, when the server fails', async () => {
    respond(500, null)
    const error = await fetchGameMove([]).catch((e) => e)
    expect(error).toBeInstanceOf(MoveRequestError)
    expect(retryUnlessRejected(error)).toBe(true)
  })

  it('throws when the answer has no move', async () => {
    respond(200, {})
    await expect(fetchGameMove([])).rejects.toBeInstanceOf(MoveRequestError)
  })

  it('retries a failed connection', () => {
    expect(retryUnlessRejected(new TypeError('Failed to fetch'))).toBe(true)
  })
})

const reply = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })

describe('startGame', () => {
  const start = (retried = false) =>
    (retried ? startGameWithRetry : startGame)(
      'white',
      'maia_kdd_600',
      'play',
      true,
      'unlimited',
    )

  it("returns the new game's id", async () => {
    respond(200, { game_id: 'abc', opponent_elo: 1500 })
    await expect(start()).resolves.toEqual({
      gameId: 'abc',
      opponentElo: 1500,
    })
  })

  it('throws, with the status, when the server fails', async () => {
    respond(502, null)
    const error = await start().catch((e) => e)
    expect(error).toBeInstanceOf(MoveRequestError)
    expect(error.status).toBe(502)
  })

  it('retries a dropped connection until the game starts', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockReturnValueOnce(reply(503, null))
      .mockReturnValueOnce(reply(200, { game_id: 'abc', opponent_elo: 1500 }))
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(start(true)).resolves.toMatchObject({ gameId: 'abc' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry a request the server rejected', async () => {
    // 401 twice: fetchAsGuest's retry after the account request, which
    // answers 401 too (its body is not read).
    const fetchMock = jest.fn().mockImplementation(() => reply(401, {}))
    global.fetch = fetchMock as unknown as typeof fetch

    const error = await start(true).catch((e) => e)
    expect(error).toBeInstanceOf(MoveRequestError)
    expect(error.status).toBe(401)
    // start_game, the account request, start_game again: once only.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
