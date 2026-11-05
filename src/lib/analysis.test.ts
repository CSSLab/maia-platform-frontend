import { GameTree, MaiaEvaluation, StockfishEvaluation } from 'src/types'
import { MAIA_MODELS } from 'src/constants/common'
import {
  applyEngineAnalysisData,
  collectEngineAnalysisData,
  generateAnalysisCacheKey,
  stockfishSearchIsDone,
} from './analysis'
import { STOCKFISH_ENGINE } from 'src/constants/analysis'

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

describe('saved analysis and which engine made it', () => {
  const saved = (engine?: string, depth = 18) => ({
    ply: 0,
    fen: START,
    stockfish: { depth, cp_vec: { e2e4: 30 }, mate_vec: {}, engine },
  })
  const live = (depth = 18, partial?: boolean): StockfishEvaluation => ({
    sent: true,
    depth,
    model_move: 'e2e4',
    model_optimal_cp: 30,
    cp_vec: { e2e4: 30 },
    cp_relative_vec: { e2e4: 0 },
    partial,
    engine: STOCKFISH_ENGINE,
  })

  it("takes saved analysis without an engine as an older engine's", () => {
    const tree = new GameTree(START)
    applyEngineAnalysisData(tree, [saved()])
    expect(tree.getRoot().analysis.stockfish?.older_engine).toBe(true)
    expect(tree.getRoot().analysis.stockfish?.engine).toBeUndefined()
  })

  it('takes saved analysis from this engine as finished', () => {
    const tree = new GameTree(START)
    applyEngineAnalysisData(tree, [saved(STOCKFISH_ENGINE)])
    const stockfish = tree.getRoot().analysis.stockfish
    expect(stockfish?.older_engine).toBe(false)
    expect(stockfishSearchIsDone(stockfish, 18)).toBe(true)
  })

  it("searches an older engine's evaluation again at the full depth only", () => {
    const tree = new GameTree(START)
    applyEngineAnalysisData(tree, [saved()])
    const stockfish = tree.getRoot().analysis.stockfish
    expect(stockfishSearchIsDone(stockfish, 18)).toBe(false)
    expect(stockfishSearchIsDone(stockfish, 12)).toBe(true)
  })

  it('leaves evaluations that did not come from saved analysis alone', () => {
    expect(stockfishSearchIsDone({ ...live(), engine: undefined }, 18)).toBe(
      true,
    )
    expect(stockfishSearchIsDone(live(18, true), 18)).toBe(false)
    expect(stockfishSearchIsDone(live(12), 18)).toBe(false)
    expect(stockfishSearchIsDone(undefined, 18)).toBe(false)
  })

  it('keeps a finished search when older saved analysis arrives after it', () => {
    const tree = new GameTree(START)
    tree.getRoot().addStockfishAnalysis(live())
    applyEngineAnalysisData(tree, [saved(undefined, 22)])
    expect(tree.getRoot().analysis.stockfish?.depth).toBe(18)
    expect(tree.getRoot().analysis.stockfish?.older_engine).toBeUndefined()
  })

  it('saves the engine of a search, and nothing for one without', () => {
    const tree = new GameTree(START)
    tree.getRoot().addStockfishAnalysis(live())
    expect(collectEngineAnalysisData(tree)[0].stockfish?.engine).toBe(
      STOCKFISH_ENGINE,
    )

    const old = new GameTree(START)
    applyEngineAnalysisData(old, [saved()])
    expect(collectEngineAnalysisData(old)[0].stockfish).not.toHaveProperty(
      'engine',
    )
  })

  it('saves again when only the engine changed', () => {
    expect(generateAnalysisCacheKey([saved()])).not.toEqual(
      generateAnalysisCacheKey([saved(STOCKFISH_ENGINE)]),
    )
  })
})
