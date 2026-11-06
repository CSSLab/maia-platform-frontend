import {
  createWheelStepper,
  wheelDeltaPx,
  WHEEL_GESTURE_GAP_MS,
  WHEEL_MIN_STEP_INTERVAL_MS,
  WHEEL_STEP_THRESHOLD_PX,
} from './wheelNavigation'

describe('wheelDeltaPx', () => {
  it('converts lines and pages to pixels', () => {
    expect(wheelDeltaPx(100, 0)).toBe(100)
    expect(wheelDeltaPx(3, 1)).toBe(48)
    expect(wheelDeltaPx(-1, 2)).toBe(-400)
  })
})

describe('createWheelStepper', () => {
  it('steps once per mouse-wheel notch, in the wheel direction', () => {
    const step = createWheelStepper()
    // Notches a third of a second apart, each its own gesture.
    expect(step(100, 0)).toBe(1)
    expect(step(100, 300)).toBe(1)
    expect(step(-100, 600)).toBe(-1)
  })

  it('moves on the first event of a gesture, however small', () => {
    const step = createWheelStepper()
    expect(step(4, 1000)).toBe(1)
  })

  it("doesn't skip moves on a trackpad's stream of small deltas", () => {
    const step = createWheelStepper()
    // 1 s of 5 px events every 16 ms: 315 px in all.
    let steps = 0
    for (let t = 0; t <= 1000; t += 16) steps += step(5, t)
    // The first event, then one more per threshold's worth of scrolling.
    expect(steps).toBe(1 + Math.floor((315 - 5) / WHEEL_STEP_THRESHOLD_PX))
  })

  it('steps at most once per interval however fast the deltas come', () => {
    const step = createWheelStepper()
    let steps = 0
    // A fast spin: 100 px events every 10 ms for half a second.
    for (let t = 0; t < 500; t += 10) steps += step(100, t)
    expect(steps).toBeLessThanOrEqual(
      Math.ceil(500 / WHEEL_MIN_STEP_INTERVAL_MS),
    )
    expect(steps).toBeGreaterThan(1)
  })

  it('starts counting again when the direction reverses', () => {
    const step = createWheelStepper()
    expect(step(5, 0)).toBe(1)
    expect(step(30, 16)).toBe(0)
    // 35 px down so far; reversing doesn't have to cancel that first.
    expect(step(-30, 100)).toBe(0)
    expect(step(-15, 116)).toBe(-1)
  })

  it('treats a pause as the start of a new gesture', () => {
    const step = createWheelStepper()
    expect(step(5, 0)).toBe(1)
    expect(step(5, 16)).toBe(0)
    expect(step(5, 16 + WHEEL_GESTURE_GAP_MS + 1)).toBe(1)
  })

  it('ignores events without vertical movement', () => {
    const step = createWheelStepper()
    expect(step(0, 0)).toBe(0)
    expect(step(10, 1)).toBe(1)
  })
})
