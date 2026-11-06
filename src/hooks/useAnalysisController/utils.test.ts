import { StockfishEvaluation } from 'src/types'
import { sortStockfishMoves } from './utils'

const evaluation = (
  partial: Partial<StockfishEvaluation>,
): StockfishEvaluation => ({
  sent: true,
  depth: 18,
  model_move: '',
  model_optimal_cp: 0,
  cp_vec: {},
  cp_relative_vec: {},
  ...partial,
})

describe('sortStockfishMoves', () => {
  it('puts faster mates first even when alphabetical order disagrees', () => {
    const sf = evaluation({
      cp_vec: { a1a2: 10000, h1h2: 10000, b1b2: 50 },
      cp_relative_vec: { a1a2: 0, h1h2: 0, b1b2: -9950 },
      winrate_loss_vec: { a1a2: 0, h1h2: 0, b1b2: -0.4 },
      mate_vec: { a1a2: 5, h1h2: 2 },
    })
    expect(sortStockfishMoves(sf, ['a1a2', 'b1b2', 'h1h2'])).toEqual([
      'h1h2',
      'a1a2',
      'b1b2',
    ])
  })

  it('puts losing mates last, slowest loss first', () => {
    const sf = evaluation({
      cp_vec: { a1a2: 20, b1b2: -10000, c1c2: -10000 },
      cp_relative_vec: { a1a2: 0, b1b2: -10020, c1c2: -10020 },
      winrate_loss_vec: { a1a2: 0, b1b2: -1, c1c2: -1 },
      mate_vec: { b1b2: -1, c1c2: -4 },
    })
    expect(sortStockfishMoves(sf, ['b1b2', 'c1c2', 'a1a2'])).toEqual([
      'a1a2',
      'c1c2',
      'b1b2',
    ])
  })

  it("breaks ties on the side to move's score, also for Black", () => {
    // Black to move: cp_vec is from White's view, so -80 is better for Black.
    const sf = evaluation({
      cp_vec: { a7a6: -40, h7h6: -80 },
      cp_relative_vec: { a7a6: -40, h7h6: 0 },
      winrate_loss_vec: { a7a6: 0, h7h6: 0 },
    })
    expect(sortStockfishMoves(sf, ['a7a6', 'h7h6'])).toEqual(['h7h6', 'a7a6'])
  })
})
