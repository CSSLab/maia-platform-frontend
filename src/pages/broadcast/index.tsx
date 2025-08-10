import React, { useEffect, useState } from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { motion } from 'framer-motion'

import { DelayedLoading } from 'src/components'
import { AuthenticatedWrapper } from 'src/components/Common/AuthenticatedWrapper'
import { useBroadcastController } from 'src/hooks/useBroadcastController'
import { Broadcast } from 'src/types'

const BroadcastsPage: NextPage = () => {
  const router = useRouter()
  const broadcastController = useBroadcastController()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        await broadcastController.loadBroadcasts()
      } catch (error) {
        console.error('Error loading broadcasts:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSelectBroadcast = (broadcast: Broadcast) => {
    const defaultRound =
      broadcast.rounds.find((r) => r.id === broadcast.defaultRoundId) ||
      broadcast.rounds.find((r) => r.ongoing) ||
      broadcast.rounds[0]

    if (defaultRound) {
      router.push(`/broadcast/${broadcast.tour.id}/${defaultRound.id}`)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  }

  if (loading) {
    return (
      <>
        <Head>
          <title>Live Broadcasts – Maia Chess</title>
          <meta
            name="description"
            content="Watch live chess tournaments and broadcasts with real-time Maia AI analysis."
          />
        </Head>
        <DelayedLoading isLoading={true}>
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="text-center">
              <h2 className="mb-2 text-xl font-semibold">
                Loading Live Broadcasts
              </h2>
              <p className="text-secondary">Fetching ongoing tournaments...</p>
            </div>
          </div>
        </DelayedLoading>
      </>
    )
  }

  if (broadcastController.broadcastState.error) {
    return (
      <>
        <Head>
          <title>Live Broadcasts – Maia Chess</title>
        </Head>
        <div className="flex min-h-screen items-center justify-center bg-backdrop">
          <div className="rounded-lg border border-white/10 bg-background-1 p-6 text-center">
            <h2 className="mb-4 text-xl font-semibold text-red-400">
              Error Loading Broadcasts
            </h2>
            <p className="mb-4 text-secondary">
              {broadcastController.broadcastState.error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded border border-human-4/30 bg-human-4 px-4 py-2 text-white transition-all duration-200 hover:border-human-4/50 hover:bg-human-4/80"
            >
              Try Again
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Live Broadcasts – Maia Chess</title>
        <meta
          name="description"
          content="Watch live chess tournaments and broadcasts with real-time Maia AI analysis."
        />
      </Head>

      <div className="min-h-screen bg-backdrop">
        <motion.div
          className="container mx-auto px-6 py-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-primary">
              Live Broadcasts
            </h1>
            <p className="text-secondary">
              Watch ongoing chess tournaments with real-time Maia AI analysis
            </p>
          </motion.div>

          {broadcastController.broadcastSections.length === 0 ? (
            <motion.div
              variants={itemVariants}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <span className="material-symbols-outlined mb-4 !text-6xl text-secondary">
                live_tv
              </span>
              <h2 className="mb-2 text-xl font-semibold text-primary">
                No Live Broadcasts
              </h2>
              <p className="text-secondary">
                There are currently no ongoing tournaments available.
              </p>
              <button
                onClick={() => broadcastController.loadBroadcasts()}
                className="mt-4 rounded border border-human-4/30 bg-human-4 px-4 py-2 text-white transition-all duration-200 hover:border-human-4/50 hover:bg-human-4/80"
              >
                Refresh
              </button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {broadcastController.broadcastSections.map(
                (section, sectionIndex) => (
                  <motion.div
                    key={section.type}
                    variants={itemVariants}
                    className="space-y-3"
                  >
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
                      {section.title}
                      {(section.type === 'official-active' ||
                        section.type === 'unofficial-active') && (
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
                          <span className="text-xs font-medium text-red-400">
                            LIVE
                          </span>
                        </div>
                      )}
                    </h2>

                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {section.broadcasts.map((broadcast, index) => {
                        const ongoingRounds = broadcast.rounds.filter(
                          (r) => r.ongoing,
                        )
                        const hasOngoingRounds = ongoingRounds.length > 0
                        const isActive =
                          section.type.includes('active') ||
                          section.type.includes('community')
                        const isPast = section.type === 'past'

                        return (
                          <motion.div
                            key={broadcast.tour.id}
                            variants={itemVariants}
                            className="overflow-hidden rounded-lg border border-white/10 bg-background-1 transition-all duration-200 hover:border-white/20 hover:bg-background-1/80"
                          >
                            <div className="p-3">
                              <div className="mb-3 flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="mb-1 line-clamp-2 text-base font-semibold text-primary">
                                    {broadcast.tour.name}
                                  </h3>
                                  {hasOngoingRounds && isActive && (
                                    <div className="flex items-center gap-1">
                                      <div className="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
                                      <span className="text-xs font-medium text-red-400">
                                        LIVE
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="mb-1 text-xs text-secondary">
                                    Tier {broadcast.tour.tier}
                                  </div>
                                  {broadcast.tour.dates.length > 0 && (
                                    <div className="text-xs text-secondary">
                                      {formatDate(broadcast.tour.dates[0])}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mb-3 border-t border-white/10 pt-2">
                                <div className="mb-1.5 text-xs font-medium text-primary">
                                  Rounds ({broadcast.rounds.length})
                                </div>
                                <div className="space-y-1">
                                  {broadcast.rounds.slice(0, 3).map((round) => (
                                    <div
                                      key={round.id}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <span className="text-secondary">
                                        {round.name}
                                      </span>
                                      <span
                                        className={`rounded px-2 py-0.5 text-xs ${
                                          round.ongoing
                                            ? 'bg-red-500/20 text-red-400'
                                            : isPast
                                              ? 'bg-background-2 text-secondary'
                                              : 'bg-blue-500/20 text-blue-400'
                                        }`}
                                      >
                                        {round.ongoing
                                          ? 'Live'
                                          : isPast
                                            ? 'Finished'
                                            : 'Upcoming'}
                                      </span>
                                    </div>
                                  ))}
                                  {broadcast.rounds.length > 3 && (
                                    <div className="text-xs text-secondary">
                                      +{broadcast.rounds.length - 3} more rounds
                                    </div>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => handleSelectBroadcast(broadcast)}
                                disabled={!hasOngoingRounds && !isPast}
                                className={`w-full rounded border py-1.5 text-sm font-medium transition-all duration-200 ${
                                  hasOngoingRounds
                                    ? 'border-human-4/30 bg-human-4 text-white hover:border-human-4/50 hover:bg-human-4/80'
                                    : isPast
                                      ? 'border-white/10 bg-background-2 text-secondary hover:border-white/20 hover:bg-background-2/80'
                                      : 'cursor-not-allowed border-white/5 bg-background-2/50 text-secondary/50'
                                }`}
                              >
                                {hasOngoingRounds
                                  ? 'Watch Live'
                                  : isPast
                                    ? 'View Tournament'
                                    : 'Coming Soon'}
                              </button>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.div>
                ),
              )}
            </div>
          )}

          <motion.div
            variants={itemVariants}
            className="mt-8 text-center text-xs text-secondary"
          >
            <p>
              Broadcasts powered by{' '}
              <a
                href="https://lichess.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/60 underline hover:text-primary"
              >
                Lichess
              </a>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}

export default function AuthenticatedBroadcastsPage() {
  return (
    <AuthenticatedWrapper>
      <BroadcastsPage />
    </AuthenticatedWrapper>
  )
}
