import { buildUrl } from './utils'

export const getGlobalStats = async () => {
  const res = await fetch(buildUrl('auth/global_stats'))
  const data = await res.json()

  return data
}
