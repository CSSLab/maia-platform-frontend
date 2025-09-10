import { Dispatch, SetStateAction } from 'react'

import { PuzzleGame } from 'src/types/puzzle'

interface Props {
  previousGameResults: (PuzzleGame & {
    result?: boolean
    ratingDiff?: number
  })[]
  setCurrentIndex: Dispatch<SetStateAction<number>>
  embedded?: boolean
}

export const PuzzleLog: React.FC<Props> = ({
  previousGameResults,
  setCurrentIndex,
  embedded = false,
}: Props) => {
  return (
    <div
      className={
        embedded
          ? 'flex h-full flex-col overflow-hidden border-t border-glassBorder bg-transparent'
          : 'flex h-full flex-col overflow-hidden rounded-md border border-glassBorder bg-glass backdrop-blur-md'
      }
    >
      <div
        className={
          embedded
            ? 'border-b border-glassBorder px-3 py-2'
            : 'border-b border-glassBorder px-3 py-2'
        }
      >
        <h3 className="text-sm font-medium text-primary">Puzzle History</h3>
      </div>
      <div className="red-scrollbar flex flex-1 flex-col overflow-y-auto">
        {previousGameResults.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-xs text-secondary">No puzzles completed yet</p>
          </div>
        ) : (
          previousGameResults.map((game, index) => {
            const isCurrentPuzzle = index === previousGameResults.length - 1
            const getStatusInfo = () => {
              if (game.result === true) {
                return {
                  label: 'Correct',
                  color: 'text-green-400',
                  bgColor: 'bg-green-900/20 hover:bg-green-900/30',
                }
              } else if (game.result === false) {
                return {
                  label: 'Incorrect',
                  color: 'text-red-400',
                  bgColor: 'bg-red-900/20 hover:bg-red-900/30',
                }
              } else {
                return {
                  label: isCurrentPuzzle ? 'Current' : 'In Progress',
                  color: 'text-secondary',
                  bgColor: 'bg-blue-900/20 hover:bg-blue-900/30',
                }
              }
            }

            const statusInfo = getStatusInfo()
            const puzzleNumber = index + 1

            return (
              <button
                key={game.id}
                onClick={() => setCurrentIndex(index)}
                className={`group flex w-full cursor-pointer items-center gap-2 border-b border-white/5 px-3 py-2 text-left transition-colors ${
                  isCurrentPuzzle
                    ? 'bg-background-2 font-medium'
                    : `${statusInfo.bgColor} hover:bg-background-2`
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs font-medium text-primary">
                      Puzzle #{puzzleNumber}
                    </p>
                    <span className={`text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-secondary">
                      Puzzle Rating:{' '}
                      {game.result !== undefined ? (
                        game.puzzle_elo
                      ) : (
                        <span className="text-secondary/60">hidden</span>
                      )}
                    </p>

                    {game.ratingDiff !== undefined && (
                      <div className="flex items-center">
                        <span
                          className={`material-symbols-outlined text-sm ${
                            game.ratingDiff >= 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {game.ratingDiff >= 0
                            ? 'arrow_drop_up'
                            : 'arrow_drop_down'}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            game.ratingDiff >= 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {game.ratingDiff >= 0 ? '+' : ''}
                          {game.ratingDiff}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
