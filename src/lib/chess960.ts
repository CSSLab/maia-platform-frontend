/**
 * Chess960 (Fischer Random) starting positions, offered in play vs Maia
 * *without castling*: neither chess.ts nor the backend's board knows
 * Chess960's castling rules (the king and rook can start anywhere, and end on
 * the usual squares), so these games start with castling rights "-". The rest
 * of the game is ordinary chess, so they go through the same path as any
 * custom starting position (`startFen`), and are unrated like those.
 *
 * Positions are numbered 0-959 as in the standard (Scharnagl) scheme, in
 * which 518 is the usual RNBQKBNR. A number identifies a position in a few
 * digits, so tests can check that every one of the 960 is reachable.
 */

export const CHESS960_POSITIONS = 960

// The knights' squares among the five empty ones left once the bishops and
// the queen are placed, for each of the ten ways (Scharnagl's table).
const KNIGHT_PLACEMENTS: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 3],
  [2, 4],
  [3, 4],
]

/**
 * White's back rank (a to h, uppercase letters) for position `index`. The
 * bishops go on opposite-coloured squares and the king between the rooks,
 * which this numbering ensures: after the bishops, queen and knights, the
 * three squares left take rook, king and rook in that order.
 */
export const chess960BackRank = (index: number): string => {
  if (!Number.isInteger(index) || index < 0 || index >= CHESS960_POSITIONS) {
    throw new RangeError(`No Chess960 position ${index}`)
  }
  const rank: (string | null)[] = Array(8).fill(null)
  let n = index

  // b1, d1, f1 and h1 (files 1, 3, 5, 7) are light squares.
  rank[(n % 4) * 2 + 1] = 'B'
  n = Math.floor(n / 4)
  // a1, c1, e1 and g1 are dark.
  rank[(n % 4) * 2] = 'B'
  n = Math.floor(n / 4)

  const emptySquares = () =>
    rank.flatMap((piece, file) => (piece === null ? [file] : []))

  rank[emptySquares()[n % 6]] = 'Q'
  n = Math.floor(n / 6)

  const empty = emptySquares()
  for (const i of KNIGHT_PLACEMENTS[n]) rank[empty[i]] = 'N'

  const [queenside, middle, kingside] = emptySquares()
  rank[queenside] = 'R'
  rank[middle] = 'K'
  rank[kingside] = 'R'

  return rank.join('')
}

/**
 * The FEN of Chess960 position `index`: Black's back rank mirrors White's,
 * White to move, and no castling (see above).
 */
export const chess960Fen = (index: number): string => {
  const rank = chess960BackRank(index)
  return `${rank.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${rank} w - - 0 1`
}

/** A random position's number (`random` as Math.random, for tests). */
export const randomChess960Index = (random: () => number = Math.random) =>
  Math.min(Math.floor(random() * CHESS960_POSITIONS), CHESS960_POSITIONS - 1)

let indexByBackRank: Map<string, number> | undefined

/**
 * The position's number if `fen` is a Chess960 starting position without
 * castling (as chess960Fen makes, e.g. a game's settings passed back to the
 * setup dialog by Play again), or undefined for anything else.
 */
export const chess960Index = (fen: string | undefined): number | undefined => {
  if (!fen) return undefined
  const [board, turn, castling, enPassant] = fen.trim().split(/\s+/)
  if (turn !== 'w' || castling !== '-' || enPassant !== '-') return undefined
  const rows = board?.split('/') ?? []
  if (rows.length !== 8) return undefined
  const middle = rows.slice(1, 7).join('/')
  if (middle !== 'pppppppp/8/8/8/8/PPPPPPPP') return undefined
  if (rows[0] !== rows[7].toLowerCase()) return undefined

  if (!indexByBackRank) {
    indexByBackRank = new Map()
    for (let i = 0; i < CHESS960_POSITIONS; i++) {
      indexByBackRank.set(chess960BackRank(i), i)
    }
  }
  return indexByBackRank.get(rows[7])
}
