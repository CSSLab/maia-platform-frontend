import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.ts'
import { getGameMove } from 'src/api/play/play'
import { logOpeningDrill } from 'src/api/opening'
import { useTreeController } from '../useTreeController'
import { useLocalStorage } from '../useLocalStorage'
import {
  GameTree,
  GameNode,
  StockfishEvaluation,
  MaiaEvaluation,
} from 'src/types'
import {
  OpeningSelection,
  OpeningDrillGame,
  CompletedDrill,
  DrillPerformanceData,
  OverallPerformanceData,
  DrillConfiguration,
  MoveAnalysis,
  EvaluationPoint,
  RatingPrediction,
  RatingComparison,
} from 'src/types/openings'
import { MAIA_MODELS } from 'src/constants/common'
import { MIN_STOCKFISH_DEPTH } from 'src/constants/analysis'
import { chessSoundManager } from 'src/lib/chessSoundManager'

interface CachedAnalysisResult {
  fen: string
  stockfish: StockfishEvaluation | null
  maia: MaiaEvaluation | null
  timestamp: number
}

interface AnalysisProgress {
  total: number
  completed: number
  currentMove: string | null
}
const parsePgnToTree = (pgn: string, gameTree: GameTree): GameNode | null => {
  if (!pgn || pgn.trim() === '') return gameTree.getRoot()

  const chess = new Chess()
  let currentNode = gameTree.getRoot()

  const moveText = pgn.replace(/\d+\./g, '').trim()
  const moves = moveText.split(/\s+/).filter((move) => move && move !== '')

  for (const moveStr of moves) {
    try {
      const moveObj = chess.move(moveStr)
      if (!moveObj) break

      const moveUci = moveObj.from + moveObj.to + (moveObj.promotion || '')
      const existingChild = currentNode.children.find(
        (child: GameNode) => child.move === moveUci,
      )

      if (existingChild) {
        currentNode = existingChild
      } else {
        const newNode = gameTree.addMainMove(
          currentNode,
          chess.fen(),
          moveUci,
          moveObj.san,
        )
        if (newNode) {
          currentNode = newNode
        } else {
          break
        }
      }
    } catch (error) {
      console.error('Error parsing move:', moveStr, error)
      break
    }
  }

  return currentNode
}

export const useOpeningDrillController = (
  configuration: DrillConfiguration,
) => {
  const [remainingDrills, setRemainingDrills] = useState<OpeningSelection[]>([])
  const [currentDrill, setCurrentDrill] = useState<OpeningSelection | null>(
    null,
  )
  const [completedDrills, setCompletedDrills] = useState<CompletedDrill[]>([])
  const [currentDrillGame, setCurrentDrillGame] =
    useState<OpeningDrillGame | null>(null)
  const [analysisEnabled, setAnalysisEnabled] = useState(false)
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0)
  const [allDrillsCompleted, setAllDrillsCompleted] = useState(false)

  const [showPerformanceModal, setShowPerformanceModal] = useState(false)
  const [showFinalModal, setShowFinalModal] = useState(false)
  const [currentPerformanceData, setCurrentPerformanceData] =
    useState<DrillPerformanceData | null>(null)
  const [isAnalyzingDrill, setIsAnalyzingDrill] = useState(false)

  const ensureAnalysisCompleteRef = useRef<
    ((nodes: GameNode[]) => Promise<void>) | null
  >(null)

  const [waitingForMaiaResponse, setWaitingForMaiaResponse] = useState(false)
  const [continueAnalyzingMode, setContinueAnalyzingMode] = useState(false)

  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({
    total: 0,
    completed: 0,
    currentMove: null,
  })
  const analysisCache = useRef<Map<string, CachedAnalysisResult>>(new Map())

  const MAX_CACHE_SIZE = 100
  const CACHE_CLEANUP_INTERVAL = 60000

  const [currentMaiaModel, setCurrentMaiaModel] = useLocalStorage(
    'currentMaiaModel',
    MAIA_MODELS[0],
  )

  useEffect(() => {
    if (!MAIA_MODELS.includes(currentMaiaModel)) {
      setCurrentMaiaModel(MAIA_MODELS[0])
    }
  }, [currentMaiaModel, setCurrentMaiaModel])

  useEffect(() => {
    const cleanupCache = () => {
      const cache = analysisCache.current
      if (cache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(cache.entries())
        entries
          .sort((a, b) => a[1].timestamp - b[1].timestamp)
          .slice(0, cache.size - MAX_CACHE_SIZE + 10)
          .forEach(([key]) => cache.delete(key))
      }

      const tenMinutesAgo = Date.now() - 600000
      for (const [key, value] of cache.entries()) {
        if (value.timestamp < tenMinutesAgo) {
          cache.delete(key)
        }
      }
    }

    const intervalId = setInterval(cleanupCache, CACHE_CLEANUP_INTERVAL)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (
      configuration.drillSequence.length > 0 &&
      remainingDrills.length === 0 &&
      !allDrillsCompleted
    ) {
      setRemainingDrills(configuration.drillSequence)
      setCurrentDrill(configuration.drillSequence[0])
      setCurrentDrillIndex(0)
    }
  }, [configuration.drillSequence, remainingDrills.length, allDrillsCompleted])

  useEffect(() => {
    if (!currentDrill || allDrillsCompleted) return

    setAnalysisProgress({ total: 0, completed: 0, currentMove: null })

    const startingFen =
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const gameTree = new GameTree(startingFen)

    const pgn = currentDrill.variation
      ? currentDrill.variation.pgn
      : currentDrill.opening.pgn
    const endNode = parsePgnToTree(pgn, gameTree)

    const drillGame: OpeningDrillGame = {
      id: currentDrill.id,
      selection: currentDrill,
      moves: [],
      tree: gameTree,
      currentFen: endNode?.fen || startingFen,
      toPlay: endNode
        ? new Chess(endNode.fen).turn() === 'w'
          ? 'white'
          : 'black'
        : 'white',
      openingEndNode: endNode,
      playerMoveCount: 0,
    }

    setCurrentDrillGame(drillGame)
    setWaitingForMaiaResponse(false)
    setContinueAnalyzingMode(false)
  }, [currentDrill?.id, allDrillsCompleted])

  const gameTree = currentDrillGame?.tree || new GameTree(new Chess().fen())
  const controller = useTreeController(
    gameTree,
    currentDrill?.playerColor || 'white',
  )

  useEffect(() => {
    if (currentDrillGame && currentDrillGame.moves.length === 0) {
      if (currentDrillGame.openingEndNode) {
        controller.setCurrentNode(currentDrillGame.openingEndNode)
      } else if (currentDrillGame.tree) {
        controller.setCurrentNode(currentDrillGame.tree.getRoot())
      }
    }
  }, [currentDrillGame?.id])

  useEffect(() => {
    if (currentDrill?.playerColor) {
      controller.setOrientation(currentDrill.playerColor)
    }
  }, [currentDrill?.playerColor])

  const isPlayerTurn = useMemo(() => {
    if (!currentDrillGame || !controller.currentNode) return true
    const chess = new Chess(controller.currentNode.fen)
    const currentTurn = chess.turn() === 'w' ? 'white' : 'black'
    return currentTurn === currentDrill?.playerColor
  }, [currentDrillGame, controller.currentNode, currentDrill?.playerColor])

  const isDrillComplete = useMemo(() => {
    if (!currentDrillGame || !currentDrill) return false
    return (
      currentDrillGame.playerMoveCount >= currentDrill.targetMoveNumber &&
      !continueAnalyzingMode
    )
  }, [currentDrillGame, currentDrill, continueAnalyzingMode])

  const isAtOpeningEnd = useMemo(() => {
    if (!currentDrillGame || !controller.currentNode) return false
    return controller.currentNode === currentDrillGame.openingEndNode
  }, [currentDrillGame, controller.currentNode])

  const areAllDrillsCompleted = useMemo(() => {
    return (
      allDrillsCompleted || completedDrills.length >= configuration.drillCount
    )
  }, [allDrillsCompleted, completedDrills.length, configuration.drillCount])

  const availableMoves = useMemo(() => {
    if (!controller.currentNode || !isPlayerTurn)
      return new Map<string, string[]>()

    const moveMap = new Map<string, string[]>()
    const chess = new Chess(controller.currentNode.fen)
    const legalMoves = chess.moves({ verbose: true })

    legalMoves.forEach((move) => {
      const { from, to } = move
      moveMap.set(from, (moveMap.get(from) ?? []).concat([to]))
    })

    return moveMap
  }, [controller.currentNode, isPlayerTurn])

  // Function to evaluate drill performance by extracting analysis from GameTree nodes
  const evaluateDrillPerformance = useCallback(
    async (drillGame: OpeningDrillGame): Promise<DrillPerformanceData> => {
      const { selection } = drillGame
      const finalNode = controller.currentNode || drillGame.tree.getRoot()
      // Use the centralized minimum depth constant

      const moveAnalyses: MoveAnalysis[] = []
      const evaluationChart: EvaluationPoint[] = []

      const extractNodeAnalysis = (
        node: GameNode,
        path: GameNode[] = [],
      ): void => {
        const currentPath = [...path, node]

        if (node.move && node.san) {
          const moveIndex = currentPath.length - 2
          const isPlayerMove =
            selection.playerColor === 'white'
              ? moveIndex % 2 === 0
              : moveIndex % 2 === 1

          const stockfishEval = node.analysis?.stockfish
          const maiaEval = node.analysis?.maia?.[currentMaiaModel]

          // Check if analysis meets minimum depth requirement
          if (stockfishEval && stockfishEval.depth < MIN_STOCKFISH_DEPTH) {
            console.warn(
              `Stockfish analysis depth ${stockfishEval.depth} is below minimum required depth ${MIN_STOCKFISH_DEPTH} for position ${node.fen}`,
            )
          }

          if (!maiaEval) {
            console.warn(`Missing Maia analysis for position ${node.fen}`)
          }

          const evaluation = stockfishEval?.model_optimal_cp as number

          const prevNode = currentPath[currentPath.length - 2]
          const prevEvaluation = prevNode?.analysis?.stockfish
            ?.model_optimal_cp as number
          const evaluationLoss = Math.abs(evaluation - prevEvaluation)

          const stockfishBestMove = stockfishEval?.model_move
          const maiaBestMove = maiaEval?.policy
            ? Object.keys(maiaEval.policy).sort(
                (a, b) => maiaEval.policy[b] - maiaEval.policy[a],
              )[0]
            : undefined

          let classification: 'excellent' | 'inaccuracy' | 'blunder' | 'good' =
            'good'

          if (isPlayerMove && prevNode && node.move) {
            const nodeClassification = GameNode.classifyMove(
              prevNode,
              node.move,
              currentMaiaModel,
            )

            if (nodeClassification.blunder) {
              classification = 'blunder'
            } else if (nodeClassification.inaccuracy) {
              classification = 'inaccuracy'
            } else if (nodeClassification.excellent) {
              classification = 'excellent'
            } else {
              classification = 'good'
            }
          }

          const moveAnalysis: MoveAnalysis = {
            move: node.move,
            san: node.san,
            fen: node.fen,
            fenBeforeMove: prevNode?.fen,
            moveNumber: Math.ceil((moveIndex + 1) / 2),
            isPlayerMove,
            evaluation,
            classification,
            evaluationLoss,
            bestMove: stockfishBestMove || maiaBestMove,
            bestEvaluation: stockfishEval?.model_optimal_cp,
            stockfishBestMove,
            maiaBestMove,
          }

          moveAnalyses.push(moveAnalysis)

          const evaluationPoint: EvaluationPoint = {
            moveNumber: moveAnalysis.moveNumber,
            evaluation,
            isPlayerMove,
            moveClassification: classification,
          }

          evaluationChart.push(evaluationPoint)
        }

        if (node.children.length > 0) {
          extractNodeAnalysis(node.children[0], currentPath)
        }
      }

      // Start analysis from the opening end node, not from the game root
      // This ensures the evaluation chart only includes post-opening moves that the player actually played
      const startingNode = drillGame.openingEndNode || drillGame.tree.getRoot()
      extractNodeAnalysis(startingNode)

      const playerMoves = moveAnalyses.filter((m) => m.isPlayerMove)
      const excellentMoves = playerMoves.filter(
        (m) => m.classification === 'excellent',
      )
      const goodMoves = playerMoves.filter((m) => m.classification === 'good')
      const inaccuracyMoves = playerMoves.filter(
        (m) => m.classification === 'inaccuracy',
      )
      const mistakeMoves = playerMoves.filter(
        (m) => m.classification === 'mistake',
      )
      const blunderMoves = playerMoves.filter(
        (m) => m.classification === 'blunder',
      )

      const accuracy =
        playerMoves.length > 0
          ? ((excellentMoves.length + goodMoves.length) / playerMoves.length) *
            100
          : 100

      const averageEvaluationLoss =
        playerMoves.length > 0
          ? playerMoves.reduce((sum, move) => sum + move.evaluationLoss, 0) /
            playerMoves.length
          : 0

      const completedDrill: CompletedDrill = {
        selection,
        finalNode,
        playerMoves: playerMoves.map((m) => m.move),
        allMoves: moveAnalyses.map((m) => m.move),
        totalMoves: playerMoves.length,
        blunders: blunderMoves.map((m) => m.move),
        goodMoves: [...excellentMoves, ...goodMoves].map((m) => m.move),
        finalEvaluation:
          evaluationChart[evaluationChart.length - 1]?.evaluation ?? 0,
        completedAt: new Date(),
        moveAnalyses,
        accuracyPercentage: accuracy,
        averageEvaluationLoss,
      }

      const feedback: string[] = []
      if (accuracy >= 90) {
        feedback.push('Excellent performance! You played very accurately.')
      } else if (accuracy >= 70) {
        feedback.push('Good job! Most of your moves were strong.')
      } else {
        feedback.push('This opening needs more practice.')
      }

      if (blunderMoves.length > 0) {
        feedback.push(
          `Watch out for ${blunderMoves.length} critical mistake${blunderMoves.length > 1 ? 's' : ''}.`,
        )
      }

      const nodesByFen = new Map<string, GameNode>()
      const collectNodes = (node: GameNode): void => {
        nodesByFen.set(node.fen, node)
        node.children.forEach(collectNodes)
      }
      collectNodes(drillGame.tree.getRoot())

      const ratingDistribution: RatingComparison[] = MAIA_MODELS.map(
        (model) => {
          const rating = parseInt(model.replace('maia_kdd_', ''))

          let totalLogLikelihood = 0
          let totalProbability = 0
          let validMoves = 0

          for (const move of playerMoves) {
            const beforeMoveNode = move.fenBeforeMove
              ? nodesByFen.get(move.fenBeforeMove)
              : null
            const maiaAnalysis = beforeMoveNode?.analysis?.maia?.[model]

            if (maiaAnalysis?.policy && move.move in maiaAnalysis.policy) {
              const moveProb = maiaAnalysis.policy[move.move]
              totalProbability += moveProb
              totalLogLikelihood += Math.log(Math.max(moveProb, 0.001))
              validMoves++
            }
          }

          const averageMoveProb =
            validMoves > 0 ? totalProbability / validMoves : 0
          const logLikelihood =
            validMoves > 0 ? totalLogLikelihood / validMoves : -10

          const normalizedLikelihood = Math.max(
            0,
            Math.min(1, (logLikelihood + 8) / 8),
          )

          return {
            rating,
            probability: averageMoveProb,
            moveMatch: false,
            logLikelihood,
            likelihoodProbability: normalizedLikelihood,
            averageMoveProb,
          }
        },
      )

      const bestRating = ratingDistribution.reduce((best, current) =>
        current.likelihoodProbability > best.likelihoodProbability
          ? current
          : best,
      )

      const ratingPrediction: RatingPrediction = {
        predictedRating: bestRating.rating,
        standardDeviation: 150,
        sampleSize: playerMoves.length,
        ratingDistribution,
      }

      return {
        drill: completedDrill,
        evaluationChart,
        accuracy,
        blunderCount: blunderMoves.length,
        goodMoveCount: goodMoves.length + excellentMoves.length,
        inaccuracyCount: inaccuracyMoves.length,
        mistakeCount: mistakeMoves.length,
        excellentMoveCount: excellentMoves.length,
        feedback,
        moveAnalyses,
        ratingComparison: [],
        ratingPrediction,
        bestPlayerMoves: playerMoves
          .filter((m) => m.classification === 'excellent')
          .slice(0, 3),
        worstPlayerMoves: [...blunderMoves, ...mistakeMoves].slice(0, 3),
        averageEvaluationLoss,
        openingKnowledge: Math.max(0, Math.min(100, accuracy)),
      }
    },
    [controller.currentNode],
  )

  const completeDrill = useCallback(
    async (gameToComplete?: OpeningDrillGame) => {
      const drillGame = gameToComplete || currentDrillGame
      if (!drillGame) return

      try {
        setIsAnalyzingDrill(true)
        setAnalysisProgress({
          total: 0,
          completed: 0,
          currentMove: 'Preparing analysis...',
        })

        // Submit drill data to backend
        try {
          await logOpeningDrill({
            opening_fen: drillGame.selection.variation
              ? drillGame.selection.variation.fen
              : drillGame.selection.opening.fen,
            side_played: drillGame.selection.playerColor,
            opponent: drillGame.selection.maiaVersion,
            num_moves: drillGame.selection.targetMoveNumber,
            moves_played_uci: drillGame.moves,
          })
        } catch (error) {
          console.error('Failed to log drill to backend:', error)
          // Continue even if backend submission fails
        }

        // Ensure all positions in the drill are analyzed to sufficient depth
        if (ensureAnalysisCompleteRef.current) {
          const drillNodes: GameNode[] = []
          let currentNode = drillGame.tree.getRoot()
          drillNodes.push(currentNode)

          while (currentNode.children.length > 0) {
            currentNode = currentNode.children[0]
            drillNodes.push(currentNode)
          }

          await ensureAnalysisCompleteRef.current(drillNodes)
        } else {
          setAnalysisProgress({
            total: 0,
            completed: 0,
            currentMove: 'Analyzing drill performance...',
          })
        }

        const performanceData = await evaluateDrillPerformance(drillGame)
        setCurrentPerformanceData(performanceData)

        setCompletedDrills((prev) => {
          const existingIndex = prev.findIndex(
            (completedDrill) =>
              completedDrill.selection.id === drillGame.selection.id,
          )

          if (existingIndex !== -1) {
            const updated = [...prev]
            updated[existingIndex] = performanceData.drill
            return updated
          } else {
            return [...prev, performanceData.drill]
          }
        })

        setShowPerformanceModal(true)
      } catch (error) {
        console.error('Error completing drill analysis:', error)
        setShowPerformanceModal(true)
      } finally {
        setIsAnalyzingDrill(false)
      }
    },
    [currentDrillGame, evaluateDrillPerformance],
  )

  const moveToNextDrill = useCallback(async () => {
    // Submit drill data to backend
    if (currentDrillGame) {
      try {
        await logOpeningDrill({
          opening_fen: currentDrillGame.selection.variation
            ? currentDrillGame.selection.variation.fen
            : currentDrillGame.selection.opening.fen,
          side_played: currentDrillGame.selection.playerColor,
          opponent: currentDrillGame.selection.maiaVersion,
          num_moves: currentDrillGame.selection.targetMoveNumber,
          moves_played_uci: currentDrillGame.moves,
        })
      } catch (error) {
        console.error('Failed to log drill to backend:', error)
      }
    }

    setShowPerformanceModal(false)
    setCurrentPerformanceData(null)
    setContinueAnalyzingMode(false)
    setAnalysisEnabled(false)

    setAnalysisProgress({ total: 0, completed: 0, currentMove: null })
    setRemainingDrills((prev) => prev.slice(1))

    const nextIndex = currentDrillIndex + 1

    if (nextIndex < configuration.drillSequence.length) {
      const nextDrill = configuration.drillSequence[nextIndex]

      setCurrentDrill(nextDrill)
      setCurrentDrillIndex(nextIndex)
    } else {
      setAllDrillsCompleted(true)
      setShowFinalModal(true)
    }
  }, [currentDrillIndex, configuration.drillSequence])

  // Continue analyzing current drill
  const continueAnalyzing = useCallback(() => {
    setShowPerformanceModal(false)
    setAnalysisEnabled(true)
    setContinueAnalyzingMode(true)
    setWaitingForMaiaResponse(false)
  }, [])

  // Continue analyzing from final modal - just enable analysis mode
  const continueAnalyzingFromFinal = useCallback(() => {
    setShowFinalModal(false)
    setAnalysisEnabled(true)
    setContinueAnalyzingMode(true)
    setWaitingForMaiaResponse(false)
  }, [])

  const showSummary = useCallback(() => {
    setShowFinalModal(true)
  }, [])

  const showPerformance = useCallback(
    async (drill?: CompletedDrill | OpeningDrillGame) => {
      let performanceData: DrillPerformanceData | null = null

      if (drill) {
        if ('selection' in drill && 'finalNode' in drill) {
          const completedDrill = drill as CompletedDrill

          if (
            currentPerformanceData &&
            currentPerformanceData.drill.selection.id ===
              completedDrill.selection.id
          ) {
            performanceData = currentPerformanceData
          } else {
            try {
              setIsAnalyzingDrill(true)
              setAnalysisProgress({
                total: 0,
                completed: 0,
                currentMove: 'Preparing analysis...',
              })

              const drillGame: OpeningDrillGame = {
                id: completedDrill.selection.id,
                selection: completedDrill.selection,
                moves: completedDrill.allMoves || completedDrill.playerMoves,
                tree: currentDrillGame?.tree || new GameTree(new Chess().fen()),
                currentFen: completedDrill.finalNode?.fen || new Chess().fen(),
                toPlay: completedDrill.finalNode
                  ? new Chess(completedDrill.finalNode.fen).turn() === 'w'
                    ? 'white'
                    : 'black'
                  : 'white',
                openingEndNode: currentDrillGame?.openingEndNode || null,
                playerMoveCount: completedDrill.totalMoves,
              }

              performanceData = await evaluateDrillPerformance(drillGame)
            } catch (error) {
              console.error('Error analyzing drill performance:', error)
            } finally {
              setIsAnalyzingDrill(false)
            }
          }
        } else {
          // This is an OpeningDrillGame - analyze it directly
          const drillGame = drill as OpeningDrillGame
          try {
            setIsAnalyzingDrill(true)
            setAnalysisProgress({
              total: 0,
              completed: 0,
              currentMove: 'Preparing analysis...',
            })

            performanceData = await evaluateDrillPerformance(drillGame)
          } catch (error) {
            console.error('Error analyzing drill performance:', error)
          } finally {
            setIsAnalyzingDrill(false)
          }
        }
      } else if (currentDrillGame) {
        // No specific drill provided, analyze current drill
        try {
          setIsAnalyzingDrill(true)
          setAnalysisProgress({
            total: 0,
            completed: 0,
            currentMove: 'Preparing analysis...',
          })

          performanceData = await evaluateDrillPerformance(currentDrillGame)
        } catch (error) {
          console.error('Error analyzing current drill performance:', error)
        } finally {
          setIsAnalyzingDrill(false)
        }
      }

      // Set the performance data and show the modal
      if (performanceData) {
        setCurrentPerformanceData(performanceData)
      }
      setShowPerformanceModal(true)
    },
    [currentDrillGame, currentPerformanceData, evaluateDrillPerformance],
  )

  // Shows performance modal for current drill
  const showCurrentPerformance = useCallback(() => {
    showPerformance()
  }, [showPerformance])

  // Reset drill session for new openings
  const resetDrillSession = useCallback(() => {
    setAllDrillsCompleted(false)
    setRemainingDrills([])
    setCompletedDrills([])
    setCurrentDrill(null)
    setCurrentDrillGame(null)
    setCurrentDrillIndex(0)
    setAnalysisEnabled(false)
    setContinueAnalyzingMode(false)
    setShowPerformanceModal(false)
    setShowFinalModal(false)
    setCurrentPerformanceData(null)
    setWaitingForMaiaResponse(false)

    analysisCache.current.clear()
    setAnalysisProgress({ total: 0, completed: 0, currentMove: null })
  }, [])

  // Load a specific completed drill for analysis
  const loadCompletedDrill = useCallback(
    (completedDrill: CompletedDrill) => {
      setCurrentDrill(completedDrill.selection)

      // Check if this drill is already the current drill and we can reuse the game tree
      if (
        currentDrillGame &&
        currentDrillGame.selection.id === completedDrill.selection.id &&
        currentDrillGame.playerMoveCount === completedDrill.totalMoves
      ) {
        setAnalysisEnabled(true)
        setContinueAnalyzingMode(true)
        setWaitingForMaiaResponse(false)
        return
      }

      // Try to reconstruct the game tree from the finalNode path
      const startingFen =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const gameTree = new GameTree(startingFen)

      const pgn = completedDrill.selection.variation
        ? completedDrill.selection.variation.pgn
        : completedDrill.selection.opening.pgn
      const endNode = parsePgnToTree(pgn, gameTree)

      let finalNode = endNode

      if (
        endNode &&
        completedDrill.allMoves &&
        completedDrill.allMoves.length > 0
      ) {
        let currentNode = endNode
        const chess = new Chess(endNode.fen)

        for (const moveUci of completedDrill.allMoves) {
          try {
            const moveObj = chess.move(moveUci, { sloppy: true })
            if (moveObj) {
              const newNode = gameTree.addMainMove(
                currentNode,
                chess.fen(),
                moveUci,
                moveObj.san,
              )
              if (newNode) {
                currentNode = newNode
                finalNode = newNode
              }
            }
          } catch (error) {
            console.error('Error replaying move:', moveUci, error)
            break
          }
        }
      } else if (endNode && completedDrill.playerMoves.length > 0) {
        let currentNode = endNode
        const chess = new Chess(endNode.fen)

        for (const moveUci of completedDrill.playerMoves) {
          try {
            const moveObj = chess.move(moveUci, { sloppy: true })
            if (moveObj) {
              const newNode = gameTree.addMainMove(
                currentNode,
                chess.fen(),
                moveUci,
                moveObj.san,
              )
              if (newNode) {
                currentNode = newNode
                finalNode = newNode
              }
            }
          } catch (error) {
            console.error('Error replaying player move:', moveUci, error)
            break
          }
        }
      }

      const loadedGame: OpeningDrillGame = {
        id: completedDrill.selection.id + '-replay',
        selection: completedDrill.selection,
        moves: completedDrill.allMoves || completedDrill.playerMoves,
        tree: gameTree,
        currentFen: finalNode?.fen || endNode?.fen || startingFen,
        toPlay: finalNode
          ? new Chess(finalNode.fen).turn() === 'w'
            ? 'white'
            : 'black'
          : 'white',
        openingEndNode: endNode,
        playerMoveCount: completedDrill.totalMoves,
      }

      setCurrentDrillGame(loadedGame)
      setAnalysisEnabled(true)
      setContinueAnalyzingMode(true)

      const isMaiaTurn = finalNode
        ? new Chess(finalNode.fen).turn() !==
          (completedDrill.selection.playerColor === 'white' ? 'w' : 'b')
        : false

      setWaitingForMaiaResponse(isMaiaTurn)

      setTimeout(() => {
        if (finalNode) {
          controller.setCurrentNode(finalNode)
        }
      }, 50)
    },
    [controller, currentDrillGame],
  )

  const navigateToDrill = useCallback(
    (drillIndex: number) => {
      if (drillIndex < 0 || drillIndex >= configuration.drillSequence.length) {
        return
      }

      const targetDrill = configuration.drillSequence[drillIndex]
      const completedDrill = completedDrills.find(
        (cd) => cd.selection.id === targetDrill.id,
      )

      if (completedDrill) {
        loadCompletedDrill(completedDrill)
        setCurrentDrillIndex(drillIndex)
        return
      }

      setCurrentDrill(targetDrill)
      setCurrentDrillIndex(drillIndex)

      const startingFen =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const gameTree = new GameTree(startingFen)

      const pgn = targetDrill.variation
        ? targetDrill.variation.pgn
        : targetDrill.opening.pgn
      const endNode = parsePgnToTree(pgn, gameTree)

      const newGame: OpeningDrillGame = {
        id: targetDrill.id,
        selection: targetDrill,
        moves: [],
        tree: gameTree,
        currentFen: endNode?.fen || startingFen,
        toPlay: endNode
          ? new Chess(endNode.fen).turn() === 'w'
            ? 'white'
            : 'black'
          : 'white',
        openingEndNode: endNode,
        playerMoveCount: 0,
      }

      setCurrentDrillGame(newGame)
      setAnalysisEnabled(false)
      setContinueAnalyzingMode(false)
      setWaitingForMaiaResponse(false)

      setRemainingDrills(configuration.drillSequence.slice(drillIndex))
    },
    [configuration.drillSequence, completedDrills, loadCompletedDrill],
  )

  const overallPerformanceData = useMemo((): OverallPerformanceData => {
    if (completedDrills.length === 0) {
      return {
        totalDrills: configuration.drillCount,
        completedDrills: [],
        overallAccuracy: 0,
        totalBlunders: 0,
        totalGoodMoves: 0,
        bestPerformance: null,
        worstPerformance: null,
        averageEvaluation: 0,
      }
    }

    const totalGoodMoves = completedDrills.reduce(
      (sum, drill) => sum + drill.goodMoves.length,
      0,
    )
    const totalMoves = completedDrills.reduce(
      (sum, drill) => sum + drill.totalMoves,
      0,
    )
    const overallAccuracy =
      totalMoves > 0 ? (totalGoodMoves / totalMoves) * 100 : 0
    const totalBlunders = completedDrills.reduce(
      (sum, drill) => sum + drill.blunders.length,
      0,
    )
    const averageEvaluation =
      completedDrills.reduce((sum, drill) => sum + drill.finalEvaluation, 0) /
      completedDrills.length

    const bestPerformance = completedDrills.reduce((best, drill) => {
      const accuracy =
        drill.totalMoves > 0
          ? (drill.goodMoves.length / drill.totalMoves) * 100
          : 0
      const bestAccuracy =
        best && best.totalMoves > 0
          ? (best.goodMoves.length / best.totalMoves) * 100
          : 0
      return accuracy > bestAccuracy ? drill : best
    }, completedDrills[0])

    const worstPerformance = completedDrills.reduce((worst, drill) => {
      const accuracy =
        drill.totalMoves > 0
          ? (drill.goodMoves.length / drill.totalMoves) * 100
          : 0
      const worstAccuracy =
        worst && worst.totalMoves > 0
          ? (worst.goodMoves.length / worst.totalMoves) * 100
          : 100
      return accuracy < worstAccuracy ? drill : worst
    }, completedDrills[0])

    return {
      totalDrills: configuration.drillCount,
      completedDrills,
      overallAccuracy,
      totalBlunders,
      totalGoodMoves,
      bestPerformance,
      worstPerformance,
      averageEvaluation,
    }
  }, [completedDrills, configuration.drillCount])

  // Helper function to update a completed drill with new moves
  const updateCompletedDrill = useCallback(
    (updatedGame: OpeningDrillGame) => {
      if (updatedGame.id.endsWith('-replay')) {
        const originalId = updatedGame.id.replace('-replay', '')

        setCompletedDrills((prev) =>
          prev.map((completedDrill) => {
            if (completedDrill.selection.id === originalId) {
              const finalNode = controller.currentNode
              return {
                ...completedDrill,
                allMoves: updatedGame.moves,
                playerMoves: updatedGame.moves.filter((_, index) => {
                  const isPlayerMove =
                    completedDrill.selection.playerColor === 'white'
                      ? index % 2 === 0
                      : index % 2 === 1
                  return isPlayerMove
                }),
                totalMoves: updatedGame.playerMoveCount,
                finalNode: finalNode || completedDrill.finalNode,
              }
            }
            return completedDrill
          }),
        )
      }
    },
    [controller],
  )

  // Make a move for the player
  const makePlayerMove = useCallback(
    async (moveUci: string, fromNode?: GameNode) => {
      if (!currentDrillGame || !controller.currentNode || !isPlayerTurn) return

      try {
        const nodeToMoveFrom = fromNode || controller.currentNode

        const chess = new Chess(nodeToMoveFrom.fen)
        const moveObj = chess.move(moveUci, { sloppy: true })

        if (!moveObj) {
          return
        }

        let newNode: GameNode | null = null

        const existingChild = nodeToMoveFrom.children.find(
          (child: GameNode) => child.move === moveUci,
        )

        if (existingChild) {
          newNode = existingChild
        } else {
          if (nodeToMoveFrom.mainChild?.move === moveUci) {
            newNode = nodeToMoveFrom.mainChild
          } else if (nodeToMoveFrom.mainChild) {
            newNode = controller.gameTree.addVariation(
              nodeToMoveFrom,
              chess.fen(),
              moveUci,
              moveObj.san,
              currentMaiaModel,
            )
          } else {
            newNode = controller.gameTree.addMainMove(
              nodeToMoveFrom,
              chess.fen(),
              moveUci,
              moveObj.san,
            )
          }
        }

        if (newNode) {
          controller.setCurrentNode(newNode)

          const mainLine = controller.gameTree.getMainLine()
          const openingLength = currentDrillGame.openingEndNode
            ? currentDrillGame.openingEndNode.getPath().length
            : 1
          const movesAfterOpening = mainLine.slice(openingLength)

          let playerMoveCount = 0
          if (currentDrillGame.openingEndNode) {
            const openingChess = new Chess(currentDrillGame.openingEndNode.fen)
            let isPlayerTurn =
              (openingChess.turn() === 'w') ===
              (currentDrill?.playerColor === 'white')

            for (const _moveNode of movesAfterOpening) {
              if (isPlayerTurn) {
                playerMoveCount++
              }
              isPlayerTurn = !isPlayerTurn
            }
          }

          const updatedGame = {
            ...currentDrillGame,
            moves: movesAfterOpening
              .map((node) => node.move)
              .filter(Boolean) as string[],
            currentFen: newNode.fen,
            playerMoveCount,
          }

          setCurrentDrillGame(updatedGame)
          updateCompletedDrill(updatedGame)

          if (!continueAnalyzingMode) {
            setWaitingForMaiaResponse(true)
          }

          // Check if drill is complete after this move (only if not in continue analyzing mode)
          if (
            currentDrill &&
            updatedGame.playerMoveCount >= currentDrill.targetMoveNumber &&
            !continueAnalyzingMode
          ) {
            setIsAnalyzingDrill(true)

            setTimeout(() => {
              completeDrill(updatedGame)
            }, 1500)
          }
        }
      } catch (error) {
        console.error('Error making player move:', error)
      }
    },
    [
      currentDrillGame,
      controller,
      isPlayerTurn,
      currentDrill,
      completeDrill,
      continueAnalyzingMode,
      updateCompletedDrill,
    ],
  )

  const makeMaiaMove = useCallback(
    async (fromNode: GameNode | null) => {
      if (!currentDrillGame || !currentDrill || !fromNode) return

      try {
        const response = await getGameMove(
          [],
          currentDrill.maiaVersion,
          fromNode.fen,
          null,
          0,
          0,
        )
        const maiaMove = response.top_move

        if (maiaMove && maiaMove.length >= 4) {
          let newNode: GameNode | null = null
          const chess = new Chess(fromNode.fen)

          const existingChild = fromNode.children.find(
            (child: GameNode) => child.move === maiaMove,
          )

          if (existingChild) {
            newNode = existingChild
          } else {
            const moveObj = chess.move(maiaMove, { sloppy: true })

            if (moveObj) {
              newNode = controller.gameTree.addMainMove(
                fromNode,
                chess.fen(),
                maiaMove,
                moveObj.san,
              )
            }
          }

          if (newNode) {
            controller.setCurrentNode(newNode)

            const tempChess = new Chess(fromNode.fen)
            const tempMoveObj = tempChess.move(maiaMove, { sloppy: true })
            const isCapture = tempMoveObj?.captured !== undefined
            chessSoundManager.playMoveSound(isCapture)

            const mainLine = controller.gameTree.getMainLine()
            const openingLength = currentDrillGame.openingEndNode
              ? currentDrillGame.openingEndNode.getPath().length
              : 1
            const movesAfterOpening = mainLine.slice(openingLength)

            let playerMoveCount = 0
            if (currentDrillGame.openingEndNode) {
              const openingChess = new Chess(
                currentDrillGame.openingEndNode.fen,
              )
              let isPlayerTurn =
                (openingChess.turn() === 'w') ===
                (currentDrill?.playerColor === 'white')

              for (const _moveNode of movesAfterOpening) {
                if (isPlayerTurn) {
                  playerMoveCount++
                }
                isPlayerTurn = !isPlayerTurn
              }
            }

            const updatedGame = {
              ...currentDrillGame,
              moves: movesAfterOpening
                .map((node) => node.move)
                .filter(Boolean) as string[],
              currentFen: newNode.fen,
              playerMoveCount,
            }

            setCurrentDrillGame(updatedGame)
            updateCompletedDrill(updatedGame)
            setWaitingForMaiaResponse(false)
          }
        }
      } catch (error) {
        console.error('Error making Maia move:', error)
      }
    },
    [currentDrillGame, controller, currentDrill, updateCompletedDrill],
  )

  // Helper function to get the latest position in the game tree (where Maia should move from)
  const getLatestPosition = useCallback((): GameNode | null => {
    if (!controller.gameTree) return null

    const mainLine = controller.gameTree.getMainLine()
    if (mainLine.length === 0) return null

    for (let i = mainLine.length - 1; i >= 0; i--) {
      const node = mainLine[i]
      if (!node.mainChild) {
        return node
      }
    }

    return mainLine[mainLine.length - 1]
  }, [controller.gameTree])

  // This ref stores the move-making function to ensure the `useEffect` has the latest version
  const makeMaiaMoveRef = useRef(makeMaiaMove)
  useEffect(() => {
    makeMaiaMoveRef.current = makeMaiaMove
  })

  // Handle Maia's response after player moves
  useEffect(() => {
    if (
      currentDrillGame &&
      controller.currentNode &&
      !isPlayerTurn &&
      waitingForMaiaResponse &&
      currentDrillGame.moves.length > 0 &&
      !isDrillComplete &&
      !continueAnalyzingMode
    ) {
      const timeoutId = setTimeout(() => {
        const latestPosition = getLatestPosition()
        if (latestPosition) {
          makeMaiaMoveRef.current(latestPosition)
        }
      }, 1500)

      return () => clearTimeout(timeoutId)
    }
  }, [
    currentDrillGame,
    controller.currentNode,
    isPlayerTurn,
    waitingForMaiaResponse,
    isDrillComplete,
    continueAnalyzingMode,
    getLatestPosition,
  ])

  // Handle initial Maia move if needed
  useEffect(() => {
    if (
      currentDrillGame &&
      controller.currentNode &&
      !isPlayerTurn &&
      currentDrillGame.moves.length === 0 &&
      currentDrillGame.openingEndNode &&
      controller.currentNode === currentDrillGame.openingEndNode &&
      !isDrillComplete &&
      !continueAnalyzingMode
    ) {
      setWaitingForMaiaResponse(true)
      const timeoutId = setTimeout(() => {
        const latestPosition = getLatestPosition()
        if (latestPosition) {
          makeMaiaMoveRef.current(latestPosition)
        }
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [
    currentDrillGame,
    controller.currentNode,
    isPlayerTurn,
    isDrillComplete,
    continueAnalyzingMode,
    getLatestPosition,
  ])

  // Reset current drill to starting position
  const resetCurrentDrill = useCallback(() => {
    if (!currentDrill) return

    setAnalysisProgress({ total: 0, completed: 0, currentMove: null })

    const startingFen =
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const gameTree = new GameTree(startingFen)

    const pgn = currentDrill.variation
      ? currentDrill.variation.pgn
      : currentDrill.opening.pgn
    const endNode = parsePgnToTree(pgn, gameTree)

    const resetGame: OpeningDrillGame = {
      id: currentDrill.id,
      selection: currentDrill,
      moves: [],
      tree: gameTree,
      currentFen: endNode?.fen || startingFen,
      toPlay: endNode
        ? new Chess(endNode.fen).turn() === 'w'
          ? 'white'
          : 'black'
        : 'white',
      openingEndNode: endNode,
      playerMoveCount: 0,
    }

    setCurrentDrillGame(resetGame)
    setAnalysisEnabled(false)
    setWaitingForMaiaResponse(false)
    setContinueAnalyzingMode(false)
  }, [currentDrill])

  return {
    // Drill state
    currentDrill,
    remainingDrills,
    completedDrills,
    currentDrillGame,
    currentDrillIndex,
    totalDrills: configuration.drillCount,
    drillSequence: configuration.drillSequence,
    isPlayerTurn,
    isDrillComplete,
    isAtOpeningEnd,

    // Tree controller
    gameTree: controller.gameTree,
    currentNode: controller.currentNode,
    setCurrentNode: controller.setCurrentNode,
    goToNode: controller.goToNode,
    goToNextNode: controller.goToNextNode,
    goToPreviousNode: controller.goToPreviousNode,
    goToRootNode: controller.goToRootNode,
    plyCount: controller.plyCount,
    orientation: controller.orientation,
    setOrientation: controller.setOrientation,

    // Available moves
    availableMoves,

    // Actions
    makePlayerMove,
    resetCurrentDrill,
    completeDrill,
    moveToNextDrill,
    continueAnalyzing,
    continueAnalyzingFromFinal,

    // Analysis
    analysisEnabled,
    setAnalysisEnabled,
    analysisProgress,
    setAnalysisProgress,
    continueAnalyzingMode,

    // Modal states
    showPerformanceModal,
    showFinalModal,
    currentPerformanceData,
    overallPerformanceData,
    setShowFinalModal,
    isAnalyzingDrill,

    // Reset drill session
    resetDrillSession,

    // Check if all drills are completed
    areAllDrillsCompleted,

    // Load a specific completed drill for analysis
    loadCompletedDrill,

    // Navigate to any drill by index
    navigateToDrill,

    // Show final summary modal
    showSummary,

    // Show performance modal for a specific drill or current drill
    showPerformance,

    // Show performance modal for current drill (for button handlers)
    showCurrentPerformance,

    // Analysis cache for sharing with analysis controller
    analysisCache,

    // Setter for the ensureAnalysisComplete function
    setEnsureAnalysisComplete: (fn: (nodes: GameNode[]) => Promise<void>) => {
      ensureAnalysisCompleteRef.current = fn
    },
  }
}
