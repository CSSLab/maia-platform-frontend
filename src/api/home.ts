import { buildUrl } from './utils'

export const getActiveUserCount = async (): Promise<number> => {
  try {
    const response = await fetch('/api/active-users')

    const data = await response.json()

    if (data.success && typeof data.activeUsers === 'number') {
      return data.activeUsers
    }
  } catch (error) {
    console.error('Failed to fetch active user count:', error)
  }

  return 0
}

export const getGlobalStats = async () => {
  const res = await fetch(buildUrl('auth/global_stats'))
  const data = await res.json()

  return data
}
