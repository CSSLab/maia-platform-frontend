import { Chess } from 'chess.ts'
import { GameTree, StockfishEvaluation } from 'src/types'
import { findKeyMoments, moveLabelOf, nearestMaiaRating } from './keyMoments'

// 1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2
const MOVES = [
  'e2e4',
  'e7e5',
  'g1f3',
  'b8c6',
  'f1c4',
  'c6d4',
  'f3e5',
  'd8g5',
  'e5f7',
  'g5g2',
]

const buildTree = () => {
  const chess = new Chess()
  const tree = new GameTree(chess.fen())
  for (const uci of MOVES) {
    const move = chess.move(uci, { sloppy: true })
    if (!move) throw new Error(uci)
    tree.getLastMainlineNode().addChild(chess.fen(), uci, move.san, true)
  }
  return tree
}

/** The analysis of the position before ply `index`: `best`, and losses. */
const analyse = (
  tree: GameTree,
  index: number,
  best: string,
  losses: Record<string, number>,
  depth = 14,
): void => {
  const node = tree.getMainLine()[index - 1]
  const evaluation: StockfishEvaluation = {
    sent: true,
    depth,
    model_move: best,
    model_optimal_cp: 30,
    cp_vec: { [best]: 30 },
    cp_relative_vec: { [best]: 0 },
    winrate_vec: { [best]: 0.55 },
    winrate_loss_vec: { [best]: 0, ...losses },
  }
  node.addStockfishAnalysis(evaluation)
}

describe('findKeyMoments', () => {
  it("finds the player's biggest mistakes, in game order", () => {
    const tree = buildTree()
    // Black's moves are plies 2, 4, 6, 8, 10.
    analyse(tree, 2, 'e7e5', {})
    analyse(tree, 4, 'b8c6', {})
    analyse(tree, 6, 'g8f6', { c6d4: -0.06 })
    analyse(tree, 8, 'd4f3', { d8g5: -0.3 })
    analyse(tree, 10, 'g5f6', { g5g2: -0.12 })
    // White's mistake isn't Black's.
    analyse(tree, 7, 'b1c3', { f3e5: -0.2 })

    const moments = findKeyMoments(tree, 'black')
    expect(moments.map((m) => [m.moveIndex, m.playedSan, m.kind])).toEqual([
      [6, 'Nd4', 'inaccuracy'],
      [8, 'Qg5', 'blunder'],
      [10, 'Qxg2', 'blunder'],
    ])
    expect(moments[1]).toMatchObject({
      bestMove: 'd4f3',
      bestSan: 'Nf3+',
      winrateLoss: 0.3,
      moveLabel: '4…',
    })

    expect(findKeyMoments(tree, 'black', 2).map((m) => m.moveIndex)).toEqual([
      8, 10,
    ])
  })

  it('leaves out small slips, the best move, and shallow analysis', () => {
    const tree = buildTree()
    analyse(tree, 6, 'g8f6', { c6d4: -0.049 })
    analyse(tree, 8, 'd8g5', { d8g5: -0.0 })
    analyse(tree, 10, 'g5f6', { g5g2: -0.5 }, 10)
    expect(findKeyMoments(tree, 'black')).toEqual([])
  })
})

describe('helpers', () => {
  it('labels moves by number and side', () => {
    expect(moveLabelOf(new Chess().fen())).toBe('1.')
    const chess = new Chess()
    chess.move('e4')
    expect(moveLabelOf(chess.fen())).toBe('1…')
  })

  it('rounds a rating to the nearest Maia', () => {
    expect(nearestMaiaRating(1549)).toBe(1500)
    expect(nearestMaiaRating(3000)).toBe(2600)
    expect(nearestMaiaRating(undefined)).toBe(1500)
  })
})
