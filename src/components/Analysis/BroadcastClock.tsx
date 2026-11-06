import { useEffect, useMemo, useState } from 'react'

import { BroadcastGame, GameNode } from 'src/types'
import {
  BroadcastClocks,
  formatClock,
  getClocksAtPly,
} from 'src/lib/broadcastClocks'

export interface BroadcastClockState extends BroadcastClocks {
  // The side whose clock is running: set only at the latest position of a
  // game in progress whose last move arrived while the page was open.
  running: 'white' | 'black' | null
  // When the running clock last stopped at the time shown in `white`/`black`.
  runningSince?: number
}

// How many moves were played to reach `node`. A position in a side line
// takes the clocks of the main-line position it branched from, as the clocks
// only exist for the moves really played.
const mainlinePly = (node: GameNode | null | undefined): number => {
  let current = node ?? null
  while (current && !current.isMainline) current = current.parent
  let ply = 0
  while (current?.parent) {
    ply++
    current = current.parent
  }
  return ply
}

// Both players' clocks at the position being viewed.
export const useBroadcastClocks = (
  game: BroadcastGame | null | undefined,
  node: GameNode | null | undefined,
): BroadcastClockState => {
  const ply = mainlinePly(node)

  return useMemo(() => {
    if (!game?.moveClocks) return { running: null }

    const clocks = getClocksAtPly(game.moveClocks, ply)
    const toMove = ply % 2 === 0 ? 'white' : 'black'
    const isRunning =
      game.result === '*' &&
      game.lastMoveReceivedAt !== undefined &&
      ply === game.moves.length &&
      clocks[toMove] !== undefined

    return {
      ...clocks,
      running: isRunning ? toMove : null,
      runningSince: isRunning ? game.lastMoveReceivedAt : undefined,
    }
  }, [
    game?.moveClocks,
    game?.result,
    game?.lastMoveReceivedAt,
    game?.moves.length,
    ply,
  ])
}

interface Props {
  clocks: BroadcastClockState
  color: 'white' | 'black'
  className?: string
}

// One player's clock. A running clock counts down from the time its player
// had when the opponent's move arrived.
export const BroadcastClock = ({ clocks, color, className = '' }: Props) => {
  const seconds = clocks[color]
  const isRunning = clocks.running === color
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isRunning) return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [isRunning])

  if (seconds === undefined) return null

  const shown =
    isRunning && clocks.runningSince !== undefined
      ? seconds - Math.max(0, now - clocks.runningSince) / 1000
      : seconds

  return (
    <span
      className={`rounded px-1 font-mono tabular-nums ${
        isRunning
          ? `bg-primary/90 ${shown < 60 ? 'text-red-700' : 'text-black'}`
          : 'bg-glass text-secondary'
      } ${className}`}
      title={`${color === 'white' ? 'White' : 'Black'}'s clock`}
    >
      {formatClock(shown)}
    </span>
  )
}
