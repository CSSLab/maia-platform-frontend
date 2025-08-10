import Link from 'next/link'
import { motion } from 'framer-motion'
import { Fragment, useCallback, useContext, useEffect, useState } from 'react'
import {
  trackHomepageFeatureClicked,
  trackLichessConnectionInitiated,
} from 'src/lib/analytics'

import {
  BrainIcon,
  TrainIcon,
  RegularPlayIcon,
  ChessboardIcon,
  StarIcon,
  BotOrNotIcon,
} from 'src/components/Common/Icons'
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
  icon: React.ReactNode
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
  index,
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
      <motion.div
        className="flex h-full cursor-pointer select-none flex-row items-center justify-start gap-4 rounded-md border-none bg-background-2 p-4 text-center hover:bg-human-4/20 md:min-h-[140px] md:flex-col md:justify-center md:gap-3"
        whileHover={{
          scale: 1.03,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          transition: { duration: 0.2 },
        }}
      >
        <motion.div className="w-10">{icon}</motion.div>
        <div className="flex flex-col items-start md:items-center">
          <motion.h2 className="text-lg font-bold">{title}</motion.h2>
          <motion.p className="text-xs">{description}</motion.p>
        </div>
      </motion.div>
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
      <div className="relative flex flex-col items-center justify-center gap-4 overflow-hidden pb-12 pt-4 md:gap-14 md:pb-16 md:pt-20">
        <div className="z-10 flex w-full max-w-[1200px] flex-col items-center justify-center gap-10 p-4 text-left md:flex-row md:gap-20">
          <div className="flex w-full flex-col items-start justify-center gap-6 md:w-[45%] md:gap-8">
            <div className="flex flex-col gap-3 md:gap-4">
              <motion.h1 className="whitespace-nowrap text-4xl font-bold leading-tight md:text-5xl">
                The human chess AI
              </motion.h1>
              <motion.p className="text-xl text-primary/80 md:text-2xl">
                Maia is a neural network chess model that captures human style.
                Enjoy realistic games, insightful analysis, and a new way of
                seeing chess.
              </motion.p>
            </div>
            <motion.div className="flex flex-col gap-4 sm:flex-row">
              <motion.button
                className="flex items-center justify-center gap-2 rounded-md border border-human-4 bg-human-4/80 px-6 py-3 text-white transition duration-200 hover:bg-human-4"
                onClick={scrollHandler}
              >
                <p>Learn More</p>
                <span className="material-symbols-outlined text-base text-primary">
                  keyboard_double_arrow_down
                </span>
              </motion.button>
              {!user?.lichessId && (
                <motion.button
                  className="flex items-center justify-center gap-2 rounded-md border border-background-2 bg-background-1/60 px-6 py-3 transition duration-200 hover:bg-background-1"
                  onClick={() => {
                    trackLichessConnectionInitiated('homepage')
                    connectLichess()
                  }}
                >
                  Connect with Lichess
                </motion.button>
              )}
            </motion.div>
          </div>
          <div className="grid w-full flex-1 grid-cols-1 gap-2 md:grid-cols-3 md:gap-4">
            <FeatureCard
              icon={<RegularPlayIcon />}
              title="Play Maia"
              description="Play chess against the human-like Maia engine"
              onClick={() => startGame('againstMaia')}
              index={0}
              featureKey="play_maia"
            />
            <FeatureCard
              icon={<ChessboardIcon />}
              title="Analysis"
              description="Analyze games with Maia's human insights"
              href="/analysis"
              index={1}
              featureKey="analysis"
            />
            <FeatureCard
              icon={<TrainIcon />}
              title="Puzzles"
              description="Improve your skills with Maia's training puzzles"
              href="/puzzles"
              index={2}
              featureKey="puzzles"
            />
            <FeatureCard
              icon={<BrainIcon />}
              title="Hand & Brain"
              description="Play a collaborative chess variant with Maia"
              onClick={() => startGame('handAndBrain')}
              index={3}
              featureKey="hand_brain"
            />
            <FeatureCard
              icon={<StarIcon />}
              title="Openings"
              description="Learn and practice chess openings with Maia"
              href="/openings"
              index={4}
              featureKey="openings"
            />
            <FeatureCard
              icon={<BotOrNotIcon />}
              title="Bot-or-Not"
              description="Distinguish between human and AI play"
              href="/turing"
              index={5}
              featureKey="bot_or_not"
            />
          </div>
        </div>
        <motion.div className="grid grid-cols-2 gap-6 px-2 md:flex md:gap-6">
          {activeUsers > 0 ? (
            <p className="text-center text-base text-primary/80">
              <AnimatedNumber
                value={activeUsers}
                className="font-bold text-human-2"
              />{' '}
              recent users
            </p>
          ) : (
            <></>
          )}
          <p className="text-center text-base text-primary/80">
            <AnimatedNumber
              value={globalStats?.play_moves_total || 0}
              className="font-bold text-human-2"
            />{' '}
            moves played
          </p>
          <p className="text-center text-base text-primary/80">
            <AnimatedNumber
              value={globalStats?.puzzle_games_total || 0}
              className="font-bold text-human-2"
            />{' '}
            puzzles solved
          </p>
          {activeUsers <= 0 ? (
            <p className="text-center text-base text-primary/80">
              <AnimatedNumber
                value={globalStats?.turing_games_total || 0}
                className="font-bold text-human-2"
              />{' '}
              turing games played
            </p>
          ) : (
            <></>
          )}
        </motion.div>
      </div>
    </Fragment>
  )
}

function BetaBlurb() {
  return (
    <div className="mt-2 flex items-center justify-center md:mt-8">
      <motion.div className="flex flex-row items-center gap-3 bg-engine-3 p-2 px-6 transition md:mt-0 md:rounded-full">
        <span className="material-symbols-outlined material-symbols-filled text-lg">
          favorite
        </span>
        <p>
          Maia Chess is in open beta. You now have full access to the platform!
        </p>
      </motion.div>
    </div>
  )
}
