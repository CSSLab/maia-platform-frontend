import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.ts'
import { PlayGameConfig, QueuedPremove } from 'src/types'
import { backOff } from 'exponential-backoff'
import { useStats } from 'src/hooks/useStats'
import { usePlayController } from 'src/hooks/usePlayController'
import { fetchGameMove, logGameMove, fetchPlayPlayerStats } from 'src/api'
import { useSound } from 'src/hooks/useSound'
import { safeUpdateRating } from 'src/lib/ratingUtils'

const playStatsLoader = async () => {
  const stats = await fetchPlayPlayerStats()
  return {
    gamesPlayed: stats.playGamesPlayed,
    gamesWon: stats.playWon,
    rating: stats.playElo,
  }
}

const PREMOVE_SOUND_DELAY_MS = 120

export const useVsMaiaPlayController = (
  id: string,
  playGameConfig: PlayGameConfig,
  simulateMaiaTime: boolean,
) => {
  const controller = usePlayController(id, playGameConfig)
  const [stats, incrementStats, updateRating] = useStats(playStatsLoader)
  const { playMoveSound } = useSound()
  const [queuedPremove, setQueuedPremove] = useState<QueuedPremove | null>(null)
  const queuedPremoveRef = useRef<QueuedPremove | null>(null)
  const [premoveResetKey, setPremoveResetKey] = useState(0)

  const clearPremove = useCallback(() => {
    if (!queuedPremoveRef.current) {
      return
    }

    queuedPremoveRef.current = null
    setQueuedPremove(null)
    setPremoveResetKey((prev) => prev + 1)
  }, [])

  const setPremove = useCallback((from: string, to: string) => {
    const nextPremove = { from, to }
    queuedPremoveRef.current = nextPremove
    setQueuedPremove(nextPremove)
  }, [])

  const getLegalPremoveUci = useCallback(
    (fen: string, premove: QueuedPremove): string | null => {
      const chess = new Chess(fen)
      const matchingMoves = chess
        .moves({ verbose: true })
        .filter((move) => move.from === premove.from && move.to === premove.to)

      if (matchingMoves.length === 0) {
        return null
      }

      const matchingPromotion =
        matchingMoves.find((move) => move.promotion === 'q') || matchingMoves[0]

      return (
        matchingPromotion.from +
        matchingPromotion.to +
        (matchingPromotion.promotion || '')
      )
    },
    [],
  )

  const makePlayerMove = async (moveUci: string, moveTimeOverride?: number) => {
    const moveTime = moveTimeOverride ?? controller.updateClock()
    clearPremove()
    controller.addMoveWithTime(moveUci, moveTime)
  }

  useEffect(() => {
    let canceled = false
    let moveTimeout: ReturnType<typeof setTimeout> | undefined

    const makeMaiaMove = async () => {
      if (
        controller.game.id &&
        !controller.playerActive &&
        !controller.game.termination
      ) {
        const maiaClock =
          (controller.player == 'white'
            ? controller.blackClock
            : controller.whiteClock) / 1000
        const initialClock = controller.timeControl.includes('+')
          ? parseInt(controller.timeControl.split('+')[0]) * 60
          : 0

        const maiaMoves = await backOff(
          () =>
            fetchGameMove(
              controller.moveList,
              playGameConfig.maiaVersion,
              playGameConfig.startFen,
              null,
              simulateMaiaTime ? initialClock : 0,
              simulateMaiaTime ? maiaClock : 0,
            ),
          {
            jitter: 'full',
          },
        )
        const nextMove = maiaMoves['top_move']
        const moveDelay = maiaMoves['move_delay']

        if (canceled) {
          return
        }

        if (simulateMaiaTime) {
          const minimumDelayMs = 200 + Math.random() * 100
          const delayMs = Math.max(moveDelay * 1000, minimumDelayMs)

          moveTimeout = setTimeout(() => {
            if (canceled) {
              return
            }

            const chess = new Chess(controller.currentNode.fen)
            const moveTime = controller.updateClock()
            const destinationSquare = nextMove.slice(2, 4)
            const isCapture = !!chess.get(destinationSquare)
            const moveResult = chess.move(nextMove, { sloppy: true })

            controller.addMoveWithTime(nextMove, moveTime)
            playMoveSound(isCapture)

            const legalPremoveUci =
              moveResult && queuedPremoveRef.current
                ? getLegalPremoveUci(chess.fen(), queuedPremoveRef.current)
                : null

            if (queuedPremoveRef.current) {
              clearPremove()
            }

            if (legalPremoveUci) {
              const premoveDestination = legalPremoveUci.slice(2, 4)
              const isPremoveCapture = !!chess.get(premoveDestination)

              controller.updateClockForColor(controller.player, 0, true)
              controller.addMoveWithTime(legalPremoveUci, 0)
              setTimeout(
                () => playMoveSound(isPremoveCapture),
                PREMOVE_SOUND_DELAY_MS,
              )
            }
          }, delayMs)
        } else {
          const chess = new Chess(controller.currentNode.fen)
          const moveTime = controller.updateClock()
          const destinationSquare = nextMove.slice(2, 4)
          const isCapture = !!chess.get(destinationSquare)
          const moveResult = chess.move(nextMove, { sloppy: true })

          controller.addMoveWithTime(nextMove, moveTime)
          playMoveSound(isCapture)

          const legalPremoveUci =
            moveResult && queuedPremoveRef.current
              ? getLegalPremoveUci(chess.fen(), queuedPremoveRef.current)
              : null

          if (queuedPremoveRef.current) {
            clearPremove()
          }

          if (legalPremoveUci) {
            const premoveDestination = legalPremoveUci.slice(2, 4)
            const isPremoveCapture = !!chess.get(premoveDestination)

            controller.updateClockForColor(controller.player, 0, true)
            controller.addMoveWithTime(legalPremoveUci, 0)
            setTimeout(
              () => playMoveSound(isPremoveCapture),
              PREMOVE_SOUND_DELAY_MS,
            )
          }
        }
      }
    }

    makeMaiaMove()

    return () => {
      canceled = true

      if (moveTimeout) {
        clearTimeout(moveTimeout)
      }
    }
  }, [
    controller.game.id,
    controller.playerActive,
    controller.game.termination,
    controller.moveList.length,
    playGameConfig.maiaVersion,
    playGameConfig.startFen,
    simulateMaiaTime,
    clearPremove,
    getLegalPremoveUci,
  ])

  useEffect(() => {
    const gameOverState = controller.game.termination?.type || 'not_over'

    if (controller.moveList.length == 0 && gameOverState == 'not_over') {
      return
    }

    const winner = controller.game.termination?.winner

    const submitFn = async () => {
      const response = await backOff(
        () =>
          logGameMove(
            controller.game.id,
            controller.moveList,
            controller.moveTimes,
            gameOverState,
            'play',
            playGameConfig.startFen || undefined,
            winner,
          ),
        {
          jitter: 'full',
        },
      )

      if (controller.game.termination) {
        const winner = controller.game.termination?.winner
        safeUpdateRating(response.player_elo, updateRating)
        incrementStats(1, winner == playGameConfig.player ? 1 : 0)
      }
    }
    submitFn()
  }, [
    controller.game.id,
    controller.moveList,
    controller.game.termination,
    controller.moveTimes,
    playGameConfig.startFen,
    incrementStats,
    updateRating,
    playGameConfig.player,
  ])

  return {
    ...controller,
    makePlayerMove,
    premovesEnabled: true,
    queuedPremove,
    setPremove,
    clearPremove,
    premoveResetKey,
    stats,
  }
}
