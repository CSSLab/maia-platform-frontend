import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { fetchLichessTVGame } from 'src/api/lichess'

interface LiveGameData {
  gameId: string
  white: {
    name: string
    rating?: number
  }
  black: {
    name: string
    rating?: number
  }
  lastMoveFen?: string
  isLive?: boolean
}

export const LiveChessWidget: React.FC = () => {
  const [liveGame, setLiveGame] = useState<LiveGameData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  const fetchLiveGame = useCallback(async () => {
    // Prevent multiple simultaneous requests
    if (isFetching) return

    setIsFetching(true)
    setIsLoading(true)
    try {
      setError(null)
      const tvGame = await fetchLichessTVGame()

      setLiveGame({
        gameId: tvGame.gameId,
        white: {
          name: tvGame.white?.name || 'White',
          rating: tvGame.white?.rating,
        },
        black: {
          name: tvGame.black?.name || 'Black',
          rating: tvGame.black?.rating,
        },
        isLive: true, // TV games are always live
      })
    } catch (err) {
      console.error('Error fetching live game:', err)
      setError('Failed to load live game')
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }, [isFetching])

  useEffect(() => {
    // Initial fetch
    fetchLiveGame()

    // Update every 5 minutes to be respectful to Lichess API
    const interval = setInterval(fetchLiveGame, 300000) // 5 minutes

    return () => clearInterval(interval)
  }, []) // Remove fetchLiveGame dependency to prevent re-renders

  if (isLoading && !liveGame) {
    return (
      <motion.div
        className="flex h-[200px] w-[200px] items-center justify-center rounded-md border border-glass-border bg-glass"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined animate-pulse text-xl text-secondary">
            live_tv
          </span>
          <p className="px-2 text-xs text-secondary">Loading live game...</p>
        </div>
      </motion.div>
    )
  }

  if (error && !liveGame) {
    return (
      <motion.div
        className="flex h-[200px] w-[200px] items-center justify-center rounded-md border border-glass-border bg-glass"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-xl text-red-400">
            error
          </span>
          <p className="px-2 text-xs text-secondary">{error}</p>
          <button
            onClick={fetchLiveGame}
            className="rounded bg-human-4 px-2 py-1 text-xs text-white transition hover:bg-human-4/80"
          >
            Retry
          </button>
        </div>
      </motion.div>
    )
  }

  if (!liveGame) {
    return (
      <motion.div
        className="flex h-[200px] w-[200px] items-center justify-center rounded-md border border-glass-border bg-glass"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-xl text-secondary">
            live_tv
          </span>
          <p className="px-2 text-xs text-secondary">No live game available</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="relative overflow-hidden rounded-md border border-glass-border bg-glass"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Live indicator */}
      {liveGame.isLive && (
        <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded bg-red-500 px-2 py-1">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="text-xs font-semibold text-white">LIVE</span>
        </div>
      )}

      {/* Mini chessboard placeholder - you could implement an actual mini board here */}
      <div className="flex h-[140px] w-[200px] items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100">
        <div className="grid grid-cols-4 gap-0.5">
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className={`h-4 w-4 ${
                (Math.floor(i / 4) + (i % 4)) % 2 === 0
                  ? 'bg-amber-200'
                  : 'bg-amber-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Game info */}
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full border border-gray-300 bg-white" />
            <span className="max-w-[60px] truncate font-medium">
              {liveGame.white.name}
            </span>
            {liveGame.white.rating && (
              <span className="text-secondary">({liveGame.white.rating})</span>
            )}
          </div>
          <span className="text-secondary">vs</span>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-black" />
            <span className="max-w-[60px] truncate font-medium">
              {liveGame.black.name}
            </span>
            {liveGame.black.rating && (
              <span className="text-secondary">({liveGame.black.rating})</span>
            )}
          </div>
        </div>

        <Link href={`/analysis/stream/${liveGame.gameId}`}>
          <motion.button
            className="w-full rounded bg-human-4 px-3 py-2 text-sm font-medium text-white transition hover:bg-human-4/90"
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm">
                analytics
              </span>
              Watch Live Analysis
            </div>
          </motion.button>
        </Link>
      </div>
    </motion.div>
  )
}
