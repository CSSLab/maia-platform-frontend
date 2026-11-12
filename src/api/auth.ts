import { buildUrl } from './utils'
import { requestAccount } from './guest'
import { savedResponses } from 'src/lib/savedResponses'

const parseAccountInfo = (data: { [x: string]: string }) => {
  const clientId = data['client_id']
  const displayName = data['display_name']
  const lichessId = data['lichess_id']

  return {
    clientId: clientId,
    displayName: displayName,
    lichessId: lichessId,
    // A boolean in the answer, whatever the type above says.
    serverGames: (data['server_games'] as unknown) === true,
  }
}

export const fetchAccount = async () => parseAccountInfo(await requestAccount())

export const logoutAndFetchAccount = async () => {
  await fetch(buildUrl('auth/logout'))

  return fetchAccount()
}

// The header's leaderboard badge and the leaderboard page ask at the same
// time; they share a request while it is in flight. An answer from the last
// five minutes, in any tab, is used without asking again.
let leaderboardRequest: Promise<any> | null = null
const savedLeaderboard = savedResponses<any>({
  name: 'leaderboard',
  maxAgeMs: 5 * 60 * 1000,
})

export const fetchLeaderboard = async () => {
  const saved = savedLeaderboard.get('all')
  if (saved !== undefined) return saved
  if (!leaderboardRequest) {
    leaderboardRequest = fetch(buildUrl('auth/leaderboard'))
      .then(async (res) => {
        const data = await res.json()
        if (res.ok) savedLeaderboard.set('all', data)
        return data
      })
      .finally(() => {
        leaderboardRequest = null
      })
  }
  return leaderboardRequest
}
