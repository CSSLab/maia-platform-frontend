import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BroadcastStreamController, BroadcastGame } from 'src/types'

interface BroadcastGameListProps {
  broadcastController: BroadcastStreamController
  onGameSelected?: () => void
}

export const BroadcastGameList: React.FC<BroadcastGameListProps> = ({
  broadcastController,
  onGameSelected,
}) => {
  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    broadcastController.currentRound?.id || '',
  )

  // Sync selectedRoundId when currentRound changes
  useEffect(() => {
    if (
      broadcastController.currentRound?.id &&
      broadcastController.currentRound.id !== selectedRoundId
    ) {
      setSelectedRoundId(broadcastController.currentRound.id)
    }
  }, [broadcastController.currentRound?.id, selectedRoundId])

  const handleRoundChange = (roundId: string) => {
    setSelectedRoundId(roundId)
    broadcastController.selectRound(roundId)
  }

  const handleGameSelect = (game: BroadcastGame) => {
    broadcastController.selectGame(game.id)
    onGameSelected?.()
  }

  const currentGames = useMemo(() => {
    if (!broadcastController.roundData?.games) {
      return []
    }
    return Array.from(broadcastController.roundData.games.values())
  }, [broadcastController.roundData?.games])

  const getGameStatus = (game: BroadcastGame) => {
    if (game.result === '*') {
      return { status: 'Live', color: 'text-red-400' }
    } else if (game.result === '1-0') {
      return { status: '1-0', color: 'text-primary' }
    } else if (game.result === '0-1') {
      return { status: '0-1', color: 'text-primary' }
    } else if (game.result === '1/2-1/2') {
      return { status: '½-½', color: 'text-primary' }
    }
    return { status: game.result, color: 'text-secondary' }
  }

  const formatPlayerName = (name: string, elo?: number) => {
    const displayName = name.length > 12 ? name.substring(0, 12) + '...' : name
    return elo ? `${displayName} (${elo})` : displayName
  }

  return (
    <div className="flex h-full flex-col items-start justify-start overflow-hidden bg-background-1 md:rounded">
      <div className="flex w-full flex-col items-start justify-start gap-2 border-b-2 border-white border-opacity-10 p-3">
        <div className="w-full overflow-hidden">
          <h3 className="truncate text-sm font-semibold text-primary">
            {broadcastController.currentBroadcast?.tour.name ||
              'Live Broadcast'}
          </h3>
        </div>

        {/* Round Selector */}
        {broadcastController.currentBroadcast && (
          <select
            id="round-selector"
            value={selectedRoundId}
            onChange={(e) => handleRoundChange(e.target.value)}
            className="w-full rounded bg-background-2 px-2 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-human-4"
          >
            {broadcastController.currentBroadcast.rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.name} {round.ongoing ? '(Live)' : ''}
              </option>
            ))}
          </select>
        )}

        {/* Connection Status */}
        {broadcastController.broadcastState.error && (
          <div className="mb-2 rounded bg-red-500/20 p-2 text-xs text-red-400">
            <div className="flex items-center justify-between">
              <span>Connection Error</span>
              <button
                onClick={broadcastController.reconnect}
                className="text-xs underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {broadcastController.broadcastState.isConnecting && (
          <div className="mb-2 rounded bg-background-2 p-2 text-xs text-secondary">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border-b border-white"></div>
              <span>Connecting...</span>
            </div>
          </div>
        )}
      </div>

      <div className="red-scrollbar flex w-full flex-col overflow-y-scroll">
        {currentGames.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8 text-center">
            <div>
              <span className="material-symbols-outlined mb-2 !text-4xl text-secondary">
                live_tv
              </span>
              <p className="text-xs text-secondary">
                {broadcastController.broadcastState.isConnecting
                  ? 'Loading games...'
                  : broadcastController.currentRound?.ongoing
                    ? 'No games available'
                    : 'Round not started yet'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {currentGames.map((game, index) => {
              const isSelected = broadcastController.currentGame?.id === game.id
              const gameStatus = getGameStatus(game)

              return (
                <div
                  key={game.id}
                  className={`group flex w-full items-center ${
                    isSelected
                      ? 'bg-background-2 font-bold'
                      : index % 2 === 0
                        ? 'bg-background-1/30 hover:bg-background-2'
                        : 'bg-background-1/10 hover:bg-background-2'
                  }`}
                >
                  <div
                    className={`flex h-full w-9 items-center justify-center ${
                      isSelected
                        ? 'bg-background-3'
                        : 'bg-background-2 group-hover:bg-white/5'
                    }`}
                  >
                    <p className="text-sm text-secondary">{index + 1}</p>
                  </div>
                  <button
                    onClick={() => handleGameSelect(game)}
                    className="flex flex-1 cursor-pointer flex-col items-start justify-center overflow-hidden px-2 py-2"
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex flex-col items-start overflow-hidden">
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-white" />
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-primary">
                            {formatPlayerName(game.white, game.whiteElo)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full border-[0.5px] bg-black" />
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-primary">
                            {formatPlayerName(game.black, game.blackElo)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium ${gameStatus.color}`}
                        >
                          {gameStatus.status}
                        </span>
                        {game.result === '*' && (
                          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></div>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Footer with broadcast info */}
      <div className="w-full border-t border-white border-opacity-10 p-2">
        <div className="text-center text-xs text-secondary">
          <p>
            Watch on{' '}
            <a
              href={broadcastController.currentBroadcast?.tour.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/60 underline hover:text-primary"
            >
              Lichess
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
