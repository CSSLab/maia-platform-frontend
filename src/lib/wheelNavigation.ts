/**
 * Turning mouse-wheel / trackpad scrolling into one-move steps (wheel down =
 * next move, up = previous, as on Lichess).
 *
 * A mouse wheel sends one event of ~100 px per notch, but a trackpad sends a
 * stream of events of a few px each (and keeps sending them while the
 * scroll coasts), so stepping once per event would fly through the game.
 * Instead the first event of a gesture steps at once (so a single notch, of
 * whatever size the browser reports, always moves), and after that the
 * deltas add up and each further step needs WHEEL_STEP_THRESHOLD_PX more,
 * at most one step per WHEEL_MIN_STEP_INTERVAL_MS.
 */

export const WHEEL_STEP_THRESHOLD_PX = 40
export const WHEEL_MIN_STEP_INTERVAL_MS = 70
/** A pause this long between events ends a gesture. */
export const WHEEL_GESTURE_GAP_MS = 250

const LINE_HEIGHT_PX = 16
const PAGE_HEIGHT_PX = 400

/** The event's deltaY in pixels (Firefox reports a mouse wheel in lines). */
export const wheelDeltaPx = (deltaY: number, deltaMode: number): number => {
  if (deltaMode === 1) return deltaY * LINE_HEIGHT_PX
  if (deltaMode === 2) return deltaY * PAGE_HEIGHT_PX
  return deltaY
}

export type WheelStep = -1 | 0 | 1

/**
 * Returns a function that takes each wheel event's deltaY (in px) and its
 * time (ms) and says whether to step: 1 = next move, -1 = previous, 0 = not
 * yet.
 */
export const createWheelStepper = ({
  threshold = WHEEL_STEP_THRESHOLD_PX,
  minInterval = WHEEL_MIN_STEP_INTERVAL_MS,
  gestureGap = WHEEL_GESTURE_GAP_MS,
}: {
  threshold?: number
  minInterval?: number
  gestureGap?: number
} = {}) => {
  let accumulated = 0
  let lastEventAt = -Infinity
  let lastStepAt = -Infinity

  return (deltaPx: number, now: number): WheelStep => {
    if (deltaPx === 0) return 0

    const freshGesture = now - lastEventAt > gestureGap
    lastEventAt = now
    // Reversing direction starts counting again, so scrolling back after
    // overshooting answers right away.
    if (freshGesture || Math.sign(deltaPx) !== Math.sign(accumulated)) {
      accumulated = 0
    }
    accumulated += deltaPx

    const ready =
      (freshGesture || Math.abs(accumulated) >= threshold) &&
      now - lastStepAt >= minInterval
    if (!ready) return 0

    lastStepAt = now
    // What's left over beyond the step is dropped: one notch, however far
    // it reports, is one move.
    accumulated = 0
    return deltaPx > 0 ? 1 : -1
  }
}
