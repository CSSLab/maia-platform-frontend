import {
  INCREMENT_SECONDS_STEPS,
  TIME_MINUTES_STEPS,
  initialClockSeconds,
  nearestStepIndex,
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
