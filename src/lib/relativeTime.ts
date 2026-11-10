// Reading the times the backend and Lichess send, and writing them as
// "3 days ago" (or "3d") and as a date in the reader's own locale and zone.

/** A backend time string, epoch milliseconds (Lichess) or a Date. */
export type TimeInput = string | number | Date | null | undefined

// "2026-11-10T07:53:30.051000", "2026-11-10 07:53:29.355000" (the backend's
// older replies: UTC, without a zone, with microseconds), the same with "Z"
// or an offset, and a date alone.
const TIME_PATTERN =
  /^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d)(?::(\d\d)(?:\.(\d+))?)?)?\s*(Z|[+-]\d\d(?::?\d\d)?)?$/i

const zoneOf = (zone?: string) => {
  if (!zone || /^z$/i.test(zone)) return 'Z'
  const digits = zone.slice(1).replace(':', '')
  return `${zone[0]}${digits.slice(0, 2)}:${digits.slice(2) || '00'}`
}

/**
 * The moment a time from the API names, or null when it names none (missing,
 * empty, or not a date, as the "????.??.??" of some old records). A string
 * without a zone is read as UTC, never as local time.
 */
export const parseTime = (time: TimeInput): Date | null => {
  if (time === null || time === undefined || time === '') return null

  if (typeof time === 'string') {
    const match = TIME_PATTERN.exec(time.trim())
    if (!match) return null
    const [, year, month, day, hour, minute, second, fraction, zone] = match
    const milliseconds = (fraction ?? '').slice(0, 3).padEnd(3, '0')
    return parseTime(
      Date.parse(
        `${year}-${month}-${day}T${hour ?? '00'}:${minute ?? '00'}:` +
          `${second ?? '00'}.${milliseconds}${zoneOf(zone)}`,
      ),
    )
  }

  const ms = typeof time === 'number' ? time : time.getTime()
  // 0 is how a missing time is sometimes written, not a game played in 1970.
  return Number.isFinite(ms) && ms > 0 ? new Date(ms) : null
}

/** Epoch milliseconds of a time from the API, or null (see parseTime). */
export const parseTimeMs = (time: TimeInput): number | null =>
  parseTime(time)?.getTime() ?? null

/**
 * The moment a PGN's `UTCDate` ("2026.11.10") and `UTCTime` ("07:53:30")
 * headers name, or null without both: a date alone says too little to write
 * "3 hours ago" from.
 */
export const parsePgnTime = (utcDate?: string, utcTime?: string) => {
  const date = /^(\d{4})\.(\d\d)\.(\d\d)$/.exec(utcDate?.trim() ?? '')
  const time = /^\d\d:\d\d:\d\d$/.exec(utcTime?.trim() ?? '')
  if (!date || !time) return null
  return parseTime(`${date[1]}-${date[2]}-${date[3]}T${time[0]}Z`)
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// A time slightly ahead of this device's clock (clocks differ by seconds, and
// a game is listed the moment the server stamps it) is "just now"; anything
// further ahead is not written at all.
const CLOCK_SKEW = 2 * MINUTE

type Unit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

const COMPACT_UNIT: Record<Unit, string> = {
  minute: 'm',
  hour: 'h',
  day: 'd',
  week: 'w',
  month: 'mo',
  year: 'y',
}

const elapsed = (ms: number): [number, Unit] | null => {
  if (ms < MINUTE) return null
  if (ms < HOUR) return [Math.floor(ms / MINUTE), 'minute']
  if (ms < DAY) return [Math.floor(ms / HOUR), 'hour']
  const days = Math.floor(ms / DAY)
  if (days < 7) return [days, 'day']
  if (days < 30) return [Math.floor(days / 7), 'week']
  // Months of 30 days; the last days of the year are still "11 months".
  if (days < 365) return [Math.min(11, Math.floor(days / 30)), 'month']
  return [Math.floor(days / 365), 'year']
}

/**
 * How long ago a time was: "just now" within a minute, then "5 minutes ago",
 * "1 hour ago", "3 days ago", "2 weeks ago" (from 7 days), "4 months ago"
 * (from 30 days), "1 year ago" (from 365 days). `compact`: "now", "5m", "1h",
 * "3d", "2w", "4mo", "1y". Null for no time and for a time in the future.
 */
export const formatRelativeTime = (
  time: TimeInput,
  now: number | Date = Date.now(),
  style: 'long' | 'compact' = 'long',
): string | null => {
  const then = parseTimeMs(time)
  if (then === null) return null
  const ms = (typeof now === 'number' ? now : now.getTime()) - then
  if (!Number.isFinite(ms) || ms < -CLOCK_SKEW) return null

  const parts = elapsed(ms)
  if (!parts) return style === 'compact' ? 'now' : 'just now'
  const [count, unit] = parts
  return style === 'compact'
    ? `${count}${COMPACT_UNIT[unit]}`
    : `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

interface LocaleOptions {
  /** The reader's own unless given (tests give both). */
  locale?: string
  timeZone?: string
}

/**
 * The date and time, in the reader's locale and time zone: "Nov 10, 2026,
 * 2:53 AM". With `end`, the span to it: "Nov 10, 2026, 2:53 – 3:10 AM".
 */
export const formatAbsoluteTime = (
  time: TimeInput,
  { locale, timeZone, end }: LocaleOptions & { end?: TimeInput } = {},
): string | null => {
  const date = parseTime(time)
  if (!date) return null
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  })
  const endDate = parseTime(end)
  if (endDate && endDate > date && typeof format.formatRange === 'function') {
    return format.formatRange(date, endDate)
  }
  return format.format(date)
}

/** The month a time falls in, for the reader: "November 2026". */
export const formatMonthYear = (
  time: TimeInput,
  { locale, timeZone }: LocaleOptions = {},
): string | null => {
  const date = parseTime(time)
  if (!date) return null
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date)
}
