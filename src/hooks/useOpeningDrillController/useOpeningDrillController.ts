import { Chess } from 'chess.ts'
import { fetchGameMove } from 'src/api/play'
import { submitOpeningDrill } from 'src/api/openings'
import { useLocalStorage } from '../useLocalStorage'
import { GameTree, GameNode, Color } from 'src/types'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
} from 'src/types/openings'
import { useSound } from 'src/hooks/useSound'
import { MAIA_MODELS } from 'src/constants/common'
import { MIN_STOCKFISH_DEPTH } from 'src/constants/analysis'

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
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0)
  const [currentDrillGame, setCurrentDrillGame] =
    useState<OpeningDrillGame | null>(null)
  const [analysisEnabled, setAnalysisEnabled] = useState(false)
  const currentDrill = configuration.selections[currentDrillIndex] || null

  const [showPerformanceModal, setShowPerformanceModal] = useState(false)
  const [currentPerformanceData, setCurrentPerformanceData] =
    useState<DrillPerformanceData | null>(null)
  const [isAnalyzingDrill, setIsAnalyzingDrill] = useState(false)
  const [waitingForMaiaResponse, setWaitingForMaiaResponse] = useState(false)
  const [continueAnalyzingMode, setContinueAnalyzingMode] = useState(false)

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
    if (configuration.selections.length > 0 && !currentDrillGame) {
      setCurrentDrillIndex(0)
    }
  }, [configuration.selections, currentDrillGame])

  useEffect(() => {
    if (!currentDrill) return

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
  }, [currentDrill?.id])

  const gameTree = currentDrillGame?.tree || new GameTree(new Chess().fen())

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

  // Simplified: drills never "complete" - they cycle infinitely
  const areAllDrillsCompleted = false

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

  const completeDrill = useCallback(
    async (gameToComplete?: OpeningDrillGame) => {
      const drillGame = gameToComplete || currentDrillGame
      if (!drillGame) return

      try {
        setIsAnalyzingDrill(true)

        // Submit drill data to backend if session ID is available
        if (configuration.sessionId) {
          try {
            await submitOpeningDrill({
              session_id: configuration.sessionId,
              opening_fen: drillGame.selection.variation
                ? drillGame.selection.variation.fen
                : drillGame.selection.opening.fen,
              side_played: drillGame.selection.playerColor,
              moves_played_uci: drillGame.moves,
            })
          } catch (error) {
            console.error('Failed to submit drill to backend:', error)
            // Continue even if backend submission fails
          }
        }

        // Simple performance evaluation without complex analysis tracking

        const performanceData = await evaluateDrillPerformance(drillGame)
        setCurrentPerformanceData(performanceData)

        // Simplified: just show the performance modal

        setShowPerformanceModal(true)
      } catch (error) {
        console.error('Error completing drill analysis:', error)
        setShowPerformanceModal(true)
      } finally {
        setIsAnalyzingDrill(false)
      }
    },
    [currentDrillGame, evaluateDrillPerformance, configuration.sessionId],
  )

  const moveToNextDrill = useCallback(async () => {
    // Submit drill data to backend if session ID is available
    if (configuration.sessionId && currentDrillGame) {
      try {
        await submitOpeningDrill({
          session_id: configuration.sessionId,
          opening_fen: currentDrillGame.selection.variation
            ? currentDrillGame.selection.variation.fen
            : currentDrillGame.selection.opening.fen,
          side_played: currentDrillGame.selection.playerColor,
          moves_played_uci: currentDrillGame.moves,
        })
      } catch (error) {
        console.error('Failed to submit drill to backend:', error)
      }
    }

    setShowPerformanceModal(false)
    setCurrentPerformanceData(null)
    setContinueAnalyzingMode(false)
    setAnalysisEnabled(false)

    // Cycle to next drill, or back to first if at end
    const nextIndex = (currentDrillIndex + 1) % configuration.selections.length
    setCurrentDrillIndex(nextIndex)
  }, [
    currentDrillIndex,
    configuration.selections,
    configuration.sessionId,
    currentDrillGame,
  ])

  // Navigate to a specific drill by index
  const navigateToDrill = useCallback(
    (index: number) => {
      if (
        index < 0 ||
        index >=
          (configuration.selections ? configuration.selections.length : 0)
      )
        return

      setShowPerformanceModal(false)
      setCurrentPerformanceData(null)
      setContinueAnalyzingMode(false)
      setAnalysisEnabled(false)
      setWaitingForMaiaResponse(false)
      setCurrentDrillIndex(index)
    },
    [configuration.selections],
  )

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
      const performanceData = await evaluateDrillPerformance(currentDrillGame)
      setCurrentPerformanceData(performanceData)
      setShowPerformanceModal(true)
    } catch (error) {
      console.error('Error analyzing current drill performance:', error)
    } finally {
      setIsAnalyzingDrill(false)
    }
  }, [currentDrillGame, evaluateDrillPerformance])

  // Shows performance modal for current drill
  const showCurrentPerformance = useCallback(() => {
    showPerformance()
  }, [showPerformance])

  // Reset drill to start over
  const resetDrillSession = useCallback(() => {
    setCurrentDrillIndex(0)
    setCurrentDrillGame(null)
    setAnalysisEnabled(false)
    setContinueAnalyzingMode(false)
    setShowPerformanceModal(false)
    setCurrentPerformanceData(null)
    setWaitingForMaiaResponse(false)
  }, [])

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
    currentDrillIndex,
    totalDrills: configuration.selections.length,
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
    navigateToDrill,

    // Analysis
    analysisEnabled,
    setAnalysisEnabled,
    continueAnalyzingMode,

    // Modal states
    showPerformanceModal,
    currentPerformanceData,
    isAnalyzingDrill,

    // Reset drill session
    resetDrillSession,

    // Show performance modal for current drill
    showCurrentPerformance,

    // Simplified - no complex session tracking
    areAllDrillsCompleted,
  }
}
