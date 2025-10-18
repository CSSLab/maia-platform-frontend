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

export const fetchAccount = async () => {
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
