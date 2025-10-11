import React from 'react'
import Image from 'next/image'
import {
  LearnFromMistakesConfiguration,
  MistakePosition,
} from 'src/types/analysis'

interface Props {
  state: LearnFromMistakesConfiguration
  currentInfo: {
    mistake: MistakePosition
    progress: string
    isLastMistake: boolean
  } | null
  onShowSolution: () => void
  onNext: () => void
  onStop: () => void
  onSelectPlayer: (color: 'white' | 'black') => void
  lastMoveResult?: 'correct' | 'incorrect' | 'not-learning'
}

export const LearnFromMistakes: React.FC<Props> = ({
  state,
  currentInfo,
  onShowSolution,
  onNext,
  onStop,
  onSelectPlayer,
  lastMoveResult,
}) => {
  if (!state.isActive) {
    return null
  }

  // Show player selection dialog
  if (state.showPlayerSelection) {
    return (
      <div className="flex h-full w-full flex-col border-white/10 bg-gradient-to-br text-white">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined !text-sm text-white/80">
              school
            </span>
            <h3 className="text-sm font-semibold text-white">
              Learn from your mistakes
            </h3>
          </div>
          <button
            onClick={onStop}
            title="Stop learning"
            className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xxs text-white/70 transition duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-outlined !text-xxs">close</span>
            Stop
          </button>
        </div>

        <div className="flex flex-1 flex-col items-start justify-start gap-6 p-3">
          <p className="text-center text-sm text-white/70">
            Choose which player&apos;s mistakes you&apos;d like to learn from:
          </p>
          <div className="flex w-full items-center justify-center gap-4">
            <button
              onClick={() => onSelectPlayer('white')}
              title="Learn from White's mistakes"
              className="flex h-16 w-16 items-center justify-center rounded border border-glassBorder bg-glass transition-colors duration-200 hover:bg-glass-strong"
            >
              <div className="relative h-10 w-10">
                <Image
                  src="/assets/pieces/white king.svg"
                  fill={true}
                  alt="Learn from White's mistakes"
                />
              </div>
            </button>
            <button
              onClick={() => onSelectPlayer('black')}
              title="Learn from Black's mistakes"
              className="flex h-16 w-16 items-center justify-center rounded border border-glassBorder bg-glass transition-colors duration-200 hover:bg-glass-strong"
            >
              <div className="relative h-10 w-10">
                <Image
                  src="/assets/pieces/black king.svg"
                  fill={true}
                  alt="Learn from Black's mistakes"
                />
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!currentInfo) {
    return null
  }

  const { mistake, progress, isLastMistake } = currentInfo

  const getMoveDisplay = () => {
    const moveNumber = Math.ceil(mistake.moveIndex / 2)
    const isWhiteMove = mistake.playerColor === 'white'

    if (isWhiteMove) {
      return `${moveNumber}. ${mistake.san}`
    } else {
      return `${moveNumber}... ${mistake.san}`
    }
  }

  const getPromptText = () => {
    const mistakeType = mistake.type === 'blunder' ? '??' : '?!'
    const moveDisplay = getMoveDisplay()
    const playerColorName = mistake.playerColor === 'white' ? 'White' : 'Black'

    return `${moveDisplay}${mistakeType} was played. Find a better move for ${playerColorName}.`
  }

  const getFeedbackText = () => {
    if (state.showSolution) {
      if (lastMoveResult === 'correct') {
        return `Correct! ${mistake.bestMoveSan} was the best move.`
      } else {
        return `The best move was ${mistake.bestMoveSan}.`
      }
    }

    if (lastMoveResult === 'incorrect') {
      const playerColorName =
        mistake.playerColor === 'white' ? 'White' : 'Black'
      return `You can do better. Try another move for ${playerColorName}.`
    }

    return null
  }

  return (
    <div className="to-white/4 flex h-full w-full flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 text-white backdrop-blur-lg">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined !text-sm text-white/80">
            school
          </span>
          <h3 className="text-sm font-semibold text-white">
            Learn from your mistakes
          </h3>
          <span className="mt-0.5 text-xxs text-white/60">({progress})</span>
        </div>
        <button
          onClick={onStop}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xxs text-white/70 transition duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          <span className="material-symbols-outlined !text-xxs">close</span>
          Stop
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm text-white/75">{getPromptText()}</p>
        {getFeedbackText() && (
          <p
            className={`text-sm ${
              state.showSolution
                ? 'text-green-300'
                : lastMoveResult === 'incorrect'
                  ? 'text-orange-300/80'
                  : 'text-white'
            }`}
          >
            {getFeedbackText()}
          </p>
        )}
      </div>

      <div className="flex w-full gap-3 pt-1">
        {!state.showSolution && lastMoveResult !== 'correct' ? (
          <>
            <button
              onClick={onShowSolution}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-human-4/40 bg-human-4/80 px-3 py-2 text-sm font-medium text-white/90 transition duration-200 hover:bg-human-4"
            >
              <span className="material-symbols-outlined !text-sm">
                lightbulb
              </span>
              See solution
            </button>
            {!isLastMistake && (
              <button
                onClick={onNext}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/75 transition duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <span className="material-symbols-outlined !text-sm">
                  skip_next
                </span>
                Skip
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onNext}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-human-4/40 bg-human-4/70 px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-human-4/90"
          >
            <span className="material-symbols-outlined !text-base">
              {isLastMistake ? 'check' : 'arrow_forward'}
            </span>
            {isLastMistake ? 'Finish' : 'Next mistake'}
          </button>
        )}
      </div>
    </div>
  )
}
