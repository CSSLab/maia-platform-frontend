import { useRouter } from 'next/router'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { Chess } from 'chess.ts'

import { useStats } from '../useStats'
import { Color, GameTree } from 'src/types'
import { TuringGame } from 'src/types/turing'
import { useTreeController } from '../useTreeController'
import {
  fetchTuringGame,
  fetchTuringPlayerStats,
  submitTuringGuess,
} from 'src/api'

const statsLoader = async () => {
  const stats = await fetchTuringPlayerStats()
  return {
    gamesPlayed: stats.correctGuesses + stats.wrongGuesses,
    gamesWon: stats.correctGuesses,
    rating: stats.rating,
  }
}

export const useTuringController = () => {
  const router = useRouter()
  const [turingGames, setTuringGames] = useState<TuringGame[]>([])

  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [stats, incrementStats, updateRating] = useStats(statsLoader)

  const getNewGame = useCallback(async () => {
    setLoading(true)
    let game
    try {
      game = await fetchTuringGame()
    } catch (e) {
      router.push('/401')
      return
    }

    setLoading(false)
    setCurrentIndex(turingGames.length)
    setTuringGames(turingGames.concat([game]))
  }, [turingGames, router])

  useEffect(() => {
    if (turingGames.length === 0 && !loading) getNewGame()
  }, [getNewGame, turingGames.length, loading])

  const game = useMemo(
    () => turingGames[currentIndex],
    [turingGames, currentIndex],
  )

  const fallbackTree = useMemo(() => new GameTree(new Chess().fen()), [])
  const controller = useTreeController(game?.tree ?? fallbackTree, 'white')

  useEffect(() => {
    if (controller.tree && game) {
      const mainLine = controller.tree.getMainLine()
      controller.setCurrentNode(mainLine[0])
    }
  }, [game])

  const gameIds = useMemo(() => turingGames.map((g) => g.id), [turingGames])

  const submitGuess = useCallback(
    async (guess: Color, comment = '', rating?: number) => {
      if (game && !game.result) {
        const result = await submitTuringGuess(game.id, guess, comment)
        setTuringGames(
          turingGames.map((g, index) =>
            index === currentIndex
              ? {
                  ...g,
                  result: {
                    ...result,
                    ratingDiff: result.turingElo - (rating || 0),
                  },
                }
              : g,
          ),
        )
        commentController[1]('')

        updateRating(result.turingElo)
        incrementStats(1, result.correct ? 1 : 0)
      }
    },
    [game, incrementStats, turingGames, updateRating, currentIndex],
  )

  const commentController = useState('')

  return {
    gameTree: controller.tree,
    currentNode: controller.currentNode,
    setCurrentNode: controller.setCurrentNode,
    goToNode: controller.goToNode,
    goToNextNode: controller.goToNextNode,
    goToPreviousNode: controller.goToPreviousNode,
    goToRootNode: controller.goToRootNode,
    plyCount: controller.plyCount,
    orientation: controller.orientation,
    setOrientation: controller.setOrientation,

    game: game as TuringGame | undefined,
    games: turingGames,
    getNewGame,
    loading,
    gameIds,
    currentIndex,
    setCurrentIndex,
    submitGuess,
    commentController,
    stats,
  }
}
