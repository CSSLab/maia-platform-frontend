import { FeedPly, feedGame, feedMark, mergePlies, usualRisk } from './feed'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_D4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1'
const AFTER_NF6 = 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2'

const ply = (
  n: number,
  fen: string,
  extra: Partial<FeedPly> = {},
): FeedPly => ({
  ply: n,
  side: n % 2 === 0 ? 'white' : 'black',
  fen,
  moves: [],
  ...extra,
})

const scored = (uci: string, san: string) => ({
  uci,
  san,
  p_elite: 0.4,
  rank_elite: 1,
  was_top: true,
})

describe('the World Championship feed', () => {
  it('keeps the newest of each ply and drops plies taken back', () => {
    let m = mergePlies(new Map(), {
      plies: [ply(0, START), ply(1, AFTER_D4), ply(2, AFTER_NF6)],
      last_ply: 2,
    })
    m = mergePlies(m, {
      plies: [ply(1, AFTER_D4, { pk_ready: true })],
      last_ply: 1,
    })
    expect(Array.from(m.keys())).toEqual([0, 1])
    expect(m.get(1)?.pk_ready).toBe(true)
  })

  it('rebuilds the moves from the plies (each scored into its position)', () => {
    const plies = new Map([
      [0, ply(0, START)],
      [
        1,
        ply(1, AFTER_D4, {
          played: scored('d2d4', 'd4'),
          clock_white_s: 7190,
          think_s: 10,
        }),
      ],
      [
        2,
        ply(2, AFTER_NF6, {
          played: scored('g8f6', 'Nf6'),
          clock_black_s: 7100,
        }),
      ],
    ])
    const g = feedGame(
      'replay',
      { game_id: 'replay', result: '1/2-1/2' },
      plies,
      { white: 'sindarov', black: 'gukesh' },
    )!
    expect(g.moves.map((m) => m.san)).toEqual(['d4', 'Nf6'])
    expect(g.moves[0]).toMatchObject({
      color: 'white',
      fenBefore: START,
      fen: AFTER_D4,
      clock: 7190,
      think: 10,
    })
    expect(g.moves[1]).toMatchObject({
      color: 'black',
      moveNumber: 1,
      clock: 7100,
    })
    // A result in the manifest counts once the last position is terminal.
    expect(g.result).toBe('*')
    plies.set(2, { ...plies.get(2)!, terminal: 'draw' })
    expect(
      feedGame('replay', { game_id: 'replay', result: '1/2-1/2' }, plies, {
        white: 'sindarov',
        black: 'gukesh',
      })!.result,
    ).toBe('1/2-1/2')
  })

  it("reads a player's usual risk for the stage of the game", () => {
    const pregame = {
      players: {
        gukesh: {
          usual_blunder_risk: {
            by_phase: {
              '0-19': { usual_risk_pct: 0.016 },
              '20-39': { usual_risk_pct: 0.497 },
              '60+': { usual_risk_pct: 2.32 },
            },
          },
        },
      },
    }
    expect(usualRisk(pregame, 'gukesh', 5)).toBeCloseTo(0.00016)
    expect(usualRisk(pregame, 'gukesh', 20)).toBeCloseTo(0.00497)
    expect(usualRisk(pregame, 'gukesh', 90)).toBeCloseTo(0.0232)
    expect(usualRisk(pregame, 'gukesh', 45)).toBeNull()
    expect(usualRisk(pregame, 'sindarov', 5)).toBeNull()
    expect(usualRisk(null, 'gukesh', 5)).toBeNull()
  })

  it('shows only ? and ?? marks', () => {
    expect(feedMark('?')).toBe('?')
    expect(feedMark('??')).toBe('??')
    expect(feedMark('!?')).toBeUndefined()
    expect(feedMark(null)).toBeUndefined()
  })
})
