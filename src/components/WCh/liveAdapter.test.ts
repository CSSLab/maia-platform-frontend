import { openingTree } from './feed'
import type { LiveGame } from './live'
import { buildLive } from './liveAdapter'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

const pregame = {
  trees: {
    sindarov_white: {
      white: 'sindarov',
      nodes: [
        {
          line: [],
          mover: 'sindarov',
          blunder_risk: 3e-6,
          moves: [
            { uci: 'd2d4', san: 'd4', p_bot: 0.19, p_generic: 0.33 },
            { uci: 'e2e4', san: 'e4', p_bot: 0.64, p_generic: 0.52 },
          ],
        },
        {
          line: ['e2e4'],
          mover: 'gukesh',
          blunder_risk: 1e-5,
          moves: [
            { uci: 'e7e5', san: 'e5', p_bot: 0.5, p_generic: 0.62 },
            { uci: 'c7c5', san: 'c5', p_bot: 0.42, p_generic: 0.29 },
          ],
        },
      ],
    },
  },
}

const noEngines = { info: () => undefined, focusEval: () => null }
const ids = { white: 'sindarov', black: 'gukesh' } as const

const game = (moves: LiveGame['moves']): LiveGame => ({
  gameId: 'j7pdr7s2',
  white: 'sindarov',
  black: 'gukesh',
  whiteName: '',
  blackName: '',
  result: '*',
  timeControl: null,
  moves,
})

describe('the live game from the opening tree', () => {
  const tree = openingTree(pregame, 'sindarov')

  it('predicts the first move from his own model before the game', () => {
    const { next } = buildLive(game([]), noEngines, ids, 7200, undefined, tree)
    expect(next.personal).toBe(true)
    expect(next.candidates.map((c) => [c.san, c.maia, c.generic])).toEqual([
      ['e4', 0.64, 0.52],
      ['d4', 0.19, 0.33],
    ])
    expect(next.risk).toBe(3e-6)
  })

  it('scores a move played in the tree and predicts the reply', () => {
    const { plies, next } = buildLive(
      game([
        {
          index: 0,
          moveNumber: 1,
          color: 'white',
          san: 'e4',
          uci: 'e2e4',
          fenBefore: START,
          fen: AFTER_E4,
          clock: 7190,
          eval: null,
          think: 10,
        },
      ]),
      noEngines,
      ids,
      7200,
      undefined,
      tree,
    )
    expect(plies[0]).toMatchObject({ rank: 1, pPlayed: 0.64, personal: true })
    expect(next.candidates[0].san).toBe('e5')
    expect(next.mover).toBe('gukesh')
  })

  it('is only for the game with that player as White', () => {
    expect(openingTree(pregame, 'gukesh')).toBeNull()
    expect(openingTree(null, 'sindarov')).toBeNull()
  })

  it('leaves positions out of the tree to the browser engines', () => {
    const { next } = buildLive(game([]), noEngines, ids, 7200, undefined, null)
    expect(next.personal).toBe(false)
    expect(next.candidates).toEqual([])
  })
})

describe('the live game from the feed', () => {
  // chess.js writes the en passant square after 1.e4; the feed doesn't.
  const E4_EP = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
  const feedPly = (ply: number, fen: string, extra: object) =>
    ({
      ply,
      fen,
      side: ply % 2 ? 'black' : 'white',
      moves: [],
      pk_ready: true,
      ...extra,
    }) as never

  it('matches a position after a two-square pawn push', () => {
    const feed = new Map([
      [
        0,
        feedPly(0, START, {
          moves: [{ uci: 'e2e4', san: 'e4', p_elite: 0.65, p_elite_pk: 0.65 }],
        }),
      ],
      [
        1,
        feedPly(1, AFTER_E4, {
          moves: [{ uci: 'e7e5', san: 'e5', p_elite: 0.47, p_elite_pk: 0.55 }],
          played: { uci: 'e2e4', san: 'e4', p_elite: 0.65, rank_elite: 1 },
        }),
      ],
    ])
    const { plies, next } = buildLive(
      game([
        {
          index: 0,
          moveNumber: 1,
          color: 'white',
          san: 'e4',
          uci: 'e2e4',
          fenBefore: START,
          fen: E4_EP,
          clock: 7190,
          eval: null,
          think: 10,
        },
      ]),
      noEngines,
      ids,
      7200,
      feed,
      null,
    )
    expect(plies[0].rank).toBe(1)
    expect(next.candidates[0]?.san).toBe('e5')
  })
})
