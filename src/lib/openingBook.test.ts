import { OpeningBook } from 'src/types'
import { blendWithBook } from './openingBook'

const book: OpeningBook = {
  book: 'p101',
  K: 100,
  sd: 0,
  ratings: [600, 700],
  games: [0, 300],
  moves: { d7d5: [0, 270], e7e6: [0, 30] },
}
const maia = { d7d5: 0.7, e7e6: 0.2, g7g6: 0.1 }

describe('blending Maia with the opening book', () => {
  it('weighs the book against Maia as a prior worth K games', () => {
    const p = blendWithBook(maia, book, 700)
    expect(p.d7d5).toBeCloseTo((270 + 100 * 0.7) / 400)
    expect(p.e7e6).toBeCloseTo((30 + 100 * 0.2) / 400)
    expect(p.g7g6).toBeCloseTo((100 * 0.1) / 400)
    expect(Object.values(p).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(Object.keys(p)).toEqual(['d7d5', 'e7e6', 'g7g6'])
  })

  it("keeps Maia's moves at a rating without games, or one the book lacks", () => {
    expect(blendWithBook(maia, book, 600)).toBe(maia)
    expect(blendWithBook(maia, book, 2600)).toBe(maia)
  })
})
