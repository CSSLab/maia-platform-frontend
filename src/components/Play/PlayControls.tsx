import { useState } from 'react'

import { BaseGame } from 'src/types'
import { ResignationConfirmModal } from 'src/components'

interface Props {
  game: BaseGame
  playerActive: boolean
  gameOver: boolean
  resign?: () => void
  offerDraw?: () => void
  playAgain?: () => void
  simulateMaiaTime?: boolean
  setSimulateMaiaTime?: (value: boolean) => void
  embedded?: boolean
}

export const PlayControls: React.FC<Props> = ({
  game,
  playerActive,
  gameOver,
  resign,
  offerDraw,
  playAgain,
  simulateMaiaTime,
  setSimulateMaiaTime,
  embedded = false,
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
  const containerClasses = embedded
    ? 'flex w-full flex-col'
    : 'flex w-full flex-col overflow-hidden rounded-lg border border-glassBorder bg-glass backdrop-blur-md'

  return (
    <div className={containerClasses}>
      {gameOver ? (
        <div className="flex flex-col gap-3 p-4">
          {game.id ? (
            <button
              onClick={() => {
                window.open(`/analysis/${game.id}/play`, '_blank')
              }}
              className="flex items-center justify-center rounded-md border border-glassBorder bg-glass px-4 py-2 text-sm font-semibold text-white/90 transition-colors duration-200 hover:bg-glass-hover"
            >
              ANALYZE GAME
            </button>
          ) : null}
          {playAgain ? (
            <button
              onClick={playAgain}
              className="flex items-center justify-center rounded-md border border-glassBorder bg-glass px-4 py-2 text-sm font-semibold tracking-wide text-white/90 transition-colors duration-200 hover:bg-glass-hover"
            >
              PLAY AGAIN
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="border-b border-glassBorder bg-transparent px-4 py-3">
            <p
              className={`text-center text-sm font-semibold uppercase tracking-wider ${
                playerActive ? 'text-white' : 'text-white/60'
              }`}
            >
              {playerActive ? 'Your Turn' : 'Waiting for Opponent'}
            </p>
          </div>

          {simulateMaiaTime !== undefined && setSimulateMaiaTime && (
            <div className="border-b border-glassBorder bg-transparent px-4 py-3">
              <div className="flex flex-col gap-2">
                <p className="text-center text-xs font-semibold tracking-wider text-white/70">
                  MAIA THINKING TIME
                </p>
                <div className="flex overflow-hidden rounded-md border border-glassBorder bg-glass">
                  <button
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                      !simulateMaiaTime
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={() => setSimulateMaiaTime(false)}
                  >
                    Instant
                  </button>
                  <button
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                      simulateMaiaTime
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
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
                  className={`w-full rounded-md border border-glassBorder px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                    playerActive
                      ? 'bg-glass text-white/90 hover:bg-glass-hover'
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
