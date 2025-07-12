import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useState, useEffect, useContext, useCallback, useMemo } from 'react'
import { Chess, PieceSymbol } from 'chess.ts'
import { AnimatePresence, motion } from 'framer-motion'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'

import { WindowSizeContext, TreeControllerContext } from 'src/contexts'
import { OpeningSelection, AnalyzedGame, DrillConfiguration } from 'src/types'
import openings from 'src/utils/openings/openings.json'
import {
  OpeningSelectionModal,
  OpeningDrillSidebar,
  OpeningDrillAnalysis,
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
  useMaiaEngine,
  useStockfishEngine,
  useAnalysisController,
} from 'src/hooks'
import {
  getCurrentPlayer,
  getAvailableMovesArray,
  requiresPromotion,
} from 'src/utils/train/utils'

const OpeningsPage: NextPage = () => {
  const router = useRouter()
  const [showSelectionModal, setShowSelectionModal] = useState(true)
  const [isReopenedModal, setIsReopenedModal] = useState(false)

  // Handle modal close with navigation
  const handleCloseModal = () => {
    if (isReopenedModal) {
      // Modal was reopened from within the page, just close it
      setShowSelectionModal(false)
    } else {
      // Modal was opened from initial page load, redirect to home
      router.push('/')
    }
  }
  const [drillConfiguration, setDrillConfiguration] =
    useState<DrillConfiguration | null>(null)
  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)
  const [arrows, setArrows] = useState<DrawShape[]>([])
  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)

  // Pre-load engines when page loads
  const { status: maiaStatus } = useMaiaEngine()
  const { streamEvaluations } = useStockfishEngine()

  // Create empty configuration if none exists
  const emptyConfiguration: DrillConfiguration = {
    selections: [],
    drillCount: 0,
    drillSequence: [],
  }

  const controller = useOpeningDrillController(
    drillConfiguration || emptyConfiguration,
  )
  const { isMobile } = useContext(WindowSizeContext)

  // Create analyzed game for analysis controller
  const analyzedGame = useMemo((): AnalyzedGame | null => {
    if (!controller.gameTree || !controller.currentDrill) return null

    const mainLine = controller.gameTree.getMainLine()
    const moves = mainLine.slice(1).map((node) => {
      const move = node.move
      return {
        board: node.fen,
        lastMove: move
          ? ([move.slice(0, 2), move.slice(2, 4)] as [string, string])
          : undefined,
        san: node.san || '',
        uci: move || '',
      }
    })

    return {
      id: `opening-drill-${Date.now()}`,
      tree: controller.gameTree,
      blackPlayer: {
        name:
          controller.currentDrill.playerColor === 'black'
            ? 'You'
            : controller.currentDrill.maiaVersion.replace('maia_kdd_', 'Maia '),
        rating:
          controller.currentDrill.playerColor === 'black'
            ? undefined
            : parseInt(controller.currentDrill.maiaVersion.slice(-4)),
      },
      whitePlayer: {
        name:
          controller.currentDrill.playerColor === 'white'
            ? 'You'
            : controller.currentDrill.maiaVersion.replace('maia_kdd_', 'Maia '),
        rating:
          controller.currentDrill.playerColor === 'white'
            ? undefined
            : parseInt(controller.currentDrill.maiaVersion.slice(-4)),
      },
      moves,
      availableMoves: moves.map(() => ({})),
      gameType: 'play' as const,
      termination: {
        result: '*',
        winner: 'none' as const,
        condition: 'Normal',
      },
      maiaEvaluations: moves.map(() => ({})),
      stockfishEvaluations: moves.map(() => undefined),
      type: 'play' as const,
    }
  }, [controller.gameTree, controller.currentDrill])

  // Analysis controller
  const analysisController = useAnalysisController(
    analyzedGame || {
      id: 'empty',
      tree: controller.gameTree,
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
  )

  // Sync analysis controller with current node
  useEffect(() => {
    if (controller.currentNode && analysisController.setCurrentNode) {
      analysisController.setCurrentNode(controller.currentNode)
    }
  }, [controller.currentNode, analysisController])

  // Set arrows for Maia and Stockfish recommendations when analysis is enabled
  useEffect(() => {
    if (!controller.analysisEnabled) {
      setArrows([])
      return
    }

    const arr = []

    if (analysisController.moveEvaluation?.maia) {
      const maia = Object.entries(
        analysisController.moveEvaluation?.maia?.policy,
      )[0]
      if (maia) {
        arr.push({
          brush: 'red',
          orig: maia[0].slice(0, 2) as Key,
          dest: maia[0].slice(2, 4) as Key,
        } as DrawShape)
      }
    }

    if (analysisController.moveEvaluation?.stockfish) {
      const stockfish = Object.entries(
        analysisController.moveEvaluation?.stockfish.cp_vec,
      )[0]
      if (stockfish) {
        arr.push({
          brush: 'blue',
          orig: stockfish[0].slice(0, 2) as Key,
          dest: stockfish[0].slice(2, 4) as Key,
          modifiers: { lineWidth: 8 },
        })
      }
    }

    setArrows(arr)
  }, [
    controller.analysisEnabled,
    analysisController.moveEvaluation,
    analysisController.currentNode,
    analysisController.orientation,
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

  // Create moves array from the game tree for MovesContainer
  const movesForContainer = useMemo(() => {
    if (!controller.gameTree) return []

    const mainLine = controller.gameTree.getMainLine()
    return mainLine.slice(1).map((node) => ({
      board: node.fen,
      lastMove: node.move
        ? ([node.move.slice(0, 2), node.move.slice(2, 4)] as [string, string])
        : undefined,
      san: node.san || '',
      uci: node.move || '',
    }))
  }, [controller.gameTree, controller.currentNode])

  // Show selection modal when no drill configuration exists and Maia model is ready
  useEffect(() => {
    if (
      (!drillConfiguration || drillConfiguration.selections.length === 0) &&
      analysisController.maiaStatus === 'ready'
    ) {
      setShowSelectionModal(true)
    }
  }, [drillConfiguration, analysisController.maiaStatus])

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

  // Player info for the board
  const topPlayer = useMemo(() => {
    if (!controller.currentDrill) return { name: 'Unknown', color: 'black' }

    const playerColor = controller.currentDrill.playerColor
    const maiaVersion = controller.currentDrill.maiaVersion
    const topPlayerColor = playerColor === 'white' ? 'black' : 'white'

    return {
      name:
        topPlayerColor === playerColor
          ? 'You'
          : maiaVersion.replace('maia_kdd_', 'Maia '),
      color: topPlayerColor,
    }
  }, [controller.currentDrill])

  const bottomPlayer = useMemo(() => {
    if (!controller.currentDrill) return { name: 'Unknown', color: 'white' }

    const playerColor = controller.currentDrill.playerColor
    const maiaVersion = controller.currentDrill.maiaVersion
    const bottomPlayerColor = playerColor

    return {
      name:
        bottomPlayerColor === playerColor
          ? 'You'
          : maiaVersion.replace('maia_kdd_', 'Maia '),
      color: bottomPlayerColor,
    }
  }, [controller.currentDrill])

  // Handle player moves
  const onPlayerMakeMove = useCallback(
    async (playedMove: [string, string] | null) => {
      if (!playedMove || !controller.isPlayerTurn) return

      const availableMoves = getAvailableMovesArray(controller.moves)

      if (requiresPromotion(playedMove, availableMoves)) {
        setPromotionFromTo(playedMove)
        return
      }

      const moveUci = playedMove[0] + playedMove[1]
      await controller.makePlayerMove(moveUci)
    },
    [controller],
  )

  const onPlayerSelectPromotion = useCallback(
    async (piece: string) => {
      if (!promotionFromTo) return

      setPromotionFromTo(null)
      const moveUci = promotionFromTo[0] + promotionFromTo[1] + piece
      await controller.makePlayerMove(moveUci)
    },
    [promotionFromTo, controller],
  )

  const onSelectSquare = useCallback(() => {
    // No special handling needed for opening drills
  }, [])

  // Make move function for analysis components
  const makeMove = useCallback(
    async (move: string) => {
      if (
        !controller.analysisEnabled ||
        !analysisController.currentNode ||
        !analyzedGame?.tree
      )
        return

      const chess = new Chess(analysisController.currentNode.fen)
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

        if (analysisController.currentNode.mainChild?.move === moveString) {
          analysisController.goToNode(analysisController.currentNode.mainChild)
        } else {
          const newVariation = analyzedGame.tree.addVariation(
            analysisController.currentNode,
            newFen,
            moveString,
            san,
            analysisController.currentMaiaModel,
          )
          analysisController.goToNode(newVariation)
        }
      }
    },
    [controller.analysisEnabled, analysisController, analyzedGame],
  )

  // Show download modal if Maia model needs to be downloaded
  if (
    analysisController.maiaStatus === 'no-cache' ||
    analysisController.maiaStatus === 'downloading'
  ) {
    return (
      <>
        <Head>
          <title>Opening Drills – Maia Chess</title>
          <meta
            name="description"
            content="Practice chess openings against Maia"
          />
        </Head>
        <AuthenticatedWrapper>
          <AnimatePresence>
            <DownloadModelModal
              progress={analysisController.maiaProgress}
              download={analysisController.downloadMaia}
            />
          </AnimatePresence>
        </AuthenticatedWrapper>
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
            content="Practice chess openings against Maia"
          />
        </Head>
        <AuthenticatedWrapper>
          <AnimatePresence>
            <OpeningSelectionModal
              openings={openings}
              initialSelections={drillConfiguration?.selections || []}
              onComplete={handleCompleteSelection}
              onClose={handleCloseModal}
            />
          </AnimatePresence>
        </AuthenticatedWrapper>
      </>
    )
  }

  const desktopLayout = () => (
    <AuthenticatedWrapper>
      <div className="flex h-full w-full flex-col items-center py-4 md:py-10">
        <div className="flex h-full w-[90%] flex-row gap-4">
          {/* Left Sidebar */}
          <div className="flex h-[85vh] w-72 min-w-60 max-w-72 flex-col gap-2 overflow-hidden 2xl:min-w-72">
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
                      game={{
                        id: controller.currentDrillGame.id,
                        tree: controller.gameTree,
                        moves: movesForContainer,
                      }}
                      type="analysis"
                      showAnnotations={false}
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
          <div className="flex h-[85vh] w-[45vh] flex-col gap-2 2xl:w-[55vh]">
            <div className="flex w-full flex-col overflow-hidden rounded">
              <PlayerInfo name={topPlayer.name} color={topPlayer.color} />
              <div className="relative flex aspect-square w-[45vh] 2xl:w-[55vh]">
                <GameBoard
                  currentNode={controller.currentNode}
                  orientation={controller.orientation}
                  availableMoves={controller.moves}
                  onPlayerMakeMove={onPlayerMakeMove}
                  onSelectSquare={onSelectSquare}
                  shapes={hoverArrow ? [...arrows, hoverArrow] : [...arrows]}
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
                {controller.remainingDrills.length > 1 &&
                  !controller.areAllDrillsCompleted && (
                    <button
                      onClick={controller.moveToNextDrill}
                      className="rounded bg-human-4 px-4 py-2 text-sm font-medium transition-colors hover:bg-human-4/80"
                    >
                      Next Drill
                    </button>
                  )}
                {controller.areAllDrillsCompleted && (
                  <button
                    onClick={controller.showSummary}
                    className="rounded bg-human-3 px-4 py-2 text-sm font-medium transition-colors hover:bg-human-3/80"
                  >
                    View Summary
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Analysis */}
          <div
            id="analysis"
            className="flex h-[85vh] w-full flex-col gap-2 xl:h-[calc(55vh+4.5rem)]"
          >
            <OpeningDrillAnalysis
              currentNode={controller.currentNode}
              gameTree={controller.gameTree}
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
          </div>
        </div>
      </div>
    </AuthenticatedWrapper>
  )

  const mobileLayout = () => (
    <AuthenticatedWrapper>
      <div className="flex h-full flex-1 flex-col justify-center gap-1">
        <div className="flex h-full flex-col items-start justify-start gap-1">
          {/* Current Drill Info Header */}
          <div className="flex w-full flex-col bg-background-1 p-3">
            <h3 className="mb-2 text-base font-bold text-primary">
              Current Drill
            </h3>
            {controller.currentDrill ? (
              <div className="space-y-1">
                <div>
                  <p className="text-sm font-medium text-primary">
                    {controller.currentDrill.opening.name}
                  </p>
                  {controller.currentDrill.variation && (
                    <p className="text-xs text-secondary">
                      {controller.currentDrill.variation.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <span>
                    vs Maia{' '}
                    {controller.currentDrill.maiaVersion.replace(
                      'maia_kdd_',
                      '',
                    )}
                  </span>
                  <span>•</span>
                  <span>{controller.currentDrill.targetMoveNumber} moves</span>
                  <span>•</span>
                  <span>
                    Drill {controller.currentDrillIndex + 1} of{' '}
                    {controller.totalDrills}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-secondary">No drill selected</p>
            )}
          </div>

          {/* Board Section */}
          <div className="flex w-full flex-col">
            <PlayerInfo name={topPlayer.name} color={topPlayer.color} />
            <div className="relative flex aspect-square h-[100vw] w-screen">
              <GameBoard
                currentNode={controller.currentNode}
                orientation={controller.orientation}
                availableMoves={controller.moves}
                onPlayerMakeMove={onPlayerMakeMove}
                onSelectSquare={onSelectSquare}
                shapes={hoverArrow ? [...arrows, hoverArrow] : [...arrows]}
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
            <div className="flex justify-center px-2">
              {controller.remainingDrills.length > 1 &&
                !controller.areAllDrillsCompleted && (
                  <button
                    onClick={controller.moveToNextDrill}
                    className="rounded bg-human-4 px-6 py-2 text-sm font-medium"
                  >
                    Next Drill
                  </button>
                )}
              {controller.areAllDrillsCompleted && (
                <button
                  onClick={controller.showSummary}
                  className="rounded bg-human-3 px-6 py-2 text-sm font-medium"
                >
                  View Summary
                </button>
              )}
            </div>

            {/* Moves Container */}
            {controller.currentDrillGame && (
              <div className="relative bottom-0 h-48 max-h-48 flex-1 overflow-auto overflow-y-hidden">
                <MovesContainer
                  game={{
                    id: controller.currentDrillGame.id,
                    tree: controller.gameTree,
                    moves: movesForContainer,
                  }}
                  type="analysis"
                  showAnnotations={false}
                />
              </div>
            )}

            {/* Analysis Components Stacked */}
            <div className="flex w-full flex-col gap-1 overflow-hidden">
              <OpeningDrillAnalysis
                currentNode={controller.currentNode}
                gameTree={controller.gameTree}
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
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedWrapper>
  )

  return (
    <>
      <Head>
        <title>Opening Drills – Maia Chess</title>
        <meta
          name="description"
          content="Practice chess openings against Maia"
        />
      </Head>
      <AuthenticatedWrapper>
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

        {/* Background Analysis Progress Indicator */}
        <AnimatePresence>
          {controller.analysisProgress.total > 0 &&
            controller.analysisProgress.completed <
              controller.analysisProgress.total && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-4 right-4 z-40 max-w-xs rounded-lg border border-white/20 bg-background-1 p-4 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-human-4 border-t-transparent"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Background Analysis</p>
                    <p className="text-xs text-secondary">
                      {controller.analysisProgress.completed}/
                      {controller.analysisProgress.total} positions
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1 w-full rounded bg-background-3">
                  <div
                    className="h-full rounded bg-human-4 transition-all duration-300"
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
              </motion.div>
            )}
        </AnimatePresence>

        {/* Analysis Loading Overlay */}
        <AnimatePresence>
          {controller.isAnalyzingDrill && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            >
              <div className="flex max-w-md flex-col items-center gap-4 rounded-lg bg-background-1 p-8 shadow-2xl">
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
                          className="h-full rounded bg-human-4 transition-all duration-300"
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
      </AuthenticatedWrapper>
    </>
  )
}

export default OpeningsPage
