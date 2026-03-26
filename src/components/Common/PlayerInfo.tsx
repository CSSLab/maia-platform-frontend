interface PlayerInfoProps {
  name: string
  color: string
  rating?: number
  termination?: string
  showArrowLegend?: boolean
  currentFen?: string
  orientation?: 'white' | 'black'
  clock?: {
    timeInSeconds: number
    isActive: boolean
    lastUpdateTime: number
  }
  rounded?: 'all' | 'top' | 'bottom' | 'none'
}

import { useState, useEffect } from 'react'
import { MaterialBalance } from './MaterialBalance'

export const PlayerInfo: React.FC<PlayerInfoProps> = ({
  name,
  rating,
  color,
  termination,
  showArrowLegend = false,
  currentFen,
  clock,
  rounded = 'all',
}) => {
  const [currentTime, setCurrentTime] = useState<number>(
    clock?.timeInSeconds || 0,
  )

  useEffect(() => {
    if (!clock || !clock.isActive) return

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsedSinceUpdate = (now - clock.lastUpdateTime) / 1000
      const newTime = Math.max(0, clock.timeInSeconds - elapsedSinceUpdate)
      setCurrentTime(newTime)
    }, 100)

    return () => clearInterval(interval)
  }, [clock])

  // Update current time when clock prop changes (new move received)
  useEffect(() => {
    if (clock) {
      setCurrentTime(clock.timeInSeconds)
    }
  }, [clock?.timeInSeconds, clock?.lastUpdateTime])

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const roundedClass =
    rounded === 'top'
      ? 'rounded-t-md'
      : rounded === 'bottom'
        ? 'rounded-b-md'
        : rounded === 'none'
          ? ''
          : 'rounded-md'

  return (
    <div
      className={`flex h-10 w-full items-center justify-between ${roundedClass} border border-glass-border bg-glass px-4 backdrop-blur-md`}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={`h-2.5 w-2.5 rounded-full ${color === 'white' ? 'bg-white' : 'border bg-black'}`}
        />
        <p className="text-sm">
          {name ?? 'Unknown'}{' '}
          <span className="text-xs text-secondary">
            {rating ? `(${rating})` : null}
          </span>
        </p>
        <MaterialBalance fen={currentFen} color={color as 'white' | 'black'} />
      </div>
      <div className="flex items-center gap-4">
        {showArrowLegend && (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div
              className="flex items-center gap-1"
              title="Most Human Move (Maia)"
            >
              <span className="relative inline-flex h-2.5 w-4 items-center">
                <span className="h-[2px] w-[calc(100%-4px)] rounded-full bg-[#882020]" />
                <span className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[3px] border-l-[4px] border-y-transparent border-l-[#882020]" />
              </span>
              <span className="text-xxs text-human-3">Maia</span>
            </div>
            <div
              className="flex items-center gap-1"
              title="Best Engine Move (Stockfish)"
            >
              <span className="relative inline-flex h-2.5 w-4 items-center">
                <span className="h-[2px] w-[calc(100%-4px)] rounded-full bg-[#003088]" />
                <span className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[3px] border-l-[4px] border-y-transparent border-l-[#003088]" />
              </span>
              <span className="text-xxs text-engine-3">SF</span>
            </div>
            <div className="flex items-center gap-1" title="Move Played">
              <span className="relative inline-flex h-2.5 w-4 items-center">
                <span className="h-[3px] w-[calc(100%-4px)] rounded-full bg-[#4A8FB3]" />
                <span className="absolute left-[1px] right-[5px] top-1/2 h-[1px] -translate-y-1/2 rounded-full bg-white" />
                <span className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[3px] border-l-[4px] border-y-transparent border-l-[#4A8FB3]" />
              </span>
              <span className="text-xxs text-primary/80">Played</span>
            </div>
          </div>
        )}

        {clock && (
          <div
            className={`flex items-center rounded bg-glass px-2 py-1 ${
              clock.isActive ? 'bg-primary text-black' : ''
            }`}
          >
            <span
              className={`font-mono text-xs font-medium ${
                clock.isActive ? '' : 'text-secondary/80'
              } ${currentTime < 60 && clock.isActive ? 'text-red-700' : ''}`}
            >
              {formatTime(currentTime)}
            </span>
          </div>
        )}

        {termination === color ? (
          <p className="text-engine-3">1</p>
        ) : termination === undefined ? (
          <></>
        ) : termination !== 'none' ? (
          <p className="text-human-3">0</p>
        ) : (
          <p className="text-secondary">½</p>
        )}
      </div>
    </div>
  )
}
