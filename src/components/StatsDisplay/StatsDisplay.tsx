import { useEffect, useState } from 'react'

import { AllStats, SingleStats } from 'src/hooks/useStats'
import { CaretUpIcon, CaretDownIcon } from 'src/components/Icons/icons'

interface SingleProps {
  stats: SingleStats | undefined
}

const SingleStatsDisplay: React.FC<SingleProps> = ({ stats }: SingleProps) => {
  const winPercentage = stats ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0

  return (
    <div className="flex flex-row">
      <div className="flex flex-1 flex-col gap-1">
        <div className={`${stats == undefined && 'opacity-0'}`}>
          {stats?.gamesWon || 0}
        </div>
        <div className="text-xs">Correct</div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className={`${stats == undefined && 'opacity-0'}`}>
          {stats?.gamesPlayed || 0}
        </div>
        <div className="text-xs">Played</div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className={`${stats == undefined && 'opacity-0'}`}>
          {Number.isNaN(winPercentage) ? '-' : Math.trunc(winPercentage)}%
        </div>
        <div className="text-xs">Rate</div>
      </div>
    </div>
  )
}

interface RatingDiffProps {
  diff: number
}

const RatingDiffDisplay: React.FC<RatingDiffProps> = ({
  diff,
}: RatingDiffProps) => {
  const icon = diff < 0 ? CaretDownIcon : CaretUpIcon
  const sign = diff < 0 ? '–' : '+'

  return (
    <div
      className={`ml-4 flex flex-row items-center gap-2 text-base ${diff < 0 ? 'text-red-500' : 'text-green-500'}`}
    >
      <i
        className={`mb-3 h-4 w-4 ${diff < 0 ? '*:fill-red-500' : 'fill-green-500'}`}
      >
        {icon}
      </i>
      <p className="text-lg">
        {sign}
        {Math.abs(diff)}
      </p>
    </div>
  )
}

interface Props {
  stats: AllStats
  hideSession?: boolean
}

export const StatsDisplay: React.FC<Props> = ({
  hideSession,
  stats,
}: Props) => {
  const [cachedRating, setCachedRating] = useState<number | undefined>(0)

  useEffect(() => {
    if (stats.rating == undefined) {
      return
    }
    setCachedRating(stats.rating)
  }, [stats])

  return (
    <div className="bg-background-1/90 flex flex-col gap-3 rounded-l p-4">
      <div className="flex flex-col">
        <div className="text-sm uppercase">Your rating</div>
        <div
          className={`flex flex-row items-center text-2xl font-bold ${cachedRating === undefined && 'opacity-0'} ${stats.rating === undefined && 'opacity-50'}`}
        >
          {cachedRating || 0}
          {stats.rating != undefined && stats.lastRating != undefined ? (
            <RatingDiffDisplay diff={stats.rating - stats.lastRating} />
          ) : null}
        </div>
      </div>
      {hideSession ? null : (
        <div className="flex flex-col gap-1">
          <div className="text-xs uppercase">This session</div>
          <SingleStatsDisplay stats={stats.sessionStats} />
        </div>
      )}
      <div className="flex flex-col gap-1 text-secondary">
        <div className="text-xs uppercase">Lifetime</div>
        <SingleStatsDisplay stats={stats.lifetimeStats} />
      </div>
    </div>
  )
}
