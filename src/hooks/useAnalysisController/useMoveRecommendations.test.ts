import { MAIA_MODELS } from 'src/constants/common'
import { MaiaEvaluation } from 'src/types'
import { buildMovesByRating } from './useMoveRecommendations'

// Two moves whose probabilities change with the rating index.
const evaluation = (index: number): MaiaEvaluation => ({
  value: 0.5,
  policy: { e2e4: 0.3 + index * 0.01, d2d4: 0.4 - index * 0.015 },
})

const ratings = (indices: number[]) =>
  Object.fromEntries(indices.map((i) => [MAIA_MODELS[i], evaluation(i)]))

const all = MAIA_MODELS.map((_, i) => i)
const even = all.filter((i) => i % 2 === 0)

describe('buildMovesByRating', () => {
  it('draws nothing while only the selected rating is in', () => {
    expect(
      buildMovesByRating(ratings([7]), undefined, MAIA_MODELS[7]),
    ).toBeUndefined()
  })

  it('draws from every 200 points, the ratings in between interpolated', () => {
    const data = buildMovesByRating(ratings(even), undefined, MAIA_MODELS[0])
    expect(data).toHaveLength(21)
    for (const i of all) {
      // the test's probabilities are linear in the index, so the average of
      // the neighbours is the value itself
      expect(data?.[i].e2e4).toBeCloseTo((0.3 + i * 0.01) * 100)
      expect(data?.[i].d2d4).toBeCloseTo((0.4 - i * 0.015) * 100)
    }
  })

  it("uses a rating's own moves once they are in", () => {
    const maia = ratings(even)
    // a rating in between whose moves differ from its neighbours' average
    maia[MAIA_MODELS[7]] = { value: 0.5, policy: { e2e4: 0.9, d2d4: 0.05 } }
    const data = buildMovesByRating(maia, undefined, MAIA_MODELS[7])
    expect(data?.[7].e2e4).toBeCloseTo(90)
    expect(data?.[7].d2d4).toBeCloseTo(5)
    expect(data?.[9].e2e4).toBeCloseTo((0.3 + 9 * 0.01) * 100)
  })

  it('gives every rating its own values when all are in', () => {
    const data = buildMovesByRating(ratings(all), undefined, MAIA_MODELS[10])
    expect(data?.map((d) => d.rating)).toEqual(all.map((i) => 600 + i * 100))
    expect(data?.[13].d2d4).toBeCloseTo((0.4 - 13 * 0.015) * 100)
  })
})
