import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useState, useEffect, useContext, useCallback, useMemo } from 'react'
import { Chess, PieceSymbol } from 'chess.ts'
import { AnimatePresence } from 'framer-motion'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'

import {
  WindowSizeContext,
  MaiaEngineContext,
  TreeControllerContext,
} from 'src/contexts'
import { DrillConfiguration, AnalyzedGame } from 'src/types'
import {
  MovesContainer,
  BoardController,
  OpeningSelectionModal,
  OpeningDrillSidebar,
  DrillPerformanceModal,
  GameBoard,
  PromotionOverlay,
  PlayerInfo,
  DownloadModelModal,
  AuthenticatedWrapper,
  AnalysisNotification,
  AnalysisOverlay,
} from 'src/components'
import openings from 'src/constants/openings.json'
import { OpeningDrillAnalysis } from 'src/components/Openings/OpeningDrillAnalysis'

import { useOpeningDrillController, useAnalysisController } from 'src/hooks'
import {
  getCurrentPlayer,
  getAvailableMovesArray,
  requiresPromotion,
} from 'src/lib/puzzle'

const OpeningsPage: NextPage = () => {
  const router = useRouter()
  const [showSelectionModal, setShowSelectionModal] = useState(true)

  const handleCloseModal = () => {
    router.push('/')
  }
  const [drillConfiguration, setDrillConfiguration] =
    useState<DrillConfiguration | null>(null)
  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)
  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)

  useEffect(() => {
    return () => {
      setHoverArrow(null)
      setPromotionFromTo(null)
    }
  }, [])

  const emptyConfiguration: DrillConfiguration = {
    selections: [],
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

  const maiaEngine = useContext(MaiaEngineContext)

  useEffect(() => {
    setHoverArrow(null)
  }, [controller.currentNode])

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

  const analyzedGame = useMemo((): AnalyzedGame | null => {
    if (!controller.gameTree || !controller.currentDrill || !playerNames)
      return null

    return {
      id: `opening-drill-${controller.currentDrill.id}`,
      tree: controller.gameTree,
      blackPlayer: playerNames.blackPlayer,
      whitePlayer: playerNames.whitePlayer,
      availableMoves: [],
      gameType: 'play' as const,
      termination: {
        result: '*',
        winner: 'none' as const,
        condition: 'Normal',
      },
      type: 'play' as const,
    }
  }, [controller.gameTree, controller.currentDrill?.id, playerNames])

  // Analysis controller for the components
  const analysisController = useAnalysisController(
    analyzedGame || {
      id: 'empty',
      tree: controller.gameTree,
      blackPlayer: { name: 'Black' },
      whitePlayer: { name: 'White' },
      availableMoves: [],
      gameType: 'play' as const,
      termination: {
        result: '*',
        winner: 'none' as const,
        condition: 'Normal',
      },
      type: 'play' as const,
    },
    controller.currentDrill?.playerColor || 'white',
    false, // Disable auto-saving on openings page
  )

  // Sync analysis controller with current node
  useEffect(() => {
    if (controller.currentNode && analysisController.setCurrentNode) {
      analysisController.setCurrentNode(controller.currentNode)
    }
  }, [controller.currentNode, analysisController.setCurrentNode])

  // Create game object for MovesContainer
  const gameForContainer = useMemo(() => {
    if (!controller.gameTree) return null

    return {
      id: `opening-drill-${controller.currentDrill?.id || 'current'}`,
      tree: controller.gameTree, // Use the original tree
      moves: [], // Not used when tree is provided
    }
  }, [controller.gameTree, controller.currentDrill?.id])

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

            const newVariation = controller.currentNode.addChild(
              newFen,
              moveString,
              san,
              false,
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
      <div className="flex h-full w-[90%] flex-row gap-3">
        {/* Left Sidebar - unified glass container */}
        <div className="desktop-left-column-container flex flex-col overflow-hidden">
          <div className="border-glass-border flex h-full w-full flex-col overflow-hidden rounded-md border bg-glass backdrop-blur-md">
            {/* Opening drill info and drill list */}
            <OpeningDrillSidebar
              currentDrill={controller.currentDrill}
              completedDrills={controller.completedDrills}
              selectionPool={controller.selectionPool}
              openingEndNode={controller.currentDrillGame?.openingEndNode}
              analysisEnabled={controller.analysisEnabled}
              continueAnalyzingMode={controller.continueAnalyzingMode}
              embedded
            />
          </div>
        </div>

        {/* Center - Board */}
        <div className="desktop-middle-column-container flex flex-col gap-2">
          <div className="flex w-full flex-col overflow-hidden rounded">
            <PlayerInfo
              name={topPlayer.name}
              color={topPlayer.color}
              currentFen={controller.currentNode?.fen}
              orientation={controller.orientation}
            />
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
              currentFen={controller.currentNode?.fen}
              orientation={controller.orientation}
            />
          </div>

          {/* Drill progress with next drill button */}
          {controller.currentDrillGame && controller.currentDrill && (
            <div className="border-glass-border flex w-full items-center gap-3 rounded-md border bg-glass p-3 backdrop-blur-md">
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-white/70">Move Progress</span>
                  <span className="font-medium text-white/90">
                    {controller.currentDrillGame.playerMoveCount}/
                    {controller.currentDrill.targetMoveNumber}
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-white/10">
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
              {controller.currentPerformanceData &&
                !controller.showPerformanceModal && (
                  <button
                    onClick={controller.showCurrentPerformance}
                    className="border-glass-border rounded-md border bg-glass px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-glass-stronger"
                  >
                    View Performance
                  </button>
                )}
              <button
                onClick={controller.moveToNextDrill}
                className="rounded bg-human-4 px-4 py-2 text-sm font-medium transition-colors hover:bg-human-4/80"
              >
                Next Drill
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Analysis */}
        <div
          id="analysis"
          className="desktop-right-column-container flex flex-col gap-2"
        >
          {analyzedGame && (
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
          )}
        </div>
      </div>
    </div>
  )

  const mobileLayout = () => (
    <div className="flex h-full flex-1 flex-col justify-center gap-1">
      <div className="flex h-full flex-col items-start justify-start gap-1">
        {/* Current Drill Info Header */}
        <div className="flex w-full flex-col bg-glass p-2">
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
                Drill {controller.currentDrillNumber || 1}
              </span>
            </div>
          ) : (
            <p className="text-xs text-secondary">No drill selected</p>
          )}
        </div>

        {/* Board Section */}
        <div className="flex w-full flex-col">
          <PlayerInfo
            name={topPlayer.name}
            color={topPlayer.color}
            currentFen={controller.currentNode?.fen}
            orientation={controller.orientation}
          />
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
            currentFen={controller.currentNode?.fen}
            orientation={controller.orientation}
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
              embedded
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
                startFromNode={
                  controller.currentDrillGame?.openingEndNode || undefined
                }
                restrictNavigationBefore={
                  controller.currentDrillGame?.openingEndNode || undefined
                }
                showAnnotations={
                  controller.analysisEnabled || controller.continueAnalyzingMode
                }
                showVariations={controller.continueAnalyzingMode}
              />
            </div>
          )}

          {/* Drill Progress */}
          {controller.currentDrillGame && controller.currentDrill && (
            <div className="border-glass-border flex w-full items-center gap-3 rounded-md border bg-glass p-3 backdrop-blur-md">
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-white/70">Move Progress</span>
                  <span className="font-medium text-white/90">
                    {controller.currentDrillGame.playerMoveCount}/
                    {controller.currentDrill.targetMoveNumber}
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-white/10">
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
            {controller.currentPerformanceData &&
              !controller.showPerformanceModal && (
                <button
                  onClick={controller.showCurrentPerformance}
                  className="border-glass-border w-full rounded-md border bg-glass px-6 py-2 text-sm font-medium text-white/90 hover:bg-glass-stronger"
                >
                  View Performance
                </button>
              )}
            <button
              onClick={controller.moveToNextDrill}
              className="w-full rounded bg-human-4 px-6 py-2 text-sm font-medium"
            >
              Next Drill
            </button>
          </div>

          {/* Analysis Components Stacked */}
          <div className="flex w-full flex-col gap-1 overflow-hidden">
            {analyzedGame && (
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

      {/* Performance Modal */}
      <AnimatePresence>
        {controller.showPerformanceModal &&
          controller.currentPerformanceData && (
            <DrillPerformanceModal
              performanceData={controller.currentPerformanceData}
              onContinueAnalyzing={controller.continueAnalyzing}
              onNextDrill={controller.moveToNextDrill}
              isLastDrill={false}
            />
          )}
      </AnimatePresence>
      <AnimatePresence>
        {controller.drillAnalysisProgress.isAnalyzing && (
          <>
            <AnalysisOverlay
              isActive={controller.drillAnalysisProgress.isAnalyzing}
            />
            <AnalysisNotification
              progress={controller.drillAnalysisProgress}
              onCancel={controller.cancelDrillAnalysis}
            />
          </>
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
