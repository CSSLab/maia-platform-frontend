import { useContext } from 'react'
import { TuringControllerContext } from 'src/contexts'

export const TuringLog: React.FC<{ embedded?: boolean }> = ({
  embedded = false,
}) => {
  const { games, gameIds, setCurrentIndex, currentIndex } = useContext(
    TuringControllerContext,
  )

  return (
    <div
      className={
        embedded
          ? 'border-glass-border flex h-full flex-col overflow-hidden border-t bg-transparent'
          : 'flex h-full flex-col overflow-hidden rounded bg-background-1'
      }
    >
      <div
        className={
          embedded
            ? 'border-glass-border border-b px-3 py-2'
            : 'border-b border-white border-opacity-10 px-3 py-2'
        }
      >
        <h3 className="text-sm font-medium text-primary">Game History</h3>
      </div>
      <div className="red-scrollbar flex flex-1 flex-col overflow-y-auto">
        {gameIds.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-xs text-secondary">No games completed yet</p>
          </div>
        ) : (
          gameIds.map((gameId, index) => {
            const game = games[index]
            const isCurrentGame = index === currentIndex
            const getStatusInfo = () => {
              if (game.result?.correct === true) {
                return {
                  label: 'Correct',
                  color: 'text-green-400',
                  bgColor: 'bg-green-900/20 hover:bg-green-900/30',
                }
              } else if (game.result?.correct === false) {
                return {
                  label: 'Incorrect',
                  color: 'text-red-400',
                  bgColor: 'bg-red-900/20 hover:bg-red-900/30',
                }
              } else {
                return {
                  label: isCurrentGame ? 'Current' : 'In Progress',
                  color: 'text-secondary',
                  bgColor: 'bg-blue-900/20 hover:bg-blue-900/30',
                }
              }
            }

            const statusInfo = getStatusInfo()
            const gameNumber = index + 1

            return (
              <button
                key={gameId}
                onClick={() => setCurrentIndex(index)}
                className={`group flex w-full cursor-pointer items-center gap-2 border-b border-white/5 px-3 py-2 text-left transition-colors ${
                  isCurrentGame
                    ? 'bg-background-2 font-medium'
                    : `${statusInfo.bgColor} hover:bg-background-2`
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs font-medium text-primary">
                      Game #{gameNumber}
                    </p>
                    <span className={`text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-secondary">
                      {game.result?.bot === 'white'
                        ? 'White was the bot'
                        : game.result?.bot === 'black'
                          ? 'Black was the bot'
                          : game.termination.winner === 'white'
                            ? 'White wins'
                            : game.termination.winner === 'black'
                              ? 'Black wins'
                              : game.termination.winner === 'none'
                                ? 'Draw'
                                : 'Game in progress'}
                    </p>
                    {game.result?.ratingDiff !== undefined && (
                      <div className="flex items-center">
                        <span
                          className={`material-symbols-outlined text-sm ${
                            game.result.ratingDiff >= 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {game.result.ratingDiff >= 0
                            ? 'arrow_drop_up'
                            : 'arrow_drop_down'}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            game.result.ratingDiff >= 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {game.result.ratingDiff >= 0 ? '+' : ''}
                          {game.result.ratingDiff}
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
