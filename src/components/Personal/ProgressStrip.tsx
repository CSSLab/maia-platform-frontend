import { useEffect, useState } from 'react'
import {
  DayGames,
  ModeRating,
  Progress,
  RATING_TREND_ENABLED,
  RatingPoint,
  fetchProgress,
  fetchRatingHistory,
} from 'src/lib/personal/progress'

interface Props {
  onShown?: () => void
}

/**
 * Behind RATING_TREND_ENABLED: a mode's rating change, once the backend
 * serves rating histories. Shows nothing without one.
 */
const RatingTrend = ({ mode }: { mode: ModeRating['mode'] }) => {
  const [points, setPoints] = useState<RatingPoint[] | null>(null)
  useEffect(() => {
    fetchRatingHistory(mode)
      .then(setPoints)
      .catch(() => setPoints(null))
  }, [mode])
  if (!points || points.length < 2) return null
  const change = points[points.length - 1].rating - points[0].rating
  return (
    <span
      className={`text-[11px] ${change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
    >
      {change >= 0 ? '+' : '−'}
      {Math.abs(Math.round(change))}
    </span>
  )
}

const weekday = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
  })
}

/** The last 7 days as small bars, one a day, as tall as its games. */
const WeekBars = ({ days }: { days: DayGames[] }) => {
  const most = Math.max(1, ...days.map((d) => d.games))
  return (
    <span
      className="inline-flex h-3.5 items-end gap-[2px]"
      role="img"
      aria-label={days.map((d) => `${weekday(d.day)}: ${d.games}`).join(', ')}
    >
      {days.map((d) => (
        <span
          key={d.day}
          title={`${weekday(d.day)}: ${d.games} game${d.games === 1 ? '' : 's'}`}
          className={`w-[3px] rounded-full ${d.games ? 'bg-human-2' : 'bg-white/20'}`}
          style={{
            height: d.games ? `${35 + (65 * d.games) / most}%` : '2px',
          }}
        />
      ))}
    </span>
  )
}

/**
 * "Your progress", in one quiet line under the site's stats: games against
 * Maia over the last week as small daily bars, and the visitor's Maia rating
 * in each mode played.
 */
export const ProgressStrip = ({ onShown }: Props) => {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let canceled = false
    fetchProgress()
      .then((result) => {
        if (canceled) return
        setProgress(result)
        onShown?.()
      })
      .catch(() => {
        if (!canceled) setFailed(true)
      })
    return () => {
      canceled = true
    }
  }, [])

  if (failed) return null

  if (!progress) {
    return (
      <div
        className="mx-auto h-5 w-64 max-w-full animate-pulse rounded bg-white/5"
        aria-busy="true"
        data-testid="progress-loading"
      />
    )
  }

  if (progress.ratings.length === 0 && progress.gamesThisWeek === 0) {
    return (
      <p
        className="text-center text-sm text-white/50"
        data-testid="progress-strip"
      >
        Play Maia, solve puzzles or try Bot or Not, and your ratings show up
        here.
      </p>
    )
  }

  const week = `${progress.gamesThisWeek}${progress.gamesThisWeekAtLeast ? '+' : ''}`
  return (
    <section
      className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-sm text-white/55"
      data-testid="progress-strip"
      aria-label="Your progress"
    >
      <span className="inline-flex items-center gap-2">
        <WeekBars days={progress.days} />
        <span>
          <span className="font-semibold tabular-nums text-white/90">
            {week}
          </span>{' '}
          game{week === '1' ? '' : 's'} this week
        </span>
      </span>
      {progress.ratings.map((rating) => (
        <span key={rating.mode} className="inline-flex items-baseline gap-1.5">
          {rating.label}
          <span className="font-semibold tabular-nums text-white/90">
            {rating.rating}
          </span>
          {RATING_TREND_ENABLED ? <RatingTrend mode={rating.mode} /> : null}
        </span>
      ))}
    </section>
  )
}
