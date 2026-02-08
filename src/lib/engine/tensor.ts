
import { Chess, Move } from 'chess.ts'

/**
 * Maia 3 tensor utilities.
 *
 * Matches the Maia3 Python dataset/model expectations at a practical inference level:
 * - Always feed the model a white-to-move / white-perspective view:
 *   if the original FEN is black to move, we mirror the position first.
 * - Tokens are per-square (64 tokens) with 12 piece channels per position snapshot.
 * - Policy indexing is the structured 4352 space used by the Maia3 model code you shared:
 *     0..4095  : from*64 + to
 *     4096..4351: promotions (from_file, to_file, promo_piece) in the order q,r,b,n
 *
 * Notes:
 * - For web integration, we default to history=1 and no time features.
 * - The API is intentionally similar to the old tensor.ts: `preprocess(...)` returns
 *   tensors + a legal move mask, and `mirrorMove` is exported for output un-mirroring.
 */

const DEFAULT_HISTORY = 1

function preprocess(
  fen: string,
  eloSelf: number,
  eloOppo: number,
  history: number = DEFAULT_HISTORY,
): {
  tokens: Float32Array
  tokenDim: number
  legalMask: Uint8Array
  blackToMove: boolean
  eloSelfValue: number
  eloOppoValue: number
} {
  const side = fen.split(' ')[1]
  const blackToMove = side === 'b'

  const fenForModel = blackToMove ? mirrorFEN(fen) : fen
  const board = new Chess(fenForModel)

  // Base snapshot tokens: (64,12)
  const snap = tokenizeFenToSquareTokens(fenForModel) // length 64*12

  const baseDim = 12
  const tokenDim = baseDim * Math.max(1, Math.trunc(history))

  // For now we emulate history by repeating the current snapshot.
  // This keeps TS/web simple and matches the model input shape when exported with history>1.
  const tokens = new Float32Array(64 * tokenDim)
  if (tokenDim === baseDim) {
    tokens.set(snap)
  } else {
    const reps = tokenDim / baseDim
    for (let r = 0; r < reps; r++) {
      for (let sq = 0; sq < 64; sq++) {
        const srcOff = sq * baseDim
        const dstOff = sq * tokenDim + r * baseDim
        for (let c = 0; c < baseDim; c++) {
          tokens[dstOff + c] = snap[srcOff + c]
        }
      }
    }
  }

  // Legal move mask in structured 4352 indexing (white-perspective).
  const legalMask = new Uint8Array(4352)
  const legalMoves = board.moves({ verbose: true }) as Move[]
  for (const m of legalMoves) {
    const promo = m.promotion ? m.promotion : ''
    const uci = `${m.from}${m.to}${promo}`
    const idx = uciToPolicyIndex(uci)
    if (idx !== null) legalMask[idx] = 1
  }

  return {
    tokens,
    tokenDim,
    legalMask,
    blackToMove,
    eloSelfValue: eloSelf,
    eloOppoValue: eloOppo,
  }
}

/**
 * Converts a FEN (assumed white-to-move view already if needed) into Maia3 square tokens.
 * Output: Float32Array length 64*12, indexed by a1=0 .. h8=63, each square has 12 channels.
 *
 * Channels:
 *  0..5  : white P,N,B,R,Q,K
 *  6..11 : black p,n,b,r,q,k
 */
function tokenizeFenToSquareTokens(fen: string): Float32Array {
  const [placement] = fen.split(' ')
  const rows = placement.split('/')

  const out = new Float32Array(64 * 12)

  // FEN ranks go 8->1; indices are a1=0 ... h8=63.
  for (let rankFrom8 = 0; rankFrom8 < 8; rankFrom8++) {
    const row = rows[rankFrom8]
    let file = 0
    const rank = 8 - rankFrom8

    for (const ch of row) {
      const n = parseInt(ch, 10)
      if (!Number.isNaN(n)) {
        file += n
        continue
      }

      const sqIdx = (rank - 1) * 8 + file
      const channel = pieceCharToChannel(ch)
      if (channel !== null) {
        out[sqIdx * 12 + channel] = 1.0
      }
      file += 1
    }
  }

  return out
}

function pieceCharToChannel(ch: string): number | null {
  switch (ch) {
    case 'P':
      return 0
    case 'N':
      return 1
    case 'B':
      return 2
    case 'R':
      return 3
    case 'Q':
      return 4
    case 'K':
      return 5
    case 'p':
      return 6
    case 'n':
      return 7
    case 'b':
      return 8
    case 'r':
      return 9
    case 'q':
      return 10
    case 'k':
      return 11
    default:
      return null
  }
}

/* =========================
   4352 policy indexing
   ========================= */

function algebraicToIndex(sq: string): number | null {
  if (sq.length !== 2) return null
  const file = sq.charCodeAt(0) - 'a'.charCodeAt(0)
  const rank = parseInt(sq[1], 10)
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null
  return (rank - 1) * 8 + file
}

function indexToSquare(idx: number): string {
  const file = idx % 8
  const rank = Math.floor(idx / 8) + 1
  return String.fromCharCode('a'.charCodeAt(0) + file) + String(rank)
}

function promoPieceToIdx(p: string): number | null {
  // Maia3 models.py order: q=0, r=1, b=2, n=3
  if (p === 'q') return 0
  if (p === 'r') return 1
  if (p === 'b') return 2
  if (p === 'n') return 3
  return null
}

function uciToPolicyIndex(uci: string): number | null {
  if (uci.length < 4) return null
  const from = uci.substring(0, 2)
  const to = uci.substring(2, 4)
  const promo = uci.length > 4 ? uci.substring(4) : ''

  const fromIdx = algebraicToIndex(from)
  const toIdx = algebraicToIndex(to)
  if (fromIdx === null || toIdx === null) return null

  if (!promo) {
    return fromIdx * 64 + toIdx
  }

  // Promotion indexing matches models.py:
  // idx = 4096 + ((from_file*8 + to_file)*4 + promoIdx)
  // and is defined for white-perspective promotions 7->8.
  const fromRank = parseInt(from[1], 10)
  const toRank = parseInt(to[1], 10)
  if (fromRank !== 7 || toRank !== 8) return null

  const fromFile = from.charCodeAt(0) - 'a'.charCodeAt(0)
  const toFile = to.charCodeAt(0) - 'a'.charCodeAt(0)
  const promoIdx = promoPieceToIdx(promo)
  if (promoIdx === null) return null

  return 4096 + ((fromFile * 8 + toFile) * 4 + promoIdx)
}

function policyIndexToUci(idx: number): string {
  if (idx < 4096) {
    const from = Math.floor(idx / 64)
    const to = idx % 64
    return indexToSquare(from) + indexToSquare(to)
  }

  const j = idx - 4096
  const fromFile = Math.floor(j / (8 * 4))
  const rem = j % (8 * 4)
  const toFile = Math.floor(rem / 4)
  const promoIdx = rem % 4

  const fromSq = String.fromCharCode('a'.charCodeAt(0) + fromFile) + '7'
  const toSq = String.fromCharCode('a'.charCodeAt(0) + toFile) + '8'
  const promo = ['q', 'r', 'b', 'n'][promoIdx]!
  return fromSq + toSq + promo
}

/* =========================
   Mirroring utilities
   ========================= */

/**
 * Mirrors a chess move in UCI notation top-to-bottom (rank flip).
 * This matches how the frontend previously un-mirrored model moves.
 */
function mirrorMove(moveUci: string): string {
  const isPromotion = moveUci.length > 4

  const startSquare = moveUci.substring(0, 2)
  const endSquare = moveUci.substring(2, 4)
  const promotionPiece = isPromotion ? moveUci.substring(4) : ''

  return mirrorSquare(startSquare) + mirrorSquare(endSquare) + promotionPiece
}

function mirrorSquare(square: string): string {
  const file = square.charAt(0)
  const rank = (9 - parseInt(square.charAt(1))).toString()
  return file + rank
}

function swapColorsInRank(rank: string): string {
  let swappedRank = ''
  for (const char of rank) {
    if (/[A-Z]/.test(char)) swappedRank += char.toLowerCase()
    else if (/[a-z]/.test(char)) swappedRank += char.toUpperCase()
    else swappedRank += char
  }
  return swappedRank
}

function swapCastlingRights(castling: string): string {
  if (castling === '-') return '-'

  const rights = new Set(castling.split(''))
  const swapped = new Set<string>()

  if (rights.has('K')) swapped.add('k')
  if (rights.has('Q')) swapped.add('q')
  if (rights.has('k')) swapped.add('K')
  if (rights.has('q')) swapped.add('Q')

  let output = ''
  if (swapped.has('K')) output += 'K'
  if (swapped.has('Q')) output += 'Q'
  if (swapped.has('k')) output += 'k'
  if (swapped.has('q')) output += 'q'

  return output === '' ? '-' : output
}

/**
 * Mirrors a FEN string vertically while swapping colors.
 * This is the same mirroring approach used in your old TS tensor.ts and is the
 * frontend analogue of python-chess's board.mirror() for our purposes.
 */
function mirrorFEN(fen: string): string {
  const [position, activeColor, castling, enPassant, halfmove, fullmove] =
    fen.split(' ')

  const ranks = position.split('/')
  const mirroredRanks = ranks.slice().reverse().map((r) => swapColorsInRank(r))
  const mirroredPosition = mirroredRanks.join('/')

  const mirroredActiveColor = activeColor === 'w' ? 'b' : 'w'
  const mirroredCastling = swapCastlingRights(castling)
  const mirroredEnPassant = enPassant !== '-' ? mirrorSquare(enPassant) : '-'

  return `${mirroredPosition} ${mirroredActiveColor} ${mirroredCastling} ${mirroredEnPassant} ${halfmove} ${fullmove}`
}

export {
  preprocess,
  tokenizeFenToSquareTokens,
  uciToPolicyIndex,
  policyIndexToUci,
  mirrorMove,
}
