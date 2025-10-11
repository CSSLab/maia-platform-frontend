import React, { useEffect, useState } from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { motion } from 'framer-motion'

import { Loading } from 'src/components'
import { AuthenticatedWrapper } from 'src/components/Common/AuthenticatedWrapper'
import { useBroadcastController } from 'src/hooks/useBroadcastController'
import { Broadcast } from 'src/types'

const fadeInUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: 'easeOut' },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const BroadcastsPage: NextPage = () => {
  const router = useRouter()
  const { broadcastSections, broadcastState, loadBroadcasts } =
    useBroadcastController()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        await loadBroadcasts()
      } catch (error) {
        console.error('Error loading broadcasts:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [loadBroadcasts])

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
        <Loading isLoading={true}>
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="text-center">
              <h2 className="mb-2 text-xl font-semibold">
                Loading Live Broadcasts
              </h2>
              <p className="text-secondary">Fetching ongoing tournaments...</p>
            </div>
          </div>
        </Loading>
      </>
    )
  }

  if (broadcastState.error) {
    return (
      <>
        <Head>
          <title>Live Broadcasts – Maia Chess</title>
        </Head>
        <div className="flex min-h-screen items-center justify-center bg-backdrop">
          <div className="rounded-lg border border-white/10 bg-background-1 p-6 text-center">
            <h2 className="mb-4 text-xl font-semibold text-red-400">
              Failed to Load Broadcasts
            </h2>
            <p className="mb-4 text-secondary">
              Unable to connect to Lichess. Please check your internet
              connection and try again.
            </p>
            <button
              onClick={() => {
                setLoading(true)
                loadBroadcasts().finally(() => setLoading(false))
              }}
              className="rounded border border-human-4/30 bg-human-4 px-4 py-2 text-white transition-all duration-200 hover:border-human-4/50 hover:bg-human-4/80"
            >
              Retry
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

      <motion.div
        className="container relative mx-auto px-6 py-8"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        <motion.div className="mb-8 text-center" variants={fadeInUp}>
          <h1 className="mb-2 text-3xl font-bold text-white">
            Live Broadcasts
          </h1>
          <p className="text-white/80">
            Watch ongoing chess tournaments with real-time Maia AI analysis
          </p>
        </motion.div>

        {broadcastSections.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-16 text-center"
            variants={fadeInUp}
          >
            <span className="material-symbols-outlined mb-4 !text-6xl text-white/60">
              live_tv
            </span>
            <h2 className="mb-2 text-xl font-semibold text-white">
              No Live Broadcasts
            </h2>
            <p className="text-white/70">
              There are currently no ongoing tournaments available.
            </p>
            <button
              onClick={() => {
                setLoading(true)
                loadBroadcasts().finally(() => setLoading(false))
              }}
              className="mt-4 rounded border border-human-4/30 bg-human-4 px-4 py-2 text-white transition-all duration-200 hover:border-human-4/50 hover:bg-human-4/80"
            >
              Refresh
            </button>
          </motion.div>
        ) : (
          <motion.div className="space-y-6" variants={staggerContainer}>
            {broadcastSections.map((section, sectionIndex) => (
              <motion.div
                key={section.type}
                className="space-y-3"
                variants={{
                  initial: { opacity: 0, y: 15 },
                  animate: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: 0.25,
                      ease: 'easeOut',
                      delay: sectionIndex * 0.2,
                    },
                  },
                }}
              >
                {section.type === 'past' && (
                  <h2 className="text-xl font-semibold text-white">
                    {section.title}
                  </h2>
                )}

                <motion.div
                  className={
                    section.type === 'official-active'
                      ? 'flex flex-wrap gap-4'
                      : 'grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                  }
                  initial="initial"
                  animate="animate"
                  variants={{
                    animate: {
                      transition: {
                        staggerChildren: 0.03,
                        delayChildren: sectionIndex * 0.2 + 0.15,
                      },
                    },
                  }}
                >
                  {section.broadcasts.map((broadcast) => {
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
                        className={`from-white/8 to-white/4 hover:from-white/12 hover:to-white/6 group relative flex flex-col overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br backdrop-blur-md transition-all duration-300 hover:border-white/20 ${
                          section.type === 'official-active' ? 'w-[280px]' : ''
                        }`}
                        variants={{
                          initial: { opacity: 0, y: 15 },
                          animate: {
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.2, ease: 'easeOut' },
                          },
                        }}
                      >
                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="line-clamp-2 text-base font-semibold text-white/95 transition-colors duration-300 group-hover:text-white">
                                {broadcast.tour.name}
                              </h3>
                              {hasOngoingRounds && isActive && (
                                <div className="mt-2 flex items-center gap-1.5">
                                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
                                  <span className="text-xs font-medium text-red-400">
                                    LIVE
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-white/60">
                                Tier {broadcast.tour.tier}
                              </span>
                              {broadcast.tour.dates &&
                                broadcast.tour.dates.length > 0 && (
                                  <span className="text-xs text-white/60">
                                    {formatDate(broadcast.tour.dates[0])}
                                  </span>
                                )}
                            </div>
                          </div>

                          <div className="text-xs text-white/70">
                            {broadcast.rounds.length} round
                            {broadcast.rounds.length !== 1 ? 's' : ''}
                            {hasOngoingRounds && (
                              <span className="ml-2 text-red-400">
                                • {ongoingRounds.length} live
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleSelectBroadcast(broadcast)}
                          disabled={!hasOngoingRounds && !isPast}
                          className={`border-t py-2 text-sm font-medium tracking-wide transition-all duration-300 ${
                            hasOngoingRounds
                              ? 'border-red-500/30 bg-red-500/20 text-red-400 group-hover:bg-red-500/30'
                              : isPast
                                ? 'border-white/10 bg-white/5 text-white/60 group-hover:bg-white/10 group-hover:text-white/80'
                                : 'cursor-not-allowed border-white/10 bg-white/5 text-white/40'
                          }`}
                        >
                          {hasOngoingRounds
                            ? 'Watch Live'
                            : isPast
                              ? 'View Tournament'
                              : 'Coming Soon'}
                        </button>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        )}

        <motion.div
          className="mt-8 text-center text-xs text-white/60"
          variants={fadeInUp}
        >
          <p>
            Broadcasts streamed from{' '}
            <a
              href="https://lichess.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 underline hover:text-white"
            >
              Lichess
            </a>
          </p>
        </motion.div>
      </motion.div>
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
