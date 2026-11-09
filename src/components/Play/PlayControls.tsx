import { useEffect, useState } from 'react'

import { PlayedGame } from 'src/types'
import { ResignationConfirmModal } from 'src/components'
import { PostGamePanel } from './PostGamePanel'

type PracticeAction = 'takeBack' | 'addTime'

// How long a practice button waits for its confirming tap.
const CONFIRM_TIMEOUT_MS = 4000

/**
 * A practice action's button. The first tap turns it into a confirm button
 * (until it's tapped again, the focus leaves it, or the wait runs out); the
 * second tap does the action.
 */
const PracticeButton: React.FC<{
  action: PracticeAction
  confirming: PracticeAction | null
  setConfirming: (action: PracticeAction | null) => void
  onConfirm?: () => void
  icon: string
  label: string
  confirmLabel: string
  title: string
}> = ({
  action,
  confirming,
  setConfirming,
  onConfirm,
  icon,
  label,
  confirmLabel,
  title,
}) => {
  const isConfirming = confirming === action && !!onConfirm
  return (
    <button
      onClick={() => {
        if (!onConfirm) return
        if (isConfirming) {
          setConfirming(null)
          onConfirm()
        } else {
          setConfirming(action)
        }
      }}
      onBlur={() => {
        if (isConfirming) setConfirming(null)
      }}
      disabled={!onConfirm}
      title={title}
      className={`flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        isConfirming
          ? 'border-human-4 bg-human-4 text-white hover:bg-human-4/90'
          : 'border-glass-border bg-glass text-white/90 hover:bg-glass-stronger'
      }`}
    >
      <span className="material-symbols-outlined !text-sm">{icon}</span>
      {isConfirming ? confirmLabel : label}
    </button>
  )
}

interface Props {
  game: PlayedGame
  playerActive: boolean
  gameOver: boolean
  resign?: () => void
  offerDraw?: () => void
  playAgain?: () => void
  /** The practice of this game's mistakes (see PostGamePanel). */
  practiceHref?: string
  /** A drill of the game's opening (see PostGamePanel). */
  drill?: { href: string; name: string }
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
  practiceHref,
  drill,
  returnTo,
  returnToLabel = 'Return',
  simulateMaiaTime,
  setSimulateMaiaTime,
  practice = false,
  takeBack,
  addTime,
}: Props) => {
  const [showResignConfirm, setShowResignConfirm] = useState(false)
  // Practice actions ask first, so a stray tap doesn't undo a move: the
  // first tap turns the button into a confirm button, the second acts.
  const [confirming, setConfirming] = useState<PracticeAction | null>(null)
  useEffect(() => {
    if (!confirming) return
    const timeout = setTimeout(() => setConfirming(null), CONFIRM_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [confirming])

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
        <PostGamePanel
          gameId={game.id}
          gameType="play"
          playAgain={playAgain}
          practiceHref={practiceHref}
          drill={drill}
          returnTo={returnTo}
          returnToLabel={returnToLabel}
        />
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
                <PracticeButton
                  action="takeBack"
                  confirming={confirming}
                  setConfirming={setConfirming}
                  onConfirm={takeBack}
                  icon="undo"
                  label="Takeback"
                  confirmLabel="Confirm takeback"
                  title="Take back your last move"
                />
                {addTime && (
                  <PracticeButton
                    action="addTime"
                    confirming={confirming}
                    setConfirming={setConfirming}
                    onConfirm={addTime}
                    icon="more_time"
                    label="+15s"
                    confirmLabel="Confirm +15s"
                    title="Add 15 seconds to your clock"
                  />
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
