import { Chess, Move } from 'chess.ts'

/* =========================================================
   MAIA 3 TENSOR PIPELINE (matches Python exactly)

   Python references:
   - dataset.py::tokenize_board
   - utils.py::get_all_possible_moves

   Model expectations:
   - tokens: (64, 12*history [+ optional time dims])
   - policy: 4352 logits
       0–4095   : from*64 + to
       4096–4351: promotions (a7→a8..h7→h8, q r b n)
   ========================================================= */

/* =========================================================
   Constants
   ========================================================= */

const PIECE_ORDER = ['P', 'N', 'B', 'R', 'Q', 'K', 'p', 'n', 'b', 'r', 'q', 'k']

export const POLICY_SIZE = 4352
const PROMO_ORDER = ['q', 'r', 'b', 'n']

/* =========================================================
   Board → token tensor (64 × 12)
   EXACT mirror of Python tokenize_board()
   ========================================================= */

function tokenizeBoard(board: Chess): Float32Array {
  const tokens = new Float32Array(64 * 12)

  // Maia always sees white-to-move
  if (board.turn() === 'b') {
    board = new Chess(mirrorFEN(board.fen()))
  }

  const rows = board.fen().split(' ')[0].split('/')

  for (let rank = 0; rank < 8; rank++) {
    const row = rows[7 - rank]
    let file = 0

    for (const char of row) {
      if (isNaN(parseInt(char))) {
        const pieceIdx = PIECE_ORDER.indexOf(char)
        const sq = rank * 8 + file
        tokens[sq * 12 + pieceIdx] = 1
        file++
      } else {
        file += parseInt(char)
      }
    }
  }

  return tokens
}

/* =========================================================
   Legal move mask (size 4352)
   EXACT same mapping as utils.py::get_all_possible_moves()
   ========================================================= */

function squareToIndex(square: string): number {
  const file = square.charCodeAt(0) - 97
  const rank = parseInt(square[1], 10) - 1
  return rank * 8 + file
}

function promoPieceToIdx(p: string): number {
  return PROMO_ORDER.indexOf(p)
}

/*
   Mapping identical to Python:

   0–4095: all from→to pairs
   4096+: promotions (a7a8q..h7h8n)
*/
export function uciToPolicyIndex(uci: string): number | null {
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promo = uci.length > 4 ? uci[4] : ''

  // normal move
  if (!promo) {
    const fromIdx = squareToIndex(from)
    const toIdx = squareToIndex(to)
    return fromIdx * 64 + toIdx
  }

  // promotion (no rank assumptions — match python exactly)
  const fromFile = from.charCodeAt(0) - 97
  const toFile = to.charCodeAt(0) - 97
  const promoIdx = promoPieceToIdx(promo)

  if (promoIdx < 0) return null

  return 4096 + ((fromFile * 8 + toFile) * 4 + promoIdx)
}

export function policyIndexToUci(idx: number): string {
  if (idx < 4096) {
    const from = Math.floor(idx / 64)
    const to = idx % 64
    return indexToSquare(from) + indexToSquare(to)
  }

  const p = idx - 4096
  const pair = Math.floor(p / 4)
  const promoIdx = p % 4

  const fromFile = Math.floor(pair / 8)
  const toFile = pair % 8

  return (
    String.fromCharCode(97 + fromFile) +
    '7' +
    String.fromCharCode(97 + toFile) +
    '8' +
    PROMO_ORDER[promoIdx]
  )
}

function indexToSquare(i: number): string {
  const file = String.fromCharCode(97 + (i % 8))
  const rank = Math.floor(i / 8) + 1
  return file + rank
}

function legalMovesMask(board: Chess): Float32Array {
  const mask = new Float32Array(POLICY_SIZE)

  for (const m of board.moves({ verbose: true }) as Move[]) {
    const promo = m.promotion ?? ''
    const uci = m.from + m.to + promo
    const idx = uciToPolicyIndex(uci)
    if (idx !== null) mask[idx] = 1
  }

  return mask
}

/* =========================================================
   Public preprocess()
   ========================================================= */

export function preprocess(
  fen: string,
  history = 1,
): {
  tokens: Float32Array
  legalMask: Float32Array
  tokenDimUsed: number
  blackToMove: boolean
} {
  let board = new Chess(fen)
  const blackToMove = board.turn() === 'b'

  if (blackToMove) {
    board = new Chess(mirrorFEN(board.fen()))
  }

  const baseTokens = tokenizeBoard(board)

  // repeat history exactly like python dataset
  const tokens = new Float32Array(64 * 12 * history)
  for (let h = 0; h < history; h++) {
    tokens.set(baseTokens, h * 64 * 12)
  }

  const legalMask = legalMovesMask(board)

  return {
    tokens,
    legalMask,
    tokenDimUsed: 12 * history,
    blackToMove,
  }
}

/* =========================================================
   Mirroring utilities (unchanged from Maia2, still correct)
   ========================================================= */

export function mirrorMove(moveUci: string): string {
  const start = moveUci.slice(0, 2)
  const end = moveUci.slice(2, 4)
  const promo = moveUci.slice(4)

  return mirrorSquare(start) + mirrorSquare(end) + promo
}

function mirrorSquare(square: string): string {
  const file = square[0]
  const rank = 9 - parseInt(square[1], 10)
  return file + rank
}

function swapColorsInRank(rank: string): string {
  let out = ''
  for (const c of rank) {
    if (/[A-Z]/.test(c)) out += c.toLowerCase()
    else if (/[a-z]/.test(c)) out += c.toUpperCase()
    else out += c
  }
  return out
}

function swapCastlingRights(castling: string): string {
  if (castling === '-') return '-'
  const rights = new Set(castling.split(''))
  const swapped = new Set<string>()

  if (rights.has('K')) swapped.add('k')
  if (rights.has('Q')) swapped.add('q')
  if (rights.has('k')) swapped.add('K')
  if (rights.has('q')) swapped.add('Q')

  return [...swapped].join('') || '-'
}

function mirrorFEN(fen: string): string {
  const [pos, active, castling, ep, half, full] = fen.split(' ')
  const ranks = pos.split('/').reverse().map(swapColorsInRank)
  const mirroredPos = ranks.join('/')

  const mirroredActive = active === 'w' ? 'b' : 'w'
  const mirroredCastling = swapCastlingRights(castling)
  const mirroredEp = ep !== '-' ? mirrorSquare(ep) : '-'

  return `${mirroredPos} ${mirroredActive} ${mirroredCastling} ${mirroredEp} ${half} ${full}`
}
