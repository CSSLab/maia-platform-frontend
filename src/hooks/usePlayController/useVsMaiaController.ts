import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.ts'
import { PlayGameConfig, QueuedPremove } from 'src/types'
import { backOff } from 'exponential-backoff'
import { useStats } from 'src/hooks/useStats'
import { usePlayController } from 'src/hooks/usePlayController'
import { fetchMaiaMove, logGameMove, fetchPlayPlayerStats } from 'src/api'
import {
  ServerGameConflict,
  flagServerGame,
  resignServerGame,
  sendServerMove,
} from 'src/api/serverGames'
import {
  ServerGame,
  serverClocks,
  serverTermination,
} from 'src/lib/serverGames'
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

  // --- A game the server holds -------------------------------------------

  // How many half-moves the board has (the next move's ply).
  const plyRef = useRef(resume?.moves.length ?? 0)
  // When it became the player's turn on this screen: their thinking time is
  // counted from here and sent with the move, so that the server can give
  // back what the network added.
  const turnShownAt = useRef(Date.now())
  const simulateRef = useRef(simulateMaiaTime)
  simulateRef.current = simulateMaiaTime
  const endCounted = useRef(false)
  // The player's move on its way to the server.
  const [outgoing, setOutgoing] = useState<{
    ply: number
    uci: string
    thinkMs: number
    attempt: number
  } | null>(null)
  // The server's latest answer, to be shown: Maia's move after its delay,
  // then the clocks and the result.
  const [answer, setAnswer] = useState<{ game: ServerGame } | null>(
    serverGame ? { game: serverGame } : null,
  )

  const sendToServer = useCallback(
    (moveUci: string, thinkMs: number) => {
      const ply = plyRef.current
      plyRef.current += 1
      controller.addMoveWithTime(moveUci, thinkMs)
      setOutgoing({ ply, uci: moveUci, thinkMs, attempt: 0 })
    },
    [controller.addMoveWithTime],
  )

  useEffect(() => {
    if (!serverHeld || !outgoing) return
    let canceled = false
    sendServerMove(
      id,
      outgoing.ply,
      outgoing.uci,
      outgoing.thinkMs,
      !simulateRef.current,
    )
      .then((game) => {
        if (canceled) return
        dismissMaiaMoveFailedToast()
        setAnswer({ game })
      })
      .catch((error) => {
        if (canceled) return
        if (error instanceof ServerGameConflict) {
          onServerResync?.(error.game)
          return
        }
        // Sending the same move again is safe: the server answers with the
        // reply it already made, if it made one.
        reportMaiaMoveFailed(error, () =>
          setOutgoing((move) => move && { ...move, attempt: move.attempt + 1 }),
        )
      })
    return () => {
      canceled = true
    }
  }, [serverHeld, id, outgoing])

  useEffect(() => {
    if (!serverHeld || !answer) return
    const { game } = answer
    let canceled = false
    let moveTimeout: ReturnType<typeof setTimeout> | undefined

    const settle = () => {
      const clocks = serverClocks(game)
      if (clocks) {
        controller.syncClocks(clocks.white, clocks.black, clocks.running)
      }
      turnShownAt.current = Date.now()
      const termination = serverTermination(game)
      if (termination) {
        controller.setServerTermination(termination)
        if (!endCounted.current && game.rating) {
          endCounted.current = true
          const rating = game.rating
          safeUpdateRating(rating.player_elo, (elo) =>
            updateRating(elo, rating.player_provisional ?? undefined),
          )
          incrementStats(1, game.winner == playGameConfig.player ? 1 : 0)
        }
      }
    }

    const bot = game.bot_move
    if (!bot || bot.ply !== plyRef.current) {
      settle()
      return
    }

    const showMaiaMove = () => {
      if (canceled) return
      const chess = new Chess(controller.gameTree.getLastMainlineNode().fen)
      const isCapture = !!chess.get(bot.uci.slice(2, 4))
      const moveResult = chess.move(bot.uci, { sloppy: true })

      plyRef.current += 1
      controller.addMoveWithTime(bot.uci, Math.round(bot.delay * 1000))
      playMoveSound(isCapture)
      settle()

      const legalPremoveUci =
        moveResult && queuedPremoveRef.current && game.state === 'not_over'
          ? getLegalPremoveUci(chess.fen(), queuedPremoveRef.current)
          : null
      if (queuedPremoveRef.current) {
        clearPremove()
      }
      if (legalPremoveUci) {
        const isPremoveCapture = !!chess.get(legalPremoveUci.slice(2, 4))
        sendToServer(legalPremoveUci, 0)
        setTimeout(
          () => playMoveSound(isPremoveCapture),
          PREMOVE_SOUND_DELAY_MS,
        )
      }
    }

    const delayMs = bot.delay * 1000
    if (delayMs > 0) {
      moveTimeout = setTimeout(showMaiaMove, delayMs)
    } else {
      showMaiaMove()
    }
    return () => {
      canceled = true
      if (moveTimeout) clearTimeout(moveTimeout)
    }
  }, [serverHeld, answer])

  // A clock reached zero here: the server's clock decides. If it agrees the
  // game ends on time; if not (lag given back, say) the clocks are set right.
  useEffect(() => {
    const expired = controller.clockExpired
    if (!serverHeld || !expired || expired.color !== playGameConfig.player) {
      return
    }
    let canceled = false
    flagServerGame(id)
      .then((game) => {
        if (!canceled) setAnswer({ game })
      })
      .catch(() => undefined)
    return () => {
      canceled = true
    }
  }, [serverHeld, id, controller.clockExpired, playGameConfig.player])

  const resign = useCallback(() => {
    if (!serverHeld) {
      controller.updateClock()
      controller.setResigned(true)
      return
    }
    resignServerGame(id)
      .then((game) => setAnswer({ game }))
      .catch((error) => {
        if (error instanceof ServerGameConflict) {
          onServerResync?.(error.game)
          return
        }
        reportMaiaMoveFailed(error, () => resign())
      })
  }, [serverHeld, id, controller.updateClock, controller.setResigned])

  const makePlayerMove = async (moveUci: string, moveTimeOverride?: number) => {
    if (serverHeld) {
      const thinkMs =
        moveTimeOverride ?? Math.max(0, Date.now() - turnShownAt.current)
      // Charged here too, so that Maia's clock is the one running while its
      // reply is on the way; the server's answer sets both clocks right.
      controller.updateClock()
      clearPremove()
      sendToServer(moveUci, thinkMs)
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

  const takeBack = useCallback(() => {
    clearPremove()
    controller.takeBack()
  }, [clearPremove, controller.takeBack])

  return {
    ...controller,
    takeBack,
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
