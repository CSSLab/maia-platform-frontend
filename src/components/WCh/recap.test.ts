import type { FeedPly, Pregame, TreeNode } from './feed'
import { FeedGameInput, buildRecap, treeLines } from './recap'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
const E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'

const ply = (n: number, fen: string, over: Partial<FeedPly> = {}): FeedPly =>
  ({
    ply: n,
    side: n % 2 ? 'black' : 'white',
    fen,
    moves: [],
    ...over,
  }) as FeedPly

const game = (n: number, white: string, result: string): FeedGameInput => ({
  n,
  id: `g${n}`,
  manifest: {
    game_id: `g${n}`,
    players: { white, black: white === 'Gukesh D' ? 'Sindarov' : 'Gukesh D' },
    result,
  },
  last_ply: 2,
  plies: [
    ply(0, START, {
      moves: [{ uci: 'e2e4', san: 'e4', p_elite: 0.6 }],
      blunder_risk: 0.1,
    }),
    ply(1, E4, {
      played: {
        uci: 'e2e4',
        san: 'e4',
        p_elite: 0.6,
        rank_elite: 1,
        was_top: true,
      },
      moves: [{ uci: 'e7e5', san: 'e5', p_elite: 0.05 }],
      p_by_rating: { 1500: 0.5, 1800: 0.55, 2100: 0.6, 2400: 0.6, 2700: 0.6 },
    }),
    ply(2, E5, {
      played: {
        uci: 'e7e5',
        san: 'e5',
        p_elite: 0.05,
        rank_elite: 4,
        was_top: false,
      },
      p_by_rating: { 1500: 0.02, 1800: 0.05, 2100: 0.1, 2400: 0.2, 2700: 0.3 },
    }),
  ],
})

const node = (
  line: string[],
  mover: string,
  moves: [string, string, number][],
): TreeNode => ({
  line,
  mover,
  moves: moves.map(([uci, san, p_bot]) => ({ uci, san, p_bot })),
})

const PREGAME: Pregame = {
  trees: {
    gukesh_white: {
      white: 'gukesh',
      nodes: [
        node([], 'gukesh', [
          ['e2e4', 'e4', 0.6],
          ['d2d4', 'd4', 0.3],
        ]),
        node(['e2e4'], 'sindarov', [
          ['e7e5', 'e5', 0.5],
          ['c7c5', 'c5', 0.4],
        ]),
        node(['d2d4'], 'sindarov', [['d7d5', 'd5', 0.9]]),
      ],
    },
  },
}

describe('the recap', () => {
  it('keeps finished games, scores the match and marks the one in play', () => {
    const r = buildRecap(
      [
        game(1, 'Sindarov', '1/2-1/2'),
        game(2, 'Gukesh D', '1-0'),
        game(3, 'Sindarov', '*'),
      ],
      PREGAME,
    )
    expect(r.games.map((g) => g.n)).toEqual([1, 2])
    expect(r.score).toEqual({ gukesh: 1.5, sindarov: 0.5 })
    expect(r.live).toEqual({ n: 3, id: 'g3', moves: 1 })
    expect(r.game?.n).toBe(2)
    expect(r.game?.opening).toBe('1.e4 e5')
  })

  it('finds the move that comes with rating and the riskiest position', () => {
    const r = buildRecap([game(1, 'Sindarov', '1/2-1/2')], PREGAME)
    const kinds = r.game?.moments.map((m) => [m.kind, m.label])
    expect(kinds).toContainEqual(['champion', '1…e5'])
    expect(kinds).toContainEqual(['risk', '1.e4'])
    // One moment per move: 1…e5 is also the surprise, but it's taken.
    expect(kinds).toHaveLength(2)
  })

  it('looks ahead to the next game with the colours swapped', () => {
    const r = buildRecap([game(1, 'Sindarov', '1/2-1/2')], PREGAME)
    expect(r.lookahead?.n).toBe(2)
    expect(r.lookahead?.white).toBe('gukesh')
    expect(r.lookahead?.firstMoves[0]).toEqual({ san: 'e4', p: 0.6 })
  })

  it('follows the likeliest lines down a tree', () => {
    const lines = treeLines(PREGAME.trees!.gukesh_white.nodes!, 2, 3)
    expect(lines.map((l) => l.san)).toEqual(['1.e4 e5', '1.d4 d5', '1.e4 c5'])
    expect(lines[0].p).toBeCloseTo(0.3)
  })
})
