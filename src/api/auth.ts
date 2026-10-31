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

export const fetchLeaderboard = async () => {
  const res = await fetch(buildUrl('auth/leaderboard'))
  const data = await res.json()

  return data
}
