import { buildUrl } from './utils'
import { requestAccount } from './guest'

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

export const fetchAccount = async () => parseAccountInfo(await requestAccount())

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
