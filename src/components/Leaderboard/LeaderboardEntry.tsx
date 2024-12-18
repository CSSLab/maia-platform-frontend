import Link from 'next/link'
import { useEffect, useState } from 'react'

import { PlayerStats } from 'src/types'
import { getPlayerStats } from 'src/api'

interface Props {
  index: number
  typeId: 'regular' | 'train' | 'turing' | 'hand' | 'brain'
  type: 'Regular' | 'Train' | 'Bot/Not' | 'Hand' | 'Brain'
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
  const [popup, setPopup] = useState(false)
  const [stats, setStats] = useState<PlayerStats | null>(null)

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
    | 'botNotCorrect'
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
    case 'train':
      ratingKey = 'trainRating'
      highestRatingKey = 'trainMax'
      gamesKey = 'trainGames'
      gamesWonKey = 'trainCorrect'
      break
    case 'turing':
      ratingKey = 'botNotRating'
      highestRatingKey = 'botNotMax'
      gamesKey = 'botNotCorrect'
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

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (hover) {
      timer = setTimeout(() => {
        fetchStats()
      }, 300)
    } else {
      setPopup(false)
    }

    return () => clearTimeout(timer)
  }, [hover])

  const fetchStats = async () => {
    try {
      const playerStats = await getPlayerStats(display_name)
      setStats(playerStats)
      setPopup(true)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div
      className={`relative flex w-full items-center justify-between px-6 py-2 ${index % 2 === 0 ? 'bg-background-1/90' : 'bg-background-1/50'}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center gap-2">
        <p className="w-5">{index + 1}</p>
        <Link
          href={`/profile/${display_name}`}
          className="flex items-center gap-2 hover:underline"
        >
          <p>
            {display_name} {index == 0 && '👑'}
          </p>
        </Link>
      </div>
      <p>{elo}</p>
      {popup && stats && (
        <div className="absolute left-0 top-[100%] z-20 flex w-full max-w-[26rem] flex-col overflow-hidden rounded border border-white/10 bg-background-1">
          <div className="flex w-full justify-between bg-backdrop/50 px-4 py-2">
            <p>
              <span className="font-bold">{display_name}</span>&apos;s {type}{' '}
              Statistics
            </p>
            <Link href={`/profile/${display_name}`}>
              <i className="material-symbols-outlined select-none text-lg text-primary hover:text-human-1">
                open_in_new
              </i>
            </Link>
          </div>
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex flex-col items-center justify-center gap-0.5 text-human-1">
              <p className="text-sm xl:text-base">Rating</p>
              <b className="text-3xl xl:text-3xl">{stats[ratingKey]}</b>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5">
              <p className="text-sm xl:text-base">Highest</p>
              <b className="text-3xl xl:text-3xl">{stats[highestRatingKey]}</b>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5">
              <p className="text-sm xl:text-base">Games</p>
              <b className="text-3xl xl:text-3xl">{stats[gamesKey]}</b>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5">
              <p className="text-sm xl:text-base">Win %</p>
              <b className="text-3xl xl:text-3xl">
                {((stats[gamesWonKey] / stats[gamesKey]) * 100).toFixed(0)}%
              </b>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
