import Link from 'next/link'
import { motion } from 'framer-motion'
import { Fragment, useCallback, useContext, useEffect, useState } from 'react'
import {
  trackHomepageFeatureClicked,
  trackLichessConnectionInitiated,
} from 'src/utils/analytics'

import {
  SunIcon,
  UserIcon,
  ArrowIcon,
  BrainIcon, // Use BrainIcon for Hand & Brain
  TrainIcon,
  RegularPlayIcon,
  ChessboardIcon,
  StarIcon,
  BotOrNotIcon, // The old BrainIcon
} from 'src/components/Icons/icons'
import { PlayType } from 'src/types'
import { getGlobalStats } from 'src/api'
import { AuthContext, ModalContext } from 'src/contexts'
import { AnimatedNumber } from 'src/components/Misc/AnimatedNumber'

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
        className="flex h-full min-h-[140px] cursor-pointer select-none flex-col items-center justify-center gap-3 rounded-md border-none bg-background-2 p-4 text-center hover:bg-human-4/20"
        whileHover={{
          scale: 1.03,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          transition: { duration: 0.2 },
        }}
      >
        <motion.div className="w-10">{icon}</motion.div>
        <div className="flex flex-col">
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
  const { setPlaySetupModalProps } = useContext(ModalContext)
  const { user, connectLichess } = useContext(AuthContext)

  const startGame = useCallback(
    (playType: PlayType) => {
      setPlaySetupModalProps({ playType: playType })
    },
    [setPlaySetupModalProps],
  )

  useEffect(() => {
    ;(async () => {
      const data = await getGlobalStats()
      setGlobalStats(data)
    })()
  }, [])

  return (
    <Fragment>
      <BetaBlurb />
      <div className="relative flex flex-col items-center justify-center gap-14 overflow-hidden pb-12 pt-8 md:pb-16 md:pt-20">
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
          <div className="grid w-full flex-1 grid-cols-1 gap-4 md:grid-cols-3">
            <FeatureCard
              icon={<RegularPlayIcon />}
              title="Play Maia"
              description="Play chess against the human-like Maia engine"
              {...(user?.lichessId
                ? { onClick: () => startGame('againstMaia') }
                : { href: 'https://lichess.org/@/maia1', external: true })}
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
        <motion.div className="grid grid-cols-3 gap-6 px-2 md:flex">
          <p className="text-center text-base text-primary/80">
            <AnimatedNumber
              value={globalStats?.play_moves_total || 0}
              className="font-bold"
            />{' '}
            moves played
          </p>
          <p className="text-center text-base text-primary/80">
            <AnimatedNumber
              value={globalStats?.puzzle_games_total || 0}
              className="font-bold"
            />{' '}
            puzzle games solved
          </p>
          <p className="text-center text-base text-primary/80">
            <AnimatedNumber
              value={globalStats?.turing_games_total || 0}
              className="font-bold"
            />{' '}
            turing games played
          </p>
        </motion.div>
      </div>
    </Fragment>
  )
}

function BetaBlurb() {
  const { user, connectLichess } = useContext(AuthContext)

  return (
    <div className="mt-2 flex items-center justify-center md:mt-8">
      {user?.lichessId ? (
        <motion.div className="flex flex-row items-center gap-3 bg-engine-3 p-2 px-6 transition md:mt-0 md:rounded-full">
          <div className="*:h-5 *:w-5">{SunIcon}</div>
          <p>
            Thanks for testing the Maia Chess beta! Join our Discord{' '}
            <a
              target="_blank"
              rel="noreferrer"
              className="underline"
              href="https://discord.gg/Az93GqEAs7"
            >
              here
            </a>
            .
          </p>
        </motion.div>
      ) : (
        <motion.div className="flex flex-row items-center gap-3 bg-human-4 p-2 px-6 transition md:mt-0 md:rounded-full">
          <div className="*:h-5 *:w-5">{SunIcon}</div>
          <p>
            Maia Chess is in private beta. Sign up{' '}
            <a
              target="_blank"
              rel="noreferrer"
              className="underline"
              href="https://forms.gle/VAUKap4uwMGXJH3N8"
            >
              here
            </a>{' '}
            and sign in with{' '}
            <button
              onClick={() => {
                trackLichessConnectionInitiated('homepage')
                connectLichess()
              }}
              className="underline"
            >
              Lichess
            </button>
            .
          </p>
        </motion.div>
      )}
    </div>
  )
}
