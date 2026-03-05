import { useCallback, useContext, useEffect } from 'react'
import { Chess } from 'chess.ts'
import { PlayGameConfig } from 'src/types'
import { backOff } from 'exponential-backoff'
import { useStats } from 'src/hooks/useStats'
import { usePlayController } from 'src/hooks/usePlayController'
import { fetchGameMove, logGameMove, fetchPlayPlayerStats } from 'src/api'
import { useSound } from 'src/hooks/useSound'
import { safeUpdateRating } from 'src/lib/ratingUtils'
import { MaiaEngineContext } from 'src/contexts'

const MAIA_VALUE_HEAD_DEBUG_KEY = 'maia.valueHeadDebug'

const isTruthy = (value: string | null | undefined): boolean => {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const isMaiaValueHeadDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return isTruthy(window.localStorage.getItem(MAIA_VALUE_HEAD_DEBUG_KEY))
  } catch {
    return false
  }
}

const playStatsLoader = async () => {
  const stats = await fetchPlayPlayerStats()
  return {
    gamesPlayed: stats.playGamesPlayed,
    gamesWon: stats.playWon,
    rating: stats.playElo,
  }
}

export const useVsMaiaPlayController = (
  id: string,
  playGameConfig: PlayGameConfig,
  simulateMaiaTime: boolean,
) => {
  const controller = usePlayController(id, playGameConfig)
  const [stats, incrementStats, updateRating] = useStats(playStatsLoader)
  const { playMoveSound } = useSound()
  const maiaEngine = useContext(MaiaEngineContext)
  const valueHeadModel =
    playGameConfig.maiaMoveSelectionMode === 'value_head'
      ? maiaEngine.maia
      : null
  const valueHeadStatus =
    playGameConfig.maiaMoveSelectionMode === 'value_head'
      ? maiaEngine.status
      : null
  const playerRatingForValueHead =
    playGameConfig.valueHeadPlayerRating ?? stats.rating ?? 1500
  const valueHeadDebugEnabled = isMaiaValueHeadDebugEnabled()

  const selectValueHeadMove = useCallback(async () => {
    if (
      !controller.currentNode ||
      valueHeadStatus !== 'ready' ||
      !valueHeadModel
    ) {
      if (valueHeadDebugEnabled) {
        console.log('[Maia value-head debug] selector unavailable', {
          hasCurrentNode: !!controller.currentNode,
          valueHeadStatus,
          hasModel: !!valueHeadModel,
        })
      }
      return null
    }

    const currentFen = controller.currentNode.fen
    const chess = new Chess(currentFen)
    const legalMoves = chess.moves({ verbose: true }) as Array<{
      from: string
      to: string
      promotion?: string
    }>

    if (legalMoves.length === 0) {
      return null
    }

    const candidateMoves = legalMoves.map(
      (move) => `${move.from}${move.to}${move.promotion ?? ''}`,
    )
    const candidateBoards = candidateMoves.map((moveUci) => {
      const board = new Chess(currentFen)
      board.move(moveUci, { sloppy: true })
      return board.fen()
    })

    const maiaRating = parseInt(
      playGameConfig.maiaVersion.replace('maia_kdd_', ''),
      10,
    )
    const modelElo = Number.isNaN(maiaRating) ? 1500 : maiaRating

    // After Maia makes a candidate move, it is the human's turn.
    // Maia's value head conditions on the side to move as elo_self,
    // so the resulting boards must use the human as elo_self and Maia as elo_oppo.
    const { result } = await valueHeadModel.batchEvaluate(
      candidateBoards,
      Array(candidateBoards.length).fill(playerRatingForValueHead),
      Array(candidateBoards.length).fill(modelElo),
    )

    const maiaIsWhite = controller.player === 'black'
    let bestMove = candidateMoves[0]
    let bestScore = maiaIsWhite ? result[0].value : 1 - result[0].value

    for (let index = 1; index < candidateMoves.length; index++) {
      const whiteWinProb = result[index].value
      const maiaWinProb = maiaIsWhite ? whiteWinProb : 1 - whiteWinProb

      if (maiaWinProb > bestScore) {
        bestMove = candidateMoves[index]
        bestScore = maiaWinProb
      }
    }

    if (valueHeadDebugEnabled) {
      const candidateSummaries = candidateMoves
        .map((moveUci, index) => {
          const moveResult = result[index]
          const whiteWinProb = moveResult.value
          const maiaWinProb = maiaIsWhite ? whiteWinProb : 1 - whiteWinProb
          const board = new Chess(currentFen)
          const moveObj = board.move(moveUci, { sloppy: true })

          return {
            move: moveUci,
            san: moveObj?.san ?? moveUci,
            maiaWinProb: Number(maiaWinProb.toFixed(4)),
          }
        })
        .sort((a, b) => b.maiaWinProb - a.maiaWinProb)

      console.groupCollapsed(
        `[Maia value-head debug] ${playGameConfig.maiaVersion} selected ${bestMove}`,
      )
      console.table(candidateSummaries)
      console.groupEnd()
    }

    const estimatedDelaySeconds = Math.min(
      3,
      0.35 + legalMoves.length * 0.04 + Math.random() * 0.25,
    )

    return {
      top_move: bestMove,
      move_delay: estimatedDelaySeconds,
    }
  }, [
    controller.currentNode,
    controller.player,
    playGameConfig.maiaVersion,
    playGameConfig.valueHeadPlayerRating,
    playerRatingForValueHead,
    valueHeadModel,
    valueHeadStatus,
    valueHeadDebugEnabled,
  ])

  const makePlayerMove = async (moveUci: string) => {
    const moveTime = controller.updateClock()
    controller.addMoveWithTime(moveUci, moveTime)
  }

  useEffect(() => {
    let canceled = false

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

        const maiaMoves =
          playGameConfig.maiaMoveSelectionMode === 'value_head'
            ? await selectValueHeadMove()
            : await backOff(
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

        if (!maiaMoves?.top_move) {
          return
        }

        const nextMove = maiaMoves['top_move']
        const moveDelay = maiaMoves['move_delay']

        if (canceled) {
          return
        }

        if (simulateMaiaTime) {
          const minimumDelayMs = 200 + Math.random() * 100
          const delayMs = Math.max(moveDelay * 1000, minimumDelayMs)

          setTimeout(() => {
            const moveTime = controller.updateClock()

            const chess = new Chess(controller.currentNode.fen)
            const destinationSquare = nextMove.slice(2, 4)
            const isCapture = !!chess.get(destinationSquare)

            controller.addMoveWithTime(nextMove, moveTime)
            playMoveSound(isCapture)
          }, delayMs)
        } else {
          const moveTime = controller.updateClock()

          const chess = new Chess(controller.currentNode.fen)
          const destinationSquare = nextMove.slice(2, 4)
          const isCapture = !!chess.get(destinationSquare)

          controller.addMoveWithTime(nextMove, moveTime)
          playMoveSound(isCapture)
        }
      }
    }

    makeMaiaMove()

    return () => {
      canceled = true
    }
  }, [
    controller.game.id,
    controller.playerActive,
    controller.game.termination,
    controller.moveList.length,
    playGameConfig.maiaVersion,
    playGameConfig.maiaMoveSelectionMode,
    playGameConfig.startFen,
    simulateMaiaTime,
    selectValueHeadMove,
    valueHeadStatus,
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
    stats,
  }
}
