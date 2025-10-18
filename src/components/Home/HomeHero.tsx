import Link from 'next/link'
import { motion } from 'framer-motion'
import { Fragment, useCallback, useContext, useEffect, useState } from 'react'
import {
  trackHomepageFeatureClicked,
  trackLichessConnectionInitiated,
} from 'src/lib/analytics'

import { PlayType } from 'src/types'
import { getGlobalStats, getActiveUserCount } from 'src/api'
import { AuthContext, ModalContext } from 'src/contexts'
import { AnimatedNumber } from 'src/components/Common/AnimatedNumber'

interface Props {
  scrollHandler: () => void
}

type FeatureKey =
  | 'play_maia'
  | 'analysis'
  | 'puzzles'
  | 'hand_brain'
  | 'openings'
  | 'bot_or_not'

interface FeatureCardProps {
  icon: string
  title: string
  description: string
  onClick?: () => void
  href?: string
  external?: boolean
  index: number
  featureKey?: FeatureKey
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  onClick,
  href,
  external,
  featureKey,
}) => {
  const { user } = useContext(AuthContext)

  const handleClick = () => {
    if (featureKey) {
      trackHomepageFeatureClicked(featureKey, !!user?.lichessId)
    }
    if (onClick) {
      onClick()
    }
  }

  const CardWrapper = ({ children }: { children: React.ReactNode }) => {
    if (onClick) {
      return (
        <button onClick={handleClick} className="w-full">
          {children}
        </button>
      )
    }
    if (href) {
      const linkClick = () => {
        if (featureKey) {
          trackHomepageFeatureClicked(featureKey, !!user?.lichessId)
        }
      }

      if (external) {
        return (
          <a href={href} target="_blank" rel="noreferrer" onClick={linkClick}>
            {children}
          </a>
        )
      }
      return (
        <Link href={href} onClick={linkClick}>
          {children}
        </Link>
      )
    }
    return <>{children}</>
  }

  return (
    <CardWrapper>
      <div className="group relative flex h-full cursor-pointer select-none flex-row items-center justify-start gap-4 overflow-hidden rounded-lg border border-glass-border p-3 text-center backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:shadow-md hover:shadow-white/5 md:min-h-[140px] md:flex-col md:items-center md:justify-center md:gap-0 md:p-4">
        <div className="text-white/60 transition-colors duration-300 group-hover:text-white/90">
          <span className="material-symbols-outlined material-symbols-filled leading-0 text-6xl">
            {icon}
          </span>
        </div>
        <div className="flex flex-col items-start md:items-center">
          <h2 className="text-lg font-bold text-white/95 transition-colors duration-300 group-hover:text-white">
            {title}
          </h2>
          <p className="text-left text-xs text-white/70 transition-colors duration-300 group-hover:text-white/85">
            {description}
          </p>
        </div>
      </div>
    </CardWrapper>
  )
}

export const HomeHero: React.FC<Props> = ({ scrollHandler }: Props) => {
  const [globalStats, setGlobalStats] = useState<{
    play_moves_total: number
    puzzle_games_total: number
    turing_games_total: number
  }>()
  const [activeUsers, setActiveUsers] = useState<number>(0)
  const { setPlaySetupModalProps } = useContext(ModalContext)
  const { user, connectLichess } = useContext(AuthContext)

  const startGame = useCallback(
    (playType: PlayType) => {
      setPlaySetupModalProps({ playType: playType })
    },
    [setPlaySetupModalProps],
  )

  // Fetch global stats and set up periodic updates
  useEffect(() => {
    const fetchGlobalStats = async () => {
      const data = await getGlobalStats()
      setGlobalStats(data)
    }

    // Fetch immediately
    fetchGlobalStats()

    // Update every 20 seconds
    const interval = setInterval(fetchGlobalStats, 20000)

    return () => clearInterval(interval)
  }, [])

  // Fetch active users count and set up periodic updates
  useEffect(() => {
    const fetchActiveUsers = async () => {
      const count = await getActiveUserCount()
      setActiveUsers(count)
    }

    // Fetch immediately
    fetchActiveUsers()

    // Update every 20 seconds
    const interval = setInterval(fetchActiveUsers, 20000)

    return () => clearInterval(interval)
  }, [])

  return (
    <Fragment>
      <BetaBlurb />
      <div className="relative flex flex-col items-center justify-center gap-4 overflow-hidden pb-6 pt-4 md:gap-14 md:pt-16">
        <div className="z-10 flex w-full max-w-[1200px] flex-col items-center justify-center gap-10 p-4 text-left md:flex-row md:gap-20">
          <div className="flex w-full flex-col items-start justify-center gap-6 md:w-[45%] md:gap-8">
            <div className="flex flex-col gap-3 md:gap-4">
              <motion.h1 className="whitespace-nowrap text-4xl font-bold leading-tight text-white md:text-5xl">
                The human chess AI
              </motion.h1>
              <motion.p className="text-xl text-white/80 md:text-2xl">
                Maia is a neural network chess model that captures human style.
                Enjoy realistic games, insightful analysis, and a new way of
                seeing chess.
              </motion.p>
            </div>
            {!user?.lichessId && (
              <motion.div className="flex flex-wrap items-center gap-3 sm:gap-3">
                <p className="text-sm tracking-wider text-white/80">
                  Sign in with:
                </p>
                <motion.button
                  className="group flex items-center gap-2.5 rounded-md border border-glass-border bg-white/5 px-3 py-2 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                  onClick={() => {
                    trackLichessConnectionInitiated('homepage')
                    connectLichess()
                  }}
                >
                  <img
                    src="/assets/icons/lichess.svg"
                    className="h-4 w-4 transition-opacity duration-200 group-hover:opacity-100"
                    alt="Lichess"
                  />
                  <span className="text-sm font-medium text-white/90 transition-colors duration-200 group-hover:text-white">
                    Lichess
                  </span>
                </motion.button>
                {/* <motion.button
                  className="group flex items-center gap-2.5 rounded-md border border-glass-border bg-white/5 px-3 py-2 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                  onClick={() => {
                    trackLichessConnectionInitiated('homepage')
                    connectLichess()
                  }}
                >
                  <img
                    src="/assets/icons/chessdotcom.svg"
                    className="h-4 w-4 transition-opacity duration-200 group-hover:opacity-100"
                    alt="Chess.com"
                  />
                  <span className="text-sm font-medium text-white/90 transition-colors duration-200 group-hover:text-white">
                    Chess.com
                  </span>
                </motion.button> */}
              </motion.div>
            )}
          </div>
          <div className="grid w-full flex-1 grid-cols-1 gap-2 md:grid-cols-3 md:gap-4">
            <FeatureCard
              icon="chess_knight"
              title="Play Maia"
              description="Play chess against the human-like Maia engine"
              onClick={() => startGame('againstMaia')}
              index={0}
              featureKey="play_maia"
            />
            <FeatureCard
              icon="network_intelligence"
              title="Analysis"
              description="Analyze games with Maia's human insights"
              href="/analysis"
              index={1}
              featureKey="analysis"
            />
            <FeatureCard
              icon="toys_and_games"
              title="Puzzles"
              description="Improve your skills with Maia's training puzzles"
              href="/puzzles"
              index={2}
              featureKey="puzzles"
            />
            <FeatureCard
              icon="network_intel_node"
              title="Hand & Brain"
              description="Play a collaborative chess variant with Maia"
              onClick={() => startGame('handAndBrain')}
              index={3}
              featureKey="hand_brain"
            />
            <FeatureCard
              icon="play_lesson"
              title="Openings"
              description="Learn and practice chess openings with Maia"
              href="/openings"
              index={4}
              featureKey="openings"
            />
            <FeatureCard
              icon="mystery"
              title="Bot or Not"
              description="Distinguish between human and AI play"
              href="/turing"
              index={5}
              featureKey="bot_or_not"
            />
          </div>
        </div>
        <motion.div className="flex flex-wrap justify-center gap-6 px-2">
          {activeUsers > 0 && (
            <p className="text-center text-base text-white/80">
              <AnimatedNumber
                value={activeUsers}
                className="font-bold text-white"
              />{' '}
              recent users
            </p>
          )}
          <p className="text-center text-base text-white/80">
            <AnimatedNumber
              value={globalStats?.play_moves_total || 0}
              className="font-bold text-white"
            />{' '}
            moves played
          </p>
          <p className="text-center text-base text-white/80">
            <AnimatedNumber
              value={globalStats?.puzzle_games_total || 0}
              className="font-bold text-white"
            />{' '}
            puzzles solved
          </p>
          {activeUsers <= 0 && (
            <p className="text-center text-base text-white/80">
              <AnimatedNumber
                value={globalStats?.turing_games_total || 0}
                className="font-bold text-white"
              />{' '}
              turing games played
            </p>
          )}
        </motion.div>
      </div>
    </Fragment>
  )
}

function BetaBlurb() {
  return (
    <div className="mt-2 flex items-center justify-center md:mt-10">
      <div className="select-none rounded-full border border-glass-border bg-black/20 px-6 py-2.5 backdrop-blur-sm transition-all duration-200 hover:border-white/15">
        <div className="flex flex-row items-center gap-2">
          <span className="material-symbols-outlined material-symbols-filled text-sm text-white/90">
            favorite
          </span>
          <p className="text-sm text-white/90">
            Maia Chess is in open beta. You now have full access to the
            platform!
          </p>
        </div>
      </div>
    </div>
  )
}
