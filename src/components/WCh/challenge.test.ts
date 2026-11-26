import { challengePosition } from './challenges'
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

describe('a round challenge', () => {
  const pgn = '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6'
  const base = { round: 1, you: 'gukesh' as const, title: '', setup: '' }

  it('stops after the game moves, or plays the what-if on', () => {
    expect(challengePosition({ ...base, plies: 4 }, pgn)).toEqual({
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      color: 'white',
      lastMove: 'b8c6',
    })
    expect(
      challengePosition({ ...base, plies: 3, then: ['Nc6', 'Bc4'] }, pgn)
        ?.lastMove,
    ).toBe('f1c4')
  })

  it("is null when the moves don't get there", () => {
    expect(challengePosition({ ...base, plies: 9 }, pgn)).toBeNull()
    expect(
      challengePosition({ ...base, plies: 2, then: ['Ke3'] }, pgn),
    ).toBeNull()
  })
})
