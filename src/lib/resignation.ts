import { Color, Termination } from 'src/types'

const other = (color: Color): Color => (color === 'white' ? 'black' : 'white')
const capitalized = (color: Color) => (color === 'white' ? 'White' : 'Black')

/**
 * A game against Maia ended by resignation: `resigning` is the side that
 * resigned, and `by` says whether that was the player or Maia. The other
 * side wins.
 */
export const resignTermination = (
  resigning: Color,
  by: 'player' | 'maia',
): Termination => {
  const winner = other(resigning)
  return {
    result: winner === 'white' ? '1-0' : '0-1',
    winner,
    type: 'resign',
    resignedBy: by,
    condition: `${capitalized(resigning)} resigned`,
  }
}

/**
 * What the game-over panel says about a resignation, for the player playing
 * `player` ("Maia resigned. You win."); undefined for any other ending, which
 * the result says well enough.
 */
export const describeTermination = (
  termination: Termination | undefined,
  player: Color,
): string | undefined => {
  if (termination?.type !== 'resign') return undefined
  const by =
    termination.resignedBy ??
    (termination.winner === player ? 'maia' : 'player')
  return by === 'maia' ? 'Maia resigned. You win.' : 'You resigned. Maia wins.'
}
