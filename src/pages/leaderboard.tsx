import Head from 'next/head'
import React, { useCallback, useEffect, useState } from 'react'

import { fetchLeaderboard } from 'src/api'
import { LeaderboardColumn } from 'src/components'
import { LeaderboardProvider } from 'src/components/Leaderboard/LeaderboardContext'

type Ranking = { display_name: string; elo: number }[]

const COLUMNS = [
  { id: 'regular', name: 'Regular', key: 'play_leaders' },
  { id: 'puzzles', name: 'Puzzles', key: 'puzzles_leaders' },
  { id: 'turing', name: 'Bot/Not', key: 'turing_leaders' },
  { id: 'hand', name: 'Hand', key: 'hand_leaders' },
  { id: 'brain', name: 'Brain', key: 'brain_leaders' },
] as const

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

// The heading and the columns render at once (and on the server); each
// column shows placeholder rows until the rankings arrive.
const Leaderboard: React.FC = () => {
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [rankings, setRankings] = useState<Record<string, Ranking> | null>(null)

  const load = useCallback(async () => {
    setError(false)
    try {
      const lb = await fetchLeaderboard()
      setLastUpdated(new Date(lb.last_updated + 'Z'))
      setRankings(
        Object.fromEntries(
          COLUMNS.map((column) => [column.id, lb[column.key]]),
        ),
      )
    } catch (err) {
      console.error('Error fetching leaderboard:', err)
      setError(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <LeaderboardProvider>
      <div className="relative mx-auto w-full px-4 py-8 md:w-[90%] md:px-0">
        <div className="mb-2 flex w-full flex-col items-start justify-between md:flex-row md:items-center">
          <h1 className="mb-2 text-3xl font-bold text-white">
            Rating Leaderboards
          </h1>

          <p className="mt-4 text-sm text-white/60 md:mt-0">
            Last updated: {lastUpdated ? getTimeAgo(lastUpdated) : '...'}
          </p>
        </div>
        {error ? (
          <div className="flex w-full flex-col items-center gap-3 rounded-md border border-glass-border bg-glass px-6 py-10 text-center">
            <p className="text-secondary">
              Couldn&apos;t load the leaderboard.
            </p>
            <button
              onClick={load}
              className="rounded bg-human-4 px-4 py-1.5 text-sm text-white transition hover:bg-human-4/80"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 justify-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {COLUMNS.map((column) => (
              <LeaderboardColumn
                key={column.id}
                id={column.id}
                name={column.name}
                ranking={rankings?.[column.id]}
              />
            ))}
          </div>
        )}
        <div className="mt-3 w-full">
          <p className="text-xs text-white/60">
            <span className="font-medium text-white/80">Note:</span> Each
            leaderboard column only features players who have played at least
            one game of the corresponding type within the last 7 days.
          </p>
        </div>
      </div>
    </LeaderboardProvider>
  )
}

const LeaderboardPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Leaderboard – Maia Chess</title>
        <meta
          name="description"
          content="View top-ranked players across all Maia Chess game modes. Competitive leaderboards for regular play, puzzles, bot detection, hand & brain chess with live ratings and statistics."
        />
      </Head>
      <Leaderboard />
    </>
  )
}

export default LeaderboardPage
