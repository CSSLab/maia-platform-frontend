import { useContext, useEffect, useState } from 'react'
import { AuthContext } from 'src/contexts/AuthContext'
import { serverGamesFor } from 'src/lib/serverGames'

// How long a page waits for the account request before playing the old way,
// which doesn't need it.
const ACCOUNT_WAIT_MS = 4000

/**
 * Whether this player's games are held by the server (serverGamesFor):
 * undefined while that isn't known yet, and false if the account request
 * hasn't answered in time.
 */
export const useServerGames = (): boolean | undefined => {
  const { user } = useContext(AuthContext)
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    const timeout = setTimeout(() => setGaveUp(true), ACCOUNT_WAIT_MS)
    return () => clearTimeout(timeout)
  }, [])
  return serverGamesFor(user) ?? (gaveUp ? false : undefined)
}
