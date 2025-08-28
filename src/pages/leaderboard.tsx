import Head from 'next/head'
import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { fetchLeaderboard } from 'src/api'
import { LeaderboardColumn, DelayedLoading } from 'src/components'
import { LeaderboardProvider } from 'src/components/Leaderboard/LeaderboardContext'

const Leaderboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [leaderboard, setLeaderboard] = useState<
    {
      ranking: { display_name: string; elo: number }[]
      name: 'Regular' | 'Puzzles' | 'Bot/Not' | 'Hand' | 'Brain'
      id: 'regular' | 'puzzles' | 'turing' | 'hand' | 'brain'
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

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const lb = await fetchLeaderboard()
      setLastUpdated(new Date(lb.last_updated + 'Z'))
      setLeaderboard([
        {
          id: 'regular',
          name: 'Regular',
          ranking: lb.play_leaders,
        },
        {
          id: 'puzzles',
          name: 'Puzzles',
          ranking: lb.puzzles_leaders,
        },
        {
          id: 'turing',

          name: 'Bot/Not',
          ranking: lb.turing_leaders,
        },
        {
          id: 'hand',

          name: 'Hand',
          ranking: lb.hand_leaders,
        },
        {
          id: 'brain',

          name: 'Brain',
          ranking: lb.brain_leaders,
        },
      ])
      setLoading(false)
    })()
  }, [fetchLeaderboard])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.2,
        staggerChildren: 0.05,
      },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 4 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: [0.25, 0.46, 0.45, 0.94],
        type: 'tween',
      },
    },
    exit: {
      opacity: 0,
      y: -4,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94],
        type: 'tween',
      },
    },
  }

  return (
    <LeaderboardProvider>
      <DelayedLoading isLoading={loading}>
        <AnimatePresence mode="wait">
          <>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 75% 60% at center top, rgba(239, 68, 68, 0.08) 0%, transparent 60%)',
              }}
            />
            <motion.div
              key="leaderboard-content"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ willChange: 'transform, opacity' }}
              className="container relative mx-auto px-6 py-8"
            >
              <Head>
                <title>Leaderboard – Maia Chess</title>
                <meta
                  name="description"
                  content="View top-ranked players across all Maia Chess game modes. Competitive leaderboards for regular play, puzzles, bot detection, hand & brain chess with live ratings and statistics."
                />
              </Head>
              <motion.div
                variants={itemVariants}
                className="mb-2 flex w-full flex-col items-start justify-between md:flex-row md:items-center"
              >
                <h1 className="mb-2 text-3xl font-bold text-white">
                  Rating Leaderboards
                </h1>

                <p className="mt-4 text-sm text-white/60 md:mt-0">
                  Last updated: {lastUpdated ? getTimeAgo(lastUpdated) : '...'}
                </p>
              </motion.div>
              <motion.div
                variants={itemVariants}
                className="grid w-full grid-cols-1 justify-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
              >
                {leaderboard?.map((column, index) => (
                  <LeaderboardColumn key={index} {...column} />
                ))}
              </motion.div>
              <motion.div variants={itemVariants} className="mt-3 w-full">
                <p className="text-xs text-white/60">
                  <span className="font-medium text-white/80">Note:</span> Each
                  leaderboard column only features players who have played at
                  least one game of the corresponding type within the last 7
                  days.
                </p>
              </motion.div>
            </motion.div>
          </>
        </AnimatePresence>
      </DelayedLoading>
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
