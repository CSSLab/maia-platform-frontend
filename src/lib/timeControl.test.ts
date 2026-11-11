import {
  INCREMENT_SECONDS_STEPS,
  TIME_MINUTES_STEPS,
  incrementSeconds,
  initialClockSeconds,
  maiaMoveClocks,
  nearestStepIndex,
  pgnTimeControl,
  normalizeTimeControl,
} from './timeControl'

describe('normalizeTimeControl', () => {
  it('keeps ordinary, long and no-base time controls', () => {
    expect(normalizeTimeControl('3+0')).toBe('3+0')
    expect(normalizeTimeControl('90+30')).toBe('90+30')
    expect(normalizeTimeControl('0+2')).toBe('0+2')
  })

  it('treats no time at all, junk or nothing as unlimited', () => {
    expect(normalizeTimeControl('0+0')).toBe('unlimited')
    expect(normalizeTimeControl('unlimited')).toBe('unlimited')
    expect(normalizeTimeControl('abc')).toBe('unlimited')
    expect(normalizeTimeControl(undefined)).toBe('unlimited')
  })
})

describe('initialClockSeconds', () => {
  it('starts "0+N" games at 3 seconds', () => {
    expect(initialClockSeconds('0+2')).toBe(3)
  })

  it('uses the base minutes otherwise, and 0 for unlimited', () => {
    expect(initialClockSeconds('5+2')).toBe(300)
    expect(initialClockSeconds('180+60')).toBe(10800)
    expect(initialClockSeconds('unlimited')).toBe(0)
  })
})

describe('nearestStepIndex', () => {
  it('finds exact and in-between values', () => {
    expect(TIME_MINUTES_STEPS[nearestStepIndex(TIME_MINUTES_STEPS, 15)]).toBe(
      15,
    )
    expect(TIME_MINUTES_STEPS[nearestStepIndex(TIME_MINUTES_STEPS, 11)]).toBe(
      10,
    )
    expect(
      INCREMENT_SECONDS_STEPS[nearestStepIndex(INCREMENT_SECONDS_STEPS, 40)],
    ).toBe(45)
  })
})

describe('pgnTimeControl', () => {
  it('writes seconds and increment, or "-" without clocks', () => {
    expect(pgnTimeControl('5+3')).toBe('300+3')
    expect(pgnTimeControl('0+1')).toBe('3+1')
    expect(pgnTimeControl('unlimited')).toBe('-')
  })
})

describe('incrementSeconds', () => {
  it('reads the increment, and 0 for unlimited', () => {
    expect(incrementSeconds('10+5')).toBe(5)
    expect(incrementSeconds('0+2')).toBe(2)
    expect(incrementSeconds('3+0')).toBe(0)
    expect(incrementSeconds('unlimited')).toBe(0)
  })
})

describe('maiaMoveClocks', () => {
  it("sends the game's clocks, increment included", () => {
    expect(maiaMoveClocks('10+5', 412.5)).toEqual({
      initialClock: 600,
      increment: 5,
      currentClock: 412.5,
    })
  })

  it('gives a game without clocks a 3-minute one, as the backend assumes', () => {
    // A clock of 0 is the backend's sign to move at once.
    expect(maiaMoveClocks('unlimited', 0)).toEqual({
      initialClock: 180,
      increment: 0,
      currentClock: 180,
    })
  })
})
