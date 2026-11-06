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
import { initialClockSeconds } from 'src/lib/timeControl'

const brainStatsLoader = async () => {
  const stats = await fetchPlayPlayerStats()
  return {
    gamesPlayed: stats.brainGamesPlayed,
    gamesWon: stats.brainWon,
    rating: stats.brainElo,
  }
}

const handStatsLoader = async () => {
  const stats = await fetchPlayPlayerStats()
  return {
    gamesPlayed: stats.handGamesPlayed,
    gamesWon: stats.handWon,
    rating: stats.handElo,
  }
}

export const useHandBrainController = (
  id: string,
  playGameConfig: PlayGameConfig,
  simulateMaiaTime: boolean,
) => {
  const isBrain = playGameConfig.isBrain
  const controller = usePlayController(id, playGameConfig)
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
  ])

  const makePlayerMove = useCallback(
    async (moveUci: string) => {
      const chess = new Chess(controller.currentNode.fen)
      const destinationSquare = moveUci.slice(2, 4)
      const isCapture = !!chess.get(destinationSquare)

      const moveTime = controller.updateClock()

      controller.addMoveWithTime(moveUci, moveTime)
      setSelectedPiece(undefined)

      playMoveSound(isCapture)
    },
    [controller, playMoveSound],
  )

  useEffect(() => {
    let canceled = false
    let moveTimeout: ReturnType<typeof setTimeout> | undefined

    const makeMaiaMove = async () => {
      const maiaClock =
        (controller.player == 'white'
          ? controller.blackClock
          : controller.whiteClock) / 1000
      const initialClock = initialClockSeconds(controller.timeControl)

      let maiaMoves
      try {
        maiaMoves = await fetchMaiaMove(
          controller.moveList,
          playGameConfig.maiaVersion,
          playGameConfig.startFen,
          null,
          simulateMaiaTime ? initialClock : 0,
          simulateMaiaTime ? maiaClock : 0,
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
  ])

  const selectPiece = useCallback(
    async (piece: PieceSymbol) => {
      if (movablePieceTypes.has(piece)) {
        setSelectedPiece(piece)

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
            playGameConfig.isBrain ? 'brain' : 'hand',
            playGameConfig.startFen || undefined,
            winner,
            brainMoves,
          ),
        {
          jitter: 'full',
        },
      )
      if (controller.game.termination) {
        const winner = controller.game.termination?.winner

        // Safely update rating - only if the response contains a valid rating
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
    playGameConfig.isBrain,
    brainMoves,
    playGameConfig.player,
    incrementStats,
    updateRating,
  ])

  return {
    ...controller,
    availableMoves,
    makePlayerMove,
    boardShapes,
    selectedPiece,
    movablePieceTypes,
    selectPiece,
    reset,
    stats,
  }
}
