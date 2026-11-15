import { plyOf } from './useAnyPositionBar'

describe('plyOf', () => {
  it('counts plies from the FEN, with either side to move', () => {
    expect(
      plyOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).toBe(0)
    expect(
      plyOf('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'),
    ).toBe(1)
    expect(
      plyOf('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'),
    ).toBe(2)
    expect(plyOf('8/8/8/8/8/8/8/K6k b - - 3 12')).toBe(23)
    expect(plyOf('8/8/8/8/8/8/8/K6k w - - 3 12')).toBe(22)
  })

  it('reads a FEN without move numbers as the start', () => {
    expect(plyOf('8/8/8/8/8/8/8/K6k w - -')).toBe(0)
  })
})
