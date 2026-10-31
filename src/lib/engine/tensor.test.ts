import { Chess } from 'chess.ts'
import { preprocessMaia3 } from './tensor'

const sum = (values: Float32Array) => values.reduce((a, b) => a + b, 0)

describe('preprocessMaia3', () => {
  const fens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    '8/P7/8/8/8/8/6k1/4K3 w - - 0 1',
    'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1',
  ]

  it('marks every legal move, for either side to move', () => {
    for (const fen of fens) {
      const { boardTokens, legalMoves } = preprocessMaia3(fen)
      expect(boardTokens.length).toBe(64 * 12)
      expect(sum(legalMoves)).toBe(new Chess(fen).moves().length)
    }
  })

  it('returns the same inputs for a position asked for again', () => {
    expect(preprocessMaia3(fens[2])).toBe(preprocessMaia3(fens[2]))
  })

  it('computes the same inputs once a position has left the cache', () => {
    const first = preprocessMaia3(fens[3])
    const tokens = Array.from(first.boardTokens)
    const legal = Array.from(first.legalMoves)
    // push it out with other positions
    const chess = new Chess()
    for (const move of [
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'Bb5',
      'a6',
      'Ba4',
      'Nf6',
      'O-O',
      'Be7',
    ]) {
      chess.move(move)
      preprocessMaia3(chess.fen())
    }
    const again = preprocessMaia3(fens[3])
    expect(again).not.toBe(first)
    expect(Array.from(again.boardTokens)).toEqual(tokens)
    expect(Array.from(again.legalMoves)).toEqual(legal)
  })
})
