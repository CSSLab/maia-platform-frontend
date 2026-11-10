import {
  formatAbsoluteTime,
  formatMonthYear,
  formatRelativeTime,
  parsePgnTime,
  parseTime,
  parseTimeMs,
} from './relativeTime'

const MS = Date.UTC(2026, 10, 10, 7, 53, 30, 51)

describe('parseTime', () => {
  it('reads the backend’s zone-less times as UTC', () => {
    // Game times, with microseconds.
    expect(parseTimeMs('2026-11-10T07:53:30.051000')).toBe(MS)
    // Account times: a space for the "T".
    expect(parseTimeMs('2026-11-10 07:53:30.051000')).toBe(MS)
    expect(parseTimeMs('2026-11-10T07:53:30')).toBe(MS - 51)
    expect(parseTimeMs('2026-11-10 07:53')).toBe(MS - 30051)
  })

  it('reads ISO times with a zone', () => {
    expect(parseTimeMs('2026-11-10T07:53:30.051Z')).toBe(MS)
    expect(parseTimeMs('2026-11-10T07:53:30.051000Z')).toBe(MS)
    expect(parseTimeMs('2026-11-10T07:53:30.051+00:00')).toBe(MS)
    expect(parseTimeMs('2026-11-10T02:53:30.051-05:00')).toBe(MS)
    expect(parseTimeMs('2026-11-10T13:23:30.051+0530')).toBe(MS)
    expect(parseTimeMs('2026-11-10T08:53:30.051+01')).toBe(MS)
    expect(parseTimeMs(' 2026-11-10T07:53:30.051z ')).toBe(MS)
  })

  it('reads a date alone as the start of that day in UTC', () => {
    expect(parseTimeMs('2026-11-10')).toBe(Date.UTC(2026, 10, 10))
  })

  it('reads epoch milliseconds and dates', () => {
    expect(parseTimeMs(MS)).toBe(MS)
    expect(parseTime(new Date(MS))).toEqual(new Date(MS))
  })

  it('gives null for a missing or unreadable time', () => {
    for (const time of [
      null,
      undefined,
      '',
      '   ',
      '????.??.??',
      'not a date',
      '2026-13-45T07:53:30',
      '2026-11-10T25:00:00',
      '2026.11.10',
      '10/11/2026',
      NaN,
      Infinity,
      0,
      -1,
      new Date(NaN),
    ]) {
      expect(parseTime(time)).toBeNull()
      expect(parseTimeMs(time)).toBeNull()
    }
  })
})

describe('parsePgnTime', () => {
  it('reads the UTCDate and UTCTime headers of a PGN', () => {
    expect(parsePgnTime('2026.11.10', '07:53:30')?.getTime()).toBe(MS - 51)
  })

  it('gives null without both, or with an unknown date', () => {
    expect(parsePgnTime('2026.11.10')).toBeNull()
    expect(parsePgnTime(undefined, '07:53:30')).toBeNull()
    expect(parsePgnTime('????.??.??', '07:53:30')).toBeNull()
    expect(parsePgnTime('2026.11.??', '07:53:30')).toBeNull()
    expect(parsePgnTime('2026.11.10', '??:??:??')).toBeNull()
  })
})

describe('formatRelativeTime', () => {
  const SECOND = 1000
  const MINUTE = 60 * SECOND
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR
  const ago = (ms: number, style?: 'long' | 'compact') =>
    formatRelativeTime(MS - ms, MS, style)

  it.each([
    [0, 'just now', 'now'],
    [59 * SECOND, 'just now', 'now'],
    [MINUTE, '1 minute ago', '1m'],
    [2 * MINUTE - 1, '1 minute ago', '1m'],
    [59 * MINUTE, '59 minutes ago', '59m'],
    [HOUR, '1 hour ago', '1h'],
    [23 * HOUR + 59 * MINUTE, '23 hours ago', '23h'],
    [DAY, '1 day ago', '1d'],
    [6 * DAY + 23 * HOUR, '6 days ago', '6d'],
    [7 * DAY, '1 week ago', '1w'],
    [13 * DAY, '1 week ago', '1w'],
    [14 * DAY, '2 weeks ago', '2w'],
    [29 * DAY, '4 weeks ago', '4w'],
    [30 * DAY, '1 month ago', '1mo'],
    [59 * DAY, '1 month ago', '1mo'],
    [60 * DAY, '2 months ago', '2mo'],
    [330 * DAY, '11 months ago', '11mo'],
    [364 * DAY, '11 months ago', '11mo'],
    [365 * DAY, '1 year ago', '1y'],
    [729 * DAY, '1 year ago', '1y'],
    [730 * DAY, '2 years ago', '2y'],
    [3650 * DAY, '10 years ago', '10y'],
  ])('writes %d ms ago as "%s" and "%s"', (ms, long, compact) => {
    expect(ago(ms)).toBe(long)
    expect(ago(ms, 'long')).toBe(long)
    expect(ago(ms, 'compact')).toBe(compact)
  })

  it('reads the time as the API sends it', () => {
    const now = new Date('2026-11-10T10:53:31Z')
    expect(formatRelativeTime('2026-11-10T07:53:30.051000', now)).toBe(
      '3 hours ago',
    )
    expect(formatRelativeTime('2026-11-10 07:53:30.051000', now)).toBe(
      '3 hours ago',
    )
    expect(formatRelativeTime('2026-11-10T07:53:30.051Z', now)).toBe(
      '3 hours ago',
    )
  })

  it('takes a time just ahead of this device’s clock as now', () => {
    expect(ago(-5 * SECOND)).toBe('just now')
    expect(ago(-2 * MINUTE, 'compact')).toBe('now')
  })

  it('writes nothing for a time in the future or no time', () => {
    expect(ago(-2 * MINUTE - 1)).toBeNull()
    expect(ago(-DAY)).toBeNull()
    expect(ago(-DAY, 'compact')).toBeNull()
    expect(formatRelativeTime(null, MS)).toBeNull()
    expect(formatRelativeTime('', MS)).toBeNull()
    expect(formatRelativeTime('????.??.??', MS)).toBeNull()
    expect(formatRelativeTime(MS, NaN)).toBeNull()
  })

  it('measures from the present unless told otherwise', () => {
    expect(formatRelativeTime(Date.now() - 3 * DAY - HOUR)).toBe('3 days ago')
  })
})

describe('formatAbsoluteTime', () => {
  // Intl separates the time of day with a narrow no-break space in some
  // versions and a plain one in others.
  const plain = (text: string | null) => text?.replace(/[  ]/g, ' ')

  it('writes the date and time in the reader’s zone', () => {
    const time = '2026-11-10T07:53:30.051000'
    expect(
      plain(
        formatAbsoluteTime(time, {
          locale: 'en-US',
          timeZone: 'America/Toronto',
        }),
      ),
    ).toBe('Nov 10, 2026, 2:53 AM')
    expect(
      plain(formatAbsoluteTime(time, { locale: 'en-US', timeZone: 'UTC' })),
    ).toBe('Nov 10, 2026, 7:53 AM')
    expect(
      plain(
        formatAbsoluteTime(time, { locale: 'en-GB', timeZone: 'Asia/Tokyo' }),
      ),
    ).toBe('10 Nov 2026, 16:53')
  })

  it('writes the span to an end time', () => {
    const span = plain(
      formatAbsoluteTime('2026-11-10T07:53:30Z', {
        locale: 'en-US',
        timeZone: 'UTC',
        end: '2026-11-10T08:10:00Z',
      }),
    )
    expect(span).toMatch(/^Nov 10, 2026, 7:53/)
    expect(span).toMatch(/8:10 AM$/)
  })

  it('writes the start alone when the end is missing or not after it', () => {
    const options = { locale: 'en-US', timeZone: 'UTC' }
    const start = '2026-11-10T07:53:30Z'
    const alone = formatAbsoluteTime(start, options)
    expect(formatAbsoluteTime(start, { ...options, end: null })).toBe(alone)
    expect(formatAbsoluteTime(start, { ...options, end: 'soon' })).toBe(alone)
    expect(formatAbsoluteTime(start, { ...options, end: start })).toBe(alone)
    expect(
      formatAbsoluteTime(start, { ...options, end: '2026-11-09T00:00:00Z' }),
    ).toBe(alone)
  })

  it('gives null for no time', () => {
    expect(formatAbsoluteTime('')).toBeNull()
    expect(formatAbsoluteTime('????.??.??')).toBeNull()
  })
})

describe('formatMonthYear', () => {
  it('names the month in the reader’s zone', () => {
    const time = '2026-11-01 02:00:00.000000'
    expect(formatMonthYear(time, { locale: 'en-US', timeZone: 'UTC' })).toBe(
      'November 2026',
    )
    // Still the evening of 31 October in Toronto.
    expect(
      formatMonthYear(time, { locale: 'en-US', timeZone: 'America/Toronto' }),
    ).toBe('October 2026')
  })

  it('gives null for no time', () => {
    expect(formatMonthYear('')).toBeNull()
    expect(formatMonthYear(null)).toBeNull()
  })
})
