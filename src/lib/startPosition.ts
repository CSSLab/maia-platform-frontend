import { Chess } from 'chess.ts'

// chess.ts's validateFen only checks that a FEN is well formed: it accepts a
// board with no king, two kings, a pawn on the back rank, or the side not to
// move in check, and the engines and the game then break on it. This also
// checks that the position could come up in a game.

export type StartPositionCheck =
  | { ok: true; fen: string }
  | { ok: false; error: string }

interface Options {
  // Analysis can look at a finished position (checkmate, stalemate, bare
  // kings); a game cannot start from one.
  allowFinished?: boolean
}

const COLOR_NAME = { w: 'White', b: 'Black' } as const

// Castling right → the king's and rook's home squares it needs.
const CASTLING = {
  K: { color: 'w', king: 'e1', rook: 'h1' },
  Q: { color: 'w', king: 'e1', rook: 'a1' },
  k: { color: 'b', king: 'e8', rook: 'h8' },
  q: { color: 'b', king: 'e8', rook: 'a8' },
} as const

export const checkStartPosition = (
  input: string,
  options: Options = {},
): StartPositionCheck => {
  try {
    return check(input, options)
  } catch {
    // chess.ts refuses to load some FENs its own validateFen passes.
    return { ok: false, error: "That position can't be set up on a board." }
  }
}

const check = (
  input: string,
  { allowFinished = false }: Options,
): StartPositionCheck => {
  const trimmed = input.trim().replace(/\s+/g, ' ')
  const validation = new Chess().validateFen(trimmed)
  if (!validation.valid) {
    return { ok: false, error: `That isn't a valid FEN: ${validation.error}` }
  }

  // Counted from the FEN's own text: chess.ts won't load a second king.
  const [board, turn, castling, enPassant, ...counters] = trimmed.split(' ')
  const counts = {
    w: { k: 0, p: 0, all: 0 },
    b: { k: 0, p: 0, all: 0 },
  }
  let pawnOnBackRank = false
  board.split('/').forEach((rank, rankIndex) => {
    for (const symbol of rank) {
      if (/\d/.test(symbol)) continue
      const count = counts[symbol === symbol.toUpperCase() ? 'w' : 'b']
      const type = symbol.toLowerCase()
      count.all++
      if (type === 'k') count.k++
      if (type === 'p') {
        count.p++
        if (rankIndex === 0 || rankIndex === 7) pawnOnBackRank = true
      }
    }
  })

  for (const color of ['w', 'b'] as const) {
    const name = COLOR_NAME[color]
    const count = counts[color]
    if (count.k === 0) return { ok: false, error: `${name} has no king.` }
    if (count.k > 1) {
      return { ok: false, error: `${name} has more than one king.` }
    }
    if (count.p > 8) {
      return { ok: false, error: `${name} has more than 8 pawns.` }
    }
    if (count.all > 16) {
      return { ok: false, error: `${name} has more than 16 pieces.` }
    }
  }
  if (pawnOnBackRank) {
    return { ok: false, error: 'A pawn is on the first or last rank.' }
  }

  const chess = new Chess(trimmed)
  const waiting = turn === 'w' ? 'b' : 'w'

  // The side that just moved can't have left its king in check.
  const flipped = [board, waiting, '-', '-', ...counters].join(' ')
  if (new Chess(flipped).inCheck()) {
    return {
      ok: false,
      error: `${COLOR_NAME[waiting]} is in check, but it's ${COLOR_NAME[turn as 'w' | 'b']}'s turn.`,
    }
  }

  // Castling rights the board can't have (king or rook off its home square)
  // are dropped rather than refused: FENs from board editors often carry
  // "KQkq" whatever the position.
  const keptCastling =
    castling === '-'
      ? ''
      : castling
          .split('')
          .filter((right) => {
            const need = CASTLING[right as keyof typeof CASTLING]
            if (!need) return false
            const king = chess.get(need.king)
            const rook = chess.get(need.rook)
            return (
              king?.type === 'k' &&
              king.color === need.color &&
              rook?.type === 'r' &&
              rook.color === need.color
            )
          })
          .join('')

  // So is an en passant square that no pawn could have just skipped.
  let keptEnPassant = '-'
  if (enPassant !== '-') {
    const file = enPassant[0]
    const rank = enPassant[1]
    const [pawnRank, fromRank] = turn === 'w' ? ['5', '7'] : ['4', '2']
    const pawn = chess.get(file + pawnRank)
    if (
      rank === (turn === 'w' ? '6' : '3') &&
      pawn?.type === 'p' &&
      pawn.color === waiting &&
      !chess.get(enPassant) &&
      !chess.get(file + fromRank)
    ) {
      keptEnPassant = enPassant
    }
  }

  const fen = [board, turn, keptCastling || '-', keptEnPassant, ...counters]
    .join(' ')
    .trim()

  if (!allowFinished) {
    const position = new Chess(fen)
    if (position.inCheckmate()) {
      return { ok: false, error: 'That position is already checkmate.' }
    }
    if (position.inStalemate()) {
      return { ok: false, error: 'That position is already stalemate.' }
    }
    if (position.insufficientMaterial()) {
      return {
        ok: false,
        error: 'Neither side has enough material to checkmate.',
      }
    }
  }

  return { ok: true, fen }
}
