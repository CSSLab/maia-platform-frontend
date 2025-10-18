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

const SAMPLE_GAMES: GameData[] = [
  {
    id: 'sample1',
    white: { name: 'Veselin Topalov' },
    black: { name: 'Viswanathan Anand' },
    isLive: false,
    url: '/analysis/a3SlSwsE/12',
  },
  {
    id: 'sample2',
    white: { name: 'Vladimir Kramnik' },
    black: { name: 'Viswanathan Anand' },
    isLive: false,
    url: '/analysis/HALtyMwL/5',
  },
  {
    id: 'sample3',
    white: { name: 'Anatoly Karpov' },
    black: { name: 'Garry Kasparov' },
    isLive: false,
    url: '/analysis/b6q7gDGK/16',
  },
  {
    id: 'sample4',
    white: { name: 'Anatoly Karpov' },
    black: { name: 'Garry Kasparov' },
    isLive: false,
    url: '/analysis/b6q7gDGK/24',
  },
  {
    id: 'sample5',
    white: { name: 'Robert Fischer' },
    black: { name: 'Boris Spassky' },
    isLive: false,
    url: '/analysis/Eyl4uwTZ/6',
  },
  {
    id: 'sample6',
    white: { name: 'Tigran Petrosian' },
    black: { name: 'Boris Spassky' },
    isLive: false,
    url: '/analysis/hm6ViybN/10',
  },
  {
    id: 'sample7',
    white: { name: 'Mikhail Botvinnik' },
    black: { name: 'Mikhail Tal' },
    isLive: false,
    url: '/analysis/wC9lnnUr/6',
  },
  {
    id: 'sample8',
    white: { name: 'Jose Capablanca' },
    black: { name: 'Alexander Alekhine' },
    isLive: false,
    url: '/analysis/G5ogxOsz/11',
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

  const rotationOptions = [
    'rotate(-2deg)',
    'rotate(-1deg)',
    'rotate(0deg)',
    'rotate(1deg)',
    'rotate(2deg)',
  ]

  const chessIcons = [
    'chess_knight',
    'chess_bishop',
    'chess_rook',
    'chess_pawn',
    'chess',
  ]

  const hash = (() => {
    let h = 0
    for (let i = 0; i < game.id.length; i++) {
      h = ((h << 5) - h + game.id.charCodeAt(i)) & 0xffffffff
    }
    return Math.abs(h)
  })()

  const rotation = rotationOptions[hash % rotationOptions.length]
  const chessIcon = chessIcons[hash % chessIcons.length]

  const truncateName = (name: string, maxLength = 15) => {
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
      className="group relative flex h-14 min-w-48 max-w-48 cursor-pointer flex-row items-center gap-3 rounded bg-white/[3%] px-4 py-2 backdrop-blur-sm transition-all duration-200 hover:bg-white/[6%]"
      style={{ transform: rotation }}
    >
      {game.isLive && (
        <div className="absolute -right-1 -top-1 flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5">
          <div className="h-1 w-1 animate-pulse rounded-full bg-white" />
          <span className="text-[8px] font-semibold text-white">LIVE</span>
        </div>
      )}

      <span className="material-symbols-outlined material-symbols-filled text-2xl text-white/30 transition-all duration-200 group-hover:text-white/60">
        {chessIcon}
      </span>

      {isBroadcast ? (
        <div className="flex flex-1 flex-col justify-center gap-0.5">
          <span className="text-[10px] font-medium text-white/30 transition-all duration-200 group-hover:text-white/70">
            Broadcast
          </span>
          <span className="truncate text-xs font-medium text-white/40 transition-all duration-200 group-hover:text-white">
            {truncateName(game.black.name, 18)}
          </span>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-0.5">
          <span className="truncate text-xs font-medium text-white/40 transition-all duration-200 group-hover:text-white">
            {truncateName(game.white.name, 16)}
          </span>
          <span className="truncate text-xs font-medium text-white/40 transition-all duration-200 group-hover:text-white">
            vs {truncateName(game.black.name, 14)}
          </span>
        </div>
      )}
    </div>
  )
}

export const GameCarousel: React.FC = () => {
  const router = useRouter()
  const [games, setGames] = useState<GameData[]>(SAMPLE_GAMES)
  const [isPaused, setIsPaused] = useState(false)
  const abortController = useRef<AbortController | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  const handleGameStart = useCallback((gameData: StreamedGame) => {
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

      const existingLiveIndex = newGames.findIndex(
        (g) => g.id === `live-${gameData.id}`,
      )

      if (existingLiveIndex !== -1) {
        newGames[existingLiveIndex] = liveGameData
      } else {
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
    fetchNewGame()
  }, [])

  const fetchNewGame = useCallback(async () => {
    try {
      const tvGame = await fetchLichessTVGame()

      if (abortController.current) {
        abortController.current.abort()
      }

      abortController.current = new AbortController()

      streamLichessGameMoves(
        tvGame.gameId,
        handleGameStart,
        handleMove,
        handleStreamComplete,
        abortController.current.signal,
      ).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Live game streaming error:', err)
        }
      })
    } catch (err) {
      console.error('Error fetching live game:', err)
    }
  }, [handleGameStart, handleMove, handleStreamComplete])

  const fetchBroadcast = useCallback(async () => {
    try {
      const topBroadcasts = await getLichessTopBroadcasts()

      if (topBroadcasts.active.length > 0) {
        const broadcastData = convertTopBroadcastToBroadcast(
          topBroadcasts.active[0],
        )

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

          const existingBroadcastIndex = newGames.findIndex(
            (g) => g.id === `broadcast-${broadcastData.tour.id}`,
          )

          if (existingBroadcastIndex !== -1) {
            newGames[existingBroadcastIndex] = broadcastGameData
          } else {
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

  useEffect(() => {
    if (isPaused || !carouselRef.current) return

    const scroll = () => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current
        const halfWidth = scrollWidth / 2

        if (scrollLeft >= halfWidth - 10) {
          carouselRef.current.scrollTo({ left: 0, behavior: 'auto' })
        } else {
          carouselRef.current.scrollBy({ left: 0.5, behavior: 'auto' })
        }
      }
    }

    const interval = setInterval(scroll, 20)
    return () => clearInterval(interval)
  }, [isPaused])

  useEffect(() => {
    fetchNewGame()
    fetchBroadcast()

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
    <section className="relative w-full overflow-y-visible py-6">
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
          {[...games, ...games].map((game, index) => (
            <GameChip
              key={`${game.id}-${index}`}
              game={game}
              onClick={() => handleGameClick(game)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

if (
  typeof document !== 'undefined' &&
  !document.getElementById('carousel-styles')
) {
  const styleSheet = document.createElement('style')
  styleSheet.id = 'carousel-styles'
  styleSheet.innerText = `
    .carousel-container::-webkit-scrollbar {
      display: none;
    }
  `
  document.head.appendChild(styleSheet)
}
