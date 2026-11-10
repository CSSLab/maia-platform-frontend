import Head from 'next/head'
import React, { useCallback, useEffect, useState } from 'react'

import { fetchLeaderboard } from 'src/api'
import { LeaderboardData } from 'src/types'
import { LeaderboardColumn, TimeAgo } from 'src/components'
import { parseTimeMs } from 'src/lib/relativeTime'
import { LeaderboardProvider } from 'src/components/Leaderboard/LeaderboardContext'

type Ranking = { display_name: string; elo: number }[]

const COLUMNS = [
  { id: 'regular', name: 'Regular', key: 'play_leaders', mode: 'play' },
  { id: 'puzzles', name: 'Puzzles', key: 'puzzles_leaders', mode: 'puzzles' },
  { id: 'turing', name: 'Bot/Not', key: 'turing_leaders', mode: 'turing' },
  { id: 'hand', name: 'Hand', key: 'hand_leaders', mode: 'hand' },
  { id: 'brain', name: 'Brain', key: 'brain_leaders', mode: 'brain' },
] as const

// The heading and the columns render at once (and on the server); each
// column shows placeholder rows until the rankings arrive.
const Leaderboard: React.FC = () => {
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [rankings, setRankings] = useState<Record<string, Ranking> | null>(null)
  // Days within which each board's players last played, by backend mode.
  const [windowDays, setWindowDays] = useState<LeaderboardData['window_days']>(
    {},
  )

  const load = useCallback(async () => {
    setError(false)
    try {
      const lb = await fetchLeaderboard()
      // UTC, sent with or without a zone.
      setLastUpdated(parseTimeMs(lb.last_updated))
      setRankings(
        Object.fromEntries(
          COLUMNS.map((column) => [column.id, lb[column.key]]),
        ),
      )
      setWindowDays(lb.window_days ?? {})
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
            Last updated: {lastUpdated ? <TimeAgo time={lastUpdated} /> : '...'}
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
                windowDays={windowDays?.[column.mode]}
              />
            ))}
          </div>
        )}
        <div className="mt-3 w-full">
          <p className="text-xs text-white/60">
            <span className="font-medium text-white/80">Note:</span> Each
            leaderboard lists the top players who are linked to Lichess, have a
            settled rating, and played that mode recently (the period is shown
            on each board). A provisional rating, shown with a &ldquo;?&rdquo;,
            doesn&apos;t qualify: it settles with more rated results.
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
