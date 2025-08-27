import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { fetchLichessTVGame, streamLichessGameMoves } from 'src/api'
import {
  getLichessTopBroadcasts,
  convertTopBroadcastToBroadcast,
} from 'src/api/broadcasts'
import { StreamedGame, StreamedMove } from 'src/types/stream'

interface GameData {
  id: string
  white: {
    name: string
    rating?: number
  }
  black: {
    name: string
    rating?: number
  }
  isLive: boolean
  url?: string
}

// Sample predefined games
const SAMPLE_GAMES: GameData[] = [
  {
    id: 'sample1',
    white: { name: 'Magnus Carlsen', rating: 2830 },
    black: { name: 'Fabiano Caruana', rating: 2805 },
    isLive: false,
    url: '/analysis/magnus-vs-fabiano-2024',
  },
  {
    id: 'sample2',
    white: { name: 'Ding Liren', rating: 2780 },
    black: { name: 'Hikaru Nakamura', rating: 2760 },
    isLive: false,
    url: '/analysis/ding-vs-hikaru-2024',
  },
  {
    id: 'sample3',
    white: { name: 'Ian Nepomniachtchi', rating: 2755 },
    black: { name: 'Wesley So', rating: 2745 },
    isLive: false,
    url: '/analysis/nepo-vs-wesley-2024',
  },
  {
    id: 'sample4',
    white: { name: 'Alireza Firouzja', rating: 2740 },
    black: { name: 'Anish Giri', rating: 2720 },
    isLive: false,
    url: '/analysis/alireza-vs-anish-2024',
  },
  {
    id: 'sample5',
    white: { name: 'Levon Aronian', rating: 2735 },
    black: { name: 'Maxime Vachier-Lagrave', rating: 2730 },
    isLive: false,
    url: '/analysis/levon-vs-mvl-2024',
  },
  {
    id: 'sample6',
    white: { name: 'Shakhriyar Mamedyarov', rating: 2725 },
    black: { name: 'Teimour Radjabov', rating: 2715 },
    isLive: false,
    url: '/analysis/shakh-vs-teimour-2024',
  },
  {
    id: 'sample7',
    white: { name: 'Richard Rapport', rating: 2710 },
    black: { name: 'Sergey Karjakin', rating: 2700 },
    isLive: false,
    url: '/analysis/rapport-vs-karjakin-2024',
  },
  {
    id: 'sample8',
    white: { name: 'Viswanathan Anand', rating: 2690 },
    black: { name: 'Vladimir Kramnik', rating: 2685 },
    isLive: false,
    url: '/analysis/anand-vs-kramnik-2024',
  },
  {
    id: 'sample9',
    white: { name: 'Pentala Harikrishna', rating: 2675 },
    black: { name: 'Yu Yangyi', rating: 2670 },
    isLive: false,
    url: '/analysis/hari-vs-yangyi-2024',
  },
  {
    id: 'sample10',
    white: { name: 'Alexander Grischuk', rating: 2665 },
    black: { name: 'Jan-Krzysztof Duda', rating: 2660 },
    isLive: false,
    url: '/analysis/grischuk-vs-duda-2024',
  },
]

interface GameChipProps {
  game: GameData
  onClick: () => void
}

const GameChip: React.FC<GameChipProps> = ({ game, onClick }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  // Preset rotation options
  const rotationOptions = [
    'rotate(-2deg)',
    'rotate(-1deg)',
    'rotate(0deg)',
    'rotate(1deg)',
    'rotate(2deg)',
  ]

  // Chess icon options
  const chessIcons = [
    'chess_knight',
    'chess_bishop',
    'chess_king',
    'chess_rook',
    'chess_pawn',
    'chess',
  ]

  // Select rotation and icon based on game ID hash
  const hash = (() => {
    let h = 0
    for (let i = 0; i < game.id.length; i++) {
      h = ((h << 5) - h + game.id.charCodeAt(i)) & 0xffffffff
    }
    return Math.abs(h)
  })()

  const rotation = rotationOptions[hash % rotationOptions.length]
  const chessIcon = chessIcons[hash % chessIcons.length]

  const truncateName = (name: string, maxLength = 12) => {
    return name.length > maxLength
      ? name.substring(0, maxLength - 1) + '…'
      : name
  }

  const isBroadcast = game.id.startsWith('broadcast-')

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={
        isBroadcast
          ? `View broadcast: ${game.black.name}${game.isLive ? ' (Live)' : ''}`
          : `View game between ${game.white.name} and ${game.black.name}${game.isLive ? ' (Live)' : ''}`
      }
      className="group relative flex h-14 min-w-48 max-w-48 cursor-pointer flex-row items-center gap-3 rounded bg-white/[3%] px-4 py-2 backdrop-blur-sm transition-all duration-200 hover:bg-white/[6%] focus:outline-none focus:ring-2 focus:ring-white/20"
      style={{ transform: rotation }}
    >
      {/* Live Indicator */}
      {game.isLive && (
        <div className="absolute -right-1 -top-1 flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5">
          <div className="h-1 w-1 animate-pulse rounded-full bg-white" />
          <span className="text-[8px] font-semibold text-white">LIVE</span>
        </div>
      )}
      {/* Chess Icon */}
      <span className="material-symbols-outlined material-symbols-filled text-2xl text-white/30 transition-all duration-200 group-hover:text-white/60">
        {chessIcon}
      </span>

      {/* Text Content */}
      {isBroadcast ? (
        <div className="flex flex-1 flex-col justify-center gap-0.5">
          <span className="text-[10px] font-medium text-white/30 transition-all duration-200 group-hover:text-white/70">
            Broadcast
          </span>
          <span className="truncate text-xs font-medium text-white/40 transition-all duration-200 group-hover:text-white">
            {truncateName(game.black.name, 16)}
          </span>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-0.5">
          <span className="truncate text-xs font-medium text-white/40 transition-all duration-200 group-hover:text-white">
            {truncateName(game.white.name, 13)}
          </span>
          <span className="truncate text-xs font-medium text-white/40 transition-all duration-200 group-hover:text-white">
            vs {truncateName(game.black.name, 10)}
          </span>
        </div>
      )}
    </div>
  )
}

export const LiveChessBoardShowcase: React.FC = () => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [games, setGames] = useState<GameData[]>(SAMPLE_GAMES)
  const [isPaused, setIsPaused] = useState(false)
  const abortController = useRef<AbortController | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  const handleGameStart = useCallback((gameData: StreamedGame) => {
    // Update the games list with live game data
    setGames((prevGames) => {
      const newGames = [...prevGames]
      const liveGameData: GameData = {
        id: `live-${gameData.id}`,
        white: {
          name: gameData.players?.white?.user?.name || 'White',
          rating: gameData.players?.white?.rating,
        },
        black: {
          name: gameData.players?.black?.user?.name || 'Black',
          rating: gameData.players?.black?.rating,
        },
        isLive: true,
        url: `/analysis/stream/${gameData.id}`,
      }

      // Check if this live game already exists
      const existingLiveIndex = newGames.findIndex(
        (g) => g.id === `live-${gameData.id}`,
      )
      if (existingLiveIndex !== -1) {
        // Update existing live game
        newGames[existingLiveIndex] = liveGameData
      } else {
        // Replace a sample game at index 2 (3rd position) with live game data
        const targetIndex = 2
        if (targetIndex < newGames.length && !newGames[targetIndex].isLive) {
          newGames[targetIndex] = liveGameData
        }
      }
      return newGames
    })
  }, [])

  const handleMove = useCallback((_moveData: StreamedMove) => {
    // Handle move updates if needed
  }, [])

  const handleStreamComplete = useCallback(() => {
    console.log('Live board showcase - Stream completed')
    fetchNewGame()
  }, [])

  const fetchNewGame = useCallback(async () => {
    try {
      setError(null)
      const tvGame = await fetchLichessTVGame()

      // Stop current stream if any
      if (abortController.current) {
        abortController.current.abort()
      }

      // Start new stream
      abortController.current = new AbortController()

      streamLichessGameMoves(
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

  const fetchBroadcast = useCallback(async () => {
    try {
      const topBroadcasts = await getLichessTopBroadcasts()

      if (topBroadcasts.active.length > 0) {
        const broadcastData = convertTopBroadcastToBroadcast(
          topBroadcasts.active[0],
        )

        // Add broadcast to games list
        setGames((prevGames) => {
          const newGames = [...prevGames]
          const broadcastGameData: GameData = {
            id: `broadcast-${broadcastData.tour.id}`,
            white: {
              name: 'Broadcast',
              rating: undefined,
            },
            black: {
              name: broadcastData.tour.name || 'Live Tournament',
              rating: undefined,
            },
            isLive: true,
            url: `/broadcast/${broadcastData.tour.id}/${broadcastData.rounds[0]?.id}`,
          }

          // Check if this broadcast already exists
          const existingBroadcastIndex = newGames.findIndex(
            (g) => g.id === `broadcast-${broadcastData.tour.id}`,
          )
          if (existingBroadcastIndex !== -1) {
            // Update existing broadcast
            newGames[existingBroadcastIndex] = broadcastGameData
          } else {
            // Replace a sample game at index 7 (8th position) with broadcast data
            const targetIndex = 7
            if (
              targetIndex < newGames.length &&
              !newGames[targetIndex].isLive
            ) {
              newGames[targetIndex] = broadcastGameData
            }
          }
          return newGames
        })
      }
    } catch (err) {
      console.error('Error fetching broadcast:', err)
    }
  }, [])

  // Auto-scroll effect
  useEffect(() => {
    if (isPaused || !carouselRef.current) return

    const scroll = () => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current
        const halfWidth = scrollWidth / 2

        if (scrollLeft >= halfWidth - 10) {
          // Reset to beginning without animation when we reach the duplicate section
          carouselRef.current.scrollTo({ left: 0, behavior: 'auto' })
        } else {
          // Smooth continuous scroll
          carouselRef.current.scrollBy({ left: 0.5, behavior: 'auto' })
        }
      }
    }

    const interval = setInterval(scroll, 20)
    return () => clearInterval(interval)
  }, [isPaused])

  useEffect(() => {
    // Initial fetch
    fetchNewGame()
    fetchBroadcast()

    // Cleanup on unmount
    return () => {
      if (abortController.current) {
        abortController.current.abort()
      }
    }
  }, [fetchNewGame, fetchBroadcast])

  const handleGameClick = useCallback(
    (game: GameData) => {
      if (game.url) {
        router.push(game.url)
      }
    },
    [router],
  )

  return (
    <div className="relative mb-10 w-full overflow-y-visible">
      <motion.div
        ref={carouselRef}
        className="flex gap-10 overflow-x-hidden overflow-y-visible py-2 pl-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Render games twice for seamless loop */}
        {[...games, ...games].map((game, index) => (
          <GameChip
            key={`${game.id}-${index}`}
            game={game}
            onClick={() => handleGameClick(game)}
          />
        ))}
      </motion.div>

      {error && (
        <div className="mt-2 text-center">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={fetchNewGame}
            className="mt-1 text-[10px] font-medium text-white/60 hover:text-white/80 hover:underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}

// Hide scrollbar for webkit browsers
const styles = `
  .carousel-container::-webkit-scrollbar {
    display: none;
  }
`

if (
  typeof document !== 'undefined' &&
  !document.getElementById('carousel-styles')
) {
  const styleSheet = document.createElement('style')
  styleSheet.id = 'carousel-styles'
  styleSheet.innerText = styles
  document.head.appendChild(styleSheet)
}
