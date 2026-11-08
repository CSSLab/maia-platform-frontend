import { User } from 'src/types'
import React, { ReactNode, useCallback, useEffect, useState } from 'react'
import { fetchAccount, connectLichessUrl, logoutAndFetchAccount } from 'src/api'
import {
  SignInSource,
  trackLichessConnectionInitiated,
  trackLichessSignInReturned,
  trackLoggedOut,
} from 'src/lib/analytics'
import {
  identifyUser,
  registerProperties,
  resetUser,
} from 'src/lib/posthogClient'

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

/**
 * Events from here on are this account's (its client_id). Its creation date
 * is known only for a guest account: a Lichess sign-in issues a new cookie, so
 * its date is that of the sign-in. Set once, so a guest who links Lichess
 * keeps the date the account was made.
 */
const identifyAccount = (account: User) => {
  if (!account.clientId) return
  const linked = Boolean(account.lichessId)
  identifyUser(
    account.clientId,
    { is_lichess_linked: linked },
    !linked && account.cookieCreatedAt
      ? {
          account_created_at: new Date(
            account.cookieCreatedAt * 1000,
          ).toISOString(),
        }
      : undefined,
  )
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
      identifyAccount(response)
      const pending = takePendingSignIn()
      if (pending) {
        trackLichessSignInReturned(signedIn, pending.source, pending.seconds)
      }
    }

    getAndSetAccount()
  }, [])

  const connectLichess = useCallback(
    (source: SignInSource, returnTo?: string) => {
      trackLichessConnectionInitiated(source)
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
      window.location.assign(
        connectLichessUrl + '?redirect_url=' + encodeURIComponent(back),
      )
    },
    [],
  )

  const logout = useCallback(async () => {
    trackLoggedOut()
    // The guest account the backend gives next is someone new.
    resetUser()
    const response = await logoutAndFetchAccount()
    setUser(response)
    registerProperties({ signed_in: Boolean(response.lichessId) })
    identifyAccount(response)
  }, [])

  return (
    <AuthContext.Provider value={{ user, logout, connectLichess }}>
      {children}
    </AuthContext.Provider>
  )
}
