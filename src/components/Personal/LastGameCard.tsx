import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { useState } from 'react'

import { DownloadModelModal } from 'src/components/Common/DownloadModelModal'
import { MAIA_DOWNLOAD_MB } from 'src/lib/engine/maiaDownloadPrompt'
import { useLastGameMoments } from 'src/hooks/useLastGameMoments'
import { momentHref } from 'src/lib/personal/momentStore'
import { KeyMoment } from 'src/lib/personal/keyMoments'

interface Props {
  lichessId: string
  onMomentClick?: (index: number) => void
}

const cardClass =
  'flex flex-col gap-3 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur-md'

const percent = (share: number) => `${Math.round(share * 100)}%`

const resultText = { win: 'You won', loss: 'You lost', draw: 'Draw' }

const MomentRow = ({
  moment,
  href,
  onClick,
}: {
  moment: KeyMoment
  href: string
  onClick: () => void
}) => (
  <li>
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-md border border-glass-border bg-white/5 px-3 py-2 transition-colors duration-200 hover:bg-white/10"
    >
      <div className="min-w-0">
        <p className="text-sm text-white/90">
          <span className="text-white/60">{moment.moveLabel}</span>{' '}
          <span
            className={
              moment.kind === 'blunder' ? 'text-rose-300' : 'text-amber-200'
            }
          >
            {moment.playedSan}
            {moment.kind === 'blunder' ? '??' : '?!'}
          </span>{' '}
          <span className="text-white/60">
            −{percent(moment.winrateLoss)} win chance
          </span>
        </p>
        <p className="text-xs text-white/60">
          Best was {moment.bestSan}
          {moment.maia
            ? ` · at ${moment.maia.rating}, ${percent(moment.maia.bestShare)} find it`
            : ''}
        </p>
      </div>
      <span className="material-symbols-outlined shrink-0 !text-lg text-white/50">
        arrow_forward_ios
      </span>
    </Link>
  </li>
)

/**
 * "Your last game": the key moments of the visitor's most recent Lichess
 * game, each opening analysis at that move. Must be inside PersonalEngines.
 */
export const LastGameCard = ({ lichessId, onMomentClick }: Props) => {
  const { state, maia } = useLastGameMoments(lichessId)
  const [askingForMaia, setAskingForMaia] = useState(false)

  if (state.status === 'loading') {
    return (
      <section
        className={cardClass}
        aria-busy="true"
        data-testid="last-game-loading"
      >
        <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
        <div className="h-10 w-full animate-pulse rounded bg-white/5" />
        <div className="h-10 w-full animate-pulse rounded bg-white/5" />
      </section>
    )
  }

  if (state.status === 'no_game' || state.status === 'error') {
    return (
      <section className={cardClass} data-testid="last-game-empty">
        <p className="text-sm text-white/60">
          {state.status === 'no_game'
            ? 'Play a game on Lichess, and Maia will find its key moments here.'
            : "Lichess can't be reached right now. Your last game will be here next time."}
        </p>
      </section>
    )
  }

  const { game } = state
  const about = [
    game.opponentRating ? `vs ${game.opponentRating}` : null,
    game.speed,
    game.result ? resultText[game.result] : null,
  ]
    .filter(Boolean)
    .join(' · ')

  if (state.status === 'analyzing' || state.status === 'engine_error') {
    const { done, total } =
      state.status === 'analyzing' ? state.progress : { done: 0, total: 0 }
    return (
      <section className={cardClass} aria-busy={state.status === 'analyzing'}>
        <div>
          <h2 className="text-base font-semibold text-white/95">
            Your last game
          </h2>
          <p className="text-xs text-white/60">{about}</p>
        </div>
        {state.status === 'analyzing' ? (
          <>
            <p className="text-sm text-white/80">
              Finding the key moments in your last game…
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded bg-white/10">
              <div
                className="h-full rounded bg-human-4 transition-all duration-300"
                style={{ width: `${total ? (100 * done) / total : 5}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-white/60">
            Stockfish couldn&apos;t start in this browser.{' '}
            <Link
              href={`/analysis/${game.id}/lichess`}
              className="underline hover:text-white/90"
            >
              Open the game in analysis
            </Link>
          </p>
        )}
      </section>
    )
  }

  const { entry } = state
  const count = entry.moments.length
  return (
    <section className={cardClass} data-testid="last-game-card">
      <div>
        <h2 className="text-base font-semibold text-white/95">
          {count === 0
            ? 'No big mistakes in your last game'
            : `Maia found ${count} key moment${count === 1 ? '' : 's'} in your last game`}
        </h2>
        <p className="text-xs text-white/60">{about}</p>
      </div>
      {count > 0 && (
        <ol className="flex flex-col gap-2">
          {entry.moments.map((moment, index) => (
            <MomentRow
              key={moment.moveIndex}
              moment={moment}
              href={momentHref(entry, moment)}
              onClick={() => onMomentClick?.(index)}
            />
          ))}
        </ol>
      )}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Link
          href={`/analysis/${game.id}/lichess`}
          className="text-sm text-white/70 underline hover:text-white/90"
        >
          Open the game in analysis
        </Link>
        {!entry.usedMaia && maia.status === 'no-cache' && (
          <button
            type="button"
            onClick={() => setAskingForMaia(true)}
            className="text-left text-xs text-white/60 underline hover:text-white/90 md:text-right"
          >
            See what players at your level play here (Maia, {MAIA_DOWNLOAD_MB}{' '}
            MB)
          </button>
        )}
      </div>
      <AnimatePresence>
        {askingForMaia && maia.status !== 'ready' && (
          <DownloadModelModal
            maia={maia.maia}
            progress={maia.progress}
            download={maia.downloadModel}
            downloading={maia.status === 'downloading'}
            onNotNow={() => setAskingForMaia(false)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
