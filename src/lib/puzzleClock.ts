/**
 * How long a puzzle was on show before it was answered, for puzzle_completed.
 *
 * Also how much of that time the page was hidden: someone who switches to
 * another tab or app before answering may be looking the move up, and a
 * correct answer in under a second or two is faster than people read a
 * position. Neither proves anything alone, but without times the two can't
 * be told apart from honest solving at all.
 */

let hiddenTotal = 0
let hiddenSince: number | null = null
let listening = false

const hiddenSoFar = (now: number) =>
  hiddenTotal + (hiddenSince === null ? 0 : now - hiddenSince)

const onVisibilityChange = () => {
  const now = performance.now()
  if (document.visibilityState === 'hidden') {
    hiddenSince ??= now
  } else if (hiddenSince !== null) {
    hiddenTotal += now - hiddenSince
    hiddenSince = null
  }
}

const listen = () => {
  if (listening || typeof document === 'undefined') return
  listening = true
  if (document.visibilityState === 'hidden') hiddenSince = performance.now()
  document.addEventListener('visibilitychange', onVisibilityChange)
}

const started = new Map<string, { at: number; hidden: number }>()

const tenths = (ms: number) => Math.round(ms / 100) / 10

/** The puzzle came on show. A puzzle already started keeps its start. */
export const startPuzzleClock = (puzzleId: string) => {
  if (typeof performance === 'undefined') return
  listen()
  if (started.has(puzzleId)) return
  const now = performance.now()
  started.set(puzzleId, { at: now, hidden: hiddenSoFar(now) })
}

/**
 * Seconds since the puzzle came on show, and how many of them the page was
 * hidden, to a tenth of a second. Null for a puzzle not started here.
 */
export const readPuzzleClock = (puzzleId: string) => {
  const start = started.get(puzzleId)
  if (!start) return null
  const now = performance.now()
  return {
    seconds: tenths(now - start.at),
    hiddenSeconds: tenths(hiddenSoFar(now) - start.hidden),
  }
}

/** For tests. */
export const resetPuzzleClocks = () => {
  started.clear()
  hiddenTotal = 0
  hiddenSince = null
  if (listening) {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    listening = false
  }
}
