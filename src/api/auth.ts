import { buildUrl } from './utils'

const parseAccountInfo = (data: { [x: string]: string }) => {
  const clientId = data['client_id']
  const displayName = data['display_name']
  const lichessId = data['lichess_id']

  return {
    clientId: clientId,
    displayName: displayName,
    lichessId: lichessId,
  }
}

declare global {
  interface Window {
    /** Started by the page's HTML (see _document.tsx). */
    __account?: Promise<{ [x: string]: string }>
  }
}

export const fetchAccount = async () => {
  // The first call takes the request the page's HTML started.
  const early = typeof window !== 'undefined' ? window.__account : undefined
  if (early) {
    delete window.__account
    const data = await early.catch(() => null)
    if (data) return parseAccountInfo(data)
  }

  const res = await fetch(buildUrl('auth/account'))
  const data = await res.json()

  return parseAccountInfo(data)
}

export const logoutAndFetchAccount = async () => {
  await fetch(buildUrl('auth/logout'))

  return fetchAccount()
}

// The header's leaderboard badge and the leaderboard page ask at the same
// time; they share a request while it is in flight.
let leaderboardRequest: Promise<any> | null = null

export const fetchLeaderboard = async () => {
  if (!leaderboardRequest) {
    leaderboardRequest = fetch(buildUrl('auth/leaderboard'))
      .then((res) => res.json())
      .finally(() => {
        leaderboardRequest = null
      })
  }
  return leaderboardRequest
}
