import { checkStartPosition } from './startPosition'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const error = (fen: string, allowFinished = false) => {
  const check = checkStartPosition(fen, { allowFinished })
  return check.ok ? undefined : check.error
}

describe('checkStartPosition', () => {
  it('accepts the usual start and ordinary positions', () => {
    expect(checkStartPosition(START)).toEqual({ ok: true, fen: START })
    const italian =
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
    expect(checkStartPosition(`  ${italian}  `)).toEqual({
      ok: true,
      fen: italian,
    })
  })

  it('refuses a malformed FEN', () => {
    expect(error('not a fen')).toMatch(/isn't a valid FEN/)
  })

  it('refuses a missing or extra king', () => {
    expect(error('8/8/8/8/8/8/8/4K3 w - - 0 1')).toBe('Black has no king.')
    expect(error('4k3/8/8/8/8/8/8/8 b - - 0 1')).toBe('White has no king.')
    expect(error('3kk3/8/8/8/8/8/8/4K3 w - - 0 1')).toBe(
      'Black has more than one king.',
    )
  })

  it('refuses pawns on the back rank and too many pieces', () => {
    expect(error('P3k3/8/8/8/8/8/8/4K3 w - - 0 1')).toMatch(/pawn/)
    expect(error('4k3/8/8/8/8/PPPPPPPP/P7/4K3 w - - 0 1')).toBe(
      'White has more than 8 pawns.',
    )
    expect(error('4k3/8/8/8/QQQQQQQQ/8/PPPPPPPP/4K3 w - - 0 1')).toBe(
      'White has more than 16 pieces.',
    )
  })

  it('refuses the side not to move being in check', () => {
    // White to move, with Black's king attacked by the rook on e1.
    expect(error('4k3/8/8/8/8/8/8/K3R3 w - - 0 1')).toBe(
      "Black is in check, but it's White's turn.",
    )
  })

  it("drops castling rights and an en passant square the board can't have", () => {
    expect(checkStartPosition('4k3/8/8/8/8/8/8/4K2R w KQkq - 0 1')).toEqual({
      ok: true,
      fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
    })
    // No black pawn on e5 that could have just come from e7.
    expect(checkStartPosition('4k3/8/8/8/8/8/8/R3K2R w KQ e6 0 1')).toEqual({
      ok: true,
      fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    })
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    expect(checkStartPosition(afterE4)).toEqual({ ok: true, fen: afterE4 })
  })

  it('refuses a finished position for a game, not for analysis', () => {
    const mate = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
    expect(error(mate)).toBe('That position is already checkmate.')
    expect(error(mate, true)).toBeUndefined()
    expect(error('k7/8/1Q6/8/8/8/8/2K5 b - - 0 1')).toBe(
      'That position is already stalemate.',
    )
    expect(error('4k3/8/8/8/8/8/8/4K3 w - - 0 1')).toMatch(/enough material/)
    expect(error('4k3/8/8/8/8/8/8/4K3 w - - 0 1', true)).toBeUndefined()
  })
})
