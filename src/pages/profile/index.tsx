import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useContext, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { PlayerStats } from 'src/types'
import { getPlayerStats } from 'src/api'
import { AuthContext, WindowSizeContext } from 'src/contexts'
import {
  AuthenticatedWrapper,
  UserProfile,
  GameList,
  DelayedLoading,
  ProfileLeaderboardBadges,
} from 'src/components'
import { useLeaderboardStatus } from 'src/hooks/useLeaderboardStatus'

const ProfilePage: NextPage = () => {
  const router = useRouter()
  const { user } = useContext(AuthContext)
  const [loading, setLoading] = useState(true)
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
    botNotGames: 0,
    botNotWrong: 0,
    botNotMax: 0,
    botNotMin: 0,
    botNotHours: 0,
  })

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      const playerStats = await getPlayerStats()
      setStats(playerStats)
      setLoading(false)
    }

    if (!user?.lichessId) router.push('/')

    fetchStats()
  }, [user])

  return (
    <AuthenticatedWrapper>
      <Head>
        <title>Profile – Maia Chess</title>
        <meta name="description" content="User profile and statistics" />
      </Head>
      <DelayedLoading isLoading={loading}>
        <Profile stats={stats} />
      </DelayedLoading>
    </AuthenticatedWrapper>
  )
}

interface Props {
  stats: PlayerStats
}
const Profile: React.FC<Props> = (props: Props) => {
  const { user } = useContext(AuthContext)
  const { isMobile } = useContext(WindowSizeContext)

  // Get leaderboard status for the current user
  const { status: leaderboardStatus, loading: leaderboardLoading } =
    useLeaderboardStatus(user?.displayName)

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
      className="mx-auto flex h-full w-[90%] flex-col items-start justify-center gap-6 md:py-[2%]"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-row items-center gap-2"
      >
        <span className="material-symbols-outlined text-6xl">
          account_circle
        </span>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold">{user?.displayName}</h1>
          <ProfileLeaderboardBadges
            status={leaderboardStatus}
            loading={leaderboardLoading}
          />
        </div>
      </motion.div>
      <motion.div
        variants={itemVariants}
        className="flex flex-col items-start gap-6 md:flex-row"
      >
        <GameList />
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
      className="mx-auto mt-6 flex w-[90%] flex-col gap-3"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-row items-center gap-2 md:gap-3"
      >
        <span className="material-symbols-outlined text-4xl">
          account_circle
        </span>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold">{user?.displayName}</h1>
          <ProfileLeaderboardBadges
            status={leaderboardStatus}
            loading={leaderboardLoading}
          />
        </div>
      </motion.div>
      <motion.div
        variants={itemVariants}
        className="flex w-full flex-col gap-4"
      >
        <GameList />
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
