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
import {
  DEFAULT_LIVE_STOCKFISH_DEPTH,
  MAX_LIVE_STOCKFISH_DEPTH,
  MIN_LIVE_STOCKFISH_DEPTH,
} from 'src/constants/analysis'
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
import { useContentStable } from 'src/hooks/useContentStable'

interface MaiaModelSetting {
  // Where the chosen Maia model is remembered, and the model before any is
  // chosen. A page with its own default (the broadcasts) keeps its choice
  // under its own key, so that it doesn't change the model of the analysis
  // page, and the other way round.
  storageKey: string
  defaultModel: string
}

const DEFAULT_MAIA_MODEL_SETTING: MaiaModelSetting = {
  storageKey: 'currentMaiaModel',
  defaultModel: MAIA_MODELS[0],
}

/** The analysis page's level before anyone picks one: the two players' level. */
const defaultMaiaModelFor = (game: AnalyzedGame) => {
  const { rating: white } = game.whitePlayer
  const { rating: black } = game.blackPlayer
  if (!white || !black) return MAIA_MODELS[0]
  const level = Math.round((white + black) / 200) * 100
  const model = `maia_kdd_${level}`
  if (MAIA_MODELS.includes(model)) return model
  return level < 1000 ? MAIA_MODELS[0] : MAIA_MODELS[MAIA_MODELS.length - 1]
}

export const useAnalysisController = (
  game: AnalyzedGame,
  initialOrientation?: 'white' | 'black',
  enableAutoSave = true,
  enableEngineAnalysis = true,
  maiaModelSetting: MaiaModelSetting = DEFAULT_MAIA_MODEL_SETTING,
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
  const refreshAnalysis = useCallback(
    () => setAnalysisState((state) => state + 1),
    [],
  )
  const inProgressAnalyses = useMemo(() => new Set<string>(), [])

  const autoSaveController = useAutoSave({
    game,
    gameTree: controller.tree,
    enableAutoSave,
    analysisState,
  })

  const [currentMove, setCurrentMove] = useState<[string, string] | null>()
  // Until someone picks a level: the level of the two players in this game.
  const [currentMaiaModel, setCurrentMaiaModel] = useLocalStorage(
    maiaModelSetting.storageKey,
    maiaModelSetting === DEFAULT_MAIA_MODEL_SETTING
      ? defaultMaiaModelFor(game)
      : maiaModelSetting.defaultModel,
  )
  const [showTopMoveBadges, setShowTopMoveBadges] = useLocalStorage<boolean>(
    'analysis-show-top-move-badges',
    true,
  )
  // Stockfish while browsing a game: its depth, or off (Maia only).
  const [storedStockfishDepth, setStockfishDepth] = useLocalStorage<number>(
    'analysis-stockfish-depth',
    DEFAULT_LIVE_STOCKFISH_DEPTH,
  )
  const stockfishDepth =
    Number.isInteger(storedStockfishDepth) &&
    storedStockfishDepth >= MIN_LIVE_STOCKFISH_DEPTH &&
    storedStockfishDepth <= MAX_LIVE_STOCKFISH_DEPTH
      ? storedStockfishDepth
      : DEFAULT_LIVE_STOCKFISH_DEPTH
  const [stockfishEnabled, setStockfishEnabled] = useLocalStorage<boolean>(
    'analysis-stockfish-enabled',
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
      setCurrentMaiaModel(maiaModelSetting.defaultModel)
    }
  }, [currentMaiaModel, setCurrentMaiaModel])

  useEngineAnalysis(
    controller.currentNode || null,
    inProgressAnalyses,
    currentMaiaModel,
    setAnalysisState,
    deepAnalysisController.progress.isAnalyzing
      ? deepAnalysisController.config.targetDepth
      : stockfishDepth,
    enableEngineAnalysis,
    // Full-game analysis (and Learn from mistakes, which uses it) was asked
    // for explicitly, so it runs Stockfish even when it's off.
    stockfishEnabled || deepAnalysisController.progress.isAnalyzing,
    !deepAnalysisController.progress.isAnalyzing,
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

  const colorSanMapping = useContentStable(
    useMemo(() => {
      if (!controller.currentNode) return {}

      return generateColorSanMapping(
        controller.currentNode.analysis.stockfish,
        controller.currentNode.fen,
      )
    }, [controller.currentNode, analysisState]),
  )

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
    movesByRating: latestMovesByRating,
    moveMap,
  } = useMoveRecommendations(
    controller.currentNode || null,
    moveEvaluation,
    currentMaiaModel,
  )
  const movesByRating = useContentStable(latestMovesByRating)

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
      const bestMove = moveEvaluation.stockfish.model_move
      if (bestMove) {
        arrows.push({
          brush: 'blue',
          orig: bestMove.slice(0, 2) as Key,
          dest: bestMove.slice(2, 4) as Key,
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
    stockfishDepth,
    setStockfishDepth,
    stockfishEnabled,
    setStockfishEnabled,
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
    /** Re-reads the analysis stored on the tree's nodes. */
    refreshAnalysis,
  }
}
