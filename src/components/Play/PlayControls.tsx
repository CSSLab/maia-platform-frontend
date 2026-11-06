import { useState } from 'react'

import { PlayedGame } from 'src/types'
import { ResignationConfirmModal } from 'src/components'

interface Props {
  game: PlayedGame
  playerActive: boolean
  gameOver: boolean
  resign?: () => void
  offerDraw?: () => void
  playAgain?: () => void
  returnTo?: () => void
  returnToLabel?: string
  simulateMaiaTime?: boolean
  setSimulateMaiaTime?: (value: boolean) => void
  // Practice games: unrated, with takebacks and extra time. Each button is
  // shown when its handler is given (and is usable now).
  practice?: boolean
  takeBack?: () => void
  addTime?: () => void
}

export const PlayControls: React.FC<Props> = ({
  game,
  playerActive,
  gameOver,
  resign,
  offerDraw,
  playAgain,
  returnTo,
  returnToLabel = 'RETURN',
  simulateMaiaTime,
  setSimulateMaiaTime,
  practice = false,
  takeBack,
  addTime,
}: Props) => {
  const [showResignConfirm, setShowResignConfirm] = useState(false)

  const handleResignClick = () => {
    setShowResignConfirm(true)
  }

  const handleConfirmResign = () => {
    if (resign) {
      resign()
    }
  }

  return (
    <div className="flex w-full flex-col">
      {gameOver ? (
        <div className="flex flex-col gap-3 p-4">
          {game.id ? (
            <button
              onClick={() => {
                window.open(`/analysis/${game.id}/play`, '_blank')
              }}
              className="flex items-center justify-center rounded-md border border-glass-border bg-glass px-4 py-2 text-sm font-semibold text-white/90 transition-colors duration-200 hover:bg-glass-stronger"
            >
              ANALYZE GAME
            </button>
          ) : null}
          {playAgain ? (
            <button
              onClick={playAgain}
              className="flex items-center justify-center rounded-md border border-glass-border bg-glass px-4 py-2 text-sm font-semibold tracking-wide text-white/90 transition-colors duration-200 hover:bg-glass-stronger"
            >
              PLAY AGAIN
            </button>
          ) : null}
          {returnTo ? (
            <button
              onClick={returnTo}
              className="flex items-center justify-center rounded-md border border-glass-border bg-glass px-4 py-2 text-sm font-semibold tracking-wide text-white/90 transition-colors duration-200 hover:bg-glass-stronger"
            >
              {returnToLabel}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="bg-transparent px-4 py-3">
            <p
              className={`text-center text-sm font-semibold uppercase tracking-wider ${
                playerActive ? 'text-white' : 'text-white/60'
              }`}
            >
              {playerActive ? 'Your Turn' : 'Waiting for Opponent'}
            </p>
            {practice && (
              <p className="mt-1 text-center text-[11px] uppercase tracking-wider text-white/50">
                Practice · Unrated
              </p>
            )}
          </div>

          {practice && (
            <div className="px-4 pb-1">
              {/* Stacked: the side panel can be narrow. */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={takeBack}
                  disabled={!takeBack}
                  title="Take back your last move"
                  className="flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-white/90 transition-colors duration-200 hover:bg-glass-stronger disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined !text-sm">
                    undo
                  </span>
                  Takeback
                </button>
                {addTime && (
                  <button
                    onClick={addTime}
                    title="Add 15 seconds to your clock"
                    className="flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-white/90 transition-colors duration-200 hover:bg-glass-stronger"
                  >
                    <span className="material-symbols-outlined !text-sm">
                      more_time
                    </span>
                    +15s
                  </button>
                )}
              </div>
            </div>
          )}

          {simulateMaiaTime !== undefined && setSimulateMaiaTime && (
            <div className="bg-transparent px-4 py-2">
              <div className="flex flex-col gap-2">
                <p className="text-center text-xs font-medium uppercase tracking-wider text-white/70">
                  Maia Thinking Time
                </p>
                <div className="flex overflow-hidden rounded-md border border-glass-border bg-glass">
                  <button
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                      !simulateMaiaTime
                        ? 'bg-human-4 text-white hover:bg-human-4/90'
                        : 'text-white/70 hover:bg-glass-strong hover:text-white'
                    }`}
                    onClick={() => setSimulateMaiaTime(false)}
                  >
                    Instant
                  </button>
                  <button
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                      simulateMaiaTime
                        ? 'bg-human-4 text-white hover:bg-human-4/90'
                        : 'text-white/70 hover:bg-glass-strong hover:text-white'
                    }`}
                    onClick={() => setSimulateMaiaTime(true)}
                  >
                    Human-like
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="px-4 py-3">
            <div className="flex flex-col gap-3">
              {offerDraw && (
                <button
                  onClick={offerDraw}
                  disabled={!playerActive}
                  className={`w-full rounded-md border border-glass-border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                    playerActive
                      ? 'bg-glass text-white/90 hover:bg-glass-stronger'
                      : 'cursor-not-allowed bg-white/5 text-white/40'
                  }`}
                >
                  OFFER DRAW
                </button>
              )}

              <div className="flex justify-center">
                <button
                  onClick={handleResignClick}
                  disabled={!resign || !playerActive}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors duration-200 ${
                    resign && playerActive
                      ? 'text-rose-300 hover:bg-rose-500/10 hover:text-rose-200'
                      : 'cursor-not-allowed text-white/30'
                  }`}
                >
                  Resign
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ResignationConfirmModal
        isOpen={showResignConfirm}
        onClose={() => setShowResignConfirm(false)}
        onConfirm={handleConfirmResign}
      />
    </div>
  )
}
