import { Chess } from 'chess.ts'
import { useMemo, Dispatch, SetStateAction } from 'react'

import { useTrainingController } from 'src/hooks'
import { PuzzleGame, Status } from 'src/types/puzzle'

interface Props {
  status: string
  game: PuzzleGame
  setAndGiveUp: () => void
  getNewGame: () => Promise<void>
  setStatus: Dispatch<SetStateAction<Status>>
  controller: ReturnType<typeof useTrainingController>
  lastAttemptedMove: string | null
  setLastAttemptedMove: Dispatch<SetStateAction<string | null>>
  solutionMoveSan: string | null
  embedded?: boolean
}

export const Feedback: React.FC<Props> = ({
  game,
  status,
  setStatus,
  getNewGame,
  setAndGiveUp,
  controller: controller,
  lastAttemptedMove,
  setLastAttemptedMove,
  solutionMoveSan,
  embedded = false,
}: Props) => {
  const turn =
    new Chess(controller.gameTree.getLastMainlineNode().fen).turn() === 'w'
      ? 'white'
      : 'black'

  const content = useMemo(() => {
    if (status === 'archived') {
      return {
        titlePrefix: null,
        title: 'You already solved this puzzle.',
        detail: 'Choose another puzzle from the history list.',
        titleClass: 'text-primary',
        accentPrefixClass: '',
      }
    }

    if (status === 'forfeit') {
      return {
        titlePrefix: null,
        title: `${solutionMoveSan || 'That move'} is the best move.`,
        detail: 'Explore the position or try the next puzzle.',
        titleClass: 'text-primary',
        accentPrefixClass: '',
      }
    }

    if (status === 'correct') {
      return {
        titlePrefix: 'Correct!',
        title: ` ${lastAttemptedMove || 'That move'} is the best move.`,
        detail: 'Explore the position or try the next puzzle.',
        titleClass: 'text-primary',
        accentPrefixClass: 'text-green-400',
      }
    }

    if (status === 'incorrect') {
      return {
        titlePrefix: 'Incorrect.',
        title: ` ${lastAttemptedMove || 'That move'} is not the best move.`,
        detail: 'Try again or give up to unlock analysis.',
        titleClass: 'text-primary',
        accentPrefixClass: 'text-human-2',
      }
    }

    return {
      titlePrefix: null,
      title: `Find the best move for ${turn}.`,
      detail: 'Give up if you want to reveal the answer and analyze it.',
      titleClass: 'text-primary',
      accentPrefixClass: '',
    }
  }, [lastAttemptedMove, solutionMoveSan, status, turn])

  return (
    <div
      className={
        embedded
          ? 'flex w-screen flex-1 flex-col border-t border-glass-border bg-transparent p-3 md:w-auto md:p-5 lg:justify-between'
          : 'flex w-screen flex-col rounded-md border border-glass-border bg-glass p-4 shadow-[0_12px_32px_rgb(0_0_0_/_0.14)] backdrop-blur-md md:w-auto'
      }
    >
      <div className="flex flex-col gap-3">
        <div className="space-y-2">
          <h3
            className={`text-[1.6rem] font-semibold leading-tight ${content.titleClass}`}
          >
            {content.titlePrefix ? (
              <span className={content.accentPrefixClass}>
                {content.titlePrefix}
              </span>
            ) : null}
            {content.title}
          </h3>
          <p className="max-w-[32ch] text-sm leading-6 text-secondary/75">
            {content.detail}
          </p>
        </div>
      </div>

      <div className="mt-4 flex min-w-32 flex-row gap-1.5 lg:flex-col">
        {status !== 'archived' && (
          <>
            {status === 'incorrect' && (
              <button
                onClick={() => {
                  setStatus('default')
                  setLastAttemptedMove(null)
                  controller.reset()
                }}
                className="flex w-full justify-center rounded-md border border-engine-4/40 bg-engine-4/15 py-2 text-sm font-medium text-primary transition duration-300 hover:bg-engine-4/25 disabled:bg-backdrop disabled:text-secondary"
              >
                Try Again
              </button>
            )}
            {status !== 'forfeit' && status !== 'correct' && (
              <button
                onClick={setAndGiveUp}
                className="flex w-full justify-center rounded-md bg-human-3 py-2 text-sm font-medium text-primary transition duration-300 hover:bg-human-4 disabled:bg-backdrop disabled:text-secondary"
              >
                Give Up
              </button>
            )}
            {(status === 'forfeit' || status === 'correct') && (
              <button
                onClick={async () => {
                  await getNewGame()
                }}
                className="flex w-full justify-center rounded-md bg-human-3 py-2 text-sm font-medium text-primary transition duration-300 hover:bg-human-4 disabled:bg-backdrop disabled:text-secondary"
              >
                Next Puzzle
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
