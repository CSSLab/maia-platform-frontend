import {
  calculateWeightedMaiaWinrate,
  getHumanWhiteWinProbability,
} from './analysis'
import type { MaiaEvaluation, StockfishEvaluation } from 'src/types'

describe('human winrate helpers', () => {
  const createStockfishEvaluation = (
    winrate_vec: NonNullable<StockfishEvaluation['winrate_vec']>,
  ): StockfishEvaluation => ({
    sent: true,
    depth: 18,
    model_move: Object.keys(winrate_vec)[0] || '',
    model_optimal_cp: 0,
    cp_vec: {},
    cp_relative_vec: {},
    winrate_vec,
  })

  it('prefers Maia-policy-weighted Stockfish winrates over the raw Maia value', () => {
    const maiaEvaluation: MaiaEvaluation = {
      value: 0.18,
      policy: {
        e2e4: 0.75,
        d2d4: 0.25,
      },
    }
    const stockfishEvaluation = createStockfishEvaluation({
      e2e4: 0.6,
      d2d4: 0.3,
    })

    expect(
      calculateWeightedMaiaWinrate(
        maiaEvaluation.policy,
        stockfishEvaluation.winrate_vec,
      ),
    ).toBeCloseTo(0.525)
    expect(
      getHumanWhiteWinProbability(maiaEvaluation, stockfishEvaluation),
    ).toBeCloseTo(0.525)
  })

  it('normalizes by covered Maia probability when Stockfish lacks some moves', () => {
    const maiaEvaluation: MaiaEvaluation = {
      value: 0.2,
      policy: {
        e2e4: 0.6,
        d2d4: 0.3,
        g1f3: 0.1,
      },
    }
    const stockfishEvaluation = createStockfishEvaluation({
      e2e4: 0.7,
      d2d4: 0.5,
    })

    expect(
      getHumanWhiteWinProbability(maiaEvaluation, stockfishEvaluation),
    ).toBeCloseTo((0.6 * 0.7 + 0.3 * 0.5) / 0.9)
  })

  it('falls back to the raw Maia value when there is no Stockfish overlap', () => {
    const maiaEvaluation: MaiaEvaluation = {
      value: 0.64,
      policy: {
        e2e4: 1,
      },
    }
    const stockfishEvaluation = createStockfishEvaluation({
      d2d4: 0.4,
    })

    expect(
      getHumanWhiteWinProbability(maiaEvaluation, stockfishEvaluation),
    ).toBe(0.64)
  })

  it('returns null when neither weighted nor raw Maia values are available', () => {
    expect(getHumanWhiteWinProbability(undefined, undefined)).toBeNull()
  })
})
