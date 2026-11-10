import { formatAbsoluteTime, formatMonthYear } from 'src/lib/relativeTime'

interface Props {
  /** When the account was created; nothing is rendered without it. */
  time?: number | null
}

/**
 * "Joined November 2026", with the day in the tooltip. Written in the
 * reader's locale and time zone, which is the same on every render: profiles
 * are fetched by the browser, so the server never renders this.
 */
export const JoinedDate = ({ time }: Props) => {
  const month = formatMonthYear(time)
  if (!time || !month) return null

  return (
    <time
      dateTime={new Date(time).toISOString()}
      title={formatAbsoluteTime(time) ?? undefined}
      className="whitespace-nowrap text-xs text-white/50"
    >
      Joined {month}
    </time>
  )
}
