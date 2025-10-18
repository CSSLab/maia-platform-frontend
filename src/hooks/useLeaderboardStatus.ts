import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchLeaderboard } from 'src/api'
import {
  LeaderboardData,
  LeaderboardStatus,
  LeaderboardPosition,
  GameType,
} from 'src/types'

interface LeaderboardCache {
  data: LeaderboardData | null
  timestamp: number
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

export const useLeaderboardStatus = (displayName?: string) => {
  const [status, setStatus] = useState<LeaderboardStatus>({
    isOnLeaderboard: false,
    positions: [],
    totalLeaderboards: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cacheRef = useRef<LeaderboardCache>({ data: null, timestamp: 0 })

  const gameTypeMap: Record<string, { key: GameType; name: string }> = {
    play_leaders: { key: 'regular', name: 'Regular' },
    puzzles_leaders: { key: 'train', name: 'Train' },
    turing_leaders: { key: 'turing', name: 'Bot/Not' },
    hand_leaders: { key: 'hand', name: 'Hand' },
    brain_leaders: { key: 'brain', name: 'Brain' },
  }

  const checkLeaderboardStatus = useCallback(
    (
      leaderboardData: LeaderboardData,
      targetDisplayName: string,
    ): LeaderboardStatus => {
      const positions: LeaderboardPosition[] = []

      Object.entries(gameTypeMap).forEach(([apiKey, { key, name }]) => {
        const leaders = leaderboardData[
          apiKey as keyof LeaderboardData
        ] as Array<{
          display_name: string
          elo: number
        }>

        if (Array.isArray(leaders)) {
          const position = leaders.findIndex(
            (leader) => leader.display_name === targetDisplayName,
          )

          if (position !== -1 && position < 10) {
            // Only consider top 10
            positions.push({
              gameType: key,
              gameName: name,
              position: position + 1, // Convert to 1-based index
              elo: leaders[position].elo,
            })
          }
        }
      })

      return {
        isOnLeaderboard: positions.length > 0,
        positions,
        totalLeaderboards: positions.length,
      }
    },
    [],
  )

  const fetchLeaderboardStatus = useCallback(async () => {
    if (!displayName) {
      setStatus({
        isOnLeaderboard: false,
        positions: [],
        totalLeaderboards: 0,
      })
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Check cache first
      const now = Date.now()
      if (
        cacheRef.current.data &&
        now - cacheRef.current.timestamp < CACHE_DURATION
      ) {
        const leaderboardStatus = checkLeaderboardStatus(
          cacheRef.current.data,
          displayName,
        )
        setStatus(leaderboardStatus)
        setLoading(false)
        return
      }

      // Fetch fresh data
      const leaderboardData = await fetchLeaderboard()

      // Update cache
      cacheRef.current = {
        data: leaderboardData,
        timestamp: now,
      }

      const leaderboardStatus = checkLeaderboardStatus(
        leaderboardData,
        displayName,
      )
      setStatus(leaderboardStatus)
    } catch (err) {
      console.error('Error fetching leaderboard status:', err)
      setError('Failed to fetch leaderboard data')
      setStatus({
        isOnLeaderboard: false,
        positions: [],
        totalLeaderboards: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [displayName, checkLeaderboardStatus])

  const refreshStatus = useCallback(() => {
    // Clear cache and refetch
    cacheRef.current = { data: null, timestamp: 0 }
    fetchLeaderboardStatus()
  }, [fetchLeaderboardStatus])

  useEffect(() => {
    fetchLeaderboardStatus()
  }, [fetchLeaderboardStatus])

  return {
    status,
    loading,
    error,
    refreshStatus,
  }
}
