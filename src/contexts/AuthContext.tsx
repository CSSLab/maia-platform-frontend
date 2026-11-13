import { User } from 'src/types'
import React, { ReactNode, useCallback, useEffect, useState } from 'react'
import { fetchAccount, connectLichessUrl, logoutAndFetchAccount } from 'src/api'
import {
  SignInSource,
  trackLichessConnectionInitiated,
  trackLichessSignInReturned,
  trackLoggedOut,
} from 'src/lib/analytics'
import { registerProperties } from 'src/lib/posthogClient'
import {
  fetchLoginOriginProof,
  isVercelPreview,
  lichessLoginUrl,
} from 'src/lib/previewLogin'

interface IAuthContext {
  user: User | null
  /**
   * Goes to Lichess's sign-in, then back to `returnTo` (a path on this site)
   * or, without it, the current page.
   */
  connectLichess: (source: SignInSource, returnTo?: string) => void
  logout: () => Promise<void>
}

export const AuthContext = React.createContext<IAuthContext>({
  user: null,
  connectLichess: () => {
    throw new Error('poorly provided AuthContext, missing connectLichess')
  },
  logout: () => {
    throw new Error('poorly provided AuthContext, missing logout')
  },
})

// A sign-in started in this tab: kept while the tab goes to Lichess and
// comes back, so that the page it returns to can tell whether it worked.
const SIGN_IN_KEY = 'maia.signInStarted'
// Older than this, the visitor didn't come back from that sign-in.
const SIGN_IN_MAX_MS = 30 * 60 * 1000

// Set once this browser has been signed in, and kept after signing out.
const SIGNED_IN_HERE_KEY = 'maia.signedInHere'

const wasSignedInHere = () => {
  try {
    return window.localStorage.getItem(SIGNED_IN_HERE_KEY) === '1'
  } catch {
    return false
  }
}

const markSignedInHere = () => {
  try {
    window.localStorage.setItem(SIGNED_IN_HERE_KEY, '1')
  } catch {
    // Not measured, as above.
  }
}

const takePendingSignIn = () => {
  try {
    const raw = window.sessionStorage.getItem(SIGN_IN_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(SIGN_IN_KEY)
    const pending = JSON.parse(raw) as { source: SignInSource; at: number }
    const elapsed = Date.now() - pending.at
    if (!(elapsed >= 0 && elapsed < SIGN_IN_MAX_MS)) return null
    return { source: pending.source, seconds: Math.round(elapsed / 1000) }
  } catch {
    return null
  }
}

export const AuthContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}: {
  children: ReactNode
}) => {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    async function getAndSetAccount() {
      const response = await fetchAccount()
      setUser(response)

      const signedIn = Boolean(response.lichessId)
      // On every event from now on, so that any of them can be split by it.
      registerProperties({ signed_in: signedIn })
      const signedInBefore = wasSignedInHere()
      if (signedIn) markSignedInHere()
      const pending = takePendingSignIn()
      if (pending) {
        trackLichessSignInReturned(
          signedIn,
          pending.source,
          pending.seconds,
          signedInBefore,
        )
      }
    }

    getAndSetAccount()
  }, [])

  const connectLichess = useCallback(
    (source: SignInSource, returnTo?: string) => {
      trackLichessConnectionInitiated(source, wasSignedInHere())
      try {
        window.sessionStorage.setItem(
          SIGN_IN_KEY,
          JSON.stringify({ source, at: Date.now() }),
        )
      } catch {
        // Not measured, but the sign-in still works.
      }
      const back = returnTo
        ? new URL(returnTo, window.location.origin).toString()
        : window.location.toString()
      const go = (proof?: string | null) =>
        window.location.assign(lichessLoginUrl(connectLichessUrl, back, proof))
      // A Vercel preview first proves to the backend that it is ours.
      if (isVercelPreview()) void fetchLoginOriginProof().then(go)
      else go()
    },
    [],
  )

  const logout = useCallback(async () => {
    trackLoggedOut()
    const response = await logoutAndFetchAccount()
    setUser(response)
    registerProperties({ signed_in: Boolean(response.lichessId) })
  }, [])

  return (
    <AuthContext.Provider value={{ user, logout, connectLichess }}>
      {children}
    </AuthContext.Provider>
  )
}
