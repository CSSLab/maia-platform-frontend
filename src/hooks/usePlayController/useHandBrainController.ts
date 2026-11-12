import { PieceSymbol, Chess } from 'chess.ts'
import type { Key } from 'chessground/types'
import { backOff } from 'exponential-backoff'
import type { DrawShape } from 'chessground/draw'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PlayGameConfig } from 'src/types'
import { useStats } from 'src/hooks/useStats'
import { usePlayController } from './usePlayController'
import { fetchMaiaMove, logGameMove, fetchPlayPlayerStats } from 'src/api'
import {
  dismissMaiaMoveFailedToast,
  reportMaiaMoveFailed,
} from 'src/components/Common/maiaMoveFailedToast'
import { useSound } from 'src/hooks/useSound'
import { safeUpdateRating } from 'src/lib/ratingUtils'
import { maiaMoveClocks } from 'src/lib/timeControl'
import { useGameLog } from './useGameLog'
import { useServerTurns } from './useServerTurns'
import { ServerGame } from 'src/lib/serverGames'
import { UnfinishedGame } from 'src/lib/unfinishedGame'

const brainStatsLoader = async () => {
  const stats = await fetchPlayPlayerStats()
  return {
    gamesPlayed: stats.brainGamesPlayed,
    gamesWon: stats.brainWon,
    rating: stats.brainElo,
    provisional: stats.brainProvisional,
  }
}

const handStatsLoader = async () => {
  const stats = await fetchPlayPlayerStats()
  return {
    gamesPlayed: stats.handGamesPlayed,
    gamesWon: stats.handWon,
    rating: stats.handElo,
    provisional: stats.handProvisional,
  }
}

export const useHandBrainController = (
  id: string,
  playGameConfig: PlayGameConfig,
  simulateMaiaTime: boolean,
  // A game the server holds (src/lib/serverGames.ts): `resume` has the moves
  // to show at once, `serverGame` its state. The server then names the
  // brain's piece (hand games) or makes the hand's move (brain games).
  resume?: UnfinishedGame,
  serverGame?: ServerGame,
  onServerResync?: (game: ServerGame) => void,
) => {
  const isBrain = playGameConfig.isBrain
  const serverHeld = !!serverGame
  const controller = usePlayController(id, playGameConfig, resume, serverHeld)
  const { playMoveSound } = useSound()

  const [selectedPiece, setSelectedPiece] = useState<PieceSymbol | undefined>(
    undefined,
  )

  const [brainMoves, setBrainMoves] = useState<string[]>([])
  // Asks Maia again (for a piece, or a move) after a request that failed.
  const [maiaAttempt, setMaiaAttempt] = useState(0)
  const retryMaia = useCallback(() => setMaiaAttempt((n) => n + 1), [])

  const [stats, incrementStats, updateRating] = useStats(
    isBrain ? brainStatsLoader : handStatsLoader,
  )

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
      if (rating) {
        safeUpdateRating(rating.player_elo, (elo) =>
          updateRating(elo, rating.player_provisional ?? undefined),
        )
      }
      incrementStats(1, game.winner == playGameConfig.player ? 1 : 0)
    },
    // Hand: the brain's piece for the next move comes with each answer.
    // Brain: the piece the player named has been played.
    onShown: (game) => {
      setBrainMoves(game.brain_moves ?? [])
      setSelectedPiece(
        !isBrain && game.state === 'not_over' && game.partner_piece
          ? (game.partner_piece as PieceSymbol)
          : undefined,
      )
    },
    // The piece can be chosen again.
    onSendFailed: () => {
      if (isBrain) setSelectedPiece(undefined)
    },
  })

  const movablePieceTypes = useMemo(() => {
    return new Set(controller.availableMoves.map((m) => m.piece))
  }, [controller.availableMoves])

  const availableMoves = useMemo(() => {
    if (isBrain) {
      return [] // Brain may not make moves directly
    } else if (selectedPiece) {
      return controller.availableMoves.filter((m) => m.piece == selectedPiece)
    } else {
      return []
    }
  }, [isBrain, selectedPiece, controller.availableMoves])

  useEffect(() => {
    if (
      !serverHeld &&
      controller.game.id &&
      !isBrain &&
      !selectedPiece &&
      controller.playerActive
    ) {
      // Maia is brain
      let canceled = false

      const maiaChoosePiece = async () => {
        let maiaMoves
        try {
          maiaMoves = await fetchMaiaMove(
            controller.moveList,
            playGameConfig.maiaPartnerVersion,
            playGameConfig.startFen,
          )
        } catch (error) {
          if (!canceled) reportMaiaMoveFailed(error, retryMaia)
          return
        }
        dismissMaiaMoveFailedToast()
        const nextMove: string = maiaMoves['top_move']

        const pieceType = controller.pieces[nextMove.substring(0, 2)]?.type
        if (!pieceType) return

        if (!canceled) {
          setSelectedPiece(pieceType)
          setBrainMoves([...brainMoves, pieceType])
        }
      }

      maiaChoosePiece()
      return () => {
        canceled = true
      }
    }
  }, [
    brainMoves,
    controller.game.id,
    controller.moveList,
    controller.pieces,
    controller.playerActive,
    isBrain,
    playGameConfig.maiaPartnerVersion,
    playGameConfig.startFen,
    selectedPiece,
    maiaAttempt,
    retryMaia,
    serverHeld,
  ])

  const makePlayerMove = useCallback(
    async (moveUci: string) => {
      // Not a move in the game (made on an earlier position): ignored.
      if (serverHeld && !server.canPlay(moveUci)) return

      const chess = new Chess(controller.currentNode.fen)
      const destinationSquare = moveUci.slice(2, 4)
      const isCapture = !!chess.get(destinationSquare)

      if (serverHeld) {
        const thinkMs = server.thinkMs()
        controller.updateClock()
        server.sendMove(moveUci, thinkMs)
      } else {
        const moveTime = controller.updateClock()
        controller.addMoveWithTime(moveUci, moveTime)
      }
      setSelectedPiece(undefined)

      playMoveSound(isCapture)
    },
    [
      controller,
      playMoveSound,
      serverHeld,
      server.thinkMs,
      server.sendMove,
      server.canPlay,
    ],
  )

  useEffect(() => {
    let canceled = false
    let moveTimeout: ReturnType<typeof setTimeout> | undefined

    const makeMaiaMove = async () => {
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
        if (!canceled) reportMaiaMoveFailed(error, retryMaia)
        return
      }
      const nextMove: string = maiaMoves['top_move']
      const moveDelay = maiaMoves['move_delay']

      if (canceled) {
        return
      }
      dismissMaiaMoveFailedToast()

      moveTimeout = setTimeout(
        () => {
          if (canceled) {
            return
          }

          const moveTime = controller.updateClock()

          const chess = new Chess(controller.currentNode.fen)
          const destinationSquare = nextMove.slice(2, 4)
          const isCapture = !!chess.get(destinationSquare)

          controller.addMoveWithTime(nextMove, moveTime)
          playMoveSound(isCapture)
        },
        simulateMaiaTime ? moveDelay * 1000 : 0,
      )
    }

    if (
      !serverHeld &&
      controller.game.id &&
      !controller.playerActive &&
      !controller.game.termination
    ) {
      makeMaiaMove()
      return () => {
        canceled = true

        if (moveTimeout) {
          clearTimeout(moveTimeout)
        }
      }
    }
  }, [
    controller.playerActive,
    controller.moveList,
    controller,
    playGameConfig.maiaVersion,
    playGameConfig.startFen,
    simulateMaiaTime,
    maiaAttempt,
    retryMaia,
    serverHeld,
  ])

  const selectPiece = useCallback(
    async (piece: PieceSymbol) => {
      if (movablePieceTypes.has(piece)) {
        setSelectedPiece(piece)

        if (serverHeld) {
          // The server has the partner Maia make the move with this piece,
          // and answers with it and the opponent's reply.
          server.sendPiece(piece, server.thinkMs())
          return
        }

        let maiaMoves
        try {
          maiaMoves = await fetchMaiaMove(
            controller.moveList,
            playGameConfig.maiaPartnerVersion,
            playGameConfig.startFen,
            piece,
          )
        } catch (error) {
          // The piece can be chosen again, or Try again asks for this one.
          setSelectedPiece(undefined)
          reportMaiaMoveFailed(error, () => selectPieceRef.current?.(piece))
          return
        }
        dismissMaiaMoveFailedToast()
        setBrainMoves([...brainMoves, piece])
        makePlayerMove(maiaMoves['top_move'])
      }
    },
    [
      controller.moveList,
      makePlayerMove,
      movablePieceTypes,
      playGameConfig.maiaPartnerVersion,
      playGameConfig.startFen,
      brainMoves,
      serverHeld,
      server.sendPiece,
      server.thinkMs,
    ],
  )

  // Try again calls the latest selectPiece, with the latest position.
  const selectPieceRef = useRef(selectPiece)
  selectPieceRef.current = selectPiece

  const boardShapes: DrawShape[] = useMemo(() => {
    if (!isBrain && selectedPiece) {
      return Object.entries(controller.pieces)
        .filter(([, piece]) => piece.color == controller.player.substring(0, 1))
        .filter(([, piece]) => selectedPiece == piece.type)
        .map(([square]) => {
          return {
            orig: square as Key,
            brush: 'green',
          }
        })
    } else {
      return []
    }
  }, [isBrain, selectedPiece, controller.pieces, controller.player])

  const reset = () => {
    setSelectedPiece(undefined)
    setBrainMoves([])
    controller.reset()
  }

  const gameOverState = controller.game.termination?.type || 'not_over'
  const resign = useCallback(() => {
    if (serverHeld) {
      server.resign()
      return
    }
    controller.setResigned(true)
  }, [serverHeld, server.resign, controller.setResigned])

  useGameLog({
    // Never sent for a game the server holds: it has every move already.
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
          playGameConfig.isBrain ? 'brain' : 'hand',
          playGameConfig.startFen || undefined,
          winner,
          brainMoves,
          { keepalive },
        )

      if (leaving) {
        log(true).catch(() => undefined)
        return
      }

      const submitFn = async () => {
        const response = await backOff(() => log(false), { jitter: 'full' })
        if (controller.game.termination) {
          // Safely update rating - only if the response contains a valid rating
          safeUpdateRating(response.player_elo, (rating) =>
            updateRating(rating, response.player_provisional),
          )
          incrementStats(1, winner == playGameConfig.player ? 1 : 0)
        }
      }
      submitFn()
    },
  })

  return {
    ...controller,
    availableMoves,
    makePlayerMove,
    boardShapes,
    selectedPiece,
    movablePieceTypes,
    selectPiece,
    reset,
    resign,
    stats,
  }
}
