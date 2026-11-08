import Link from 'next/link'
import type { DrawShape } from 'chessground/draw'
import type { Key } from 'chessground/types'
import { useContext, useEffect, useRef, useState } from 'react'

import { StockfishEngineContext } from 'src/contexts/StockfishEngineContext'
import { localDay } from 'src/lib/personal/storage'
import {
  ATTEMPTS_PER_POSITION,
  PracticeDay,
  PracticePosition,
  PracticeStreak,
  STREAK_SHOWN_FROM,
  loadStreak,
  recordAnswer,
} from 'src/lib/personal/practiceStore'
import { gradeAnswer } from 'src/lib/personal/practice'
import { momentHref } from 'src/lib/personal/momentStore'
import { Chess } from 'chess.ts'
import { PracticeBoard } from './PracticeBoard'
import {
  trackPracticeCompleted,
  trackPracticePositionAnswered,
  trackPracticeStarted,
} from 'src/lib/analytics'

interface Props {
  day: PracticeDay
}

type Phase =
  | { kind: 'thinking'; attempt: number }
  | { kind: 'checking'; attempt: number; answer: string }
  | { kind: 'wrong'; attempt: number }
  | { kind: 'revealed'; correct: boolean; answer: string }

const sanOf = (fen: string, uci: string) =>
  new Chess(fen).move(uci, { sloppy: true })?.san ?? uci

const arrow = (uci: string, brush: string): DrawShape => ({
  orig: uci.slice(0, 2) as Key,
  dest: uci.slice(2, 4) as Key,
  brush,
})

const StreakBadge = ({ streak }: { streak: PracticeStreak }) =>
  streak.days >= STREAK_SHOWN_FROM ? (
    <span className="flex items-center gap-1 rounded-full border border-human-4/50 bg-human-4/10 px-2 py-0.5 text-xs text-white/90">
      <span className="material-symbols-outlined !text-sm">star</span>
      {streak.days}-day streak
    </span>
  ) : null

/** Today's positions, one at a time, then how it went. */
export const PracticeSession = ({ day: initialDay }: Props) => {
  const stockfish = useContext(StockfishEngineContext)
  const [day, setDay] = useState(initialDay)
  const [streak, setStreak] = useState(() => loadStreak())
  const firstOpen = initialDay.positions.findIndex(
    (p) => !initialDay.answers[p.id],
  )
  const [index, setIndex] = useState(
    firstOpen === -1 ? initialDay.positions.length : firstOpen,
  )
  const [phase, setPhase] = useState<Phase>({ kind: 'thinking', attempt: 1 })
  const [resetKey, setResetKey] = useState(0)
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  // Opened with positions left to answer today.
  useEffect(() => {
    const remaining = initialDay.positions.filter(
      (p) => !initialDay.answers[p.id],
    ).length
    if (remaining > 0) {
      trackPracticeStarted(initialDay.positions.length, remaining)
    }
  }, [])

  const total = day.positions.length
  const position: PracticePosition | undefined = day.positions[index]

  if (!position) {
    const correct = day.positions.filter(
      (p) => day.answers[p.id]?.correct,
    ).length
    return (
      <section className="flex flex-col items-center gap-4 rounded-lg border border-glass-border bg-glass p-6 text-center backdrop-blur-md">
        <h2 className="text-lg font-semibold text-white/95">
          {correct} of {total} found today
        </h2>
        <StreakBadge streak={streak} />
        <p className="text-sm text-white/70">
          Three new positions from your games tomorrow.
        </p>
        <div className="flex flex-col gap-2 md:flex-row">
          <Link
            href="/play"
            className="rounded-md bg-human-4 px-4 py-2 text-sm font-medium text-white hover:bg-human-4/90"
          >
            Play Maia
          </Link>
          <Link
            href="/"
            className="rounded-md border border-glass-border bg-glass px-4 py-2 text-sm text-white/90 hover:bg-glass-stronger"
          >
            Home
          </Link>
        </div>
      </section>
    )
  }

  const answer = async (uci: string) => {
    // A second try is made from the "Not quite" message.
    if (phase.kind !== 'thinking' && phase.kind !== 'wrong') return
    const attempt = phase.attempt
    setPhase({ kind: 'checking', attempt, answer: uci })
    abort.current?.abort()
    abort.current = new AbortController()
    let correct: boolean
    try {
      if (!stockfish.isReady()) throw new Error('Stockfish is not ready')
      correct = (
        await gradeAnswer(
          position.fen,
          uci,
          position.bestMove,
          stockfish,
          abort.current.signal,
        )
      ).correct
    } catch (error) {
      console.error('Practice answer check failed:', error)
      // Back to the position: the answer wasn't counted.
      setResetKey((key) => key + 1)
      setPhase({ kind: 'thinking', attempt })
      return
    }
    if (abort.current.signal.aborted) return
    trackPracticePositionAnswered(correct, attempt)
    if (!correct && attempt < ATTEMPTS_PER_POSITION) {
      setResetKey((key) => key + 1)
      setPhase({ kind: 'wrong', attempt: attempt + 1 })
      return
    }
    const recorded = recordAnswer(
      day,
      position.id,
      { correct, attempts: attempt, answer: uci },
      localDay(),
    )
    setDay(recorded.day)
    setStreak(recorded.streak)
    setPhase({ kind: 'revealed', correct, answer: uci })
    if (recorded.completedNow) {
      trackPracticeCompleted(
        recorded.day.positions.filter(
          (p) => recorded.day.answers[p.id]?.correct,
        ).length,
        recorded.streak.days,
      )
    }
  }

  const next = () => {
    setIndex((i) => i + 1)
    setPhase({ kind: 'thinking', attempt: 1 })
    setResetKey((key) => key + 1)
  }

  const revealed = phase.kind === 'revealed'
  const solved = revealed && phase.correct
  // The answer stays on the board while it's checked, and when it's right.
  const played = phase.kind === 'checking' || solved ? phase.answer : undefined
  // A right answer stays on the board; after a miss, the game's move and
  // the best one are drawn on the position.
  const shapes: DrawShape[] =
    revealed && !solved
      ? [arrow(position.playedMove, 'red'), arrow(position.bestMove, 'green')]
      : []
  const side = position.color === 'white' ? 'White' : 'Black'
  const about = [
    `Move ${position.moveLabel.replace(/[.…]$/, '')}`,
    position.opponentRating ? `vs ${position.opponentRating}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="flex w-full flex-col gap-3 md:flex-row md:items-start md:gap-6">
      <div className="w-full md:max-w-[min(70vh,560px)]">
        <PracticeBoard
          fen={position.fen}
          color={position.color}
          active={phase.kind === 'thinking' || phase.kind === 'wrong'}
          onMove={answer}
          shapes={shapes}
          resetKey={resetKey}
          played={played}
          solved={solved}
        />
      </div>
      <div className="flex w-full flex-col gap-3 md:max-w-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wider text-white/60">
            Position {index + 1} of {total}
          </p>
          <StreakBadge streak={streak} />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur-md">
          <p className="text-xs text-white/60">{about}</p>
          {phase.kind === 'thinking' && (
            <p className="text-sm text-white/90">
              You went wrong here in your game. Find a better move for {side}.
            </p>
          )}
          {phase.kind === 'checking' && (
            <p className="text-sm text-white/70" aria-live="polite">
              Checking your move…
            </p>
          )}
          {phase.kind === 'wrong' && (
            <p className="text-sm text-amber-200" aria-live="polite">
              Not quite. One more try.
            </p>
          )}
          {revealed && (
            <div className="flex flex-col gap-1" aria-live="polite">
              <p
                className={`text-sm font-medium ${phase.correct ? 'text-emerald-300' : 'text-white/90'}`}
              >
                {phase.correct
                  ? `Good move: ${sanOf(position.fen, phase.answer)}`
                  : `The best move was ${position.bestSan}`}
              </p>
              <p className="text-sm text-white/70">
                In the game you played {position.playedSan}. Best:{' '}
                {position.bestSan}.
              </p>
              <Link
                href={momentHref(position, position)}
                className="text-xs text-white/60 underline hover:text-white/90"
              >
                Open in analysis
              </Link>
            </div>
          )}
        </div>
        {revealed && (
          <button
            type="button"
            onClick={next}
            className="rounded-md bg-human-4 px-4 py-2 text-sm font-medium text-white hover:bg-human-4/90"
          >
            {index + 1 < total ? 'Next position' : 'See how it went'}
          </button>
        )}
      </div>
    </section>
  )
}
