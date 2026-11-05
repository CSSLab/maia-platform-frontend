import { GameNode } from './node'
import { StockfishEvaluation } from '.'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

const evaluation = (
  depth: number,
  moveDepth: number,
  partial?: boolean,
): StockfishEvaluation => ({
  sent: true,
  depth,
  model_move: 'd2d4',
  model_optimal_cp: 50,
  cp_vec: { d2d4: 50, e2e4: -500 },
  cp_relative_vec: { d2d4: 0, e2e4: -550 },
  root_move_depth_vec: { d2d4: depth, e2e4: moveDepth },
  winrate_vec: { d2d4: 0.55, e2e4: 0.2 },
  winrate_loss_vec: { d2d4: 0, e2e4: -0.35 },
  partial,
})

describe('GameNode move colours', () => {
  const played = () => {
    const root = new GameNode(START)
    return { root, child: root.addChild(AFTER_E4, 'e2e4', 'e4', true) }
  }

  it('does not judge a move from a shallow score during a search', () => {
    const { root, child } = played()
    root.addStockfishAnalysis(evaluation(18, 6, true))
    expect(child.color).toBeNull()
    expect(child.blunder).toBe(false)
  })

  it('judges it once its score is deep enough, or the search has finished', () => {
    const during = played()
    during.root.addStockfishAnalysis(evaluation(18, 10, true))
    expect(during.child.color).not.toBeNull()

    const finished = played()
    finished.root.addStockfishAnalysis(evaluation(18, 6))
    expect(finished.child.color).not.toBeNull()
  })

  it('takes a finished search over a deeper unfinished one', () => {
    const { root, child } = played()
    root.addStockfishAnalysis(evaluation(18, 6, true))
    root.addStockfishAnalysis(evaluation(12, 12))
    expect(root.analysis.stockfish?.depth).toBe(12)
    expect(root.analysis.stockfish?.partial).toBeUndefined()
    expect(child.color).not.toBeNull()
  })

  it('keeps a deeper finished search, and a deeper unfinished one over a shallower', () => {
    const finished = played()
    finished.root.addStockfishAnalysis(evaluation(18, 18))
    finished.root.addStockfishAnalysis(evaluation(12, 12))
    expect(finished.root.analysis.stockfish?.depth).toBe(18)

    const unfinished = played()
    unfinished.root.addStockfishAnalysis(evaluation(18, 6, true))
    unfinished.root.addStockfishAnalysis(evaluation(12, 6, true))
    expect(unfinished.root.analysis.stockfish?.depth).toBe(18)
  })

  describe("an older engine's saved evaluation", () => {
    const older = (depth: number) => ({
      ...evaluation(depth, depth),
      older_engine: true,
    })

    it('stays on show during a search', () => {
      const { root } = played()
      root.addStockfishAnalysis(older(18))
      root.addStockfishAnalysis(evaluation(18, 6, true))
      expect(root.analysis.stockfish?.older_engine).toBe(true)
    })

    it('gives way when the search has finished', () => {
      const { root } = played()
      root.addStockfishAnalysis(older(18))
      root.addStockfishAnalysis(evaluation(18, 18))
      expect(root.analysis.stockfish?.older_engine).toBeUndefined()
    })

    it('gives way to the full depth even when it was deeper', () => {
      const { root } = played()
      root.addStockfishAnalysis(older(22))
      root.addStockfishAnalysis(evaluation(18, 18))
      expect(root.analysis.stockfish?.depth).toBe(18)
    })

    it('stays when the search was shallower than the full depth', () => {
      const { root } = played()
      root.addStockfishAnalysis(older(18))
      root.addStockfishAnalysis(evaluation(12, 12))
      expect(root.analysis.stockfish?.depth).toBe(18)
      expect(root.analysis.stockfish?.older_engine).toBe(true)
    })
  })

  it('still judges analysis saved without per-move depths', () => {
    const { root, child } = played()
    const saved = evaluation(18, 0)
    delete saved.root_move_depth_vec
    root.addStockfishAnalysis(saved)
    expect(child.color).not.toBeNull()
  })
})
