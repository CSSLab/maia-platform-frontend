import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.ts'
import { PlayGameConfig, QueuedPremove } from 'src/types'
import { backOff } from 'exponential-backoff'
import { useStats } from 'src/hooks/useStats'
import { usePlayController } from 'src/hooks/usePlayController'
import { fetchMaiaMove, logGameMove, fetchPlayPlayerStats } from 'src/api'
import {
  ServerGameConflict,
  addTimeServerGame,
  takeBackServerGame,
} from 'src/api/serverGames'
import { ServerGame } from 'src/lib/serverGames'
import { useServerTurns } from './useServerTurns'
import {
  dismissMaiaMoveFailedToast,
  reportMaiaMoveFailed,
} from 'src/components/Common/maiaMoveFailedToast'
import { useSound } from 'src/hooks/useSound'
import { safeUpdateRating } from 'src/lib/ratingUtils'
import { maiaMoveClocks } from 'src/lib/timeControl'
import { useGameLog } from './useGameLog'
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
    provisional: stats.playProvisional,
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
  // The game as the server holds it, when it does (src/lib/serverGames.ts):
  // each of the player's moves is sent to it and answered with Maia's reply,
  // the clocks and the result. `resume` then holds the moves to show at once.
  serverGame?: ServerGame,
  // The server says the game isn't where this page thought: start again from
  // its state.
  onServerResync?: (game: ServerGame) => void,
) => {
  const serverHeld = !!serverGame
  const controller = usePlayController(id, playGameConfig, resume, serverHeld)
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

  // --- A game the server holds (useServerTurns) --------------------------

  const server = useServerTurns({
    controller,
    id,
    serverGame,
    player: playGameConfig.player,
    simulateMaiaTime,
    initialPlies: resume?.moves.length ?? 0,
    playMoveSound,
    onServerResync,
    onGameEnd: (game) => {
      const rating = game.rating
      if (rating && !playGameConfig.practice) {
        safeUpdateRating(rating.player_elo, (elo) =>
          updateRating(elo, rating.player_provisional ?? undefined),
        )
      }
      incrementStats(1, game.winner == playGameConfig.player ? 1 : 0)
    },
    // A queued premove is played as soon as Maia's move is on the board.
    onShown: (game, afterMaia) => {
      if (!afterMaia) return
      const legalPremoveUci =
        queuedPremoveRef.current && game.state === 'not_over'
          ? getLegalPremoveUci(afterMaia.fen(), queuedPremoveRef.current)
          : null
      if (queuedPremoveRef.current) {
        clearPremove()
      }
      if (legalPremoveUci) {
        const isPremoveCapture = !!afterMaia.get(legalPremoveUci.slice(2, 4))
        server.sendMove(legalPremoveUci, 0)
        setTimeout(
          () => playMoveSound(isPremoveCapture),
          PREMOVE_SOUND_DELAY_MS,
        )
      }
    },
  })

  const resign = useCallback(() => {
    if (!serverHeld) {
      controller.updateClock()
      controller.setResigned(true)
      return
    }
    server.resign()
  }, [
    serverHeld,
    server.resign,
    controller.updateClock,
    controller.setResigned,
  ])

  const makePlayerMove = async (moveUci: string, moveTimeOverride?: number) => {
    if (serverHeld) {
      // Not a move in the game (made on an earlier position): ignored.
      if (!server.canPlay(moveUci)) return
      const thinkMs = moveTimeOverride ?? server.thinkMs()
      // Charged here too, so that Maia's clock is the one running while its
      // reply is on the way; the server's answer sets both clocks right.
      controller.updateClock()
      clearPremove()
      server.sendMove(moveUci, thinkMs)
      return
    }
    const moveTime = moveTimeOverride ?? controller.updateClock()
    clearPremove()
    controller.addMoveWithTime(moveUci, moveTime)
  }

  useEffect(() => {
    // The server makes Maia's moves in a game it holds (above).
    if (serverHeld) return

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
        const clocks = maiaMoveClocks(controller.timeControl, maiaClock)

        let maiaMoves
        try {
          maiaMoves = await fetchMaiaMove(
            controller.moveList,
            playGameConfig.maiaVersion,
            playGameConfig.startFen,
            null,
            clocks.initialClock,
            clocks.currentClock,
            clocks.increment,
          )
        } catch (error) {
          if (canceled) return
          reportMaiaMoveFailed(error, () => setMaiaMoveAttempt((n) => n + 1))
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
    serverHeld,
  ])

  const gameOverState = controller.game.termination?.type || 'not_over'
  useGameLog({
    // Until start_game has answered (a resignation in that moment), nothing
    // is sent; it is once the game has its id. Never, for a game the server
    // holds: it has every move already.
    gameId: serverHeld ? '' : controller.game.id,
    plies: controller.moveList.length,
    state: gameOverState,
    send: (leaving) => {
      const winner = controller.game.termination?.winner
      const log = (keepalive: boolean) =>
        logGameMove(
          controller.game.id,
          controller.moveList,
          controller.moveTimes,
          gameOverState,
          'play',
          playGameConfig.startFen ||
            (playGameConfig.practice ? STANDARD_START_FEN : undefined),
          winner,
          [],
          { keepalive },
        )

      if (leaving) {
        log(true).catch(() => undefined)
        return
      }

      const submitFn = async () => {
        const response = await backOff(() => log(false), { jitter: 'full' })

        if (controller.game.termination) {
          if (!playGameConfig.practice) {
            safeUpdateRating(response.player_elo, (rating) =>
              updateRating(rating, response.player_provisional),
            )
          }
          incrementStats(1, winner == playGameConfig.player ? 1 : 0)
        }
      }
      submitFn()
    },
  })

  // Unlimited and practice games are kept in this browser after each move,
  // so they can be continued if the tab is closed; forgotten once over.
  useEffect(() => {
    // A game the server holds is continued from the server, not from here.
    if (serverHeld) return
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
    serverHeld,
  ])

  // In a game the server holds, a takeback and extra time (practice games)
  // are asked of the server; the board is then drawn again from its state.
  const practiceRequest = useCallback(
    (request: (gameId: string) => Promise<ServerGame>, redraw: boolean) => {
      request(id)
        .then((game) => (redraw ? onServerResync?.(game) : server.show(game)))
        .catch((error) => {
          if (error instanceof ServerGameConflict) {
            onServerResync?.(error.game)
            return
          }
          reportMaiaMoveFailed(error, () => practiceRequest(request, redraw))
        })
    },
    [id, onServerResync, server.show],
  )

  const takeBack = useCallback(() => {
    clearPremove()
    if (serverHeld) {
      practiceRequest(takeBackServerGame, true)
      return
    }
    controller.takeBack()
  }, [clearPremove, controller.takeBack, serverHeld, practiceRequest])

  const addTime = useCallback(
    (ms: number) => {
      if (serverHeld) {
        practiceRequest(addTimeServerGame, false)
        return
      }
      controller.addTime(ms)
    },
    [controller.addTime, serverHeld, practiceRequest],
  )

  return {
    ...controller,
    takeBack,
    addTime,
    makePlayerMove,
    resign,
    premovesEnabled: true,
    queuedPremove,
    setPremove,
    clearPremove,
    premoveResetKey,
    stats,
  }
}
