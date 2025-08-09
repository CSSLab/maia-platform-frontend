import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { Chess } from 'chess.ts'
import Chessground from '@react-chess/chessground'
import { getLichessTVGame, streamLichessGame } from 'src/api/lichess/streaming'
import { StreamedGame, StreamedMove } from 'src/types/stream'

interface LiveGameData {
  gameId: string
  white?: {
    user: {
      id: string
      name: string
    }
    rating?: number
  }
  black?: {
    user: {
      id: string
      name: string
    }
    rating?: number
  }
  currentFen?: string
  isLive?: boolean
}

export const LiveChessBoardShowcase: React.FC = () => {
  const router = useRouter()
  const [liveGame, setLiveGame] = useState<LiveGameData | null>(null)
  const [currentFen, setCurrentFen] = useState<string>(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  )
  const [error, setError] = useState<string | null>(null)
  const abortController = useRef<AbortController | null>(null)

  const handleGameStart = useCallback((gameData: StreamedGame) => {
    if (gameData.fen) {
      setCurrentFen(gameData.fen)
    }
    setLiveGame({
      gameId: gameData.id,
      white: gameData.players?.white,
      black: gameData.players?.black,
      currentFen: gameData.fen,
      isLive: true,
    })
  }, [])

  const handleMove = useCallback((moveData: StreamedMove) => {
    if (moveData.fen) {
      setCurrentFen(moveData.fen)
    }
  }, [])

  const handleStreamComplete = useCallback(() => {
    console.log('Live board showcase - Stream completed')
    fetchNewGame()
  }, [])

  const fetchNewGame = useCallback(async () => {
    try {
      setError(null)
      const tvGame = await getLichessTVGame()

      // Stop current stream if any
      if (abortController.current) {
        abortController.current.abort()
      }

      // Start new stream
      abortController.current = new AbortController()

      setLiveGame({
        gameId: tvGame.gameId,
        white: tvGame.white,
        black: tvGame.black,
        isLive: true,
      })

      streamLichessGame(
        tvGame.gameId,
        handleGameStart,
        handleMove,
        handleStreamComplete,
        abortController.current.signal,
      ).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Live board streaming error:', err)
          setError('Connection lost')
        }
      })
    } catch (err) {
      console.error('Error fetching new live game:', err)
      setError('Failed to load live game')
    }
  }, [handleGameStart, handleMove, handleStreamComplete])

  useEffect(() => {
    // Initial fetch
    fetchNewGame()

    // Cleanup on unmount
    return () => {
      if (abortController.current) {
        abortController.current.abort()
      }
    }
  }, []) // Remove fetchNewGame dependency to prevent re-renders

  const handleClick = () => {
    if (liveGame?.gameId) {
      router.push(`/analysis/stream/${liveGame.gameId}`)
    }
  }

  // Keep FEN only; Chessground renders from FEN directly

  return (
    <div className="flex flex-col items-center">
      <motion.div
        className="relative inline-block h-[192px] w-[192px] cursor-pointer overflow-hidden rounded-lg transition-colors duration-200"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        onClick={handleClick}
      >
        {/* Live indicator */}
        {liveGame?.isLive && (
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-red-500 px-2 py-1">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            <span className="text-xs font-semibold text-white">LIVE</span>
          </div>
        )}

        {/* Chess board */}
        <Chessground
          contained
          width={192}
          height={192}
          config={{
            fen: currentFen,
            viewOnly: true,
            coordinates: false,
            drawable: {
              enabled: false,
            },
            highlight: {
              lastMove: true,
              check: true,
            },
            animation: {
              enabled: true,
              duration: 200,
            },
          }}
        />
      </motion.div>

      {/* Player names below the board */}
      {liveGame && (
        <div className="mt-2 w-48 text-center">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full border border-gray-300 bg-white" />
              <span className="truncate font-medium">
                {liveGame.white?.user?.name || 'White'}
              </span>
              {liveGame.white?.rating && (
                <span className="shrink-0 text-[11px] text-secondary">
                  ({liveGame.white.rating})
                </span>
              )}
            </div>
            <span className="text-[11px] text-secondary">vs</span>
            <div className="flex min-w-0 items-center justify-end gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-black" />
              <span className="truncate font-medium">
                {liveGame.black?.user?.name || 'Black'}
              </span>
              {liveGame.black?.rating && (
                <span className="shrink-0 text-[11px] text-secondary">
                  ({liveGame.black.rating})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={fetchNewGame}
            className="mt-1 text-xs font-medium text-human-4 hover:underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
