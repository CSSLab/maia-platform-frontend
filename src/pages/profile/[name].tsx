import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useContext, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { PlayerStats } from 'src/types'
import { fetchPlayerStats } from 'src/api'
import { WindowSizeContext } from 'src/contexts'
import {
  AuthenticatedWrapper,
  UserProfile,
  GameList,
  Loading,
  ProfileLeaderboardBadges,
} from 'src/components'
import { useLeaderboardStatus } from 'src/hooks/useLeaderboardStatus'

const ProfilePage: NextPage = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [stats, setStats] = useState<PlayerStats>({
    regularRating: 0,
    regularWins: 0,
    regularDraws: 0,
    regularGames: 0,
    regularMax: 0,
    regularMin: 0,
    regularHours: 0,

    handRating: 0,
    handWins: 0,
    handDraws: 0,
    handGames: 0,
    handMax: 0,
    handMin: 0,
    handHours: 0,

    brainRating: 0,
    brainWins: 0,
    brainDraws: 0,
    brainGames: 0,
    brainMax: 0,
    brainMin: 0,
    brainHours: 0,

    trainRating: 0,
    trainCorrect: 0,
    trainGames: 0,
    trainMax: 0,
    trainMin: 0,
    trainHours: 0,

    botNotRating: 0,
    botNotCorrect: 0,
    botNotWrong: 0,
    botNotGames: 0,
    botNotMax: 0,
    botNotMin: 0,
    botNotHours: 0,
  })

  useEffect(() => {
    const fetchStats = async (n: string) => {
      setLoading(true)
      const playerStats = await fetchPlayerStats(n)
      setName(n)
      setStats(playerStats)
      setLoading(false)
    }

    if (router.query.name) {
      fetchStats(router.query.name as string)
    }
  }, [router.query])

  return (
    <AuthenticatedWrapper>
      <Head>
        <title>
          {name ? `${name}'s Profile – Maia Chess` : 'Profile – Maia Chess'}
        </title>
        <meta
          name="description"
          content={
            name
              ? `View ${name}'s chess statistics and ratings across all Maia Chess game modes. See performance in regular play, puzzles, hand & brain, and bot detection challenges.`
              : 'View player profiles and comprehensive chess statistics on Maia Chess. Track ratings, games played, and performance across all game modes.'
          }
        />
      </Head>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 60% at center top, rgba(239, 68, 68, 0.08) 0%, transparent 60%)',
        }}
      />
      <Loading isLoading={loading}>
        <Profile name={name} stats={stats} />
      </Loading>
    </AuthenticatedWrapper>
  )
}

interface Props {
  name: string
  stats: PlayerStats
}
const Profile: React.FC<Props> = (props: Props) => {
  const { isMobile } = useContext(WindowSizeContext)

  // Get leaderboard status for the viewed user
  const { status: leaderboardStatus, loading: leaderboardLoading } =
    useLeaderboardStatus(props.name)

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

  const desktopLayout = (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
      className="relative mx-auto flex h-full w-[90%] flex-col items-start justify-center gap-6 md:py-[2%]"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-row items-center gap-2"
      >
        <span className="material-symbols-outlined !text-5xl text-white/80">
          account_circle
        </span>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-white/95">
              {props.name}
            </h1>
            <ProfileLeaderboardBadges
              status={leaderboardStatus}
              loading={leaderboardLoading}
            />
          </div>
          <a
            target="_blank"
            href={`https://lichess.org/@/${props.name}`}
            className="flex items-center gap-1.5 transition-opacity duration-200 hover:opacity-80"
          >
            <img
              src="/assets/icons/lichess.svg"
              className="h-3 w-3"
              alt="Lichess"
            />
            <span className="text-xs text-white/70">{props.name}</span>
          </a>
        </div>
      </motion.div>
      <motion.div
        variants={itemVariants}
        className="flex w-full flex-col items-start gap-4 md:flex-row"
      >
        <GameList
          lichessId={props.name}
          userName={props.name}
          showCustom={false}
          showLichess={false}
        />
        <UserProfile stats={props.stats} />
      </motion.div>
    </motion.div>
  )

  const mobileLayout = (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
      className="relative mx-auto mt-6 flex w-[90%] flex-col gap-3"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-row items-center gap-2 md:gap-3"
      >
        <span className="material-symbols-outlined text-3xl text-white/80">
          account_circle
        </span>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-white/95">
              {props.name}
            </h1>
            <ProfileLeaderboardBadges
              status={leaderboardStatus}
              loading={leaderboardLoading}
            />
          </div>
          <a
            target="_blank"
            href={`https://lichess.org/@/${props.name}`}
            className="flex items-center gap-1.5 transition-opacity duration-200 hover:opacity-80"
          >
            <img
              src="/assets/icons/lichess.svg"
              className="h-3 w-3"
              alt="Lichess"
            />
            <span className="text-xs text-white/70">{props.name}</span>
          </a>
        </div>
      </motion.div>
      <motion.div
        variants={itemVariants}
        className="flex w-full flex-col gap-3"
      >
        <GameList
          lichessId={props.name}
          userName={props.name}
          showCustom={false}
          showLichess={false}
        />
        <UserProfile stats={props.stats} />
      </motion.div>
    </motion.div>
  )

  return (
    <AnimatePresence mode="wait">
      {isMobile ? mobileLayout : desktopLayout}
    </AnimatePresence>
  )
}

export default ProfilePage
