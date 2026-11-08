import { useEffect, useState } from 'react'
import {
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
 * Behind RATING_TREND_ENABLED: a mode's rating over time, once the backend
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
    <span className={change >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
      {change >= 0 ? '+' : '−'}
      {Math.abs(Math.round(change))}
    </span>
  )
}

const Tile = ({
  label,
  value,
  extra,
}: {
  label: string
  value: string
  extra?: React.ReactNode
}) => (
  <div className="flex min-w-[6.5rem] flex-col rounded-md border border-glass-border bg-white/5 px-3 py-2">
    <span className="text-[11px] uppercase tracking-wider text-white/60">
      {label}
    </span>
    <span className="text-lg font-semibold text-white/95">
      {value}{' '}
      {extra ? <span className="text-xs font-normal">{extra}</span> : null}
    </span>
  </div>
)

/** "Your progress": Maia ratings per mode, and games this week. */
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
      <section
        className="flex gap-2 overflow-hidden"
        aria-busy="true"
        data-testid="progress-loading"
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-14 w-28 shrink-0 animate-pulse rounded-md bg-white/5"
          />
        ))}
      </section>
    )
  }

  const week = `${progress.gamesThisWeek}${progress.gamesThisWeekAtLeast ? '+' : ''}`
  return (
    <section className="flex flex-col gap-2" data-testid="progress-strip">
      <h2 className="text-sm font-semibold text-white/80">Your progress</h2>
      {progress.ratings.length === 0 && progress.gamesThisWeek === 0 ? (
        <p className="text-sm text-white/60">
          Play Maia, solve puzzles or try Bot or Not, and your ratings show up
          here.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Tile label="Games this week" value={week} />
          {progress.ratings.map((rating) => (
            <Tile
              key={rating.mode}
              label={rating.label}
              value={String(rating.rating)}
              extra={
                RATING_TREND_ENABLED ? <RatingTrend mode={rating.mode} /> : null
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
