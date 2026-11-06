import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.ts'
import { PlayGameConfig, QueuedPremove } from 'src/types'
import { backOff } from 'exponential-backoff'
import { useStats } from 'src/hooks/useStats'
import { usePlayController } from 'src/hooks/usePlayController'
import {
  fetchGameMove,
  logGameMove,
  fetchPlayPlayerStats,
  retryUnlessRejected,
  MoveRequestError,
} from 'src/api'
import { trackMaiaMoveFailed } from 'src/lib/analytics'
import {
  dismissMaiaMoveFailedToast,
  showMaiaMoveFailedToast,
} from 'src/components/Common/maiaMoveFailedToast'
import { useSound } from 'src/hooks/useSound'
import { safeUpdateRating } from 'src/lib/ratingUtils'
import { initialClockSeconds } from 'src/lib/timeControl'
import {
  UnfinishedGame,
  canResume,
  clearUnfinishedGame,
  saveUnfinishedGame,
} from 'src/lib/unfinishedGame'

const playStatsLoader = async () => {
  const stats = await fetchPlayPlayerStats()
  return {
    gamesPlayed: stats.playGamesPlayed,
    gamesWon: stats.playWon,
    rating: stats.playElo,
  }
}

const PREMOVE_SOUND_DELAY_MS = 120

// The backend updates ratings only for games sent without a starting
// position, so a practice game from the usual start sends it explicitly to
// stay unrated. (Its win, draw or loss still counts in the player's stats.)
const STANDARD_START_FEN = new Chess().fen()

export const useVsMaiaPlayController = (
  id: string,
  playGameConfig: PlayGameConfig,
  simulateMaiaTime: boolean,
  resume?: UnfinishedGame,
) => {
  const controller = usePlayController(id, playGameConfig, resume)
  const [stats, incrementStats, updateRating] = useStats(playStatsLoader)
  const { playMoveSound } = useSound()
  const [queuedPremove, setQueuedPremove] = useState<QueuedPremove | null>(null)
  const queuedPremoveRef = useRef<QueuedPremove | null>(null)
  const [premoveResetKey, setPremoveResetKey] = useState(0)
  // Asks for Maia's move again after a request that failed.
  const [maiaMoveAttempt, setMaiaMoveAttempt] = useState(0)

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
        const initialClock = initialClockSeconds(controller.timeControl)

        let maiaMoves
        try {
          maiaMoves = await backOff(
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
              numOfAttempts: 6,
              retry: retryUnlessRejected,
            },
          )
        } catch (error) {
          if (canceled) return
          // Reported, but the game waits for the player instead of breaking.
          console.error(error)
          trackMaiaMoveFailed(
            error instanceof Error ? error.message : String(error),
            error instanceof MoveRequestError ? error.status : undefined,
          )
          showMaiaMoveFailedToast(() => setMaiaMoveAttempt((n) => n + 1))
          return
        }
        dismissMaiaMoveFailedToast()
        const nextMove: string = maiaMoves['top_move']
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
    maiaMoveAttempt,
  ])

  useEffect(() => {
    const gameOverState = controller.game.termination?.type || 'not_over'

    if (controller.moveList.length == 0 && gameOverState == 'not_over') {
      return
    }
    // Until start_game has answered (a resignation in that moment); this
    // runs again once the game has its id.
    if (!controller.game.id) return

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
            playGameConfig.startFen ||
              (playGameConfig.practice ? STANDARD_START_FEN : undefined),
            winner,
          ),
        {
          jitter: 'full',
        },
      )

      if (controller.game.termination) {
        const winner = controller.game.termination?.winner
        if (!playGameConfig.practice) {
          safeUpdateRating(response.player_elo, updateRating)
        }
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
    playGameConfig.practice,
    incrementStats,
    updateRating,
    playGameConfig.player,
  ])

  // Unlimited and practice games are kept in this browser after each move,
  // so they can be continued if the tab is closed; forgotten once over.
  useEffect(() => {
    if (!controller.game.id || !canResume(playGameConfig)) return
    if (controller.game.termination) {
      clearUnfinishedGame(controller.game.id)
      return
    }
    if (controller.moveList.length === 0) return
    saveUnfinishedGame({
      id: controller.game.id,
      config: playGameConfig,
      moves: controller.moveList,
      moveTimes: controller.moveTimes,
      whiteClock: controller.whiteClock,
      blackClock: controller.blackClock,
      savedAt: Date.now(),
    })
  }, [
    controller.game.id,
    controller.game.termination,
    controller.moveList,
    controller.moveTimes,
    controller.whiteClock,
    controller.blackClock,
    playGameConfig,
  ])

  const takeBack = useCallback(() => {
    clearPremove()
    controller.takeBack()
  }, [clearPremove, controller.takeBack])

  return {
    ...controller,
    takeBack,
    makePlayerMove,
    premovesEnabled: true,
    queuedPremove,
    setPremove,
    clearPremove,
    premoveResetKey,
    stats,
  }
}
