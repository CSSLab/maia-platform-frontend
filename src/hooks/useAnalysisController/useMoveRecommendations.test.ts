import { MAIA_MODELS } from 'src/constants/common'
import { MaiaEvaluation, StockfishEvaluation } from 'src/types'
import {
  buildMovesByRating,
  chartMoves,
  ratingProbability,
} from './useMoveRecommendations'

// Two moves whose probabilities change with the rating index.
const evaluation = (index: number): MaiaEvaluation => ({
  value: 0.5,
  policy: { e2e4: 0.3 + index * 0.01, d2d4: 0.4 - index * 0.015 },
})

const ratings = (indices: number[]) =>
  Object.fromEntries(indices.map((i) => [MAIA_MODELS[i], evaluation(i)]))

const all = MAIA_MODELS.map((_, i) => i)
const every400 = all.filter((i) => i % 4 === 0)
const every200 = all.filter((i) => i % 2 === 0)

describe('buildMovesByRating', () => {
  it('draws nothing while only the selected rating is in', () => {
    expect(buildMovesByRating(ratings([7]), undefined)).toBeUndefined()
  })

  it('draws nothing until every 400 points are in', () => {
    const maia = ratings(every400)
    delete maia[MAIA_MODELS[8]]
    expect(buildMovesByRating(maia, undefined)).toBeUndefined()
  })

  it('draws from every 400 points, the ratings in between interpolated', () => {
    const data = buildMovesByRating(ratings(every400), undefined)
    expect(data).toHaveLength(21)
    for (const i of all) {
      // the test's probabilities are linear in the index, so the average of
      // the neighbours is the value itself
      expect(data?.[i].e2e4).toBeCloseTo((0.3 + i * 0.01) * 100)
      expect(data?.[i].d2d4).toBeCloseTo((0.4 - i * 0.015) * 100)
    }
  })

  it("uses a rating's own moves once they are in", () => {
    const maia = ratings(every200)
    // a rating in between whose moves differ from its neighbours' average
    maia[MAIA_MODELS[7]] = { value: 0.5, policy: { e2e4: 0.9, d2d4: 0.05 } }
    const data = buildMovesByRating(maia, undefined)
    expect(data?.[7].e2e4).toBeCloseTo(90)
    expect(data?.[7].d2d4).toBeCloseTo(5)
    expect(data?.[9].e2e4).toBeCloseTo((0.3 + 9 * 0.01) * 100)
  })

  it('gives every rating its own values when all are in', () => {
    const data = buildMovesByRating(ratings(all), undefined)
    expect(data?.map((d) => d.rating)).toEqual(all.map((i) => 600 + i * 100))
    expect(data?.[13].d2d4).toBeCloseTo((0.4 - 13 * 0.015) * 100)
  })
})

describe('ratingProbability', () => {
  it('interpolates from the nearest ratings that are in', () => {
    const maia = ratings([4, 5, 8])
    maia[MAIA_MODELS[5]] = { value: 0.5, policy: { e2e4: 0.5 } }
    // a third and two thirds of the way from 1100 (0.5) to 1400 (0.38)
    expect(ratingProbability(maia, 6, 'e2e4')).toBeCloseTo(0.46)
    expect(ratingProbability(maia, 7, 'e2e4')).toBeCloseTo(0.42)
  })

  it('gives undefined without a rating on both sides', () => {
    expect(ratingProbability(ratings([4, 8]), 2, 'e2e4')).toBeUndefined()
    expect(ratingProbability(ratings([4, 8]), 9, 'e2e4')).toBeUndefined()
  })
})

describe('chartMoves', () => {
  // The same probabilities at every rating, or each rating's from `at`.
  const maiaOf = (at: (i: number) => { [move: string]: number }) =>
    Object.fromEntries(
      MAIA_MODELS.map((model, i) => [model, { value: 0.5, policy: at(i) }]),
    )
  // Stockfish's moves best first.
  const stockfishOf = (...moves: string[]) =>
    ({
      cp_vec: Object.fromEntries(moves.map((m, i) => [m, -50 * i])),
      cp_relative_vec: Object.fromEntries(moves.map((m, i) => [m, -50 * i])),
    }) as unknown as StockfishEvaluation

  it("draws only the natural move, and Stockfish's best", () => {
    const maia = maiaOf(() => ({ e2e4: 0.8, d2d4: 0.12, g1f3: 0.08 }))
    expect(chartMoves(maia, stockfishOf('e2e4', 'd2d4'))).toEqual(['e2e4'])
    expect(chartMoves(maia, stockfishOf('g1f3', 'e2e4'))).toEqual([
      'g1f3',
      'e2e4',
    ])
  })

  it('draws every move at least 15% of players play at some rating', () => {
    // d2d4 overtakes e2e4 at higher ratings, where c2c4 also passes 15%;
    // g1f3 never does
    const maia = maiaOf((i) => ({
      e2e4: 0.6 - 0.02 * i,
      d2d4: 0.12 + 0.025 * i,
      c2c4: 0.02 + 0.016 * i,
      g1f3: 0.1,
    }))
    expect(chartMoves(maia, undefined)).toEqual(['d2d4', 'e2e4', 'c2c4'])
  })

  it('draws the most played move where no move is natural', () => {
    const flat = Object.fromEntries(
      ['a', 'b', 'c', 'd'].map((m, i) => [`${m}2${m}3`, 0.14 - 0.01 * i]),
    )
    expect(
      chartMoves(
        maiaOf(() => flat),
        undefined,
      ),
    ).toEqual(['a2a3'])
  })

  it('adds the most played likely blunder where there is room', () => {
    // Stockfish: e2e4 best, d2d4 -0.5, g1f3 -1, c2c4 -1.5, d1h5 -2, f2f3 -2.5
    const sf = stockfishOf('e2e4', 'd2d4', 'g1f3', 'c2c4', 'd1h5', 'f2f3')
    const policy = { e2e4: 0.8, d2d4: 0.06, d1h5: 0.07, f2f3: 0.06, c2c4: 0.01 }
    expect(
      chartMoves(
        maiaOf(() => policy),
        sf,
      ),
    ).toEqual(['e2e4', 'd1h5'])
    // under 1 in 20 everywhere: not added
    const rare = { ...policy, d1h5: 0.04, f2f3: 0.03 }
    expect(
      chartMoves(
        maiaOf(() => rare),
        sf,
      ),
    ).toEqual(['e2e4'])
    // a blunder already drawn: no second one
    const natural = { ...policy, e2e4: 0.6, f2f3: 0.25 }
    expect(
      chartMoves(
        maiaOf(() => natural),
        sf,
      ),
    ).toEqual(['e2e4', 'f2f3'])
  })

  it("draws at most six, Stockfish's best always among them", () => {
    // each of eight moves is played by 22-29% at one rating
    const maia = maiaOf((i) =>
      Object.fromEntries([
        ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((m, k) => [
          `${m}2${m}3`,
          k === i ? 0.29 - 0.01 * k : 0.05,
        ]),
        ['h2h4', 0.004],
      ]),
    )
    const moves = chartMoves(maia, stockfishOf('h2h4'))
    expect(moves).toEqual(['h2h4', 'a2a3', 'b2b3', 'c2c3', 'd2d3', 'e2e3'])
  })
})
