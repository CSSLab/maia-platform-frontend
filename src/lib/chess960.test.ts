import { Chess } from 'chess.ts'
import {
  CHESS960_POSITIONS,
  chess960BackRank,
  chess960Fen,
  chess960Index,
  randomChess960Index,
} from './chess960'

const allIndices = Array.from({ length: CHESS960_POSITIONS }, (_, i) => i)

describe('chess960BackRank', () => {
  it('numbers positions as in the standard scheme', () => {
    expect(chess960BackRank(518)).toBe('RNBQKBNR')
    expect(chess960BackRank(0)).toBe('BBQNNRKR')
    expect(chess960BackRank(959)).toBe('RKRNNQBB')
  })

  it('gives 960 different positions, each with the right pieces', () => {
    const ranks = allIndices.map(chess960BackRank)
    expect(new Set(ranks).size).toBe(CHESS960_POSITIONS)
    for (const rank of ranks) {
      expect(rank.split('').sort().join('')).toBe('BBKNNQRR')
    }
  })

  it('puts the bishops on opposite colours and the king between the rooks', () => {
    for (const rank of allIndices.map(chess960BackRank)) {
      const bishops = [...rank.matchAll(/B/g)].map((m) => m.index as number)
      expect(bishops[0] % 2).not.toBe(bishops[1] % 2)
      const rooks = [...rank.matchAll(/R/g)].map((m) => m.index as number)
      const king = rank.indexOf('K')
      expect(rooks[0]).toBeLessThan(king)
      expect(king).toBeLessThan(rooks[1])
    }
  })

  it('rejects numbers outside 0-959', () => {
    expect(() => chess960BackRank(-1)).toThrow(RangeError)
    expect(() => chess960BackRank(960)).toThrow(RangeError)
    expect(() => chess960BackRank(1.5)).toThrow(RangeError)
  })
})

describe('chess960Fen', () => {
  it('is a valid FEN with no castling, Black mirroring White', () => {
    for (const i of allIndices) {
      const fen = chess960Fen(i)
      expect(new Chess().validateFen(fen).valid).toBe(true)
      const [board, turn, castling, enPassant] = fen.split(' ')
      expect(turn).toBe('w')
      expect(castling).toBe('-')
      expect(enPassant).toBe('-')
      const rows = board.split('/')
      expect(rows[0]).toBe(rows[7].toLowerCase())
      expect(rows[7]).toBe(chess960BackRank(i))
      expect(rows.slice(1, 7)).toEqual([
        'pppppppp',
        '8',
        '8',
        '8',
        '8',
        'PPPPPPPP',
      ])
    }
  })

  it('loads in chess.ts without castling moves', () => {
    const chess = new Chess(chess960Fen(518))
    expect(chess.moves().some((move) => move.startsWith('O-O'))).toBe(false)
    expect(chess.moves()).toHaveLength(20)
  })
})

describe('chess960Index', () => {
  it('finds the number of every position chess960Fen makes', () => {
    for (const i of allIndices) expect(chess960Index(chess960Fen(i))).toBe(i)
  })

  it('is undefined for other positions', () => {
    expect(chess960Index(undefined)).toBeUndefined()
    expect(chess960Index('')).toBeUndefined()
    // The usual start, with castling.
    expect(
      chess960Index('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).toBeUndefined()
    // After 1. e4.
    expect(
      chess960Index('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b - e3 0 1'),
    ).toBeUndefined()
    // Not mirrored.
    expect(
      chess960Index('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RKRNNQBB w - - 0 1'),
    ).toBeUndefined()
    // Bishops on the same colour.
    expect(
      chess960Index('brbkqnnr/pppppppp/8/8/8/8/PPPPPPPP/BRBKQNNR w - - 0 1'),
    ).toBeUndefined()
  })
})

describe('randomChess960Index', () => {
  it('maps the random number onto 0-959', () => {
    expect(randomChess960Index(() => 0)).toBe(0)
    expect(randomChess960Index(() => 0.5)).toBe(480)
    expect(randomChess960Index(() => 0.9999999)).toBe(959)
    const i = randomChess960Index()
    expect(Number.isInteger(i) && i >= 0 && i < 960).toBe(true)
  })
})
