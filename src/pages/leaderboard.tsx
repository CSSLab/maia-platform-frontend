import Head from 'next/head'
import React, { useCallback, useEffect, useState } from 'react'

import {
  BrainIcon,
  HandIcon,
  RegularPlayIcon,
  TrainIcon,
  BotOrNotIcon,
} from 'src/components/Icons/icons'
import { getLeaderboard } from 'src/api'
import { LeaderboardColumn } from 'src/components'
import { LeaderboardProvider } from 'src/components/Leaderboard/LeaderboardContext'

const Leaderboard: React.FC = () => {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [leaderboard, setLeaderboard] = useState<
    {
      icon: React.JSX.Element
      ranking: { display_name: string; elo: number }[]
      name: 'Regular' | 'Train' | 'Bot/Not' | 'Hand' | 'Brain'
      id: 'regular' | 'train' | 'turing' | 'hand' | 'brain'
    }[]
  >()

  const getTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    )

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60)
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24)
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`

    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
  }

  const fetchLeaderboard = useCallback(async () => {
    const lb = await getLeaderboard()
    setLastUpdated(new Date(lb.last_updated + 'Z'))
    setLeaderboard([
      {
        id: 'regular',
        icon: <RegularPlayIcon />,
        name: 'Regular',
        ranking: lb.play_leaders,
      },
      {
        id: 'train',
        icon: <TrainIcon />,
        name: 'Train',
        ranking: lb.puzzles_leaders,
      },
      {
        id: 'turing',
        icon: <BotOrNotIcon />,
        name: 'Bot/Not',
        ranking: lb.turing_leaders,
      },
      {
        id: 'hand',
        icon: <HandIcon />,
        name: 'Hand',
        ranking: lb.hand_leaders,
      },
      {
        id: 'brain',
        icon: <BrainIcon />,
        name: 'Brain',
        ranking: lb.brain_leaders,
      },
    ])
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return (
    <LeaderboardProvider>
      <div className="mx-auto flex h-full w-[90%] flex-col items-start justify-center gap-4 py-[1%]">
        <Head>
          <title>Leaderboard – Maia Chess</title>
          <meta
            name="description"
            content="Top users across all Maia Chess leaderboards"
          />
        </Head>
        <div className="flex w-full flex-row items-end justify-between">
          <h1 className="text-3xl font-bold">Rating Leaderboards</h1>
          <p className="text-sm text-secondary">
            Last updated: {lastUpdated ? getTimeAgo(lastUpdated) : '...'}
          </p>
        </div>
        <div className="grid h-full w-full grid-cols-1 justify-start gap-3 md:grid-cols-2 lg:grid-cols-3">
          {leaderboard?.map((column, index) => (
            <LeaderboardColumn key={index} {...column} />
          ))}
        </div>
        <div className="my-2 w-full">
          <p className="text-xs text-secondary">
            <span className="font-medium">Note:</span> Each leaderboard column
            only features players who have played atleast one game of the
            corresponding type within the last 7 days.
          </p>
        </div>
      </div>
    </LeaderboardProvider>
  )
}

const LeaderboardPage: React.FC = () => {
  return (
    <>
      <Leaderboard />
    </>
  )
}

export default LeaderboardPage
