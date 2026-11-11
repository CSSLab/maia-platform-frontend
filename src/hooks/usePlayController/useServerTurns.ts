import { Chess } from 'chess.ts'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Color } from 'src/types'
import {
  ServerGameConflict,
  flagServerGame,
  resignServerGame,
  sendServerMove,
  sendServerPiece,
} from 'src/api/serverGames'
import {
  dismissMaiaMoveFailedToast,
  reportMaiaMoveFailed,
} from 'src/components/Common/maiaMoveFailedToast'
import {
  ServerGame,
  serverClocks,
  serverTermination,
} from 'src/lib/serverGames'
import { usePlayController } from './usePlayController'

interface Options {
  controller: ReturnType<typeof usePlayController>
  id: string
  // The game as the server holds it; without it this hook does nothing.
  serverGame?: ServerGame
  player: Color
  simulateMaiaTime: boolean
  // How many half-moves the board starts with.
  initialPlies: number
  playMoveSound: (isCapture: boolean) => void
  // The server says the game isn't where this page thought.
  onServerResync?: (game: ServerGame) => void
  // The game ended in this answer (called once): its ratings are in it.
  onGameEnd: (game: ServerGame) => void
  // An answer is on the board. `afterMaia`: the position after Maia's move,
  // if one was just shown.
  onShown?: (game: ServerGame, afterMaia: Chess | null) => void
  // A move or piece couldn't be sent (after the retries).
  onSendFailed?: () => void
}

/**
 * The turns of a game the server holds (src/lib/serverGames.ts): each of the
 * player's moves is sent to the server, whose answer has Maia's reply (shown
 * after its delay), the clocks and the result.
 */
export const useServerTurns = (options: Options) => {
  const { controller, id, serverGame } = options
  const serverHeld = !!serverGame
  // The callbacks as of the latest render, for effects that outlive one.
  const latest = useRef(options)
  latest.current = options

  // How many half-moves the board has (the next move's ply).
  const plyRef = useRef(options.initialPlies)
  // When it became the player's turn on this screen: their thinking time is
  // counted from here and sent with the move, so that the server can give
  // back what the network added.
  const turnShownAt = useRef(Date.now())
  const endCounted = useRef(false)
  // The player's move (or, in a brain game, piece) on its way to the server.
  const [outgoing, setOutgoing] = useState<{
    ply: number
    uci?: string
    piece?: string
    thinkMs: number
    attempt: number
  } | null>(null)
  // The server's latest answer, to be shown: Maia's move after its delay,
  // then the clocks and the result.
  const [answer, setAnswer] = useState<{ game: ServerGame } | null>(
    serverGame ? { game: serverGame } : null,
  )

  /** How long the player has been thinking on this screen (ms). */
  const thinkMs = useCallback(
    () => Math.max(0, Date.now() - turnShownAt.current),
    [],
  )

  /** Shows the player's move at once and sends it. */
  const sendMove = useCallback(
    (moveUci: string, think: number) => {
      const ply = plyRef.current
      plyRef.current += 1
      controller.addMoveWithTime(moveUci, think)
      setOutgoing({ ply, uci: moveUci, thinkMs: think, attempt: 0 })
    },
    [controller.addMoveWithTime],
  )

  /** Brain games: sends the piece the player named; the move comes back. */
  const sendPiece = useCallback((piece: string, think: number) => {
    setOutgoing({ ply: plyRef.current, piece, thinkMs: think, attempt: 0 })
  }, [])

  /** Shows a state the server sent (extra time, a flag that wasn't one). */
  const show = useCallback((game: ServerGame) => setAnswer({ game }), [])

  useEffect(() => {
    if (!serverHeld || !outgoing) return
    let canceled = false
    const instant = !latest.current.simulateMaiaTime
    const sent =
      outgoing.piece !== undefined
        ? sendServerPiece(
            id,
            outgoing.ply,
            outgoing.piece,
            outgoing.thinkMs,
            instant,
          )
        : sendServerMove(
            id,
            outgoing.ply,
            outgoing.uci as string,
            outgoing.thinkMs,
            instant,
          )
    sent
      .then((game) => {
        if (canceled) return
        dismissMaiaMoveFailedToast()
        setAnswer({ game })
      })
      .catch((error) => {
        if (canceled) return
        if (error instanceof ServerGameConflict) {
          latest.current.onServerResync?.(error.game)
          return
        }
        latest.current.onSendFailed?.()
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

    const settle = (afterMaia: Chess | null) => {
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
          latest.current.onGameEnd(game)
        }
      }
      latest.current.onShown?.(game, afterMaia)
    }

    const tipFen = () => controller.gameTree.getLastMainlineNode().fen

    // Brain games: the move the partner Maia made with the player's piece.
    const mine = game.player_move
    if (mine && mine.ply === plyRef.current) {
      const isCapture = !!new Chess(tipFen()).get(mine.uci.slice(2, 4))
      plyRef.current += 1
      controller.addMoveWithTime(mine.uci, game.move_times[mine.ply] ?? 0)
      latest.current.playMoveSound(isCapture)
    }

    const bot = game.bot_move
    if (!bot || bot.ply !== plyRef.current) {
      settle(null)
      return
    }

    const showMaiaMove = () => {
      if (canceled) return
      const chess = new Chess(tipFen())
      const isCapture = !!chess.get(bot.uci.slice(2, 4))
      const moveResult = chess.move(bot.uci, { sloppy: true })

      plyRef.current += 1
      controller.addMoveWithTime(bot.uci, Math.round(bot.delay * 1000))
      latest.current.playMoveSound(isCapture)
      settle(moveResult ? chess : null)
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
    if (!serverHeld || !expired || expired.color !== options.player) {
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
  }, [serverHeld, id, controller.clockExpired, options.player])

  const resign = useCallback(() => {
    resignServerGame(id)
      .then((game) => setAnswer({ game }))
      .catch((error) => {
        if (error instanceof ServerGameConflict) {
          latest.current.onServerResync?.(error.game)
          return
        }
        reportMaiaMoveFailed(error, () => resign())
      })
  }, [id])

  return { serverHeld, thinkMs, sendMove, sendPiece, show, resign }
}
