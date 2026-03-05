import { Chess } from 'chess.ts'
import {
  Key,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react'

import { AnalyzedGame, GameNode } from 'src/types'
import type { DrawShape } from 'chessground/draw'
import { MAIA_MODELS } from 'src/constants/common'
import { useTreeController, useLocalStorage } from '..'
import { useEngineAnalysis } from './useEngineAnalysis'
import { useBoardDescription } from './useBoardDescription'
import { useMoveRecommendations } from './useMoveRecommendations'
import { useLearnFromMistakes } from './useLearnFromMistakes'
import { useDeepAnalysis } from './useDeepAnalysis'
import { useAutoSave } from './useAutoSave'
import { MaiaEngineContext } from 'src/contexts/MaiaEngineContext'
import { generateColorSanMapping, calculateBlunderMeter } from './utils'
import { StockfishEngineContext } from 'src/contexts/StockfishEngineContext'

export const useAnalysisController = (
  game: AnalyzedGame,
  initialOrientation?: 'white' | 'black',
  enableAutoSave = true,
) => {
  const defaultOrientation = initialOrientation
    ? initialOrientation
    : game.whitePlayer.name.includes('Maia')
      ? 'black'
      : 'white'

  const maia = useContext(MaiaEngineContext)
  const stockfish = useContext(StockfishEngineContext)
  const controller = useTreeController(game.tree, defaultOrientation)

  const [analysisState, setAnalysisState] = useState(0)
  const inProgressAnalyses = useMemo(() => new Set<string>(), [])

  const autoSaveController = useAutoSave({
    game,
    gameTree: controller.tree,
    enableAutoSave,
    analysisState,
  })

  const [currentMove, setCurrentMove] = useState<[string, string] | null>()
  const [currentMaiaModel, setCurrentMaiaModel] = useLocalStorage(
    'currentMaiaModel',
    MAIA_MODELS[0],
  )
  const [showTopMoveBadges, setShowTopMoveBadges] = useLocalStorage<boolean>(
    'analysis-show-top-move-badges',
    true,
  )

  const deepAnalysisController = useDeepAnalysis({
    gameTree: controller.tree,
    setCurrentNode: controller.setCurrentNode,
  })

  const learnFromMistakesController = useLearnFromMistakes({
    gameTree: controller.tree,
    deepAnalysisProgress: deepAnalysisController.progress,
    startDeepAnalysis: deepAnalysisController.startAnalysis,
    currentMaiaModel,
    setCurrentNode: controller.setCurrentNode,
    goToNode: controller.goToNode,
    currentNode: controller.currentNode,
  })

  useEffect(() => {
    if (!MAIA_MODELS.includes(currentMaiaModel)) {
      setCurrentMaiaModel(MAIA_MODELS[0])
    }
  }, [currentMaiaModel, setCurrentMaiaModel])

  useEngineAnalysis(
    controller.currentNode || null,
    inProgressAnalyses,
    currentMaiaModel,
    setAnalysisState,
    deepAnalysisController.progress.isAnalyzing
      ? deepAnalysisController.config.targetDepth
      : 18,
  )

  const availableMoves = useMemo(() => {
    if (!controller.currentNode) return new Map<string, string[]>()

    const moveMap = new Map<string, string[]>()
    const chess = new Chess(controller.currentNode.fen)
    const moves = chess.moves({ verbose: true })

    moves.forEach((key) => {
      const { from, to } = key
      moveMap.set(from, (moveMap.get(from) ?? []).concat([to]))
    })

    return moveMap
  }, [controller.currentNode])

  const colorSanMapping = useMemo(() => {
    if (!controller.currentNode) return {}

    return generateColorSanMapping(
      controller.currentNode.analysis.stockfish,
      controller.currentNode.fen,
    )
  }, [controller.currentNode, analysisState])

  const moveEvaluation = useMemo(() => {
    if (!controller.currentNode) return null

    return {
      maia: controller.currentNode.analysis.maia?.[currentMaiaModel],
      stockfish: controller.currentNode.analysis.stockfish,
    }
  }, [currentMaiaModel, controller.currentNode, analysisState])

  const blunderMeter = useMemo(
    () =>
      calculateBlunderMeter(moveEvaluation?.maia, moveEvaluation?.stockfish),
    [moveEvaluation],
  )

  const {
    recommendations: moveRecommendations,
    movesByRating,
    moveMap,
  } = useMoveRecommendations(
    controller.currentNode || null,
    moveEvaluation,
    currentMaiaModel,
  )

  const boardDescription = useBoardDescription(
    controller.currentNode || null,
    moveEvaluation,
  )

  const move = useMemo(() => {
    if (!currentMove) return undefined

    const chess = new Chess(controller.currentNode?.fen)
    const san = chess.move({ from: currentMove[0], to: currentMove[1] })?.san

    if (san) {
      return {
        move: currentMove,
        fen: chess.fen(),
        check: chess.inCheck(),
        san,
      }
    }

    return undefined
  }, [currentMove, controller.currentNode])

  const arrows = useMemo(() => {
    if (!controller.currentNode) return []

    const arrows: DrawShape[] = []

    if (moveEvaluation?.maia) {
      const bestMove = Object.entries(moveEvaluation.maia.policy)[0]
      if (bestMove) {
        arrows.push({
          brush: 'red',
          orig: bestMove[0].slice(0, 2) as Key,
          dest: bestMove[0].slice(2, 4) as Key,
        } as DrawShape)
      }
    }

    if (moveEvaluation?.stockfish) {
      const bestMove = Object.entries(moveEvaluation.stockfish.cp_vec)[0]
      if (bestMove) {
        arrows.push({
          brush: 'blue',
          orig: bestMove[0].slice(0, 2) as Key,
          dest: bestMove[0].slice(2, 4) as Key,
          modifiers: { lineWidth: 8 },
        } as DrawShape)
      }
    }

    return arrows
  }, [controller.currentNode, moveEvaluation])

  const topHumanMoveBadge = useMemo(() => {
    if (!controller.currentNode || !moveEvaluation?.maia) {
      return null
    }

    const policyEntries = Object.entries(moveEvaluation.maia.policy)
    if (policyEntries.length === 0) {
      return null
    }

    const [topHumanMove] = policyEntries.reduce((best, current) =>
      current[1] > best[1] ? current : best,
    )

    if (!topHumanMove || topHumanMove.length < 4) {
      return null
    }

    const classification = GameNode.classifyMove(
      controller.currentNode,
      topHumanMove,
      currentMaiaModel,
    )

    if (!classification.blunder && !classification.inaccuracy) {
      return null
    }

    return {
      square: topHumanMove.slice(2, 4),
      classification,
    }
  }, [controller.currentNode, moveEvaluation, currentMaiaModel])

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

    move,
    availableMoves,
    currentMaiaModel,
    setCurrentMaiaModel,
    currentMove,
    colorSanMapping,
    setCurrentMove,
    showTopMoveBadges,
    setShowTopMoveBadges,
    moveEvaluation,
    movesByRating,
    moveRecommendations,
    moveMap,
    blunderMeter,
    boardDescription,
    arrows,
    topHumanMoveBadge,
    stockfish: stockfish,
    maia: maia,
    gameAnalysis: {
      ...deepAnalysisController,
      saveAnalysis: autoSaveController.saveAnalysis,
      autoSave: autoSaveController.autoSave,
    },
    learnFromMistakes: learnFromMistakesController,
  }
}
