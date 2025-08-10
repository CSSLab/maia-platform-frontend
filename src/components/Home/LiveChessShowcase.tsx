import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { LiveChessBoardShowcase } from './LiveChessBoardShowcase'
import {
  getLichessBroadcasts,
  getLichessTopBroadcasts,
  convertTopBroadcastToBroadcast,
} from 'src/api/lichess/broadcasts'
import { Broadcast } from 'src/types'

interface BroadcastWidgetProps {
  broadcast: Broadcast
}

const BroadcastWidget: React.FC<BroadcastWidgetProps> = ({ broadcast }) => {
  // Get the first ongoing round, or the first round if none are ongoing
  const activeRound =
    broadcast.rounds.find((r) => r.ongoing) || broadcast.rounds[0]

  return (
    <motion.div
      className="group flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Tournament card */}
      <Link
        href={`/broadcast/${broadcast.tour.id}/${activeRound?.id || broadcast.rounds[0]?.id}`}
        className="w-full"
      >
        <div className="relative w-48 overflow-hidden rounded-lg border border-background-2 bg-background-1 transition-colors duration-200 hover:border-primary/40">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-background-2 px-3 py-2">
            <h4 className="line-clamp-1 text-[13px] font-semibold text-primary">
              {broadcast.tour.name}
            </h4>
            {activeRound?.ongoing && (
              <div className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                <span className="text-[10px] font-semibold text-white">
                  LIVE
                </span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex h-28 flex-col justify-between px-3 py-2">
            <div>
              <p
                className="line-clamp-1 text-xs text-secondary"
                title={activeRound?.name}
              >
                {activeRound?.name}
              </p>
              {/* Placeholder meta; could be expanded when we parse PGN/game counts */}
              <p className="mt-1 text-[11px] text-primary/70">Ongoing round</p>
            </div>

            <div className="flex items-center justify-end gap-1">
              <span className="text-[11px] text-human-4">View</span>
              <span className="material-symbols-outlined text-sm text-human-4">
                chevron_right
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Spacing under card */}
      <div className="h-1" />
    </motion.div>
  )
}

export const LiveChessShowcase: React.FC = () => {
  const [topBroadcasts, setTopBroadcasts] = useState<Broadcast[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBroadcasts = useCallback(async () => {
    try {
      setError(null)
      setIsLoading(true)

      // Load both official and top broadcasts
      const [officialBroadcasts, topBroadcastsData] = await Promise.all([
        getLichessBroadcasts(),
        getLichessTopBroadcasts(),
      ])

      // Get top ongoing broadcasts with live rounds (official first, then unofficial)
      const officialActive = officialBroadcasts
        .filter((b) => b.rounds.some((r) => r.ongoing))
        .slice(0, 1) // Take top 1 official

      const unofficialActive = topBroadcastsData.active
        .map(convertTopBroadcastToBroadcast)
        .filter(
          (b) =>
            // Must have ongoing rounds and not be in official list
            b.rounds.some((r) => r.ongoing) &&
            !officialActive.some((official) => official.tour.id === b.tour.id),
        )
        .slice(0, 1) // Take top 1 unofficial

      const broadcasts = [...officialActive, ...unofficialActive].slice(0, 2)
      setTopBroadcasts(broadcasts)
    } catch (err) {
      console.error('Error fetching broadcasts:', err)
      setError('Failed to load broadcasts')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBroadcasts()
    // Refresh every 10 minutes
    const interval = setInterval(fetchBroadcasts, 600000)
    return () => clearInterval(interval)
  }, [fetchBroadcasts])

  return (
    <section className="bg-background-2 py-4">
      <div className="container mx-auto px-4">
        <div className="mb-4 flex flex-col items-center justify-between gap-4 lg:flex-row lg:items-center">
          {/* Header on the left */}
          <div className="text-center lg:text-left">
            <h2 className="mb-1 text-2xl font-bold text-primary">Live Chess</h2>
            <p className="text-secondary">
              Watch live games and tournaments with real-time Maia AI analysis
            </p>
          </div>

          {/* Live content on the right */}
          <div className="flex items-start gap-4 sm:flex-row sm:items-start sm:gap-6">
            {/* Live Lichess TV Game */}
            <div className="flex flex-col items-center">
              <h3 className="mb-2 text-base font-semibold text-primary">
                Maia TV
              </h3>
              <LiveChessBoardShowcase />
            </div>

            {/* Top Live Broadcasts */}
            {isLoading ? (
              <div className="flex flex-col items-center">
                <h3 className="mb-2 text-base font-semibold text-primary">
                  Live Tournament
                </h3>
                <motion.div
                  className="flex h-[180px] w-48 flex-col items-center justify-center rounded-lg border border-background-2 bg-background-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="material-symbols-outlined animate-pulse text-2xl text-secondary">
                      stadia_controller
                    </span>
                    <p className="px-3 text-xs text-secondary">
                      Loading tournaments...
                    </p>
                  </div>
                </motion.div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center">
                <h3 className="mb-2 text-base font-semibold text-primary">
                  Live Tournament
                </h3>
                <motion.div
                  className="flex h-[180px] w-48 flex-col items-center justify-center rounded-lg border border-background-2 bg-background-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="material-symbols-outlined text-2xl text-red-400">
                      error
                    </span>
                    <p className="px-3 text-xs text-secondary">{error}</p>
                    <button
                      onClick={fetchBroadcasts}
                      className="text-xs font-medium text-human-4 hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                </motion.div>
              </div>
            ) : topBroadcasts.length > 0 ? (
              <div className="flex flex-col items-center">
                <h3 className="mb-2 text-base font-semibold text-primary">
                  Live Tournament
                </h3>
                <BroadcastWidget broadcast={topBroadcasts[0]} />
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <h3 className="mb-2 text-base font-semibold text-primary">
                  Live Tournament
                </h3>
                <motion.div
                  className="flex h-[180px] w-48 flex-col items-center justify-center rounded-lg border border-background-2 bg-background-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="material-symbols-outlined text-xl text-secondary">
                      stadia_controller
                    </span>
                    <p className="px-3 text-xs text-secondary">
                      No live tournaments
                    </p>
                    <Link
                      href="/broadcast"
                      className="text-xs font-medium text-engine-4 hover:underline"
                    >
                      View all
                    </Link>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
