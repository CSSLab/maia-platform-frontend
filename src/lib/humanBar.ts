import { Chess } from 'chess.ts'
import { TYPICAL_DANGER_BY_LEVEL } from 'src/constants/typicalDanger'
import { HumanBarGameInfo } from 'src/types/humanBar'

const STANDARD_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** PGN tag pairs, e.g. { White: 'name', WhiteElo: '1850', ... }. */
export const parsePgnHeaders = (pgn: string): Record<string, string> => {
  const headers: Record<string, string> = {}
  const re = /^\s*\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(pgn)) !== null) {
    headers[match[1]] = match[2].replace(/\\(.)/g, '$1')
  }
  return headers
}

const CLOCK_RE = /\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/

const parseClock = (comment: string): number | null => {
  const match = comment.match(CLOCK_RE)
  if (!match) return null
  return (
    Number.parseInt(match[1], 10) * 3600 +
    Number.parseInt(match[2], 10) * 60 +
    Number.parseFloat(match[3])
  )
}

/**
 * The main line of a single-game PGN: each move's SAN with the clock from
 * its [%clk h:mm:ss] comment (seconds left for the mover after the move), or
 * null where a move has no clock. Variations are skipped.
 */
export const parsePgnMainline = (
  pgn: string,
): { san: string; clock: number | null }[] => {
  const movetext = pgn
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*\[/.test(line))
    .join('\n')

  const moves: { san: string; clock: number | null }[] = []
  let depth = 0
  let i = 0
  while (i < movetext.length) {
    const ch = movetext[i]
    if (ch === '{') {
      const end = movetext.indexOf('}', i + 1)
      const comment = movetext.slice(i + 1, end === -1 ? undefined : end)
      if (depth === 0 && moves.length > 0) {
        const clock = parseClock(comment)
        if (clock !== null && moves[moves.length - 1].clock === null) {
          moves[moves.length - 1].clock = clock
        }
      }
      i = end === -1 ? movetext.length : end + 1
    } else if (ch === ';') {
      const end = movetext.indexOf('\n', i + 1)
      i = end === -1 ? movetext.length : end + 1
    } else if (ch === '(') {
      depth++
      i++
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1)
      i++
    } else if (/\s/.test(ch)) {
      i++
    } else {
      let j = i
      while (j < movetext.length && !/[\s{}();]/.test(movetext[j])) j++
      const token = movetext.slice(i, j).replace(/^\d+\.+/, '')
      i = j
      if (
        depth > 0 ||
        !token ||
        /^\$\d+$/.test(token) ||
        /^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)
      ) {
        continue
      }
      moves.push({ san: token, clock: null })
    }
  }
  return moves
}

const parseRating = (value: string | undefined): number | null => {
  if (!value) return null
  const rating = Number.parseInt(value, 10)
  return Number.isFinite(rating) && rating > 0 ? rating : null
}

const parseStartMs = (
  date: string | undefined,
  time: string | undefined,
): number | null => {
  const d = date?.match(/^(\d{4})\.(\d{2})\.(\d{2})$/)
  const t = time?.match(/^(\d{2}):(\d{2}):(\d{2})$/)
  if (!d || !t) return null
  return Date.UTC(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2]),
    Number(t[3]),
  )
}

export type HumanBarSetup =
  | { ok: true; game: HumanBarGameInfo; clocks: number[] }
  | { ok: false; reason: string }

/**
 * Checks that a Lichess game can get human bars and collects what the
 * server needs from its PGN: both ratings, the time control, the start time
 * and every move's clock. `moveCount` is the number of main-line moves in
 * the game tree, which must match the PGN.
 */
export const buildHumanBarSetup = (
  pgn: string | undefined,
  gameId: string,
  moveCount: number,
  rootFen: string,
  fallbackRatings: { white?: number; black?: number } = {},
): HumanBarSetup => {
  if (!pgn) {
    return { ok: false, reason: 'The game record (PGN) is not available.' }
  }
  const headers = parsePgnHeaders(pgn)

  const variant = headers.Variant
  if (
    (variant && variant.toLowerCase() !== 'standard') ||
    rootFen !== STANDARD_START_FEN
  ) {
    return {
      ok: false,
      reason: 'Human bars are only available for standard chess games.',
    }
  }

  const whiteElo = parseRating(headers.WhiteElo) ?? fallbackRatings.white
  const blackElo = parseRating(headers.BlackElo) ?? fallbackRatings.black
  if (!whiteElo || !blackElo) {
    return {
      ok: false,
      reason: 'This game has no ratings for both players.',
    }
  }

  const timeControl = headers.TimeControl
  if (!timeControl || !/^\d+\+\d+$/.test(timeControl)) {
    return {
      ok: false,
      reason: 'This game has no clock (no time control).',
    }
  }

  const mainline = parsePgnMainline(pgn)
  if (moveCount === 0 || mainline.length === 0) {
    return { ok: false, reason: 'This game has no moves yet.' }
  }
  if (mainline.length !== moveCount) {
    return {
      ok: false,
      reason: `The game record has ${mainline.length} moves but the board has ${moveCount}.`,
    }
  }
  const clocks = mainline.map((move) => move.clock)
  if (clocks.some((clock) => clock === null)) {
    return {
      ok: false,
      reason: 'This game has no clock times for its moves.',
    }
  }

  return {
    ok: true,
    clocks: clocks as number[],
    game: {
      white: headers.White ?? 'White',
      black: headers.Black ?? 'Black',
      white_elo: whiteElo,
      black_elo: blackElo,
      time_control: timeControl,
      event: headers.Event ?? '',
      start_ms: parseStartMs(headers.UTCDate, headers.UTCTime),
      site: headers.Site ?? `https://lichess.org/${gameId}`,
    },
  }
}

/** Base64 of a float32 array, little-endian regardless of the platform. */
export const float32ToBase64LE = (values: Float32Array): string => {
  const bytes = new Uint8Array(values.length * 4)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < values.length; i++) {
    view.setFloat32(i * 4, values[i], true)
  }
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * The moves the bars look one move ahead through (practical LOG §90, P91):
 * Maia's most likely moves at the players' ratings until they cover 95% of
 * its probability, at most 12. The bar shown is half the position's own bar
 * and half the Maia-weighted average of the bars after these moves.
 */
export const LIKELY_COVER = 0.95
export const LIKELY_MAX = 12

export const likelyMoves = (
  policy: Record<string, number>,
): { uci: string; prob: number }[] => {
  const sorted = Object.entries(policy)
    .filter(([, prob]) => prob > 0)
    .sort((a, b) => b[1] - a[1])
  const out: { uci: string; prob: number }[] = []
  let cover = 0
  for (const [uci, prob] of sorted) {
    if (cover >= LIKELY_COVER || out.length >= LIKELY_MAX) break
    out.push({ uci, prob })
    cover += prob
  }
  return out
}

/**
 * A move's mark from its two costs, in points of win chance for the mover
 * (practical LOG §91, §93):
 * - objective: the site's win-rate loss against Stockfish's best move;
 * - practical: these players' chance after the move (the bar server's
 *   `after`, fair clocks) against the best practical try among the moves
 *   priced, and against Stockfish's best move.
 * The objective tiers are the usual ones (as Lichess's): under 5 none, 5-10
 * ?! (an inaccuracy), 10-15 ?, over 15 ??. !? is the one mark from the
 * human side: a move 2-15 behind Stockfish's best (up to a mistake, never a
 * blunder) that is these players' best try (within 1 point) and 2+ points
 * better for them than Stockfish's move.
 */
export type MoveMark = '!?' | '?!' | '?' | '??'

export const moveMark = (
  objective: number,
  practical?: {
    /** These players' chance after the move (0-100, the mover's). */
    move: number
    /** After the best practical try among the moves priced. */
    top: number
    /** After Stockfish's best move, if priced. */
    best?: number
  },
): MoveMark | null => {
  if (
    objective >= 2 &&
    objective < 15 &&
    practical &&
    practical.best !== undefined &&
    practical.top - practical.move <= 1 &&
    practical.best - practical.move <= -2
  ) {
    return '!?'
  }
  if (objective < 5) return null
  if (objective < 10) return '?!'
  return objective < 15 ? '?' : '??'
}

/** The position after a move given in UCI (e.g. "e7e8q"), or null if it is not legal there. */
export const fenAfterMove = (fen: string, uci: string): string | null => {
  const board = new Chess(fen)
  const move = board.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(uci.length > 4 ? { promotion: uci[4] } : {}),
  } as Parameters<Chess['move']>[0])
  return move ? board.fen() : null
}

/**
 * The eval of the position after a move, for its side to move, from the
 * site's search of the position before it: `cpWhite` is that move's line
 * (White's side, mates as +-10000) and `mateIn` its mate distance.
 */
export const evalAfterMoveFromLine = (
  cpWhite: number,
  mateIn: number | undefined,
  whiteToMoveAfter: boolean,
): number => {
  const sideToMove = whiteToMoveAfter ? cpWhite : -cpWhite
  if (Math.abs(cpWhite) >= 10000) {
    return Math.sign(sideToMove) * (10000 - Math.max(1, Math.abs(mateIn ?? 1)))
  }
  return Math.round(sideToMove)
}

/**
 * A finished position's eval for the side to move, or null if play goes on:
 * checkmated -10000 (mate in 0), stalemate or insufficient material 0. The
 * server gives such a position its exact result, and no search reaches a
 * depth there, so the bars should not wait for one.
 */
export const gameOverEval = (fen: string): number | null => {
  const board = new Chess(fen)
  if (board.inCheckmate()) return -10000
  if (board.inStalemate() || board.insufficientMaterial()) return 0
  return null
}

/** Lichess's winning-chances curve: expected score in [0, 1] for `cp`. */
export const lichessExpectedScore = (cp: number): number => {
  const clamped = Math.max(-1000, Math.min(1000, cp))
  return 1 / (1 + Math.exp(-0.00368208 * clamped))
}

/**
 * The order in which the browser evaluates a game's positions while the
 * user sits on `current`: that position, the next `lookahead` (so stepping
 * forward finds them ready), the one before, then the rest of the game
 * outward from `current` (for the game chart).
 */
export const evaluationOrder = (
  current: number,
  total: number,
  lookahead: number,
): number[] => {
  const order: number[] = []
  const seen = new Set<number>()
  const push = (p: number) => {
    if (p >= 0 && p < total && !seen.has(p)) {
      seen.add(p)
      order.push(p)
    }
  }
  push(current)
  for (let k = 1; k <= lookahead; k++) push(current + k)
  push(current - 1)
  for (let d = 1; d < total; d++) {
    push(current + d)
    push(current - d)
  }
  return order
}

/** Lichess's class for a "base+increment" time control (estimated duration). */
const timeClassOf = (timeControl: string | undefined) => {
  const [base, inc] = String(timeControl || '180+0')
    .split('+')
    .map(Number)
  const est = (base || 0) + 40 * (inc || 0)
  return est < 180 ? 'bullet' : est < 480 ? 'blitz' : 'rapid'
}

/**
 * How often a player of this rating and time control blunders within their
 * next 5 moves (interpolated between rating bands).
 */
export const usualBlunderRiskIn5 = (
  rating: number,
  timeControl: string | undefined,
): number => {
  const rows = TYPICAL_DANGER_BY_LEVEL[timeClassOf(timeControl)]
  let i = rows.findIndex((row) => row[0] >= rating)
  if (i <= 0) i = i === 0 ? 1 : rows.length - 1
  const a = rows[i - 1]
  const b = rows[i]
  const f = Math.max(0, Math.min(1, (rating - a[0]) / (b[0] - a[0])))
  return a[2] + f * (b[2] - a[2])
}

/**
 * How often players win, draw and lose from an eval (practical LOG §86,
 * eval_curve.py: 1.2M positions of everyday Lichess games; White's share is
 * typically 2 points off on held-out games). One eval always gives one answer,
 * whatever the clocks or the side to move.
 */
const EVAL_CURVE = {
  taus: [1.5, 4, 12],
  classes: {
    bullet: {
      b0: [0, 0.00009, 1.42412],
      b1: [0.04238, 0.0034, 0.22559],
      c0: 0.06689,
      c1: 0.02191,
      g: 1.81757,
    },
    blitz: {
      b0: [0, 0.00009, 2.50575],
      b1: [0.00241, 0.04804, 0.31431],
      c0: 0.11633,
      c1: 0.01328,
      g: 1.48005,
    },
    rapid: {
      b0: [0, 0.00009, 3.16613],
      b1: [0.00002, 0.08107, 0.55669],
      c0: 0.1382,
      c1: -0.00557,
      g: 1.24131,
    },
  },
}
/** The small net's evals are about this much smaller than SF19's, which the curve was fit on (P89, depth 18). */
export const SMALL_NET_TO_SF19 = 1.12

/** [White, draw, Black] from an eval on SF19's scale, in pawns from White's side. */
export const engineChance = (
  pawns: number,
  whiteElo: number,
  blackElo: number,
  timeControl: string | undefined,
): [number, number, number] => {
  const p = EVAL_CURVE.classes[timeClassOf(timeControl)]
  const r = ((whiteElo + blackElo) / 2 - 1700) / 400
  const gap = (whiteElo - blackElo) / 400
  const x = Math.max(-100, Math.min(100, pawns))
  const eta =
    EVAL_CURVE.taus.reduce(
      (sum, tau, i) =>
        sum + Math.max(0, p.b0[i] + p.b1[i] * r) * Math.tanh(x / tau),
      0,
    ) +
    p.g * gap
  const c = p.c0 + p.c1 * r
  const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))
  const w = sigmoid(eta - c)
  const b = sigmoid(-eta - c)
  return [w, 1 - w - b, b]
}
