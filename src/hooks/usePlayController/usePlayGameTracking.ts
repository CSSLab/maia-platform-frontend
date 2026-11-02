import { useContext, useEffect, useRef } from 'react'
import { AuthContext } from 'src/contexts/AuthContext'
import { PlayGameConfig, Termination } from 'src/types'
import {
  PlayGameType,
  trackPlayGameEnded,
  trackPlayGameFirstMoves,
  trackPlayGameStarted,
} from 'src/lib/analytics'

const GAME_TYPES: Record<PlayGameConfig['playType'], PlayGameType> = {
  againstMaia: 'vs_maia',
  handAndBrain: 'hand_and_brain',
}

const getResult = (
  termination: Termination,
  player: PlayGameConfig['player'],
) => {
  if (termination.winner === player) return 'win'
  return termination.winner === 'none' ? 'draw' : 'loss'
}

export const usePlayGameTracking = (
  id: string,
  config: PlayGameConfig,
  moveCount: number,
  termination: Termination | undefined,
) => {
  const { user } = useContext(AuthContext)
  const tracked = useRef({
    id: '',
    startedAt: 0,
    firstMoves: false,
    ended: false,
  })
  const gameType = GAME_TYPES[config.playType]

  useEffect(() => {
    if (!id || tracked.current.id === id) return

    tracked.current = {
      id,
      startedAt: Date.now(),
      firstMoves: false,
      ended: false,
    }
    trackPlayGameStarted(
      id,
      gameType,
      config.maiaVersion,
      config.player,
      config.timeControl,
      !!config.startFen,
      config.isBrain,
      !!user?.lichessId,
    )
  }, [id])

  useEffect(() => {
    if (!id || moveCount < 2 || tracked.current.firstMoves) return

    tracked.current.firstMoves = true
    trackPlayGameFirstMoves(id, gameType, config.maiaVersion)
  }, [id, moveCount])

  useEffect(() => {
    if (!id) return

    if (!termination) {
      tracked.current.ended = false
      return
    }
    if (tracked.current.ended) return

    tracked.current.ended = true
    trackPlayGameEnded(
      id,
      gameType,
      config.maiaVersion,
      getResult(termination, config.player),
      termination.type ?? 'unknown',
      moveCount,
      Math.round((Date.now() - tracked.current.startedAt) / 1000),
    )
  }, [id, termination, moveCount])
}
