import { TimeControl } from 'src/types'

// The steps the play setup's sliders move through: one-minute steps for
// short games, then coarser ones up to classical (3 hours, 60 s increment).
// The minutes slider has one more position past the last step: Unlimited.
export const TIME_MINUTES_STEPS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
  75, 90, 105, 120, 150, 180,
]
export const INCREMENT_SECONDS_STEPS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 45, 60,
]

// As on other sites, a game with no base time ("0+N") starts each clock at
// 3 seconds; the increment does the rest.
export const ZERO_BASE_START_SECONDS = 3

/** Index of the step closest to `value`, for a slider over `steps`. */
export const nearestStepIndex = (steps: number[], value: number): number =>
  steps.reduce(
    (best, step, i) =>
      Math.abs(step - value) < Math.abs(steps[best] - value) ? i : best,
    0,
  )

/**
 * A time control from a URL or the setup dialog: "M+S", or unlimited for
 * anything else. "0+0" (no time at all) is unlimited too.
 */
export const normalizeTimeControl = (
  timeControl: string | undefined,
): TimeControl => {
  const match = timeControl?.match(/^(\d+)\+(\d+)$/)
  if (!match || (Number(match[1]) === 0 && Number(match[2]) === 0)) {
    return 'unlimited'
  }
  return timeControl as TimeControl
}

/** Each clock's starting time in seconds (0 for unlimited). */
export const initialClockSeconds = (timeControl: string): number => {
  if (timeControl === 'unlimited' || !timeControl.includes('+')) return 0
  const minutes = parseInt(timeControl.split('+')[0], 10)
  if (!Number.isFinite(minutes)) return 0
  return minutes === 0 ? ZERO_BASE_START_SECONDS : minutes * 60
}

/** The increment in seconds (0 for unlimited). */
export const incrementSeconds = (timeControl: string): number => {
  if (timeControl === 'unlimited' || !timeControl.includes('+')) return 0
  const seconds = parseInt(timeControl.split('+')[1], 10)
  return Number.isFinite(seconds) ? seconds : 0
}

// What the backend tells Maia about a game without clocks: 3 minutes each.
// Sent as a real clock, so that "Human-like" thinking time takes time there
// too (no clock at all is the backend's sign to move at once).
export const UNLIMITED_MAIA_CLOCK_SECONDS = 180

/**
 * The clocks sent with a request for Maia's move: the game's own, so that
 * Maia plays the time control being played, and spends time as it would.
 * With "Instant" thinking time, its reply's delay is not waited for.
 */
export const maiaMoveClocks = (
  timeControl: string,
  maiaClockSeconds: number,
): { initialClock: number; increment: number; currentClock: number } => {
  const initialClock = initialClockSeconds(timeControl)
  if (initialClock === 0) {
    return {
      initialClock: UNLIMITED_MAIA_CLOCK_SECONDS,
      increment: 0,
      currentClock: UNLIMITED_MAIA_CLOCK_SECONDS,
    }
  }
  return {
    initialClock,
    increment: incrementSeconds(timeControl),
    currentClock: maiaClockSeconds,
  }
}

/**
 * A time control as PGN's TimeControl header writes it: the starting time and
 * increment in seconds ("300+3"), or "-" for a game without clocks.
 */
export const pgnTimeControl = (timeControl: string): string => {
  const seconds = initialClockSeconds(timeControl)
  if (!seconds) return '-'
  const increment = parseInt(timeControl.split('+')[1], 10) || 0
  return `${seconds}+${increment}`
}
