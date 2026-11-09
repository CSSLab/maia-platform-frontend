import Link from 'next/link'
import Chessground from '@react-chess/chessground'
import type { Key } from 'chessground/types'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { DownloadModelModal } from 'src/components/Common/DownloadModelModal'
import { MAIA_DOWNLOAD_MB } from 'src/lib/engine/maiaDownloadPrompt'
import { useLastGame, useMomentFinder } from 'src/hooks/useLastGameMoments'
import { GameMoments, momentHref } from 'src/lib/personal/momentStore'
import { KeyMoment, topMoments } from 'src/lib/personal/keyMoments'
import { LastLichessGame } from 'src/lib/personal/lastLichessGame'
import {
  PersonalLocation,
  trackLastGameAnalyzeClicked,
  trackLastGameCardShown,
} from 'src/lib/analytics'
import { PersonalEngines } from './PersonalEngines'

interface Props {
  lichessId: string
  location: PersonalLocation
  onMomentClick?: (index: number) => void
}

const cardClass =
  'flex flex-col gap-4 rounded-xl border border-glass-border bg-glass p-4 backdrop-blur-md'
const quietButtonClass =
  'flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-white/85 transition-colors duration-200 hover:border-white/30 hover:bg-white/5'
const primaryButtonClass =
  'flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-human-4 px-3.5 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-human-3'

const percent = (share: number) => `${Math.round(share * 100)}%`

const resultText = { win: 'You won', loss: 'You lost', draw: 'Draw' }

// The boards: three across a phone, fixed and small beside the text on wider
// screens.
const boardsClass = 'grid grid-cols-3 gap-2 md:flex md:gap-3'
const boardClass = 'aspect-square w-full md:w-[148px]'

/** A key moment: the position, the move played as a red arrow, and below
 *  it the move and what players at the visitor's level find. */
const MomentBoard = ({
  moment,
  color,
  href,
  onClick,
}: {
  moment: KeyMoment
  color: 'white' | 'black'
  href: string
  onClick: () => void
}) => {
  // The arrow once the board has its size (chessground draws it from the
  // board's bounds).
  const [sized, setSized] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSized(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <li className="min-w-0">
      <Link
        href={href}
        onClick={onClick}
        className="group flex flex-col gap-1.5"
      >
        <div
          data-testid="moment-board"
          className={`${boardClass} pointer-events-none overflow-hidden rounded-md opacity-90 ring-1 ring-white/10 transition duration-200 group-hover:opacity-100 group-hover:ring-white/30`}
        >
          <Chessground
            contained
            config={{
              viewOnly: true,
              fen: moment.fen,
              orientation: color,
              coordinates: false,
              animation: { enabled: false },
              drawable: {
                enabled: false,
                visible: true,
                autoShapes: sized
                  ? [
                      {
                        orig: moment.playedMove.slice(0, 2) as Key,
                        dest: moment.playedMove.slice(2, 4) as Key,
                        brush: 'red',
                      },
                    ]
                  : [],
              },
            }}
          />
        </div>
        <p className="truncate text-xs text-white/85">
          <span className="text-white/45">{moment.moveLabel}</span>{' '}
          <span
            className={
              moment.kind === 'blunder' ? 'text-rose-300' : 'text-amber-200'
            }
          >
            {moment.playedSan}
            {moment.kind === 'blunder' ? '??' : '?!'}
          </span>
        </p>
        <p className="-mt-1 truncate text-[11px] text-white/45">
          {moment.maia
            ? `${percent(moment.maia.bestShare)} find ${moment.bestSan}`
            : `Best ${moment.bestSan}`}
        </p>
      </Link>
    </li>
  )
}

/** The boards' places while the moments are found. */
const BoardsLoading = () => (
  <div className={boardsClass} aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className={`${boardClass} animate-pulse rounded-md bg-white/[0.04] ring-1 ring-white/5`}
      />
    ))}
  </div>
)

/**
 * Runs the analysis the visitor asked for (inside PersonalEngines, which only
 * start then): the game's key moments, or Maia's view of moments found
 * before. Shows how far it got, or the download dialog for Maia's model.
 */
const Finder = ({
  game,
  entry,
  addMaia,
  onDone,
  onCancel,
}: {
  game: LastLichessGame
  entry: GameMoments | null
  addMaia: boolean
  onDone: (entry: GameMoments) => void
  onCancel: () => void
}) => {
  const { state, maia } = useMomentFinder(game, entry, addMaia, onDone)

  if (state.status === 'engine_error') {
    return (
      <p className="text-sm text-white/60">
        Stockfish couldn&apos;t start in this browser.{' '}
        <Link
          href={`/analysis/${game.id}/lichess`}
          className="underline hover:text-white/90"
        >
          Open the game in analysis
        </Link>
      </p>
    )
  }

  if (addMaia) {
    return (
      <>
        <p className="text-xs text-white/60" aria-live="polite">
          {maia.status === 'downloading'
            ? 'Downloading Maia…'
            : 'Asking Maia what players at your level play…'}
        </p>
        {/* On the page itself: the card's backdrop blur would hold the
            dialog's fixed position inside the card. */}
        {typeof document !== 'undefined' &&
          createPortal(
            <AnimatePresence>
              {(state.status === 'needs_maia' ||
                maia.status === 'downloading') && (
                <DownloadModelModal
                  maia={maia.maia}
                  progress={maia.progress}
                  download={maia.downloadModel}
                  downloading={maia.status === 'downloading'}
                  onNotNow={onCancel}
                />
              )}
            </AnimatePresence>,
            document.body,
          )}
      </>
    )
  }

  const { done, total } =
    state.status === 'analyzing' ? state.progress : { done: 0, total: 0 }
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <BoardsLoading />
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-human-2 transition-all duration-300 ${total ? '' : 'animate-pulse'}`}
          style={{ width: `${total ? (100 * done) / total : 8}%` }}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        Finding the key moments…
      </p>
    </div>
  )
}

/**
 * "Your last game": the key moments of the visitor's most recent Lichess
 * game, each opening analysis at that move. Loading the page analyses
 * nothing: moments found before (here, or saved with the backend) show at
 * once, and a game not analysed yet has a button to find them.
 */
export const LastGameCard = ({ lichessId, location, onMomentClick }: Props) => {
  const { state, update } = useLastGame(lichessId)
  const [finding, setFinding] = useState<'moments' | 'maia' | null>(null)

  // Once per page, when the card settles.
  const shown = useRef(false)
  useEffect(() => {
    if (shown.current || state.status === 'loading') return
    shown.current = true
    trackLastGameCardShown(
      state.status === 'done',
      state.status === 'done' && state.entry.usedMaia,
      location,
    )
  }, [state.status])

  if (state.status === 'loading') {
    return (
      <section
        className={`${cardClass} md:mx-auto md:w-[420px]`}
        aria-busy="true"
        data-testid="last-game-loading"
      >
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-44 animate-pulse rounded bg-white/5" />
        </div>
      </section>
    )
  }

  if (state.status === 'no_game' || state.status === 'error') {
    return (
      <p
        className="px-1 text-center text-sm text-white/50"
        data-testid="last-game-empty"
      >
        {state.status === 'no_game'
          ? 'Play a game on Lichess, and Maia will find its key moments here.'
          : "Lichess can't be reached right now. Your last game will be here next time."}
      </p>
    )
  }

  const { game } = state
  const entry = state.status === 'done' ? state.entry : null
  const about = [
    game.opponentRating ? `vs ${game.opponentRating}` : null,
    game.speed,
    game.result ? resultText[game.result] : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const finder = finding && (
    <PersonalEngines>
      <Finder
        game={game}
        entry={entry}
        addMaia={finding === 'maia'}
        onDone={(found) => {
          update(game, found)
          setFinding(null)
        }}
        onCancel={() => setFinding(null)}
      />
    </PersonalEngines>
  )

  const start = (what: 'moments' | 'maia') => {
    trackLastGameAnalyzeClicked(what, location)
    setFinding(what)
  }

  const heading = (
    <div className="min-w-0">
      <h2 className="whitespace-nowrap text-sm font-semibold text-white/95">
        Your last game
      </h2>
      <p className="text-xs text-white/50">{about}</p>
    </div>
  )

  if (!entry) {
    return (
      <section
        className={`${cardClass} md:mx-auto md:w-fit md:min-w-[420px]`}
        data-testid="last-game-card"
      >
        <div className="flex items-center justify-between gap-6">
          {heading}
          {!finding && (
            <button
              type="button"
              onClick={() => start('moments')}
              className={quietButtonClass}
            >
              <span className="material-symbols-outlined !text-base">
                search
              </span>
              Find key moments
            </button>
          )}
        </div>
        {finder}
      </section>
    )
  }

  const shownMoments = topMoments(entry.moments)
  const count = shownMoments.length
  return (
    <section
      className={`${cardClass} md:mx-auto md:w-fit md:flex-row md:items-start md:gap-10 md:p-5`}
      data-testid="last-game-card"
    >
      <div className="flex items-center justify-between gap-3 md:flex-col md:items-start md:gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white/95">
            {count === 0
              ? 'No big mistakes in your last game'
              : 'Your last game'}
          </h2>
          <p className="text-xs text-white/50">{about}</p>
        </div>
        {count > 0 ? (
          <Link href="/practice" className={primaryButtonClass}>
            <span className="material-symbols-outlined !text-base">target</span>
            Practice
          </Link>
        ) : (
          <Link
            href={`/analysis/${game.id}/lichess`}
            className={quietButtonClass}
          >
            Open in analysis
          </Link>
        )}
      </div>
      {count > 0 && (
        <div className="flex flex-col gap-3">
          <ol className={boardsClass}>
            {shownMoments.map((moment, index) => (
              <MomentBoard
                key={moment.moveIndex}
                moment={moment}
                color={entry.color}
                href={momentHref(entry, moment)}
                onClick={() => onMomentClick?.(index)}
              />
            ))}
          </ol>
          {!entry.usedMaia && !finding && (
            <button
              type="button"
              onClick={() => start('maia')}
              className="self-start text-left text-xs text-white/45 underline-offset-2 hover:text-white/80 hover:underline"
            >
              What players at your level play here (Maia, {MAIA_DOWNLOAD_MB} MB)
            </button>
          )}
          {finder}
        </div>
      )}
    </section>
  )
}
