import {
  RECHECK_MS,
  fetchLastLichessGame,
  parseLichessGameJson,
} from './lastLichessGame'

const json = (overrides: Record<string, unknown> = {}) => ({
  id: 'abcd1234',
  variant: 'standard',
  speed: 'blitz',
  status: 'mate',
  winner: 'black',
  createdAt: 1000,
  lastMoveAt: 2000,
  players: {
    white: { user: { id: 'someone', name: 'Someone' }, rating: 1800 },
    black: { user: { id: 'alice', name: 'Alice' }, rating: 1650 },
  },
  pgn: '[Event "x"]\n\n1. e4 e5 *',
  ...overrides,
})

const reply = (body: string, status = 200) =>
  Promise.resolve({
    ok: status === 200,
    status,
    text: () => Promise.resolve(body),
  } as Response)

describe('parseLichessGameJson', () => {
  it("reads the visitor's side, ratings and result", () => {
    expect(parseLichessGameJson(json(), 'Alice')).toMatchObject({
      id: 'abcd1234',
      userColor: 'black',
      userRating: 1650,
      opponentRating: 1800,
      result: 'win',
      speed: 'blitz',
    })
  })

  it('skips variants and games without the visitor', () => {
    expect(parseLichessGameJson(json({ variant: 'chess960' }), 'alice')).toBe(
      null,
    )
    expect(parseLichessGameJson(json(), 'bob')).toBe(null)
  })
})

describe('fetchLastLichessGame', () => {
  const fetchMock = jest.fn()
  beforeEach(() => {
    window.sessionStorage.clear()
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  it('asks once per session, then only for newer games', async () => {
    fetchMock.mockReturnValueOnce(reply(JSON.stringify(json()) + '\n'))
    const first = await fetchLastLichessGame('alice', 0)
    expect(first?.id).toBe('abcd1234')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('max=1')

    // Within the recheck time: from the session's copy.
    await fetchLastLichessGame('alice', RECHECK_MS / 2)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Later: only games since the kept one; none, so the same game.
    fetchMock.mockReturnValueOnce(reply(''))
    const same = await fetchLastLichessGame('alice', Date.now() + RECHECK_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toContain('since=1001')
    expect(same?.id).toBe('abcd1234')
  })

  it('shares a request in flight', async () => {
    fetchMock.mockReturnValueOnce(reply(JSON.stringify(json())))
    const [a, b] = await Promise.all([
      fetchLastLichessGame('alice', 0),
      fetchLastLichessGame('alice', 0),
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
  })

  it('stops asking for a while after a rate limit', async () => {
    fetchMock.mockReturnValueOnce(reply('', 429))
    await expect(fetchLastLichessGame('carol', Date.now())).rejects.toThrow()
    await expect(fetchLastLichessGame('carol', Date.now())).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
