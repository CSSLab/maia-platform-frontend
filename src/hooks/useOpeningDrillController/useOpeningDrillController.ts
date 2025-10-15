import { Chess } from 'chess.ts'
import { fetchGameMove } from 'src/api/play'
import { logOpeningDrill } from 'src/api/openings'
import { useLocalStorage } from '../useLocalStorage'
import { GameTree, GameNode, Color } from 'src/types'
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useContext,
} from 'react'
import { useTreeController } from '../useTreeController'
import {
  MoveAnalysis,
  EvaluationPoint,
  CompletedDrill,
  RatingPrediction,
  RatingComparison,
  OpeningDrillGame,
  DrillPerformanceData,
  DrillConfiguration,
  OpeningSelection,
} from 'src/types/openings'
import { useSound } from 'src/hooks/useSound'
import { MAIA_MODELS } from 'src/constants/common'
import { MIN_STOCKFISH_DEPTH } from 'src/constants/analysis'
import { DeepAnalysisProgress, MaiaEvaluation } from 'src/types/analysis'
import { StockfishEngineContext, MaiaEngineContext } from 'src/contexts'

const MAIA_ELO_VALUES = MAIA_MODELS.map((model) =>
  parseInt(model.replace('maia_kdd_', ''), 10),
)

const getInitialAnalysisProgress = (): DeepAnalysisProgress => ({
  currentMoveIndex: 0,
  totalMoves: 0,
  currentMove: '',
  isAnalyzing: false,
  isComplete: false,
  isCancelled: false,
})

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const parsePgnToTree = (pgn: string, gameTree: GameTree): GameNode | null => {
  const rootNode = gameTree.getRoot()

  if (!pgn || pgn.trim() === '') return rootNode

  const chess = new Chess()
  if (rootNode?.fen && chess.fen() !== rootNode.fen) {
    chess.load(rootNode.fen)
  }

  let currentNode = rootNode

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
        // Add along the mainline so the opening becomes the tree's main line
        const newNode = gameTree.addMainlineNode(
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
  const { playMoveSound } = useSound()
  const [currentDrill, setCurrentDrill] = useState<OpeningSelection | null>(
    null,
  )
  const [currentDrillGame, setCurrentDrillGame] =
    useState<OpeningDrillGame | null>(null)
  const [analysisEnabled, setAnalysisEnabled] = useState(false)
  const [completedDrills, setCompletedDrills] = useState<CompletedDrill[]>([])
  const [currentDrillNumber, setCurrentDrillNumber] = useState(0)
  const attemptCountersRef = useRef<Record<string, number>>({})
  const baseSelectionsRef = useRef<OpeningSelection[]>(configuration.selections)
  const [initialCycleComplete, setInitialCycleComplete] = useState(false)
  const [initialDrillPointer, setInitialDrillPointer] = useState(-1)

  const [showPerformanceModal, setShowPerformanceModal] = useState(false)
  const [currentPerformanceData, setCurrentPerformanceData] =
    useState<DrillPerformanceData | null>(null)
  const [isAnalyzingDrill, setIsAnalyzingDrill] = useState(false)
  const [waitingForMaiaResponse, setWaitingForMaiaResponse] = useState(false)
  const [continueAnalyzingMode, setContinueAnalyzingMode] = useState(false)

  const stockfish = useContext(StockfishEngineContext)
  const maiaEngine = useContext(MaiaEngineContext)
  const { maia: maiaInstance, status: maiaStatus } = maiaEngine

  const analysisCancellationRef = useRef(false)
  const [drillAnalysisProgress, setDrillAnalysisProgress] =
    useState<DeepAnalysisProgress>(getInitialAnalysisProgress())

  const [currentMaiaModel, setCurrentMaiaModel] = useLocalStorage(
    'currentMaiaModel',
    MAIA_MODELS[0],
  )

  const createDrillInstance = useCallback(
    (selection: OpeningSelection): OpeningSelection => {
      const templateId = selection.id
      const nextAttempt = (attemptCountersRef.current[templateId] ?? 0) + 1
      attemptCountersRef.current[templateId] = nextAttempt

      const instanceId = `${templateId}__attempt_${nextAttempt}`

      return {
        ...selection,
        id: instanceId,
      }
    },
    [],
  )

  const assignNextDrill = useCallback(() => {
    const selections = baseSelectionsRef.current

    if (!selections.length) {
      setCurrentDrill(null)
      setCurrentDrillNumber(0)
      setInitialDrillPointer(-1)
      return null
    }

    if (!initialCycleComplete && initialDrillPointer < selections.length - 1) {
      const nextIndex = initialDrillPointer + 1
      const instance = createDrillInstance(selections[nextIndex])
      setCurrentDrill(instance)
      setInitialDrillPointer(nextIndex)
      setCurrentDrillNumber((prev) => (prev <= 0 ? 1 : prev + 1))
      return instance
    }

    if (!initialCycleComplete) {
      setInitialCycleComplete(true)
    }

    const randomIndex = Math.floor(Math.random() * selections.length)
    const instance = createDrillInstance(selections[randomIndex])
    setCurrentDrill(instance)
    setCurrentDrillNumber((prev) => prev + 1)
    return instance
  }, [createDrillInstance, initialCycleComplete, initialDrillPointer])

  useEffect(() => {
    if (!MAIA_MODELS.includes(currentMaiaModel)) {
      setCurrentMaiaModel(MAIA_MODELS[0])
    }
  }, [currentMaiaModel, setCurrentMaiaModel])

  useEffect(() => {
    baseSelectionsRef.current = configuration.selections
    attemptCountersRef.current = {}
    setCompletedDrills([])
    setInitialCycleComplete(false)
    setInitialDrillPointer(-1)
    setCurrentDrillNumber(0)
    setShowPerformanceModal(false)
    setCurrentPerformanceData(null)
    setCurrentDrillGame(null)
    analysisCancellationRef.current = false
    setDrillAnalysisProgress(getInitialAnalysisProgress())

    if (!configuration.selections.length) {
      setCurrentDrill(null)
      return
    }

    const firstSelection = createDrillInstance(configuration.selections[0])
    setCurrentDrill(firstSelection)
    setInitialDrillPointer(0)
    setCurrentDrillNumber(1)
    setWaitingForMaiaResponse(false)
    setContinueAnalyzingMode(false)
  }, [configuration.selections, createDrillInstance])

  useEffect(() => {
    if (!currentDrill) {
      setCurrentDrillGame(null)
      return
    }

    const startingFen =
      currentDrill.variation?.setupFen ||
      currentDrill.opening.setupFen ||
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
  }, [currentDrill])

  const fallbackGameTree = useMemo(
    () => new GameTree(new Chess().fen()),
    [],
  )

  const gameTree = currentDrillGame?.tree || fallbackGameTree

  // Delegate navigation/orientation to the shared tree controller
  const treeController = useTreeController(
    gameTree,
    (currentDrill?.playerColor as Color) || 'white',
  )

  useEffect(() => {
    if (currentDrillGame && currentDrillGame.moves.length === 0) {
      if (currentDrillGame.openingEndNode) {
        treeController.setCurrentNode(currentDrillGame.openingEndNode)
      } else if (currentDrillGame.tree) {
        treeController.setCurrentNode(currentDrillGame.tree.getRoot())
      }
    }
  }, [currentDrillGame?.id, treeController])

  const isPlayerTurn = useMemo(() => {
    if (!currentDrillGame || !treeController.currentNode) return true
    const chess = new Chess(treeController.currentNode.fen)
    const currentTurn = chess.turn() === 'w' ? 'white' : 'black'
    return currentTurn === currentDrill?.playerColor
  }, [currentDrillGame, treeController.currentNode, currentDrill?.playerColor])

  const isDrillComplete = useMemo(() => {
    if (!currentDrillGame || !currentDrill) return false
    return (
      currentDrillGame.playerMoveCount >= currentDrill.targetMoveNumber &&
      !continueAnalyzingMode
    )
  }, [currentDrillGame, currentDrill, continueAnalyzingMode])

  const isAtOpeningEnd = useMemo(() => {
    if (!currentDrillGame || !treeController.currentNode) return false
    return treeController.currentNode === currentDrillGame.openingEndNode
  }, [currentDrillGame, treeController.currentNode])

  const availableMoves = useMemo(() => {
    if (!treeController.currentNode || !isPlayerTurn)
      return new Map<string, string[]>()

    const moveMap = new Map<string, string[]>()
    const chess = new Chess(treeController.currentNode.fen)
    const legalMoves = chess.moves({ verbose: true })

    legalMoves.forEach((move) => {
      const { from, to } = move
      moveMap.set(from, (moveMap.get(from) ?? []).concat([to]))
    })

    return moveMap
  }, [treeController.currentNode, isPlayerTurn])

  // Function to evaluate drill performance by extracting analysis from GameTree nodes
  const evaluateDrillPerformance = useCallback(
    async (drillGame: OpeningDrillGame): Promise<DrillPerformanceData> => {
      const { selection } = drillGame
      const finalNode = treeController.currentNode || drillGame.tree.getRoot()
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
    [treeController.currentNode],
  )

  const ensureMaiaForNode = useCallback(
    async (node: GameNode) => {
      const existingMaia = node.analysis.maia
      const hasAllMaiaModels =
        existingMaia && MAIA_MODELS.every((model) => existingMaia[model])

      if (hasAllMaiaModels || analysisCancellationRef.current) {
        return
      }

      let retries = 0
      const maxRetries = 50

      while (
        maiaStatus !== 'ready' &&
        retries < maxRetries &&
        !analysisCancellationRef.current
      ) {
        await delay(100)
        retries++
      }

      if (
        maiaStatus !== 'ready' ||
        !maiaInstance ||
        analysisCancellationRef.current
      ) {
        return
      }

      try {
        const boards = Array(MAIA_MODELS.length).fill(node.fen)
        const { result } = await maiaInstance.batchEvaluate(
          boards,
          MAIA_ELO_VALUES,
          MAIA_ELO_VALUES,
        )

        const maiaEvaluations: { [rating: string]: MaiaEvaluation } = {}
        MAIA_MODELS.forEach((model, index) => {
          maiaEvaluations[model] = result[index]
        })

        node.addMaiaAnalysis(maiaEvaluations, currentMaiaModel)
      } catch (error) {
        console.error('Failed to compute Maia analysis for drill node:', error)
      }
    },
    [currentMaiaModel, maiaInstance, maiaStatus],
  )

  const ensureStockfishForNode = useCallback(
    async (node: GameNode) => {
      const existingStockfish = node.analysis.stockfish
      if (
        (existingStockfish && existingStockfish.depth >= MIN_STOCKFISH_DEPTH) ||
        analysisCancellationRef.current
      ) {
        return
      }

      const chess = new Chess(node.fen)
      const legalMoveCount = chess.moves().length

      if (legalMoveCount === 0) {
        return
      }

      let retries = 0
      const maxRetries = 50

      while (
        !stockfish.isReady() &&
        retries < maxRetries &&
        !analysisCancellationRef.current
      ) {
        await delay(100)
        retries++
      }

      if (!stockfish.isReady() || analysisCancellationRef.current) {
        return
      }

      const evaluationStream = stockfish.streamEvaluations(
        node.fen,
        legalMoveCount,
        MIN_STOCKFISH_DEPTH,
      )

      if (!evaluationStream) {
        return
      }

      try {
        for await (const evaluation of evaluationStream) {
          if (analysisCancellationRef.current) {
            break
          }

          node.addStockfishAnalysis(evaluation, currentMaiaModel)

          if (evaluation.depth >= MIN_STOCKFISH_DEPTH) {
            break
          }
        }
      } catch (error) {
        console.error(
          'Failed to compute Stockfish analysis for drill node:',
          error,
        )
      } finally {
        stockfish.stopEvaluation()
      }
    },
    [currentMaiaModel, stockfish],
  )

  const ensureDrillAnalysis = useCallback(
    async (drillGame: OpeningDrillGame): Promise<boolean> => {
      const mainLine = drillGame.tree.getMainLine()
      const startingNode = drillGame.openingEndNode || mainLine[0]
      const startIndex = startingNode
        ? Math.max(mainLine.indexOf(startingNode), 0)
        : 0
      const nodesToAnalyze = mainLine.slice(startIndex)

      const nodesNeedingAnalysis = nodesToAnalyze.filter((node) => {
        const maiaData = node.analysis.maia
        const needsMaia =
          !maiaData || MAIA_MODELS.some((model) => !maiaData[model])
        const stockfishData = node.analysis.stockfish
        const needsStockfish =
          !stockfishData || stockfishData.depth < MIN_STOCKFISH_DEPTH
        return needsMaia || needsStockfish
      })

      if (nodesNeedingAnalysis.length === 0) {
        setDrillAnalysisProgress((prev) => ({
          ...prev,
          currentMoveIndex: 0,
          totalMoves: 0,
          currentMove: '',
          isAnalyzing: false,
          isComplete: true,
          isCancelled: false,
        }))
        return true
      }

      analysisCancellationRef.current = false

      setDrillAnalysisProgress({
        ...getInitialAnalysisProgress(),
        totalMoves: nodesNeedingAnalysis.length,
        isAnalyzing: true,
      })

      for (let i = 0; i < nodesNeedingAnalysis.length; i++) {
        if (analysisCancellationRef.current) {
          break
        }

        const node = nodesNeedingAnalysis[i]
        const moveLabel =
          node.san || node.move || `Position ${startIndex + i + 1}`

        setDrillAnalysisProgress((prev) => ({
          ...prev,
          currentMoveIndex: i + 1,
          currentMove: moveLabel,
        }))

        await ensureMaiaForNode(node)
        if (analysisCancellationRef.current) {
          break
        }

        await ensureStockfishForNode(node)
      }

      const wasCancelled = analysisCancellationRef.current

      setDrillAnalysisProgress((prev) => ({
        ...prev,
        isAnalyzing: false,
        isComplete: !wasCancelled,
        isCancelled: wasCancelled,
      }))

      analysisCancellationRef.current = false

      return !wasCancelled
    },
    [ensureMaiaForNode, ensureStockfishForNode, setDrillAnalysisProgress],
  )

  const cancelDrillAnalysis = useCallback(() => {
    analysisCancellationRef.current = true
    stockfish.stopEvaluation()
    setDrillAnalysisProgress((prev) => ({
      ...prev,
      isAnalyzing: false,
      isCancelled: true,
    }))
    setIsAnalyzingDrill(false)
  }, [setIsAnalyzingDrill, stockfish])

  const completeDrill = useCallback(
    async (gameToComplete?: OpeningDrillGame) => {
      const drillGame = gameToComplete || currentDrillGame
      if (!drillGame) return

      try {
        setIsAnalyzingDrill(true)

        // Submit drill data to backend once the drill is complete
        try {
          await logOpeningDrill({
            opening_fen: drillGame.selection.variation
              ? drillGame.selection.variation.fen
              : drillGame.selection.opening.fen,
            side_played: drillGame.selection.playerColor,
            opponent: drillGame.selection.maiaVersion,
            num_moves: drillGame.moves.length,
            moves_played_uci: drillGame.moves,
          })
        } catch (error) {
          console.error('Failed to log opening drill:', error)
          // Continue even if backend submission fails
        }

        const analysisSuccessful = await ensureDrillAnalysis(drillGame)
        if (!analysisSuccessful) {
          return
        }

        // Simple performance evaluation without complex analysis tracking

        const performanceData = await evaluateDrillPerformance(drillGame)
        setCurrentPerformanceData(performanceData)
        setCompletedDrills((prev) => [...prev, performanceData.drill])

        // Simplified: just show the performance modal

        setShowPerformanceModal(true)
      } catch (error) {
        console.error('Error completing drill analysis:', error)
        setShowPerformanceModal(true)
      } finally {
        setIsAnalyzingDrill(false)
      }
    },
    [currentDrillGame, ensureDrillAnalysis, evaluateDrillPerformance],
  )

  const moveToNextDrill = useCallback(() => {
    setShowPerformanceModal(false)
    setCurrentPerformanceData(null)
    setContinueAnalyzingMode(false)
    setAnalysisEnabled(false)
    setWaitingForMaiaResponse(false)
    analysisCancellationRef.current = false
    setDrillAnalysisProgress(getInitialAnalysisProgress())
    setCurrentDrillGame(null)
    assignNextDrill()
  }, [assignNextDrill])

  // Continue analyzing current drill
  const continueAnalyzing = useCallback(() => {
    setShowPerformanceModal(false)
    setAnalysisEnabled(true)
    setContinueAnalyzingMode(true)
    setWaitingForMaiaResponse(false)
  }, [])

  const showPerformance = useCallback(async () => {
    if (!currentDrillGame) return

    try {
      setIsAnalyzingDrill(true)
      const analysisSuccessful = await ensureDrillAnalysis(currentDrillGame)
      if (!analysisSuccessful) {
        return
      }
      const performanceData = await evaluateDrillPerformance(currentDrillGame)
      setCurrentPerformanceData(performanceData)
      setShowPerformanceModal(true)
    } catch (error) {
      console.error('Error analyzing current drill performance:', error)
    } finally {
      setIsAnalyzingDrill(false)
    }
  }, [currentDrillGame, ensureDrillAnalysis, evaluateDrillPerformance])

  // Shows performance modal for current drill
  const showCurrentPerformance = useCallback(() => {
    showPerformance()
  }, [showPerformance])

  // Reset drill to start over
  const resetDrillSession = useCallback(() => {
    attemptCountersRef.current = {}
    setCompletedDrills([])
    setInitialCycleComplete(false)
    setInitialDrillPointer(-1)
    setCurrentDrillNumber(0)
    setCurrentDrill(null)
    setCurrentDrillGame(null)
    setAnalysisEnabled(false)
    setContinueAnalyzingMode(false)
    setShowPerformanceModal(false)
    setCurrentPerformanceData(null)
    setWaitingForMaiaResponse(false)
    analysisCancellationRef.current = false
    setDrillAnalysisProgress(getInitialAnalysisProgress())

    if (!baseSelectionsRef.current.length) {
      return
    }

    const firstInstance = createDrillInstance(baseSelectionsRef.current[0])
    setCurrentDrill(firstInstance)
    setInitialDrillPointer(0)
    setCurrentDrillNumber(1)
  }, [createDrillInstance])

  // Make a move for the player
  const makePlayerMove = useCallback(
    async (moveUci: string, fromNode?: GameNode) => {
      if (!currentDrillGame || !treeController.currentNode || !isPlayerTurn)
        return

      try {
        const nodeToMoveFrom = fromNode || treeController.currentNode

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
            newNode = nodeToMoveFrom.addChild(
              chess.fen(),
              moveUci,
              moveObj.san,
              false,
              currentMaiaModel,
            )
          } else {
            newNode = nodeToMoveFrom.addChild(
              chess.fen(),
              moveUci,
              moveObj.san,
              true,
              currentMaiaModel,
            )
          }
        }

        if (newNode) {
          treeController.setCurrentNode(newNode)

          // Simply increment the player move count since this function is only called for player moves
          const updatedPlayerMoveCount = currentDrillGame.playerMoveCount + 1

          // Update the moves array by getting all moves after the opening
          const mainLine = gameTree.getMainLine()
          const openingLength = currentDrillGame.openingEndNode
            ? currentDrillGame.openingEndNode.getPath().length
            : 1
          const movesAfterOpening = mainLine.slice(openingLength)

          const updatedGame = {
            ...currentDrillGame,
            moves: movesAfterOpening
              .map((node) => node.move)
              .filter(Boolean) as string[],
            currentFen: newNode.fen,
            playerMoveCount: updatedPlayerMoveCount,
          }

          setCurrentDrillGame(updatedGame)

          console.log('After player move - game tree state:', {
            mainLineLength: gameTree.getMainLine().length,
            updatedGameMovesLength: updatedGame.moves.length,
            currentNodeFen: newNode.fen,
            playerMoveCount: updatedPlayerMoveCount,
          })

          if (!continueAnalyzingMode) {
            console.log(
              'Setting waitingForMaiaResponse to true after player move',
            )
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
      treeController.currentNode,
      gameTree,
      isPlayerTurn,
      currentDrill,
      completeDrill,
      continueAnalyzingMode,
      treeController,
    ],
  )

  const makeMaiaMove = useCallback(
    async (_fromNode: GameNode | null) => {
      if (!currentDrillGame || !currentDrill) return

      try {
        // Always respond from the tip of the main line, regardless of current view
        const tipNode = gameTree.getLastMainlineNode()
        const path = tipNode.getPath()
        const response = await fetchGameMove(
          [],
          currentDrill.maiaVersion,
          tipNode.fen,
          null,
          0,
          0,
        )

        console.log('Maia response:', response)
        const maiaMove = response.top_move

        if (maiaMove && maiaMove.length >= 4) {
          let newNode: GameNode | null = null
          const chess = new Chess(tipNode.fen)

          const existingChild = tipNode.children.find(
            (child: GameNode) => child.move === maiaMove,
          )

          if (existingChild) {
            newNode = existingChild
          } else {
            const moveObj = chess.move(maiaMove, { sloppy: true })

            if (moveObj) {
              newNode = tipNode.addChild(
                chess.fen(),
                maiaMove,
                moveObj.san,
                true,
              )
            }
          }

          if (newNode) {
            treeController.setCurrentNode(newNode)

            const tempChess = new Chess(tipNode.fen)
            const tempMoveObj = tempChess.move(maiaMove, { sloppy: true })
            const isCapture = tempMoveObj?.captured !== undefined
            playMoveSound(isCapture)

            // Update the moves array by getting all moves after the opening
            const mainLine = gameTree.getMainLine()
            const openingLength = currentDrillGame.openingEndNode
              ? currentDrillGame.openingEndNode.getPath().length
              : 1
            const movesAfterOpening = mainLine.slice(openingLength)

            const updatedGame = {
              ...currentDrillGame,
              moves: movesAfterOpening
                .map((node) => node.move)
                .filter(Boolean) as string[],
              currentFen: newNode.fen,
              // Don't change playerMoveCount when Maia makes a move
              playerMoveCount: currentDrillGame.playerMoveCount,
            }

            setCurrentDrillGame(updatedGame)
            setWaitingForMaiaResponse(false)

            console.log('After Maia move - game tree state:', {
              mainLineLength: gameTree.getMainLine().length,
              updatedGameMovesLength: updatedGame.moves.length,
              currentNodeFen: newNode.fen,
            })
          }
        }
      } catch (error) {
        console.error('Error making Maia move:', error)
      }
    },
    [currentDrillGame, gameTree, currentDrill],
  )

  // This ref stores the move-making function to ensure the `useEffect` has the latest version
  const makeMaiaMoveRef = useRef(makeMaiaMove)
  useEffect(() => {
    makeMaiaMoveRef.current = makeMaiaMove
  })

  // Handle Maia's response after player moves
  useEffect(() => {
    console.log('Maia response useEffect triggered:', {
      currentDrillGame: !!currentDrillGame,
      currentNode: !!treeController.currentNode,
      isPlayerTurn,
      waitingForMaiaResponse,
      isDrillComplete,
      continueAnalyzingMode,
    })

    if (
      currentDrillGame &&
      waitingForMaiaResponse &&
      !isDrillComplete &&
      !continueAnalyzingMode
    ) {
      // Decide based on the tip of the main line, not the viewed node
      const tip = gameTree.getLastMainlineNode()
      const chess = new Chess(tip.fen)
      const playerTurnsColor = currentDrill?.playerColor === 'white' ? 'w' : 'b'
      const isMaiaTurnAtTip = chess.turn() !== playerTurnsColor

      if (isMaiaTurnAtTip) {
        console.log('Scheduling Maia move at tip in 1500ms')
        const timeoutId = setTimeout(() => {
          console.log('Executing Maia move at tip')
          makeMaiaMoveRef.current(tip)
        }, 1500)
        return () => clearTimeout(timeoutId)
      }
    }
  }, [
    currentDrillGame,
    waitingForMaiaResponse,
    isDrillComplete,
    continueAnalyzingMode,
    gameTree,
    currentDrill,
  ])

  // Handle initial Maia move if needed
  useEffect(() => {
    if (
      currentDrillGame &&
      treeController.currentNode &&
      !isPlayerTurn &&
      currentDrillGame.moves.length === 0 &&
      currentDrillGame.openingEndNode &&
      treeController.currentNode === currentDrillGame.openingEndNode &&
      !isDrillComplete &&
      !continueAnalyzingMode
    ) {
      setWaitingForMaiaResponse(true)
      const timeoutId = setTimeout(() => {
        const tip = gameTree.getLastMainlineNode()
        makeMaiaMoveRef.current(tip)
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [
    currentDrillGame,
    treeController.currentNode,
    isPlayerTurn,
    isDrillComplete,
    continueAnalyzingMode,
    gameTree,
  ])

  // Reset current drill to starting position
  const resetCurrentDrill = useCallback(() => {
    if (!currentDrill) return

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
    currentDrillGame,
    currentDrillNumber,
    selectionPool: configuration.selections,
    completedDrills,
    hasCompletedInitialCycle: initialCycleComplete,
    isPlayerTurn,
    isDrillComplete,
    isAtOpeningEnd,

    // Tree controller
    gameTree,
    currentNode: treeController.currentNode,
    setCurrentNode: treeController.setCurrentNode,
    goToNode: treeController.goToNode,
    goToNextNode: treeController.goToNextNode,
    goToPreviousNode: treeController.goToPreviousNode,
    goToRootNode: treeController.goToRootNode,
    plyCount: treeController.plyCount,
    orientation: treeController.orientation,
    setOrientation: treeController.setOrientation,

    // Available moves
    availableMoves,

    // Actions
    makePlayerMove,
    resetCurrentDrill,
    completeDrill,
    moveToNextDrill,
    continueAnalyzing,

    // Analysis
    analysisEnabled,
    setAnalysisEnabled,
    continueAnalyzingMode,
    drillAnalysisProgress,
    cancelDrillAnalysis,

    // Modal states
    showPerformanceModal,
    currentPerformanceData,
    isAnalyzingDrill,

    // Reset drill session
    resetDrillSession,

    // Show performance modal for current drill
    showCurrentPerformance,
  }
}
