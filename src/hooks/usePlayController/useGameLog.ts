import { useEffect, useRef } from 'react'

/**
 * When a game against Maia is sent to the backend (play/submit_move).
 *
 * It was sent after every half-move, Maia's included: about 330,000 requests
 * a day, a third of everything the site's host (Vercel) counts and bills. Each
 * request carries every move so far, so sending fewer of them loses nothing
 * but the moves since the last one, and those are sent when the page is hidden
 * or left. A game is now sent every LOG_EVERY_PLIES half-moves, when it ends,
 * and when the page is hidden, left or moves on to another game.
 */
export const LOG_EVERY_PLIES = 20

export type GameOverState = 'not_over' | 'rules' | 'resign' | 'time'

const keyOf = (plies: number, state: GameOverState) => `${plies}/${state}`

/** Whether the game should be sent now, given what was last sent. */
export const shouldLogGame = (
  plies: number,
  state: GameOverState,
  lastSent: string | null,
) => {
  if (keyOf(plies, state) === lastSent) return false
  if (state !== 'not_over') return true
  return plies > 0 && plies % LOG_EVERY_PLIES === 0
}

/** Whether moves are waiting to be sent when the page goes away. */
export const hasUnsentMoves = (
  plies: number,
  state: GameOverState,
  lastSent: string | null,
) => state === 'not_over' && plies > 0 && keyOf(plies, state) !== lastSent

/**
 * Calls `send` as above. `send(true)` is for a page being hidden or left: it
 * should send with fetch's keepalive and not wait for an answer.
 */
export const useGameLog = ({
  gameId,
  plies,
  state,
  send,
}: {
  gameId: string
  plies: number
  state: GameOverState
  send: (leaving: boolean) => void
}) => {
  const lastSent = useRef<string | null>(null)
  const latest = useRef({ gameId, plies, state, send })

  // Updated in an effect, not while rendering, so that when the game changes
  // the cleanup below still sees the game that is being left.
  useEffect(() => {
    latest.current = { gameId, plies, state, send }
  })

  useEffect(() => {
    if (!gameId) return
    if (!shouldLogGame(plies, state, lastSent.current)) return
    lastSent.current = keyOf(plies, state)
    latest.current.send(false)
  }, [gameId, plies, state])

  useEffect(() => {
    const flush = () => {
      const { gameId, plies, state, send } = latest.current
      if (!gameId || !hasUnsentMoves(plies, state, lastSent.current)) return
      lastSent.current = keyOf(plies, state)
      send(true)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flush)
      // Leaving the game, for another game or another page.
      flush()
      lastSent.current = null
    }
  }, [gameId])
}
