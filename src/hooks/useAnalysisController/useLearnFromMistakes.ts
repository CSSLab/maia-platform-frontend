import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Chess } from 'chess.ts'

import { GameTree } from 'src/types'
import {
  LearnFromMistakesConfiguration,
  DeepAnalysisProgress,
} from 'src/types/analysis'
import { isBestMove } from 'src/lib/analysis'
import {
  getStablePlayerMistakes,
  loadStoredMistakes,
} from 'src/lib/learnMistakes'
import { LEARN_FROM_MISTAKES_DEPTH } from 'src/constants/analysis'

interface UseLearnFromMistakesProps {
  gameTree: GameTree
  deepAnalysisProgress: DeepAnalysisProgress
  startDeepAnalysis: (targetDepth: number) => Promise<void>
  currentMaiaModel: string
  setCurrentNode: (node: any) => void
  goToNode: (node: any) => void
  currentNode: any
}

export const useLearnFromMistakes = ({
  gameTree,
  deepAnalysisProgress,
  startDeepAnalysis,
  currentMaiaModel,
  setCurrentNode,
  goToNode,
  currentNode,
}: UseLearnFromMistakesProps) => {
  const [learnModeState, setLearnModeState] =
    useState<LearnFromMistakesConfiguration>({
      isActive: false,
      showPlayerSelection: false,
      selectedPlayerColor: null,
      currentMistakeIndex: 0,
      mistakes: [],
      hasCompletedAnalysis: false,
      showSolution: false,
      currentAttempt: 1,
      maxAttempts: Infinity,
      originalPosition: null,
    })

  const requestLearnModePlayerColor = useCallback(async () => {
    setLearnModeState((prev) => ({
      ...prev,
      showPlayerSelection: true,
      isActive: true,
    }))
  }, [])

  const checkAnalysisProgressForLearnMode = useCallback(
    async (playerColor: 'white' | 'black') => {
      // A game reviewed before has its list of mistakes already, so it doesn't
      // wait for the analysis of the whole game again.
      if (loadStoredMistakes(gameTree, playerColor)) {
        beginLearnMode(playerColor)
        return
      }

      const mainLine = gameTree.getMainLine()
      const hasEnoughAnalysis = mainLine.every((node) => {
        if (!node.move) return true

        const chess = new Chess(node.fen)
        if (chess.gameOver()) return true

        return (
          (node.analysis.stockfish?.depth ?? 0) >= LEARN_FROM_MISTAKES_DEPTH &&
          !node.analysis.stockfish?.partial
        )
      })

      if (hasEnoughAnalysis) {
        beginLearnMode(playerColor)
        return Promise.resolve()
      } else {
        await startDeepAnalysis(LEARN_FROM_MISTAKES_DEPTH)

        return new Promise<void>((resolve) => {
          const checkComplete = () => {
            if (
              deepAnalysisProgress.isComplete ||
              deepAnalysisProgress.isCancelled
            ) {
              if (deepAnalysisProgress.isComplete) {
                beginLearnMode(playerColor)
              }
              resolve()
            } else {
              setTimeout(checkComplete, 500)
            }
          }

          checkComplete()
        })
      }
    },
    [deepAnalysisProgress, startDeepAnalysis, gameTree],
  )

  const beginLearnMode = useCallback(
    (playerColor: 'white' | 'black') => {
      // The list from the game's first review, when there is one, so the same
      // game gives the same mistakes each time (see src/lib/learnMistakes).
      const mistakes = getStablePlayerMistakes(gameTree, playerColor)

      if (mistakes.length === 0) {
        const colorName = playerColor === 'white' ? 'White' : 'Black'
        toast(`No clear mistakes made by ${colorName}`, {
          icon: '👑',
          duration: 3000,
        })

        setLearnModeState({
          isActive: false,
          showPlayerSelection: false,
          selectedPlayerColor: null,
          currentMistakeIndex: 0,
          mistakes: [],
          hasCompletedAnalysis: false,
          showSolution: false,
          currentAttempt: 1,
          maxAttempts: Infinity,
          originalPosition: null,
        })
        return
      }

      const firstMistake = mistakes[0]
      const mistakeNode = gameTree.getMainLine()[firstMistake.moveIndex]
      const originalPosition =
        mistakeNode && mistakeNode.parent ? mistakeNode.parent.fen : null

      setLearnModeState({
        isActive: true,
        showPlayerSelection: false,
        selectedPlayerColor: playerColor,
        currentMistakeIndex: 0,
        mistakes,
        hasCompletedAnalysis: true,
        showSolution: false,
        currentAttempt: 1,
        maxAttempts: Infinity,
        originalPosition,
      })

      if (mistakeNode && mistakeNode.parent) {
        setCurrentNode(mistakeNode.parent)
      }
    },
    [gameTree, setCurrentNode],
  )

  const stopLearnMode = useCallback(() => {
    setLearnModeState({
      isActive: false,
      showPlayerSelection: false,
      selectedPlayerColor: null,
      currentMistakeIndex: 0,
      mistakes: [],
      hasCompletedAnalysis: false,
      showSolution: false,
      currentAttempt: 1,
      maxAttempts: Infinity,
      originalPosition: null,
    })
  }, [])

  const showLearnModeSolution = useCallback(() => {
    if (!learnModeState.isActive || learnModeState.mistakes.length === 0) return

    const currentMistake =
      learnModeState.mistakes[learnModeState.currentMistakeIndex]
    if (!currentMistake || !currentNode) return

    const chess = new Chess(currentNode.fen)
    const moveResult = chess.move(currentMistake.bestMove, { sloppy: true })

    // The best move goes in the move list, but the board stays on the
    // mistake's position (the page draws the move as an arrow), so that the
    // panels, Moves by Rating among them, describe the position the question
    // was about rather than the one after the answer.
    if (moveResult) {
      gameTree.addVariationNode(
        currentNode,
        chess.fen(),
        currentMistake.bestMove,
        currentMistake.bestMoveSan,
        currentMaiaModel,
      )
    }

    setLearnModeState((prev) => ({
      ...prev,
      showSolution: true,
    }))
  }, [learnModeState, currentNode, gameTree, currentMaiaModel])

  const goToNextLearnModeMistake = useCallback(() => {
    if (!learnModeState.isActive || learnModeState.mistakes.length === 0) return

    const nextIndex = learnModeState.currentMistakeIndex + 1

    if (nextIndex >= learnModeState.mistakes.length) {
      stopLearnMode()
      return
    }

    const nextMistake = learnModeState.mistakes[nextIndex]
    const mistakeNode = gameTree.getMainLine()[nextMistake.moveIndex]
    const newOriginalPosition =
      mistakeNode && mistakeNode.parent ? mistakeNode.parent.fen : null

    if (mistakeNode && mistakeNode.parent) {
      setCurrentNode(mistakeNode.parent)
    }

    setLearnModeState((prev) => ({
      ...prev,
      currentMistakeIndex: nextIndex,
      showSolution: false,
      currentAttempt: 1,
      originalPosition: newOriginalPosition,
    }))
  }, [learnModeState, gameTree, setCurrentNode, stopLearnMode])

  const checkMoveInLearnMode = useCallback(
    (moveUci: string): 'correct' | 'incorrect' | 'not-learning' => {
      if (!learnModeState.isActive || !currentNode) return 'not-learning'

      const currentMistake =
        learnModeState.mistakes[learnModeState.currentMistakeIndex]
      if (!currentMistake) return 'not-learning'

      // A kept mistake's best move came from the analysis at its first
      // review; a deeper search since may prefer another, and either counts.
      const isCorrect =
        moveUci === currentMistake.bestMove || isBestMove(currentNode, moveUci)

      if (isCorrect) {
        setLearnModeState((prev) => ({
          ...prev,
          showSolution: true,
        }))
        return 'correct'
      } else {
        setLearnModeState((prev) => ({
          ...prev,
          currentAttempt: prev.currentAttempt + 1,
        }))
        return 'incorrect'
      }
    },
    [learnModeState, currentNode],
  )

  const returnLearnModeMistakeToOriginalPosition = useCallback(() => {
    if (!learnModeState.originalPosition) return

    const mainLine = gameTree.getMainLine()
    const originalNode = mainLine.find(
      (node) => node.fen === learnModeState.originalPosition,
    )

    if (originalNode) {
      setCurrentNode(originalNode)
    }
  }, [learnModeState.originalPosition, gameTree, setCurrentNode])

  const getCurrentLearnModeMistakeInfo = useCallback(() => {
    if (!learnModeState.isActive || learnModeState.mistakes.length === 0) {
      return null
    }

    const currentMistake =
      learnModeState.mistakes[learnModeState.currentMistakeIndex]
    const totalMistakes = learnModeState.mistakes.length
    const currentIndex = learnModeState.currentMistakeIndex + 1

    return {
      mistake: currentMistake,
      progress: `${currentIndex} of ${totalMistakes}`,
      isLastMistake: learnModeState.currentMistakeIndex === totalMistakes - 1,
    }
  }, [learnModeState])

  return {
    state: learnModeState,
    start: requestLearnModePlayerColor,
    startWithColor: checkAnalysisProgressForLearnMode,
    stop: stopLearnMode,
    showSolution: showLearnModeSolution,
    goToNext: goToNextLearnModeMistake,
    checkMove: checkMoveInLearnMode,
    getCurrentInfo: getCurrentLearnModeMistakeInfo,
    returnToOriginalPosition: returnLearnModeMistakeToOriginalPosition,
  }
}
