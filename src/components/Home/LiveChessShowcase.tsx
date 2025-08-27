import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { LiveChessBoardShowcase } from './LiveChessBoardShowcase'
import {
  getLichessBroadcasts,
  getLichessTopBroadcasts,
  convertTopBroadcastToBroadcast,
} from 'src/api/broadcasts'
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
        <div className="relative w-36 overflow-hidden rounded-md border border-white/10 bg-black/20 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-black/30">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-2 py-1.5">
            <h4 className="line-clamp-1 text-[10px] font-semibold text-white/95">
              {broadcast.tour.name}
            </h4>
            {activeRound?.ongoing && (
              <div className="flex items-center gap-0.5 rounded-full bg-red-500/90 px-1 py-0.5">
                <span className="h-0.5 w-0.5 animate-pulse rounded-full bg-white" />
                <span className="text-[8px] font-semibold text-white">
                  LIVE
                </span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex h-12 flex-col justify-between px-2 py-1.5">
            <div>
              <p
                className="line-clamp-1 text-[10px] text-white/70"
                title={activeRound?.name}
              >
                {activeRound?.name}
              </p>
              <p className="text-[8px] text-white/50">Ongoing round</p>
            </div>

            <div className="flex items-center justify-end gap-0.5">
              <span className="text-[8px] text-white/60">View</span>
              <span className="material-symbols-outlined text-xs text-white/60">
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
    <section className="relative py-3">
      {/* Glass morphism background */}
      <div className="absolute inset-0 border-y border-white/10 bg-black/10 backdrop-blur-sm" />

      <div className="relative mx-auto max-w-4xl px-4">
        <div className="flex flex-col items-center gap-4">
          {/* Centered header */}
          <div className="text-center">
            <h2 className="text-lg font-bold text-white/95">Live Chess</h2>
            <p className="text-xs text-white/70">
              Watch live games and tournaments with real-time Maia AI analysis
            </p>
          </div>

          {/* Centered live content */}
          <div className="flex items-center gap-8">
            {/* Live Lichess TV Game */}
            <div className="flex flex-col items-center">
              <h3 className="mb-2 text-xs font-medium text-white/80">
                Maia TV
              </h3>
              <div className="rounded-md border border-white/10 bg-black/20 p-1.5 backdrop-blur-sm">
                <LiveChessBoardShowcase />
              </div>
            </div>

            {/* Top Live Broadcasts */}
            {isLoading ? (
              <div className="flex flex-col items-center">
                <h3 className="mb-2 text-xs font-medium text-white/80">
                  Live Tournament
                </h3>
                <motion.div
                  className="flex h-[80px] w-36 flex-col items-center justify-center rounded-md border border-white/10 bg-black/20 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="material-symbols-outlined animate-pulse text-lg text-white/60">
                      stadia_controller
                    </span>
                    <p className="px-2 text-[10px] text-white/70">Loading...</p>
                  </div>
                </motion.div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center">
                <h3 className="mb-2 text-xs font-medium text-white/80">
                  Live Tournament
                </h3>
                <motion.div
                  className="flex h-[80px] w-36 flex-col items-center justify-center rounded-md border border-white/10 bg-black/20 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="material-symbols-outlined text-lg text-red-400/80">
                      error
                    </span>
                    <p className="px-2 text-[10px] text-white/70">Error</p>
                    <button
                      onClick={fetchBroadcasts}
                      className="text-[9px] font-medium text-white/60 transition-colors hover:text-white/80 hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                </motion.div>
              </div>
            ) : topBroadcasts.length > 0 ? (
              <div className="flex flex-col items-center">
                <h3 className="mb-2 text-xs font-medium text-white/80">
                  Live Tournament
                </h3>
                <BroadcastWidget broadcast={topBroadcasts[0]} />
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <h3 className="mb-2 text-xs font-medium text-white/80">
                  Live Tournament
                </h3>
                <motion.div
                  className="flex h-[80px] w-36 flex-col items-center justify-center rounded-md border border-white/10 bg-black/20 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="material-symbols-outlined text-base text-white/60">
                      stadia_controller
                    </span>
                    <p className="px-2 text-[10px] text-white/70">
                      No tournaments
                    </p>
                    <Link
                      href="/broadcast"
                      className="text-[9px] font-medium text-white/60 transition-colors hover:text-white/80 hover:underline"
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
