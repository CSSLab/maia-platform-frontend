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
    <div
      className="flex h-6 items-end gap-[3px]"
      role="img"
      aria-label={days.map((d) => `${weekday(d.day)}: ${d.games}`).join(', ')}
    >
      {days.map((d) => (
        <span
          key={d.day}
          title={`${weekday(d.day)}: ${d.games} game${d.games === 1 ? '' : 's'}`}
          className={`w-1.5 rounded-sm ${d.games ? 'bg-human-4' : 'bg-white/15'}`}
          style={{
            height: d.games ? `${30 + (70 * d.games) / most}%` : '3px',
          }}
        />
      ))}
    </div>
  )
}

/**
 * "Your progress", in one slim line: games against Maia over the last week
 * as small daily bars, and the visitor's Maia rating in each mode played.
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
        className="h-[52px] w-full animate-pulse rounded-lg border border-glass-border bg-glass"
        aria-busy="true"
        data-testid="progress-loading"
      />
    )
  }

  if (progress.ratings.length === 0 && progress.gamesThisWeek === 0) {
    return (
      <p className="px-1 text-sm text-white/50" data-testid="progress-strip">
        Play Maia, solve puzzles or try Bot or Not, and your ratings show up
        here.
      </p>
    )
  }

  const week = `${progress.gamesThisWeek}${progress.gamesThisWeekAtLeast ? '+' : ''}`
  return (
    <section
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-glass-border bg-glass px-4 py-2.5 backdrop-blur-md"
      data-testid="progress-strip"
      aria-label="Your progress"
    >
      <div className="flex items-end gap-2.5">
        <WeekBars days={progress.days} />
        <p className="text-xs leading-tight text-white/60">
          <span className="text-sm font-semibold tabular-nums text-white/90">
            {week}
          </span>{' '}
          game{week === '1' ? '' : 's'} this week
        </p>
      </div>
      {progress.ratings.length > 0 && (
        <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {progress.ratings.map((rating) => (
            <div key={rating.mode} className="flex items-baseline gap-1.5">
              <dt className="text-[11px] uppercase tracking-wider text-white/50">
                {rating.label}
              </dt>
              <dd className="text-sm font-semibold tabular-nums text-white/90">
                {rating.rating}
                {RATING_TREND_ENABLED ? (
                  <>
                    {' '}
                    <RatingTrend mode={rating.mode} />
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
