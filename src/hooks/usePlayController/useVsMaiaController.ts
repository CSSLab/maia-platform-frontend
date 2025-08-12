import { useEffect } from 'react'
import { Chess } from 'chess.ts'
import { PlayGameConfig } from 'src/types'
import { backOff } from 'exponential-backoff'
import { useStats } from 'src/hooks/useStats'
import { usePlayController } from 'src/hooks/usePlayController'
import { fetchGameMove, logGameMove, fetchPlayPlayerStats } from 'src/api'
import { chessSoundManager } from 'src/lib/sound'
import { safeUpdateRating } from 'src/lib/ratingUtils'

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
        console.log('node before move', controller.currentNode.fen)
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
          setTimeout(() => {
            const moveTime = controller.updateClock()

            const chess = new Chess(controller.currentNode.fen)
            const destinationSquare = nextMove.slice(2, 4)
            const isCapture = !!chess.get(destinationSquare)

            controller.addMoveWithTime(nextMove, moveTime)
            chessSoundManager.playMoveSound(isCapture)
          }, moveDelay * 1000)
        } else {
          const moveTime = controller.updateClock()

          const chess = new Chess(controller.currentNode.fen)
          const destinationSquare = nextMove.slice(2, 4)
          const isCapture = !!chess.get(destinationSquare)

          controller.addMoveWithTime(nextMove, moveTime)
          chessSoundManager.playMoveSound(isCapture)
        }
      }
    }

    makeMaiaMove()

    return () => {
      canceled = true
    }
  }, [controller, playGameConfig, simulateMaiaTime])

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
