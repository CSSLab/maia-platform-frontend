import { ReactNode, useSyncExternalStore } from 'react'

import {
  TimeInput,
  parseTime,
  formatAbsoluteTime,
  formatRelativeTime,
} from 'src/lib/relativeTime'

// One clock for every time on the page: while any is shown, they are written
// again each minute ("5 minutes ago" needs no more).
const TICK_MS = 60 * 1000
const listeners = new Set<() => void>()
let stopClock: (() => void) | undefined

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (!stopClock) {
    const timer = setInterval(
      () => listeners.forEach((notify) => notify()),
      TICK_MS,
    )
    stopClock = () => clearInterval(timer)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stopClock?.()
      stopClock = undefined
    }
  }
}

// To the nearest minute, so that every render within one reads the same time
// (as React asks of a store) without waiting for the timer.
const getTime = () => Math.round(Date.now() / TICK_MS) * TICK_MS

const getServerTime = () => null

/**
 * The time now, to the minute; null on the server and while its HTML is
 * taken over, so that what's rendered from it is the same in both.
 */
export const useNow = (): number | null =>
  useSyncExternalStore<number | null>(subscribe, getTime, getServerTime)

interface Props {
  /** A time from the API; nothing is rendered for a missing or unreadable one. */
  time: TimeInput
  /**
   * `long`: "3 days ago". `compact`: "3d", for rows with no room to spare.
   * `responsive`: compact on phones and long from the `md` width up.
   */
  format?: 'long' | 'compact' | 'responsive'
  /** Written before the time: "Last played ". */
  prefix?: string
  /** When what started at `time` ended, for the tooltip. */
  end?: TimeInput
  /** Rendered instead when there is no time to show. */
  fallback?: ReactNode
  className?: string
}

/**
 * How long ago something happened, with the date and time in the tooltip.
 * Rendered in the browser only (the server's "now", locale and time zone are
 * not the reader's).
 */
export const TimeAgo = ({
  time,
  format = 'long',
  prefix,
  end,
  fallback = null,
  className,
}: Props) => {
  const now = useNow()
  const date = parseTime(time)
  if (!date || now === null) return <>{fallback}</>

  const long = formatRelativeTime(date, now)
  const compact = formatRelativeTime(date, now, 'compact')
  const absolute = formatAbsoluteTime(date, { end })
  if (!long || !compact || !absolute) return <>{fallback}</>

  return (
    <time
      dateTime={date.toISOString()}
      // Beside the short form, the tooltip says it in words too.
      title={format === 'long' ? absolute : `${long} · ${absolute}`}
      className={className}
    >
      {prefix}
      {format === 'long' ? (
        long
      ) : format === 'compact' ? (
        compact
      ) : (
        <>
          <span className="md:hidden">{compact}</span>
          <span className="hidden md:inline">{long}</span>
        </>
      )}
    </time>
  )
}
