// Clocks for broadcast games. Lichess broadcast PGNs carry the time each
// player had left after a move as a `[%clk h:mm:ss]` comment on that move, so
// the clocks at any position of the game can be read back from the moves
// played to reach it.

// The seconds in a `[%clk ...]` comment, or undefined when the comment has no
// clock. Lichess writes `h:mm:ss`, other relays `m:ss`, and some add tenths
// (`0:00:09.5`).
export const parseClockComment = (comment: string): number | undefined => {
  const match = comment.match(/\[%clk\s+(\d+):(\d+)(?::(\d+(?:\.\d+)?))?\s*\]/)
  if (!match) return undefined

  const [, first, second, third] = match
  if (third !== undefined) {
    return (
      parseInt(first, 10) * 3600 + parseInt(second, 10) * 60 + parseFloat(third)
    )
  }
  return parseInt(first, 10) * 60 + parseInt(second, 10)
}

export interface BroadcastClocks {
  white?: number
  black?: number
}

// The clocks after `ply` moves of a game that starts from the usual position
// (white moves on even indices of `moveClocks`): each player's time is the one
// recorded after their latest move up to there. A player who hasn't moved yet,
// or whose moves carried no clock, has none.
export const getClocksAtPly = (
  moveClocks: (number | null)[] | undefined,
  ply: number,
): BroadcastClocks => {
  const clocks: BroadcastClocks = {}
  if (!moveClocks) return clocks

  for (let i = Math.min(ply, moveClocks.length) - 1; i >= 0; i--) {
    const clock = moveClocks[i]
    if (clock === null || clock === undefined) continue
    const color = i % 2 === 0 ? 'white' : 'black'
    if (clocks[color] === undefined) clocks[color] = clock
    if (clocks.white !== undefined && clocks.black !== undefined) break
  }
  return clocks
}

// `1:23:45` past an hour, `4:05` below it. Seconds are rounded down, as on a
// chess clock: 0:00 means the flag has fallen.
export const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const ss = secs.toString().padStart(2, '0')
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${ss}`
    : `${minutes}:${ss}`
}
