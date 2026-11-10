import { GameTree, MaiaEvaluation, StockfishEvaluation } from 'src/types'
import { MAIA_MODELS } from 'src/constants/common'
import {
  collectEngineAnalysisData,
  convertBackendEvalToStockfishEval,
} from './analysis'
import { sortStockfishMoves } from 'src/hooks/useAnalysisController/utils'

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

describe('convertBackendEvalToStockfishEval', () => {
  // 2024 World Championship, game 1, Black to move after 32. Bd4: the
  // backend's scores are Black's, and mates are +-10000 (here 32...Kh8
  // allows 33. Rxf8# and 32...g5 33. Qxg5#).
  const black = convertBackendEvalToStockfishEval(
    { b2d3: 254, f8f1: 24, g8h8: -10000, g7g5: -10000 },
    'b',
  )

  it('keeps mates from the side to move, like the engine', () => {
    expect(black.mate_vec).toEqual({ g8h8: -1, g7g5: -1 })
    expect(black.cp_vec).toEqual({
      b2d3: -254,
      f8f1: -24,
      g8h8: 10000,
      g7g5: 10000,
    })
    expect(black.model_move).toBe('b2d3')
  })

  it('ranks moves that get the side to move mated last', () => {
    const order = sortStockfishMoves(black, Object.keys(black.cp_vec))
    expect(order.slice(0, 2)).toEqual(['b2d3', 'f8f1'])
    // The two mated moves tie.
    expect(order.slice(2).sort()).toEqual(['g7g5', 'g8h8'])
  })

  it('leaves mates with White to move as they were', () => {
    const white = convertBackendEvalToStockfishEval(
      { d1h5: 10000, e2e4: 30, f2f3: -10000 },
      'w',
    )
    expect(white.mate_vec).toEqual({ d1h5: 1, f2f3: -1 })
    expect(sortStockfishMoves(white, Object.keys(white.cp_vec))).toEqual([
      'd1h5',
      'e2e4',
      'f2f3',
    ])
  })
})
