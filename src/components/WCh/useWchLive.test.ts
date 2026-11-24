import { sameUci } from './useWchLive'

describe("matching Lichess's last move", () => {
  it('is the same move however castling is written', () => {
    expect(sameUci('e8e7', 'e8e7')).toBe(true)
    expect(sameUci('e1h1', 'e1g1')).toBe(true)
    expect(sameUci('e8a8', 'e8c8')).toBe(true)
    expect(sameUci('e7e8q', 'e7e8q')).toBe(true)
    expect(sameUci('e2e4', 'd2d4')).toBe(false)
  })
})
