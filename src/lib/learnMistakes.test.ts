import { Chess } from 'chess.ts'
import { GameTree, StockfishEvaluation } from 'src/types'
import { extractPlayerMistakes } from './analysis'
import { getStablePlayerMistakes, loadStoredMistakes } from './learnMistakes'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// White plays 1. f3 e5 2. g4, and Black's reply is analysed too.
const buildGame = () => {
  const tree = new GameTree(START)
  const chess = new Chess()
  let node = tree.getRoot()
  for (const move of ['f2f3', 'e7e5', 'g2g4']) {
    const result = chess.move(move, { sloppy: true })
    if (!result) throw new Error(move)
    node = tree.addMainlineNode(node, chess.fen(), move, result.san)
  }
  return tree
}

const analysis = (
  depth: number,
  bestMove: string,
  losses: Record<string, number>,
): StockfishEvaluation => ({
  sent: true,
  depth,
  model_move: bestMove,
  model_optimal_cp: 0,
  cp_vec: { [bestMove]: 0 },
  cp_relative_vec: { [bestMove]: 0 },
  winrate_vec: { [bestMove]: 0.5 },
  winrate_loss_vec: { [bestMove]: 0, ...losses },
})

describe('getStablePlayerMistakes', () => {
  beforeEach(() => window.localStorage.clear())

  it('keeps the first review’s mistakes when deeper analysis changes them', () => {
    const tree = buildGame()
    const [root, , afterE5] = tree.getMainLine()

    // At depth 12, 1. f3 loses just over the inaccuracy threshold and 2. g4
    // is a blunder.
    root.addStockfishAnalysis(analysis(12, 'e2e4', { f2f3: -0.051 }))
    afterE5.addStockfishAnalysis(analysis(12, 'e2e4', { g2g4: -0.2 }))

    const first = getStablePlayerMistakes(tree, 'white')
    expect(first.map((m) => m.san)).toEqual(['f3', 'g4'])

    // A deeper search of the start position puts 1. f3 just under it.
    root.addStockfishAnalysis(analysis(18, 'd2d4', { f2f3: -0.049 }))
    expect(extractPlayerMistakes(tree, 'white').map((m) => m.san)).toEqual([
      'g4',
    ])

    expect(getStablePlayerMistakes(tree, 'white')).toEqual(first)
  })

  it('reviews a game with other moves afresh', () => {
    const tree = buildGame()
    const [root] = tree.getMainLine()
    root.addStockfishAnalysis(analysis(12, 'e2e4', { f2f3: -0.2 }))
    getStablePlayerMistakes(tree, 'white')
    expect(loadStoredMistakes(tree, 'white')).not.toBeNull()

    tree.addMoveToMainLine('d7d5')
    expect(loadStoredMistakes(tree, 'white')).toBeNull()
  })

  it('keeps each side’s list apart', () => {
    const tree = buildGame()
    const [root] = tree.getMainLine()
    root.addStockfishAnalysis(analysis(12, 'e2e4', { f2f3: -0.2 }))
    expect(getStablePlayerMistakes(tree, 'white')).toHaveLength(1)
    expect(loadStoredMistakes(tree, 'black')).toBeNull()
    expect(getStablePlayerMistakes(tree, 'black')).toEqual([])
  })
})
