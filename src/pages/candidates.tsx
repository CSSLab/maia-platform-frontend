import Head from 'next/head'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

import {
  CANDIDATES_FEATURED_POSITIONS,
  CANDIDATES_ROUND_THREE_POSITIONS,
  CANDIDATES_ROUND_TWO_POSITIONS,
  CANDIDATES_WARMUP_POSITIONS,
  CandidatePosition,
} from 'src/constants/candidates'
import {
  buildPositionPlayLink,
  inferPlayerColorFromFen,
} from 'src/lib/positionLinks'
import { GameTree } from 'src/types'

const CANDIDATES_COMPLETED_STORAGE_KEY = 'maia-candidates-completed'
const CANDIDATES_BROADCAST_HREF = '/broadcast/BLA70Vds/uLCZwqAK'
const WOMENS_CANDIDATES_BROADCAST_HREF =
  'https://www.maiachess.com/broadcast/xj4qM8Nw/EMkf0c6e'

const readCompletedChallenges = (): string[] => {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(CANDIDATES_COMPLETED_STORAGE_KEY)
    const parsed = stored ? (JSON.parse(stored) as unknown) : []
    if (!Array.isArray(parsed)) return []

    return parsed.filter((value): value is string => typeof value === 'string')
  } catch (error) {
    console.warn('Failed to read Candidates completion state:', error)
    return []
  }
}

const GameBoard = dynamic(
  () => import('src/components/Board/GameBoard').then((mod) => mod.GameBoard),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-square h-full w-full animate-pulse bg-white/[0.04]" />
    ),
  },
)

const accentClasses: Record<CandidatePosition['accent'], string> = {
  amber:
    'border-[#463d42] bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_60%),rgba(255,255,255,0.02)]',
  blue: 'border-[#463d42] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_60%),rgba(255,255,255,0.02)]',
  red: 'border-[#463d42] bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.16),transparent_60%),rgba(255,255,255,0.02)]',
}

const completedAccentClass =
  'border-emerald-300/35 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.18),transparent_62%),rgba(255,255,255,0.03)]'

const ChallengeSectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="md:col-span-2 xl:col-span-3">
    <p className="text-sm uppercase tracking-[0.24em] text-white/40">{title}</p>
  </div>
)

const PositionBoard: React.FC<{
  position: CandidatePosition
  completed?: boolean
}> = ({ position, completed = false }) => {
  const tree = useMemo(() => new GameTree(position.fen), [position.fen])
  const orientation =
    position.playerColor ?? inferPlayerColorFromFen(position.fen)
  const [showBoard, setShowBoard] = useState(false)

  useEffect(() => {
    let frameOne = 0
    let frameTwo = 0
    let resizeTimeout: number | undefined

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        setShowBoard(true)
        resizeTimeout = window.setTimeout(() => {
          window.dispatchEvent(new Event('resize'))
        }, 120)
      })
    })

    return () => {
      window.cancelAnimationFrame(frameOne)
      window.cancelAnimationFrame(frameTwo)
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout)
      }
    }
  }, [])

  return (
    <div
      className={`mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl border bg-black/20 shadow-[0_18px_40px_rgba(0,0,0,0.28)] md:max-w-none ${
        completed ? 'border-emerald-300/30' : 'border-white/10'
      }`}
    >
      {showBoard ? (
        <GameBoard
          currentNode={tree.getRoot()}
          orientation={orientation}
          availableMoves={new Map()}
        />
      ) : (
        <div className="aspect-square h-full w-full animate-pulse bg-white/[0.04]" />
      )}
    </div>
  )
}

const PositionPill: React.FC<{
  position: CandidatePosition
  completed?: boolean
  compactTitle?: boolean
}> = ({ position, completed = false, compactTitle = false }) => {
  const playHref = buildPositionPlayLink({
    ...position,
    challengeId: position.id,
    returnTo: '/candidates',
    modalTitle: 'Maia Candidates Challenge',
    modalSubtitle: position.title,
  })

  return (
    <article
      className={`overflow-hidden rounded-[24px] border p-4 md:p-5 ${
        completed ? completedAccentClass : accentClasses[position.accent]
      }`}
    >
      <div className="flex h-full flex-col gap-4">
        <div
          className={`min-w-0 ${
            compactTitle ? 'xl:min-h-[132px]' : 'xl:min-h-[150px]'
          }`}
        >
          <h2
            className={`overflow-hidden text-lg font-semibold text-primary md:text-xl ${
              compactTitle
                ? 'h-[1.5rem] leading-[1.5rem] md:h-[1.75rem] md:leading-[1.75rem]'
                : 'h-[3rem] leading-[1.5rem] md:h-[3.5rem] md:leading-[1.75rem]'
            }`}
          >
            {position.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/65">
            {position.subtitle}
          </p>
          <div
            className={`mt-3 inline-flex items-center gap-2 text-sm ${
              completed ? 'text-emerald-100' : 'text-white/45'
            }`}
          >
            <span
              className={`material-symbols-outlined !text-[18px] ${
                completed ? 'text-emerald-200' : 'text-white/35'
              }`}
            >
              {completed ? 'verified' : 'radio_button_unchecked'}
            </span>
            <span className="font-semibold">
              {completed ? 'Completed:' : 'Incomplete'}
            </span>
            {completed ? <span>Nicely done!</span> : null}
          </div>
        </div>

        <Link
          href={playHref}
          aria-label={`Challenge Maia from ${position.title}`}
          className="block"
        >
          <PositionBoard position={position} completed={completed} />
        </Link>

        <div className="mt-auto flex justify-center">
          <Link
            href={playHref}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-primary transition ${
              completed
                ? 'border border-emerald-300/30 bg-emerald-500/10 hover:border-emerald-200/45 hover:bg-emerald-500/15'
                : 'border border-rose-300/25 bg-rose-500/10 hover:border-rose-200/40 hover:bg-rose-500/15'
            }`}
          >
            <span className="material-symbols-outlined !text-[18px]">
              swords
            </span>
            Challenge Maia
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function CandidatesPage() {
  const router = useRouter()
  const [completedChallengeIds, setCompletedChallengeIds] = useState<string[]>(
    [],
  )
  const completedChallengeId =
    typeof router.query.completedChallenge === 'string'
      ? router.query.completedChallenge
      : undefined

  useEffect(() => {
    setCompletedChallengeIds(readCompletedChallenges())
  }, [])

  useEffect(() => {
    if (
      !router.isReady ||
      !completedChallengeId ||
      typeof window === 'undefined'
    ) {
      return
    }

    const current = readCompletedChallenges()
    const next = current.includes(completedChallengeId)
      ? current
      : [...current, completedChallengeId]

    setCompletedChallengeIds(next)

    try {
      window.localStorage.setItem(
        CANDIDATES_COMPLETED_STORAGE_KEY,
        JSON.stringify(next),
      )
    } catch (error) {
      console.warn('Failed to save Candidates completion state:', error)
    }

    router.replace('/candidates', undefined, { shallow: true, scroll: false })
  }, [completedChallengeId, router])

  return (
    <>
      <Head>
        <title>FIDE Candidates Tournament 2026 – Maia Chess</title>
        <meta
          name="description"
          content="Candidates tournament positions with one-click Maia challenges."
        />
      </Head>

      <main className="px-4 py-4 md:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          <header className="pb-1 md:col-span-2 xl:col-span-3">
            <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">
              FIDE Candidates Tournament 2026
            </h1>
            <p className="mt-2 text-sm uppercase tracking-[0.2em] text-white/45">
              Round 4
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={CANDIDATES_BROADCAST_HREF}
                className="inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:border-rose-200/40 hover:bg-rose-500/15"
              >
                <span className="material-symbols-outlined !text-[18px]">
                  live_tv
                </span>
                Watch Candidates Broadcast
              </Link>
              <a
                href={WOMENS_CANDIDATES_BROADCAST_HREF}
                className="inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:border-rose-200/40 hover:bg-rose-500/15"
              >
                <span className="material-symbols-outlined !text-[18px]">
                  live_tv
                </span>
                Watch Women&apos;s Candidates Broadcast
              </a>
            </div>
          </header>
          {CANDIDATES_FEATURED_POSITIONS.length > 0 ? (
            <>
              <ChallengeSectionTitle title="Round 4 Challenges" />
              {CANDIDATES_FEATURED_POSITIONS.map((position) => (
                <PositionPill
                  key={position.id}
                  position={position}
                  completed={completedChallengeIds.includes(position.id)}
                />
              ))}
            </>
          ) : null}
          {CANDIDATES_ROUND_THREE_POSITIONS.length > 0 ? (
            <>
              <ChallengeSectionTitle title="Round 3 Challenges" />
              {CANDIDATES_ROUND_THREE_POSITIONS.map((position) => (
                <PositionPill
                  key={position.id}
                  position={position}
                  completed={completedChallengeIds.includes(position.id)}
                />
              ))}
            </>
          ) : null}
          {CANDIDATES_ROUND_TWO_POSITIONS.length > 0 ? (
            <>
              <ChallengeSectionTitle title="Round 2 Challenges" />
              {CANDIDATES_ROUND_TWO_POSITIONS.map((position) => (
                <PositionPill
                  key={position.id}
                  position={position}
                  completed={completedChallengeIds.includes(position.id)}
                />
              ))}
            </>
          ) : null}
          {CANDIDATES_WARMUP_POSITIONS.length > 0 ? (
            <>
              <ChallengeSectionTitle title="Round 1 Challenges" />
              {CANDIDATES_WARMUP_POSITIONS.map((position) => (
                <PositionPill
                  key={position.id}
                  position={position}
                  completed={completedChallengeIds.includes(position.id)}
                />
              ))}
            </>
          ) : null}
        </div>
      </main>
    </>
  )
}
