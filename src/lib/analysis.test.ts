import { GameTree, MaiaEvaluation, StockfishEvaluation } from 'src/types'
import { MAIA_MODELS } from 'src/constants/common'
import { collectEngineAnalysisData } from './analysis'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const evaluation: MaiaEvaluation = { policy: { e2e4: 1 }, value: 0.5 }

describe('collectEngineAnalysisData', () => {
  it('saves Maia analysis only when every rating is there', () => {
    const tree = new GameTree(START)
    const root = tree.getRoot()

    // The analysis page adds the selected rating before the others.
    root.addMaiaAnalysis({ maia_kdd_1500: evaluation }, 'maia_kdd_1500')
    expect(collectEngineAnalysisData(tree)).toEqual([])

    root.addMaiaAnalysis(
      Object.fromEntries(MAIA_MODELS.map((model) => [model, evaluation])),
      'maia_kdd_1500',
    )
    const [position] = collectEngineAnalysisData(tree)
    expect(Object.keys(position.maia ?? {})).toHaveLength(MAIA_MODELS.length)
  })
})

describe('collectEngineAnalysisData and unfinished searches', () => {
  const stockfish = (partial?: boolean): StockfishEvaluation => ({
    sent: true,
    depth: 18,
    model_move: 'e2e4',
    model_optimal_cp: 30,
    cp_vec: { e2e4: 30 },
    cp_relative_vec: { e2e4: 0 },
    partial,
  })

  it('saves a finished search', () => {
    const tree = new GameTree(START)
    tree.getRoot().addStockfishAnalysis(stockfish())
    expect(collectEngineAnalysisData(tree)[0].stockfish?.depth).toBe(18)
  })

  it('does not save an unfinished one', () => {
    const tree = new GameTree(START)
    tree.getRoot().addStockfishAnalysis(stockfish(true))
    expect(collectEngineAnalysisData(tree)).toEqual([])
  })
})
