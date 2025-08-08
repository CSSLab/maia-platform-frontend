import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import {
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  Suspense,
  lazy,
} from 'react'
import { Chess, PieceSymbol } from 'chess.ts'
import { AnimatePresence, motion } from 'framer-motion'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'

import {
  WindowSizeContext,
  TreeControllerContext,
  AuthContext,
  MaiaEngineContext,
} from 'src/contexts'
import { DrillConfiguration, AnalyzedGame, EcoDatabase } from 'src/types'
import { GameNode } from 'src/types/base/tree'
import { MIN_STOCKFISH_DEPTH } from 'src/constants/analysis'
import openings from 'src/lib/openings/openings.json'
import { getComprehensiveOpenings } from 'src/lib/openings'

const LazyOpeningDrillAnalysis = lazy(() =>
  import('src/components/Openings/OpeningDrillAnalysis').then((module) => ({
    default: module.OpeningDrillAnalysis,
  })),
)

import {
  OpeningSelectionModal,
  OpeningDrillSidebar,
  DrillPerformanceModal,
  FinalCompletionModal,
  GameBoard,
  BoardController,
  MovesContainer,
  PromotionOverlay,
  PlayerInfo,
  DownloadModelModal,
  AuthenticatedWrapper,
} from 'src/components'
import {
  useOpeningDrillController,
  useTreeController,
  useAnalysisController,
} from 'src/hooks'
import {
  getCurrentPlayer,
  getAvailableMovesArray,
  requiresPromotion,
} from 'src/lib/train/utils'

const OpeningsPage: NextPage = () => {
  const router = useRouter()
  const { user } = useContext(AuthContext)
  const [showSelectionModal, setShowSelectionModal] = useState(true)
  const [isReopenedModal, setIsReopenedModal] = useState(false)

  // Load comprehensive ECO database (async, TSV-backed)
  const [ecoDatabase, setEcoDatabase] = useState<EcoDatabase>({
    meta: {
      title: 'Loading ECO Database',
      description: 'Loading...',
      version: 'pending',
      totalOpenings: 0,
      ecoSections: [],
    },
    openings: {},
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const db = await getComprehensiveOpenings()
        if (!cancelled) setEcoDatabase(db)
      } catch (error) {
        console.error('Failed to load comprehensive openings database:', error)
        if (!cancelled) {
          setEcoDatabase({
            meta: {
              title: 'Fallback ECO Database',
              description: 'Minimal database for error handling',
              version: '1.0.0',
              totalOpenings: 0,
              ecoSections: [],
            },
            openings: {},
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleCloseModal = () => {
    if (isReopenedModal) {
      setShowSelectionModal(false)
    } else {
      router.push('/')
    }
  }
  const [drillConfiguration, setDrillConfiguration] =
    useState<DrillConfiguration | null>(null)
  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)
  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)

  // useEffect(() => {
  //   if (user !== null && !user.lichessId) {
  //     router.push('/401')
  //   }
  // }, [user, router])

  useEffect(() => {
    return () => {
      setHoverArrow(null)
      setPromotionFromTo(null)
    }
  }, [])

  const deferHeavyOperation = useCallback((callback: () => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(callback, { timeout: 1000 })
    } else {
      setTimeout(callback, 0)
    }
  }, [])

  const emptyConfiguration: DrillConfiguration = {
    selections: [],
    drillCount: 0,
    drillSequence: [],
  }

  const controller = useOpeningDrillController(
    drillConfiguration || emptyConfiguration,
  )
  const { isMobile } = useContext(WindowSizeContext)

  const playerNames = useMemo(() => {
    if (!controller.currentDrill) return null

    const maiaName = controller.currentDrill.maiaVersion.replace(
      'maia_kdd_',
      'Maia ',
    )
    const maiaRating = parseInt(controller.currentDrill.maiaVersion.slice(-4))

    return {
      blackPlayer: {
        name:
          controller.currentDrill.playerColor === 'black' ? 'You' : maiaName,
        rating:
          controller.currentDrill.playerColor === 'black'
            ? undefined
            : maiaRating,
      },
      whitePlayer: {
        name:
          controller.currentDrill.playerColor === 'white' ? 'You' : maiaName,
        rating:
          controller.currentDrill.playerColor === 'white'
            ? undefined
            : maiaRating,
      },
    }
  }, [
    controller.currentDrill?.playerColor,
    controller.currentDrill?.maiaVersion,
  ])

  const treeController = useTreeController(
    controller.gameTree || null,
    controller.currentDrill?.playerColor || 'white',
  )

  const maiaEngine = useContext(MaiaEngineContext)

  // Sync tree controller with opening drill controller
  useEffect(() => {
    if (controller.currentNode && treeController.setCurrentNode) {
      treeController.setCurrentNode(controller.currentNode)
    }
  }, [controller.currentNode, treeController.setCurrentNode])

  // Memoize arrow calculations to reduce re-renders
  const calculatedArrows = useMemo(() => {
    if (!controller.analysisEnabled || !treeController.currentNode) {
      return []
    }

    const arr: DrawShape[] = []
    const currentNode = treeController.currentNode

    // Show Maia best move if available
    if (currentNode.analysis?.maia?.['maia_kdd_1500']?.policy) {
      const maiaPolicy = currentNode.analysis.maia['maia_kdd_1500'].policy
      const maiaEntries = Object.entries(maiaPolicy)
      if (maiaEntries.length > 0) {
        const bestMove = maiaEntries.reduce((a, b) =>
          maiaPolicy[a[0]] > maiaPolicy[b[0]] ? a : b,
        )
        arr.push({
          brush: 'red',
          orig: bestMove[0].slice(0, 2) as Key,
          dest: bestMove[0].slice(2, 4) as Key,
        } as DrawShape)
      }
    }

    // Show Stockfish best move if available
    if (currentNode.analysis?.stockfish?.cp_vec) {
      const stockfishEntries = Object.entries(
        currentNode.analysis.stockfish.cp_vec,
      )
      if (stockfishEntries.length > 0) {
        const vec = currentNode.analysis.stockfish.cp_vec
        const bestMove = stockfishEntries.reduce((a, b) =>
          vec[a[0]] > vec[b[0]] ? a : b,
        )
        arr.push({
          brush: 'blue',
          orig: bestMove[0].slice(0, 2) as Key,
          dest: bestMove[0].slice(2, 4) as Key,
          modifiers: { lineWidth: 8 },
        })
      }
    }

    return arr
  }, [
    controller.analysisEnabled,
    treeController.currentNode?.analysis?.maia,
    treeController.currentNode?.analysis?.stockfish,
  ])

  // Clear hover arrow when node changes
  useEffect(() => {
    setHoverArrow(null)
  }, [controller.currentNode])

  // Hover function for analysis components
  const hover = useCallback((move?: string) => {
    if (move) {
      setHoverArrow({
        orig: move.slice(0, 2) as Key,
        dest: move.slice(2, 4) as Key,
        brush: 'green',
        modifiers: { lineWidth: 10 },
      })
    } else {
      setHoverArrow(null)
    }
  }, [])

  // Custom navigation functions that respect opening end position
  const customGoToPreviousNode = useCallback(() => {
    if (!controller.isAtOpeningEnd) {
      controller.goToPreviousNode()
    }
  }, [controller])

  const customGoToRootNode = useCallback(() => {
    if (
      !controller.isAtOpeningEnd &&
      controller.currentDrillGame?.openingEndNode
    ) {
      controller.goToNode(controller.currentDrillGame.openingEndNode)
    }
  }, [controller])

  // Create minimal AnalyzedGame for analysis controller
  const analyzedGame = useMemo((): AnalyzedGame | null => {
    if (!treeController.gameTree || !controller.currentDrill || !playerNames)
      return null

    return {
      id: `opening-drill-${controller.currentDrill.id}`,
      tree: treeController.gameTree,
      blackPlayer: playerNames.blackPlayer,
      whitePlayer: playerNames.whitePlayer,
      moves: [], // Tree will be used directly
      availableMoves: [],
      gameType: 'play' as const,
      termination: {
        result: '*',
        winner: 'none' as const,
        condition: 'Normal',
      },
      maiaEvaluations: [],
      stockfishEvaluations: [],
      type: 'play' as const,
    }
  }, [treeController.gameTree, controller.currentDrill?.id, playerNames])

  // Analysis controller for the components
  const analysisController = useAnalysisController(
    analyzedGame || {
      id: 'empty',
      tree: treeController.gameTree,
      blackPlayer: { name: 'Black' },
      whitePlayer: { name: 'White' },
      moves: [],
      availableMoves: [],
      gameType: 'play' as const,
      termination: {
        result: '*',
        winner: 'none' as const,
        condition: 'Normal',
      },
      maiaEvaluations: [],
      stockfishEvaluations: [],
      type: 'play' as const,
    },
    controller.currentDrill?.playerColor || 'white',
    false, // Disable auto-saving on openings page
  )

  // Function to ensure all positions have sufficient analysis
  const ensureAnalysisComplete = useCallback(
    async (nodes: GameNode[]): Promise<void> => {
      // Use the centralized minimum depth constant

      // Filter nodes that actually need analysis to avoid redundant work
      const nodesNeedingAnalysis = nodes.filter((node) => {
        const hasStockfishAnalysis =
          node.analysis.stockfish &&
          node.analysis.stockfish.depth >= MIN_STOCKFISH_DEPTH
        const hasMaiaAnalysis =
          node.analysis.maia && Object.keys(node.analysis.maia).length > 0

        return !hasStockfishAnalysis || !hasMaiaAnalysis
      })

      if (nodesNeedingAnalysis.length === 0) {
        return // All nodes already have sufficient analysis
      }

      // Set initial progress
      if (controller.setAnalysisProgress) {
        controller.setAnalysisProgress({
          total: nodesNeedingAnalysis.length,
          completed: 0,
          currentMove: 'Starting analysis...',
        })
      }

      for (let i = 0; i < nodesNeedingAnalysis.length; i++) {
        const node = nodesNeedingAnalysis[i]

        // Update progress for current node
        if (controller.setAnalysisProgress) {
          controller.setAnalysisProgress({
            total: nodesNeedingAnalysis.length,
            completed: i,
            currentMove: `Analyzing position ${i + 1}/${nodesNeedingAnalysis.length}`,
          })
        }

        // Set this node as current to trigger analysis via the existing analysis controller
        if (analysisController && analysisController.setCurrentNode) {
          analysisController.setCurrentNode(node)

          // Wait for analysis to complete with optimized timing
          await new Promise<void>((resolve) => {
            let attempts = 0
            const maxAttempts = 150 // Reduced from 300 to 150 (15 seconds timeout)

            const checkAnalysis = () => {
              attempts++
              const hasStockfish =
                node.analysis.stockfish &&
                node.analysis.stockfish.depth >= MIN_STOCKFISH_DEPTH
              const hasMaia =
                node.analysis.maia && Object.keys(node.analysis.maia).length > 0

              if (hasStockfish && hasMaia) {
                resolve()
              } else if (attempts >= maxAttempts) {
                console.warn(`Analysis timeout for node ${node.fen}`)
                resolve()
              } else {
                setTimeout(checkAnalysis, 50) // Reduced from 100ms to 50ms for faster checking
              }
            }

            // Start checking immediately without delay
            checkAnalysis()
          })
        }
      }

      // Mark analysis as complete
      if (controller.setAnalysisProgress) {
        controller.setAnalysisProgress({
          total: nodesNeedingAnalysis.length,
          completed: nodesNeedingAnalysis.length,
          currentMove: 'Analysis complete',
        })
      }
    },
    [analysisController, controller.setAnalysisProgress],
  )

  // Pass the ensureAnalysisComplete function to the controller via ref
  useEffect(() => {
    if (controller && ensureAnalysisComplete) {
      // Store the function in the controller's ref or call a setter
      // This way the controller can access it when needed
      controller.setEnsureAnalysisComplete?.(ensureAnalysisComplete)
    }
  }, [controller, ensureAnalysisComplete])

  // Sync analysis controller with current node
  useEffect(() => {
    if (controller.currentNode && analysisController.setCurrentNode) {
      analysisController.setCurrentNode(controller.currentNode)
    }
  }, [controller.currentNode, analysisController.setCurrentNode])

  // Create game object for MovesContainer
  const gameForContainer = useMemo(() => {
    if (!treeController.gameTree) return null

    return {
      id: `opening-drill-${controller.currentDrill?.id || 'current'}`,
      tree: treeController.gameTree,
      moves: [], // Not used when tree is provided
    }
  }, [treeController.gameTree, controller.currentDrill?.id])

  // Show selection modal when no drill configuration exists
  useEffect(() => {
    if (!drillConfiguration || drillConfiguration.selections.length === 0) {
      setShowSelectionModal(true)
    }
  }, [drillConfiguration])

  const handleCompleteSelection = useCallback(
    (configuration: DrillConfiguration) => {
      setDrillConfiguration(configuration)
      setShowSelectionModal(false)
    },
    [],
  )

  const handleChangeSelections = useCallback(() => {
    controller.resetDrillSession()
    // Mark that this is a reopened modal so it just closes instead of navigating
    setIsReopenedModal(true)
    setShowSelectionModal(true)
  }, [controller])

  // No-op function for disabling orientation changes
  const noOpSetOrientation = useCallback((_orientation: 'white' | 'black') => {
    // Orientation is controlled by player color selection, not user input
  }, [])

  // Memoize available moves calculation to prevent excessive re-computation
  const availableMoves = useMemo(() => {
    if (controller.analysisEnabled || controller.continueAnalyzingMode) {
      // In continue analyzing mode, show all legal moves
      if (controller.continueAnalyzingMode) {
        const currentFen = controller.currentNode?.fen
        if (!currentFen) return new Map<string, string[]>()

        const moveMap = new Map<string, string[]>()
        const chess = new Chess(currentFen)
        const legalMoves = chess.moves({ verbose: true })

        legalMoves.forEach((move) => {
          const { from, to } = move
          moveMap.set(from, (moveMap.get(from) ?? []).concat([to]))
        })

        return moveMap
      }

      // In regular drill mode with analysis enabled:
      // Only show moves if we're at the latest position AND it's player's turn
      const isAtLatestPosition = !controller.currentNode?.mainChild
      if (isAtLatestPosition && controller.isPlayerTurn) {
        return controller.availableMoves
      }

      // If viewing previous moves or not player's turn, show no moves
      return new Map<string, string[]>()
    }

    return controller.availableMoves
  }, [
    controller.analysisEnabled,
    controller.continueAnalyzingMode,
    controller.currentNode?.fen,
    controller.currentNode?.mainChild,
    controller.isPlayerTurn,
    controller.availableMoves,
  ])

  // Player info for the board - optimized to use already computed playerNames
  const topPlayer = useMemo(() => {
    if (!controller.currentDrill || !playerNames)
      return { name: 'Unknown', color: 'black' }

    const playerColor = controller.currentDrill.playerColor
    const topPlayerColor = playerColor === 'white' ? 'black' : 'white'

    return {
      name:
        topPlayerColor === 'black'
          ? playerNames.blackPlayer.name
          : playerNames.whitePlayer.name,
      color: topPlayerColor,
    }
  }, [controller.currentDrill?.playerColor, playerNames])

  const bottomPlayer = useMemo(() => {
    if (!controller.currentDrill || !playerNames)
      return { name: 'Unknown', color: 'white' }

    const playerColor = controller.currentDrill.playerColor

    return {
      name:
        playerColor === 'black'
          ? playerNames.blackPlayer.name
          : playerNames.whitePlayer.name,
      color: playerColor,
    }
  }, [controller.currentDrill?.playerColor, playerNames])

  // Make move function for analysis components
  const makeMove = useCallback(
    async (move: string) => {
      // Allow moves when analysis is enabled OR in continue analyzing mode
      if (
        !(controller.analysisEnabled || controller.continueAnalyzingMode) ||
        !controller.currentNode ||
        !controller.gameTree
      )
        return

      if (controller.continueAnalyzingMode) {
        // In continue analyzing mode, allow moves from both sides and create variations
        const chess = new Chess(controller.currentNode.fen)
        const moveAttempt = chess.move({
          from: move.slice(0, 2),
          to: move.slice(2, 4),
          promotion: move[4] ? (move[4] as PieceSymbol) : undefined,
        })

        if (moveAttempt) {
          const newFen = chess.fen()
          const moveString =
            moveAttempt.from +
            moveAttempt.to +
            (moveAttempt.promotion ? moveAttempt.promotion : '')
          const san = moveAttempt.san

          // Use analysis page logic for variations
          if (controller.currentNode.mainChild?.move === moveString) {
            // Move matches main line, just navigate to it
            controller.setCurrentNode(controller.currentNode.mainChild)
          } else {
            // Create variation for different move
            const newVariation = controller.gameTree.addVariation(
              controller.currentNode,
              newFen,
              moveString,
              san,
              'maia_kdd_1500',
            )
            controller.setCurrentNode(newVariation)
          }
        }
      } else {
        // In regular drill mode, only allow moves when it's the player's turn
        // and use the controller's makePlayerMove method so Maia can respond
        if (!controller.isPlayerTurn) return

        await controller.makePlayerMove(move)
      }
    },
    [controller],
  )

  // Handle player moves
  const onPlayerMakeMove = useCallback(
    async (playedMove: [string, string] | null) => {
      if (!playedMove) return

      // In post-drill analysis mode, allow moves from both sides
      if (controller.continueAnalyzingMode) {
        // Calculate available moves from current drill controller position
        const chess = new Chess(controller.currentNode?.fen || '')
        const legalMoves = chess.moves({ verbose: true })
        const availableMoves = new Map<string, string[]>()

        legalMoves.forEach((move) => {
          const { from, to } = move
          availableMoves.set(
            from,
            (availableMoves.get(from) ?? []).concat([to]),
          )
        })

        // Convert Map to array format for requiresPromotion function
        const movesArray: { from: string; to: string }[] = []
        availableMoves.forEach((destinations, from) => {
          destinations.forEach((to) => {
            movesArray.push({ from, to })
          })
        })

        if (requiresPromotion(playedMove, movesArray)) {
          setPromotionFromTo(playedMove)
          return
        }

        const moveUci = playedMove[0] + playedMove[1]
        await makeMove(moveUci)
        return
      }

      // In drill mode, only allow moves when it's the player's turn
      if (!controller.isPlayerTurn) return

      const availableMoves = getAvailableMovesArray(controller.availableMoves)

      if (requiresPromotion(playedMove, availableMoves)) {
        setPromotionFromTo(playedMove)
        return
      }

      const moveUci = playedMove[0] + playedMove[1]
      await controller.makePlayerMove(moveUci)
    },
    [controller, makeMove],
  )

  const onPlayerSelectPromotion = useCallback(
    async (piece: string) => {
      if (!promotionFromTo) return

      setPromotionFromTo(null)
      const moveUci = promotionFromTo[0] + promotionFromTo[1] + piece

      // In post-drill analysis mode, use makeMove for variations
      if (controller.continueAnalyzingMode) {
        await makeMove(moveUci)
      } else {
        await controller.makePlayerMove(moveUci)
      }
    },
    [promotionFromTo, controller, makeMove],
  )

  const onSelectSquare = useCallback(() => {
    // No special handling needed for opening drills
  }, [])

  // // Don't render if user is not authenticated
  // if (user !== null && !user.lichessId) {
  //   return null
  // }

  // Show download modal if Maia model needs to be downloaded
  if (maiaEngine.status === 'no-cache' || maiaEngine.status === 'downloading') {
    return (
      <>
        <Head>
          <title>Opening Drills – Maia Chess</title>
          <meta
            name="description"
            content="Drill chess openings against Maia models calibrated to specific rating levels. Practice against opponents similar to those you'll face, with targeted training for your skill level."
          />
        </Head>
        <AnimatePresence>
          <DownloadModelModal
            progress={maiaEngine.progress}
            download={maiaEngine.downloadModel}
          />
        </AnimatePresence>
      </>
    )
  }

  // Show selection modal when no drill configuration exists (after model is ready)
  if (
    !drillConfiguration ||
    drillConfiguration.selections.length === 0 ||
    showSelectionModal
  ) {
    return (
      <>
        <Head>
          <title>Opening Drills – Maia Chess</title>
          <meta
            name="description"
            content="Drill chess openings against Maia models calibrated to specific rating levels. Practice against opponents similar to those you'll face, with targeted training for your skill level."
          />
        </Head>
        <AnimatePresence>
          <OpeningSelectionModal
            openings={openings}
            ecoDatabase={ecoDatabase}
            initialSelections={drillConfiguration?.selections || []}
            onComplete={handleCompleteSelection}
            onClose={handleCloseModal}
          />
        </AnimatePresence>
      </>
    )
  }

  const desktopLayout = () => (
    <div className="flex h-full w-full flex-col items-center py-4">
      <div className="flex h-full w-[90%] flex-row gap-2">
        {/* Left Sidebar */}
        <div className="desktop-left-column-container flex flex-col gap-2 overflow-hidden rounded">
          <div className="flex w-full flex-col">
            <OpeningDrillSidebar
              currentDrill={controller.currentDrill}
              completedDrills={controller.completedDrills}
              remainingDrills={controller.remainingDrills}
              currentDrillIndex={controller.currentDrillIndex}
              totalDrills={controller.totalDrills}
              onResetCurrentDrill={controller.resetCurrentDrill}
              onChangeSelections={handleChangeSelections}
              onLoadCompletedDrill={controller.loadCompletedDrill}
              drillSequence={controller.drillSequence}
            />
          </div>

          {/* Moves Container with Board Controller */}
          <div className="flex h-[30vh] flex-col overflow-hidden">
            {controller.currentDrillGame && (
              <div className="flex h-full flex-col">
                <div className="flex-1 overflow-hidden">
                  <MovesContainer
                    game={
                      gameForContainer || {
                        id: controller.currentDrillGame.id,
                        tree: controller.gameTree,
                        moves: [],
                      }
                    }
                    type="analysis"
                    showAnnotations={
                      controller.analysisEnabled ||
                      controller.continueAnalyzingMode
                    }
                    showVariations={controller.continueAnalyzingMode}
                  />
                </div>
                <div className="border-t border-white/10">
                  <BoardController
                    gameTree={controller.gameTree}
                    orientation={controller.orientation}
                    setOrientation={noOpSetOrientation}
                    currentNode={controller.currentNode}
                    plyCount={controller.plyCount}
                    goToNode={controller.goToNode}
                    goToNextNode={controller.goToNextNode}
                    goToPreviousNode={customGoToPreviousNode}
                    goToRootNode={customGoToRootNode}
                    disableFlip={true}
                    disablePrevious={controller.isAtOpeningEnd}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center - Board */}
        <div className="desktop-middle-column-container flex flex-col gap-2">
          <div className="flex w-full flex-col overflow-hidden rounded">
            <PlayerInfo name={topPlayer.name} color={topPlayer.color} />
            <div className="desktop-board-container relative flex aspect-square">
              <GameBoard
                currentNode={controller.currentNode}
                orientation={controller.orientation}
                availableMoves={availableMoves}
                onPlayerMakeMove={onPlayerMakeMove}
                onSelectSquare={onSelectSquare}
                shapes={
                  controller.analysisEnabled
                    ? hoverArrow
                      ? [...analysisController.arrows, hoverArrow]
                      : [...analysisController.arrows]
                    : hoverArrow
                      ? [hoverArrow]
                      : []
                }
              />
              {promotionFromTo && (
                <PromotionOverlay
                  player={getCurrentPlayer(controller.currentNode)}
                  file={promotionFromTo[1].slice(0, 1)}
                  onPlayerSelectPromotion={onPlayerSelectPromotion}
                />
              )}
            </div>
            <PlayerInfo
              name={bottomPlayer.name}
              color={bottomPlayer.color}
              showArrowLegend={controller.analysisEnabled}
            />
          </div>

          {/* Drill progress with next drill button */}
          {controller.currentDrillGame && controller.currentDrill && (
            <div className="flex w-full items-center gap-3 rounded bg-background-1 p-3">
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-secondary">Move Progress</span>
                  <span className="font-medium text-primary">
                    {controller.currentDrillGame.playerMoveCount}/
                    {controller.currentDrill.targetMoveNumber}
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-background-3">
                  <div
                    className="h-full rounded bg-human-3 transition-all duration-300"
                    style={{
                      width: `${
                        controller.currentDrill.targetMoveNumber > 0
                          ? (controller.currentDrillGame.playerMoveCount /
                              controller.currentDrill.targetMoveNumber) *
                            100
                          : 0
                      }%`,
                      maxWidth: '100%',
                    }}
                  />
                </div>
              </div>
              {controller.areAllDrillsCompleted && (
                <button
                  onClick={controller.showSummary}
                  className="rounded bg-human-3 px-4 py-2 text-sm font-medium transition-colors hover:bg-human-3/80"
                >
                  View Summary
                </button>
              )}
              {controller.currentPerformanceData &&
                !controller.showPerformanceModal && (
                  <button
                    onClick={controller.showCurrentPerformance}
                    className="rounded bg-background-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-background-3"
                  >
                    View Performance
                  </button>
                )}
              {controller.remainingDrills.length > 1 &&
                !controller.areAllDrillsCompleted && (
                  <button
                    onClick={controller.moveToNextDrill}
                    className="rounded bg-human-4 px-4 py-2 text-sm font-medium transition-colors hover:bg-human-4/80"
                  >
                    Next Drill
                  </button>
                )}
            </div>
          )}
        </div>

        {/* Right Panel - Analysis */}
        <div
          id="analysis"
          className="desktop-right-column-container flex flex-col gap-2"
        >
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <div className="text-sm text-secondary">
                  Loading analysis...
                </div>
              </div>
            }
          >
            {analyzedGame && (
              <LazyOpeningDrillAnalysis
                currentNode={controller.currentNode}
                gameTree={treeController.gameTree}
                analysisEnabled={controller.analysisEnabled}
                onToggleAnalysis={() =>
                  controller.setAnalysisEnabled(!controller.analysisEnabled)
                }
                playerColor={controller.currentDrill?.playerColor || 'white'}
                maiaVersion={
                  controller.currentDrill?.maiaVersion || 'maia_kdd_1500'
                }
                analysisController={analysisController}
                hover={hover}
                setHoverArrow={setHoverArrow}
                makeMove={makeMove}
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )

  const mobileLayout = () => (
    <div className="flex h-full flex-1 flex-col justify-center gap-1">
      <div className="flex h-full flex-col items-start justify-start gap-1">
        {/* Current Drill Info Header */}
        <div className="flex w-full flex-col bg-background-1 p-2">
          <h3 className="mb-1 text-sm font-bold text-primary">Current Drill</h3>
          {controller.currentDrill ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-primary">
                {controller.currentDrill.opening.name}
              </span>
              {controller.currentDrill.variation && (
                <>
                  <span className="text-secondary">•</span>
                  <span className="text-secondary">
                    {controller.currentDrill.variation.name}
                  </span>
                </>
              )}
              <span className="text-secondary">•</span>
              <span className="text-secondary">
                vs Maia{' '}
                {controller.currentDrill.maiaVersion.replace('maia_kdd_', '')}
              </span>
              <span className="text-secondary">•</span>
              <span className="text-secondary">
                Drill {controller.currentDrillIndex + 1} of{' '}
                {controller.totalDrills}
              </span>
            </div>
          ) : (
            <p className="text-xs text-secondary">No drill selected</p>
          )}
        </div>

        {/* Board Section */}
        <div className="flex w-full flex-col">
          <PlayerInfo name={topPlayer.name} color={topPlayer.color} />
          <div className="relative flex aspect-square h-[100vw] w-screen">
            <GameBoard
              currentNode={controller.currentNode}
              orientation={controller.orientation}
              availableMoves={availableMoves}
              onPlayerMakeMove={onPlayerMakeMove}
              onSelectSquare={onSelectSquare}
              shapes={
                controller.analysisEnabled
                  ? hoverArrow
                    ? [...analysisController.arrows, hoverArrow]
                    : [...analysisController.arrows]
                  : hoverArrow
                    ? [hoverArrow]
                    : []
              }
            />
            {promotionFromTo && (
              <PromotionOverlay
                player={getCurrentPlayer(controller.currentNode)}
                file={promotionFromTo[1].slice(0, 1)}
                onPlayerSelectPromotion={onPlayerSelectPromotion}
              />
            )}
          </div>
          <PlayerInfo
            name={bottomPlayer.name}
            color={bottomPlayer.color}
            showArrowLegend={controller.analysisEnabled}
          />
        </div>

        {/* Controls and Content Below Board */}
        <div className="flex w-full flex-col gap-1">
          {/* Board Controller */}
          <div className="flex-none">
            <BoardController
              orientation={controller.orientation}
              setOrientation={noOpSetOrientation}
              currentNode={controller.currentNode}
              plyCount={controller.plyCount}
              goToNode={controller.goToNode}
              goToNextNode={controller.goToNextNode}
              goToPreviousNode={customGoToPreviousNode}
              goToRootNode={customGoToRootNode}
              gameTree={controller.gameTree}
              disableFlip={true}
              disablePrevious={controller.isAtOpeningEnd}
            />
          </div>

          {/* Moves Container */}
          {controller.currentDrillGame && (
            <div className="relative bottom-0 h-48 max-h-48 flex-1 overflow-auto overflow-y-hidden">
              <MovesContainer
                game={
                  gameForContainer || {
                    id: controller.currentDrillGame.id,
                    tree: controller.gameTree,
                    moves: [],
                  }
                }
                type="analysis"
                showAnnotations={
                  controller.analysisEnabled || controller.continueAnalyzingMode
                }
                showVariations={controller.continueAnalyzingMode}
              />
            </div>
          )}

          {/* Drill Progress */}
          {controller.currentDrillGame && controller.currentDrill && (
            <div className="flex w-full items-center gap-3 rounded bg-background-1 p-3">
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-secondary">Move Progress</span>
                  <span className="font-medium text-primary">
                    {controller.currentDrillGame.playerMoveCount}/
                    {controller.currentDrill.targetMoveNumber}
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-background-3">
                  <div
                    className="h-full rounded bg-human-3 transition-all duration-300"
                    style={{
                      width: `${
                        controller.currentDrill.targetMoveNumber > 0
                          ? (controller.currentDrillGame.playerMoveCount /
                              controller.currentDrill.targetMoveNumber) *
                            100
                          : 0
                      }%`,
                      maxWidth: '100%',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex w-full justify-center gap-1">
            {controller.areAllDrillsCompleted && (
              <button
                onClick={controller.showSummary}
                className="w-full rounded bg-human-3 px-6 py-2 text-sm font-medium"
              >
                View Summary
              </button>
            )}
            {controller.currentPerformanceData &&
              !controller.showPerformanceModal && (
                <button
                  onClick={controller.showCurrentPerformance}
                  className="w-full rounded bg-background-2 px-6 py-2 text-sm font-medium"
                >
                  View Performance
                </button>
              )}
            {controller.remainingDrills.length > 1 &&
              !controller.areAllDrillsCompleted && (
                <button
                  onClick={controller.moveToNextDrill}
                  className="w-full rounded bg-human-4 px-6 py-2 text-sm font-medium"
                >
                  Next Drill
                </button>
              )}
          </div>

          {/* Analysis Components Stacked */}
          <div className="flex w-full flex-col gap-1 overflow-hidden">
            {analyzedGame && (
              <LazyOpeningDrillAnalysis
                currentNode={controller.currentNode}
                gameTree={treeController.gameTree}
                analysisEnabled={controller.analysisEnabled}
                onToggleAnalysis={() =>
                  controller.setAnalysisEnabled(!controller.analysisEnabled)
                }
                playerColor={controller.currentDrill?.playerColor || 'white'}
                maiaVersion={
                  controller.currentDrill?.maiaVersion || 'maia_kdd_1500'
                }
                analysisController={analysisController}
                hover={hover}
                setHoverArrow={setHoverArrow}
                makeMove={makeMove}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>Opening Drills – Maia Chess</title>
        <meta
          name="description"
          content="Master chess openings with interactive drills against Maia AI. Practice popular openings, learn key variations, and get performance analysis to improve your opening repertoire."
        />
      </Head>
      <TreeControllerContext.Provider
        value={{
          gameTree: controller.gameTree,
          currentNode: controller.currentNode,
          setCurrentNode: controller.setCurrentNode,
          orientation: controller.orientation,
          setOrientation: controller.setOrientation,
          goToNode: controller.goToNode,
          goToNextNode: controller.goToNextNode,
          goToPreviousNode: controller.goToPreviousNode,
          goToRootNode: controller.goToRootNode,
          plyCount: controller.plyCount,
        }}
      >
        {isMobile ? mobileLayout() : desktopLayout()}
      </TreeControllerContext.Provider>

      {/* Analysis Loading Overlay */}
      <AnimatePresence>
        {controller.isAnalyzingDrill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <div className="flex max-w-md flex-col items-center gap-4 rounded-lg border border-white/10 bg-background-1 p-8 shadow-2xl">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-human-4 border-t-transparent"></div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">
                  Finalizing Performance Analysis
                </h3>
                <p className="text-sm text-secondary">
                  {controller.analysisProgress.currentMove ||
                    'Aggregating cached analysis results...'}
                </p>
                {controller.analysisProgress.total > 0 && (
                  <div className="mt-3 w-full">
                    <div className="mb-1 flex justify-between text-xs text-secondary">
                      <span>Progress</span>
                      <span>
                        {Math.round(
                          (controller.analysisProgress.completed /
                            controller.analysisProgress.total) *
                            100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-background-3">
                      <div
                        className="h-full rounded bg-human-4 transition-all duration-300 ease-out"
                        style={{
                          width: `${
                            controller.analysisProgress.total > 0
                              ? (controller.analysisProgress.completed /
                                  controller.analysisProgress.total) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Performance Modal */}
      <AnimatePresence>
        {controller.showPerformanceModal &&
          controller.currentPerformanceData && (
            <DrillPerformanceModal
              performanceData={controller.currentPerformanceData}
              onContinueAnalyzing={controller.continueAnalyzing}
              onNextDrill={controller.moveToNextDrill}
              isLastDrill={controller.remainingDrills.length <= 1}
            />
          )}
      </AnimatePresence>

      {/* Final Completion Modal */}
      <AnimatePresence>
        {controller.showFinalModal && (
          <FinalCompletionModal
            performanceData={controller.overallPerformanceData}
            onContinueAnalyzing={controller.continueAnalyzingFromFinal}
            onSelectNewOpenings={() => {
              controller.resetDrillSession()
              setShowSelectionModal(true)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default function AuthenticatedOpeningsPage() {
  return (
    <AuthenticatedWrapper>
      <OpeningsPage />
    </AuthenticatedWrapper>
  )
}
