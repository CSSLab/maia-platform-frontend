import { useCallback, useEffect, useState } from 'react'

export interface ApiResult {
  rating: number
  provisional?: boolean
  gamesPlayed: number
  gamesWon: number
}

export interface SingleStats {
  gamesPlayed: number
  gamesWon: number
}

export interface AllStats {
  lastRating: number | undefined
  rating: number | undefined
  provisional?: boolean
  session: SingleStats
  lifetime: SingleStats | undefined
}

type IncrementStatsFunction = (gamesPlayed: number, gamesWon: number) => void
// `provisional` comes with the result when the backend sends it; otherwise the
// flag from the page's load stands.
type UpdateStatsFunction = (newRating: number, provisional?: unknown) => void

export const useStats = (
  apiCall: () => Promise<ApiResult>,
): [AllStats, IncrementStatsFunction, UpdateStatsFunction] => {
  const [stats, setStats] = useState<AllStats>({
    rating: undefined,
    lastRating: undefined,
    session: {
      gamesPlayed: 0,
      gamesWon: 0,
    },
    lifetime: undefined,
  })

  useEffect(() => {
    const statsLoader = async () => {
      const loadedStats = await apiCall()

      setStats((s) => ({
        ...stats,
        rating: loadedStats.rating,
        provisional: loadedStats.provisional,
        lastRating: stats.rating,
        lifetime: {
          gamesPlayed: loadedStats.gamesPlayed,
          gamesWon: loadedStats.gamesWon,
        },
      }))
    }

    statsLoader()
  }, [])

  const incrementStats: IncrementStatsFunction = useCallback(
    (gamesPlayed: number, gamesWon: number) => {
      setStats((s) => ({
        ...s,
        session: {
          gamesPlayed: s.session.gamesPlayed + gamesPlayed,
          gamesWon: s.session.gamesWon + gamesWon,
        },
        lifetime: s.lifetime
          ? {
              gamesPlayed: s.lifetime.gamesPlayed + gamesPlayed,
              gamesWon: s.lifetime.gamesWon + gamesWon,
            }
          : {
              gamesPlayed,
              gamesWon,
            },
      }))
    },
    [],
  )

  const updateRating: UpdateStatsFunction = useCallback(
    (newRating, provisional) => {
      setStats((s) => ({
        ...s,
        rating: newRating,
        lastRating: s.rating,
        provisional:
          typeof provisional === 'boolean' ? provisional : s.provisional,
      }))
    },
    [],
  )

  return [stats, incrementStats, updateRating]
}
