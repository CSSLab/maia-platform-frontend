import { Color, Termination } from 'src/types'

/**
 * The play page's clocks, published for tools that drive a physical board
 * or clock (such as ChessConnect for electronic chessboards), so they need
 * not read the clocks from the page's markup. See docs/clock-state.md.
 *
 * Read it from `window.__MaiaClockState`, or listen for the
 * `maia:clockstate` event on `window`, whose `detail` is the new state (or
 * `null` when the game is left).
 */
export interface MaiaClockState {
  /** Bumped only if a field changes meaning or is removed. */
  version: 1
  /** Remaining time when the state was published (`remainingAtMs`). */
  whiteRemainingMs: number
  blackRemainingMs: number
  whiteInitialMs: number
  blackInitialMs: number
  incrementMs: number
  /**
   * Epoch milliseconds (`Date.now()`) at which the remaining times held.
   * The running clock's time now is its remaining time minus
   * `Date.now() - remainingAtMs`.
   */
  remainingAtMs: number
  /** Whose turn it is, or null once the game is over. */
  turnColor: Color | null
  /** The clock that is counting down: null with no clocks, before both
   * sides have moved, and once the game is over. */
  activeColor: Color | null
  lifecycle: 'not_started' | 'ongoing' | 'finished'
  result: 'white_wins' | 'black_wins' | 'draw' | null
}

export const CLOCK_STATE_EVENT = 'maia:clockstate'

declare global {
  interface Window {
    __MaiaClockState?: MaiaClockState
  }
}

interface ClockStateInput {
  timeControl: string
  whiteClock: number
  blackClock: number
  initialClock: number
  incrementSeconds: number
  lastMoveTime: number
  movesPlayed: number
  toPlay: Color | null
  termination?: Termination
  now: number
}

export const buildClockState = (input: ClockStateInput): MaiaClockState => {
  const { termination } = input
  const lifecycle = termination
    ? 'finished'
    : input.movesPlayed > 0
      ? 'ongoing'
      : 'not_started'

  // The same condition the page's clocks count down on: both sides have
  // moved and the clock has a reference time.
  const running =
    input.timeControl !== 'unlimited' &&
    !termination &&
    input.movesPlayed >= 2 &&
    input.lastMoveTime > 0 &&
    !!input.toPlay

  return Object.freeze({
    version: 1,
    whiteRemainingMs: input.whiteClock,
    blackRemainingMs: input.blackClock,
    whiteInitialMs: input.initialClock,
    blackInitialMs: input.initialClock,
    incrementMs: input.incrementSeconds * 1000,
    remainingAtMs: running ? input.lastMoveTime : input.now,
    turnColor: termination ? null : input.toPlay,
    activeColor: running ? input.toPlay : null,
    lifecycle,
    result:
      termination?.winner === 'white'
        ? 'white_wins'
        : termination?.winner === 'black'
          ? 'black_wins'
          : termination?.winner === 'none'
            ? 'draw'
            : null,
  })
}

export const publishClockState = (state: MaiaClockState | null) => {
  if (typeof window === 'undefined') return
  if (state) {
    window.__MaiaClockState = state
  } else {
    delete window.__MaiaClockState
  }
  window.dispatchEvent(new CustomEvent(CLOCK_STATE_EVENT, { detail: state }))
}
