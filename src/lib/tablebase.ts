/**
 * Endgame tablebase lookups through Lichess's public tablebase API
 * (https://tablebase.lichess.ovh). Stockfish's evals in simple endgames can
 * be confusing (a +40 that is a dead draw, a "mistake" that still wins), so
 * for positions with at most 7 pieces the analysis panel also shows the exact
 * result and the moves that keep it.
 */

export const TABLEBASE_URL = 'https://tablebase.lichess.ovh/standard'

/** The Syzygy tables Lichess serves cover positions with up to 7 pieces. */
export const MAX_TABLEBASE_PIECES = 7

export type TablebaseCategory =
  | 'win'
  | 'unknown'
  | 'maybe-win'
  | 'cursed-win'
  | 'draw'
  | 'blessed-loss'
  | 'maybe-loss'
  | 'loss'

const CATEGORIES: TablebaseCategory[] = [
  'win',
  'unknown',
  'maybe-win',
  'cursed-win',
  'draw',
  'blessed-loss',
  'maybe-loss',
  'loss',
]

/** A legal move, scored for the side that plays it. */
export interface TablebaseMove {
  uci: string
  san: string
  /** The result for the side playing the move (Lichess gives the opponent's). */
  category: TablebaseCategory
  /**
   * Plies to mate counted from the current position, positive when the side
   * playing the move mates and negative when it gets mated; null when the
   * position after the move has no DTM (DTM tables only go up to 5 pieces).
   */
  dtm: number | null
  /** DTZ of the position after the move, as Lichess shows it. */
  dtz: number | null
  checkmate: boolean
  stalemate: boolean
}

/** The current position, from the side to move's point of view. */
export interface TablebaseResult {
  fen: string
  category: TablebaseCategory
  /** Plies to mate: positive when the side to move mates, negative if mated. */
  dtm: number | null
  /** Plies to the next capture or pawn move (zeroing the 50-move counter). */
  dtz: number | null
  checkmate: boolean
  stalemate: boolean
  /** Best first, in the order Lichess sorts them. */
  moves: TablebaseMove[]
}

/** How many pieces (kings included) the FEN's board has. */
export const countPieces = (fen: string): number => {
  const board = fen.trim().split(/\s+/)[0] ?? ''
  let count = 0
  for (const c of board) {
    if (/[pnbrqk]/i.test(c)) count++
  }
  return count
}

export const isTablebasePosition = (fen: string): boolean => {
  const pieces = countPieces(fen)
  return pieces >= 2 && pieces <= MAX_TABLEBASE_PIECES
}

/** The same result seen by the other side. */
export const flipCategory = (
  category: TablebaseCategory,
): TablebaseCategory => {
  switch (category) {
    case 'win':
      return 'loss'
    case 'loss':
      return 'win'
    case 'maybe-win':
      return 'maybe-loss'
    case 'maybe-loss':
      return 'maybe-win'
    case 'cursed-win':
      return 'blessed-loss'
    case 'blessed-loss':
      return 'cursed-win'
    default:
      return category
  }
}

const asCategory = (value: unknown): TablebaseCategory | null =>
  typeof value === 'string' && CATEGORIES.includes(value as TablebaseCategory)
    ? (value as TablebaseCategory)
    : null

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/**
 * The move's DTM counted from the current position, for the side playing
 * it: the API's value is for the position after the move, from the
 * opponent's side, so the sign flips and the move itself adds one ply. A
 * mating move leaves a DTM of 0, which is mate in one ply.
 */
const moveDtmFromMover = (
  afterDtm: number | null,
  category: TablebaseCategory,
  checkmate: boolean,
): number | null => {
  if (checkmate) return 1
  if (afterDtm === null || afterDtm === 0) return null
  const plies = Math.abs(afterDtm) + 1
  // A negative DTM after the move means the opponent is the one getting
  // mated, so the mover wins.
  if (afterDtm < 0) return plies
  return category === 'draw' ? null : -plies
}

/**
 * Reads the API's JSON. Returns null for anything we can't use (an
 * unexpected shape, or a position the tables don't know), so the panel
 * simply doesn't show a tablebase line.
 */
export const parseTablebaseResponse = (
  fen: string,
  json: unknown,
): TablebaseResult | null => {
  if (!json || typeof json !== 'object') return null
  const data = json as Record<string, unknown>
  const category = asCategory(data.category)
  if (!category || category === 'unknown') return null

  const rawMoves = Array.isArray(data.moves) ? data.moves : []
  const moves: TablebaseMove[] = []
  for (const raw of rawMoves) {
    if (!raw || typeof raw !== 'object') continue
    const move = raw as Record<string, unknown>
    const afterCategory = asCategory(move.category)
    if (
      typeof move.uci !== 'string' ||
      typeof move.san !== 'string' ||
      !afterCategory
    ) {
      continue
    }
    const moverCategory = flipCategory(afterCategory)
    const checkmate = move.checkmate === true
    moves.push({
      uci: move.uci,
      san: move.san,
      category: moverCategory,
      dtm: moveDtmFromMover(asNumber(move.dtm), moverCategory, checkmate),
      dtz: asNumber(move.dtz),
      checkmate,
      stalemate: move.stalemate === true,
    })
  }

  return {
    fen,
    category,
    dtm: asNumber(data.dtm),
    // `precise_dtz` is exact where `dtz` may be rounded, when Lichess has it.
    dtz: asNumber(data.precise_dtz) ?? asNumber(data.dtz),
    checkmate: data.checkmate === true,
    stalemate: data.stalemate === true,
    moves,
  }
}

const CATEGORY_LABELS: Record<TablebaseCategory, string> = {
  win: 'Win',
  loss: 'Loss',
  draw: 'Draw',
  // Wins that the 50-move rule turns into draws (and the losses it saves).
  'cursed-win': 'Cursed win',
  'blessed-loss': 'Blessed loss',
  'maybe-win': 'Win or 50-move draw',
  'maybe-loss': 'Loss or 50-move draw',
  unknown: 'Unknown',
}

export const tablebaseCategoryLabel = (category: TablebaseCategory) =>
  CATEGORY_LABELS[category]

/** Full moves to mate from a DTM in plies (mating side's moves, or the mated side's). */
export const dtmToMoves = (dtm: number): number => Math.ceil(Math.abs(dtm) / 2)

/**
 * The distance part of a result: "mate in 22" / "mated in 21" when DTM is
 * known (up to 5 pieces), else "DTZ 9" for decided positions, else nothing.
 */
const formatDistance = (
  category: TablebaseCategory,
  dtm: number | null,
  dtz: number | null,
): string | null => {
  if (category === 'draw' || category === 'unknown') return null
  if (dtm !== null && dtm !== 0) {
    return dtm > 0
      ? `mate in ${dtmToMoves(dtm)}`
      : `mated in ${dtmToMoves(dtm)}`
  }
  if (dtz !== null && dtz !== 0) return `DTZ ${Math.abs(dtz)}`
  return null
}

/** E.g. "Win · mate in 22", "Draw", "Loss · DTZ 14", "Checkmate". */
export const formatTablebaseSummary = (result: TablebaseResult): string => {
  if (result.checkmate) return 'Checkmate'
  if (result.stalemate) return 'Stalemate · Draw'
  const label = tablebaseCategoryLabel(result.category)
  const distance = formatDistance(result.category, result.dtm, result.dtz)
  return distance ? `${label} · ${distance}` : label
}

/**
 * A short label for a move: "Win #22", "Draw", "Loss DTZ 3", "Mate". The
 * mate count is in full moves from the current position, for whichever side
 * mates (the category already says which one that is).
 */
export const formatTablebaseMove = (move: TablebaseMove): string => {
  if (move.checkmate) return 'Mate'
  if (move.stalemate) return 'Stalemate'
  const label =
    move.category === 'maybe-win'
      ? 'Win?'
      : move.category === 'maybe-loss'
        ? 'Loss?'
        : move.category === 'cursed-win'
          ? 'Cursed'
          : move.category === 'blessed-loss'
            ? 'Blessed'
            : tablebaseCategoryLabel(move.category)
  if (move.category === 'draw' || move.category === 'unknown') return label
  if (move.dtm !== null) return `${label} #${dtmToMoves(move.dtm)}`
  if (move.dtz !== null && move.dtz !== 0) {
    return `${label} DTZ ${Math.abs(move.dtz)}`
  }
  return label
}

/** Whether the result is good, neutral or bad for the side to move (for colour). */
export const tablebaseOutlook = (
  category: TablebaseCategory,
): 'good' | 'neutral' | 'bad' => {
  if (category === 'win' || category === 'maybe-win') return 'good'
  if (category === 'loss' || category === 'maybe-loss') return 'bad'
  return 'neutral'
}

export interface TablebaseClient {
  /** The cached result: a result, null (no usable result), or undefined (not fetched). */
  peek: (fen: string) => TablebaseResult | null | undefined
  /**
   * Fetches (or reads from the cache) the position's result. Requests run
   * one at a time; a lookup whose signal aborts while it waits for its turn
   * is never sent and rejects.
   */
  lookup: (fen: string, signal?: AbortSignal) => Promise<TablebaseResult | null>
}

const abortError = () => {
  const error = new Error('Tablebase lookup aborted')
  error.name = 'AbortError'
  return error
}

export const createTablebaseClient = ({
  fetchFn = (input, init) => fetch(input, init),
  cacheSize = 500,
  timeoutMs = 8000,
}: {
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>
  cacheSize?: number
  timeoutMs?: number
} = {}): TablebaseClient => {
  // Results per FEN, oldest first: positions are revisited constantly while
  // stepping back and forth, and the tables never change.
  const cache = new Map<string, TablebaseResult | null>()
  // Lichess asks clients not to send parallel requests to the tablebase, so
  // there is at most one in flight and later lookups wait for it.
  let inFlight: Promise<unknown> | null = null

  const remember = (fen: string, result: TablebaseResult | null) => {
    cache.delete(fen)
    cache.set(fen, result)
    while (cache.size > cacheSize) {
      const oldest = cache.keys().next().value
      if (oldest === undefined) break
      cache.delete(oldest)
    }
  }

  const request = async (fen: string) => {
    // The request itself isn't cancelled when the position changes (its
    // answer is cached, and the user often steps back to it), but one that
    // hangs mustn't hold up every later lookup.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchFn(
        `${TABLEBASE_URL}?fen=${encodeURIComponent(fen)}`,
        { signal: controller.signal },
      )
      if (!response.ok) {
        // Not cached: a 429 or a server error may well pass.
        throw new Error(`Tablebase request failed: ${response.status}`)
      }
      const result = parseTablebaseResponse(fen, await response.json())
      remember(fen, result)
      return result
    } finally {
      clearTimeout(timer)
    }
  }

  const peek = (fen: string) => (cache.has(fen) ? cache.get(fen) : undefined)

  const lookup = async (fen: string, signal?: AbortSignal) => {
    const cached = peek(fen)
    if (cached !== undefined) return cached

    while (inFlight) {
      await inFlight.catch(() => undefined)
      if (signal?.aborted) throw abortError()
      // The request we waited for may have been for this position.
      const nowCached = peek(fen)
      if (nowCached !== undefined) return nowCached
    }
    if (signal?.aborted) throw abortError()

    const pending = request(fen)
    inFlight = pending
    // Registered before anyone else can wait on `pending`, so waiters find
    // the slot free when they wake up.
    const clear = () => {
      if (inFlight === pending) inFlight = null
    }
    pending.then(clear, clear)
    return pending
  }

  return { peek, lookup }
}

/** Shared by every board on the page, so they share the cache and the queue. */
export const tablebaseClient = createTablebaseClient()
