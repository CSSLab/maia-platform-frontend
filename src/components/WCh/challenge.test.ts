import { fetchPositionStats, maiaName, winShare } from './challenge'

const answer = (body: unknown, ok = true) =>
  jest.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) })

describe('a position challenge', () => {
  afterEach(() => jest.restoreAllMocks())

  it('asks for the position, the Maia and the side', async () => {
    const f = answer({
      attempts: 3,
      players: 2,
      reveal_after: 20,
      results: null,
    })
    global.fetch = f as unknown as typeof fetch
    const s = await fetchPositionStats(
      '8/8/8/8/8/8/8/K6k w - - 0 1',
      1900,
      'black',
    )
    expect(s?.attempts).toBe(3)
    const url = new URL(f.mock.calls[0][0], 'http://x')
    expect(url.pathname).toMatch(/play\/position_stats$/)
    expect(url.searchParams.get('maia_name')).toBe(maiaName(1900))
    expect(url.searchParams.get('player_color')).toBe('black')
  })

  it('ignores an answer it does not understand', async () => {
    global.fetch = answer({ attempts: 'many' }) as unknown as typeof fetch
    expect(await fetchPositionStats('x', 1900, 'white')).toBeNull()
    global.fetch = answer({}, false) as unknown as typeof fetch
    expect(await fetchPositionStats('x', 1900, 'white')).toBeNull()
  })

  it('shows shares only once the results are out', () => {
    expect(
      winShare({ attempts: 5, players: 5, reveal_after: 20, results: null }),
    ).toBeNull()
    expect(
      winShare({
        attempts: 40,
        players: 30,
        reveal_after: 20,
        results: { wins: 10, draws: 10, losses: 20 },
      }),
    ).toEqual({ win: 0.25, draw: 0.25, loss: 0.5 })
  })
})
