import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useContext } from 'react'

import { PlayerStats } from 'src/types'
import { fetchPlayerStats } from 'src/api'
import { useLeaderboardContext } from './LeaderboardContext'
import { AuthContext } from 'src/contexts'

interface Props {
  index: number
  typeId: 'regular' | 'puzzles' | 'turing' | 'hand' | 'brain'
  type: 'Regular' | 'Puzzles' | 'Bot/Not' | 'Hand' | 'Brain'
  display_name: string
  elo: number
}

export const LeaderboardEntry = ({
  typeId,
  type,
  index,
  display_name,
  elo,
}: Props) => {
  const [hover, setHover] = useState(false)
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const shouldShowPopupRef = useRef(false)
  const { activePopup, setActivePopup } = useLeaderboardContext()
  const { user } = useContext(AuthContext)

  const entryKey = `${typeId}-${display_name}-${index}`
  const isPopupVisible = activePopup === entryKey
  const isCurrentUser =
    user?.lichessId?.toLowerCase() === display_name.toLowerCase()

  let ratingKey:
    | 'regularRating'
    | 'trainRating'
    | 'botNotRating'
    | 'handRating'
    | 'brainRating'

  let highestRatingKey:
    | 'regularMax'
    | 'trainMax'
    | 'botNotMax'
    | 'handMax'
    | 'brainMax'

  let gamesKey:
    | 'regularGames'
    | 'trainGames'
    | 'botNotGames'
    | 'handGames'
    | 'brainGames'

  let gamesWonKey:
    | 'regularWins'
    | 'trainCorrect'
    | 'botNotCorrect'
    | 'handWins'
    | 'brainWins'

  switch (typeId) {
    case 'regular':
      ratingKey = 'regularRating'
      highestRatingKey = 'regularMax'
      gamesKey = 'regularGames'
      gamesWonKey = 'regularWins'
      break
    case 'puzzles':
      ratingKey = 'trainRating'
      highestRatingKey = 'trainMax'
      gamesKey = 'trainGames'
      gamesWonKey = 'trainCorrect'
      break
    case 'turing':
      ratingKey = 'botNotRating'
      highestRatingKey = 'botNotMax'
      gamesKey = 'botNotGames'
      gamesWonKey = 'botNotCorrect'
      break
    case 'hand':
      ratingKey = 'handRating'
      highestRatingKey = 'handMax'
      gamesKey = 'handGames'
      gamesWonKey = 'handWins'
      break
    case 'brain':
      ratingKey = 'brainRating'
      highestRatingKey = 'brainMax'
      gamesKey = 'brainGames'
      gamesWonKey = 'brainWins'
      break
    default:
      ratingKey = 'regularRating'
      highestRatingKey = 'regularMax'
      gamesKey = 'regularGames'
      gamesWonKey = 'regularWins'
      break
  }

  const fetchStats = useCallback(async () => {
    try {
      const playerStats = await fetchPlayerStats(display_name)
      setStats(playerStats)
      // Only show popup if we're still supposed to (user still hovering)
      if (shouldShowPopupRef.current && hover) {
        setActivePopup(entryKey)
      }
    } catch (error) {
      console.error(error)
    }
  }, [display_name, hover, entryKey, setActivePopup])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (hover) {
      shouldShowPopupRef.current = true
      timer = setTimeout(() => {
        fetchStats()
      }, 500)
    } else {
      shouldShowPopupRef.current = false
      setActivePopup(null)
    }

    return () => {
      clearTimeout(timer)
      if (!hover) {
        shouldShowPopupRef.current = false
      }
    }
  }, [hover, setActivePopup, entryKey, fetchStats])

  return (
    <div
      className={`group relative flex w-full items-center justify-between px-3 py-1 text-sm transition-colors duration-200 hover:bg-white/[3%] ${
        isCurrentUser ? 'bg-yellow-500/10 hover:bg-yellow-500/15' : ''
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center gap-1.5">
        <p className="w-4 text-xs text-white/60">{index + 1}</p>
        <Link
          href={`/profile/${display_name}`}
          className="flex items-center gap-1.5 text-white/90 transition-colors duration-200 hover:text-white hover:underline"
        >
          <p>
            {display_name} {index == 0 && '👑'}
          </p>
        </Link>
      </div>
      <p className="text-sm font-medium text-white/95">{elo}</p>
      {isPopupVisible && stats && (
        <div className="absolute left-0 top-[100%] z-50 flex w-full max-w-[24rem] flex-col overflow-hidden rounded border border-white/20 bg-[#171214]">
          <div className="flex w-full justify-between border-b border-white/10 bg-[#171214] px-3 py-2">
            <p className="text-sm text-white/95">
              <span className="font-bold">{display_name}</span>&apos;s {type}{' '}
              Statistics
            </p>
            <Link href={`/profile/${display_name}`}>
              <i className="material-symbols-outlined select-none text-base text-white/70 transition-colors hover:text-white">
                open_in_new
              </i>
            </Link>
          </div>
          <div className="flex items-center justify-between px-3 py-3">
            <div className="flex flex-col items-center justify-center gap-0.5">
              <p className="text-xs text-white/70">Rating</p>
              <b className="text-xl text-white/95">{stats[ratingKey]}</b>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5">
              <p className="text-xs text-white/70">Highest</p>
              <b className="text-xl text-white/95">{stats[highestRatingKey]}</b>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5">
              <p className="text-xs text-white/70">Games</p>
              <b className="text-xl text-white/95">{stats[gamesKey]}</b>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5">
              <p className="text-xs text-white/70">Win %</p>
              <b className="text-xl text-white/95">
                {((stats[gamesWonKey] / stats[gamesKey]) * 100).toFixed(0)}%
              </b>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
