import React, {
  useMemo,
  Dispatch,
  useState,
  useEffect,
  useContext,
  useCallback,
  SetStateAction,
} from 'react'
import {
  fetchPgnOfLichessGame,
  fetchAnalyzedMaiaGame,
  fetchAnalyzedPgnGame,
  fetchAnalyzedWorldChampionshipGame,
  retrieveGameAnalysisCache,
  storeCustomGame,
} from 'src/api'
import {
  AnalyzedGame,
  MaiaEvaluation,
  StockfishEvaluation,
  GameNode,
} from 'src/types'
import { WindowSizeContext, TreeControllerContext, useTour } from 'src/contexts'
import { DelayedLoading } from 'src/components/Common/DelayedLoading'
import { AuthenticatedWrapper } from 'src/components/Common/AuthenticatedWrapper'
import { PlayerInfo } from 'src/components/Common/PlayerInfo'
import { MoveMap } from 'src/components/Analysis/MoveMap'
import { Highlight } from 'src/components/Analysis/Highlight'
import { AnalysisSidebar } from 'src/components/Analysis'
import { BlunderMeter } from 'src/components/Analysis/BlunderMeter'
import { MovesByRating } from 'src/components/Analysis/MovesByRating'
import { AnalysisGameList } from 'src/components/Analysis/AnalysisGameList'
import { DownloadModelModal } from 'src/components/Common/DownloadModelModal'
import { CustomAnalysisModal } from 'src/components/Analysis/CustomAnalysisModal'
import { ConfigurableScreens } from 'src/components/Analysis/ConfigurableScreens'
import { AnalysisConfigModal } from 'src/components/Analysis/AnalysisConfigModal'
import { AnalysisNotification } from 'src/components/Analysis/AnalysisNotification'
import { AnalysisOverlay } from 'src/components/Analysis/AnalysisOverlay'
import { LearnFromMistakes } from 'src/components/Analysis/LearnFromMistakes'
import { GameBoard } from 'src/components/Board/GameBoard'
import { MovesContainer } from 'src/components/Board/MovesContainer'
import { BoardController } from 'src/components/Board/BoardController'
import { PromotionOverlay } from 'src/components/Board/PromotionOverlay'
import { GameInfo } from 'src/components/Common/GameInfo'
import Head from 'next/head'
import toast from 'react-hot-toast'
import type { NextPage } from 'next'
import { trackAnalysisGameLoaded } from 'src/lib/analytics'
import { useRouter } from 'next/router'
import type { Key } from 'chessground/types'
import { Chess, PieceSymbol } from 'chess.ts'
import { AnimatePresence, motion } from 'framer-motion'
import { useAnalysisController } from 'src/hooks'
import { tourConfigs } from 'src/constants/tours'
import type { DrawShape } from 'chessground/draw'
import { MAIA_MODELS } from 'src/constants/common'
import { applyEngineAnalysisData } from 'src/lib/analysis'

const AnalysisPage: NextPage = () => {
  const { startTour, tourState } = useTour()

  const router = useRouter()
  const { id } = router.query

  const [analyzedGame, setAnalyzedGame] = useState<AnalyzedGame | undefined>(
    undefined,
  )
  const [initialTourCheck, setInitialTourCheck] = useState(false)

  useEffect(() => {
    // Wait for tour system to be ready before starting tour
    if (!initialTourCheck && tourState.ready) {
      setInitialTourCheck(true)
      // Always attempt to start the tour - the tour context will handle completion checking
      startTour(tourConfigs.analysis.id, tourConfigs.analysis.steps, false)
    }
  }, [initialTourCheck, startTour, tourState.ready])
  const [currentId, setCurrentId] = useState<string[]>(id as string[])

  const loadGameAnalysisCache = useCallback(async (game: AnalyzedGame) => {
    if (!game.id || game.type === 'tournament') {
      return
    }

    try {
      const storedAnalysis = await retrieveGameAnalysisCache(game.id)
      if (storedAnalysis && storedAnalysis.positions.length > 0) {
        applyEngineAnalysisData(game.tree, storedAnalysis.positions)
      }
    } catch (error) {
      console.warn('Failed to load stored analysis:', error)
    }
  }, [])

  const getAndSetWorldChampionshipGame = useCallback(
    async (
      newId: string[],
      setCurrentMove?: Dispatch<SetStateAction<number>>,
      updateUrl = true,
    ) => {
      let game
      try {
        game = await fetchAnalyzedWorldChampionshipGame(newId)
      } catch (e) {
        router.push('/401')
        return
      }
      if (setCurrentMove) setCurrentMove(0)

      trackAnalysisGameLoaded('lichess')
      setAnalyzedGame({ ...game, type: 'tournament' })
      setCurrentId(newId)

      if (updateUrl) {
        router.push(`/analysis/${newId.join('/')}`, undefined, {
          shallow: true,
        })
      }
    },
    [router, loadGameAnalysisCache],
  )

  const getAndSetLichessGame = useCallback(
    async (
      id: string,
      pgn: string,
      setCurrentMove?: Dispatch<SetStateAction<number>>,
      updateUrl = true,
    ) => {
      const game = await fetchAnalyzedPgnGame(id, pgn)

      if (setCurrentMove) setCurrentMove(0)

      setAnalyzedGame({
        ...game,
        type: 'lichess',
      })
      setCurrentId([id, 'lichess'])

      await loadGameAnalysisCache({ ...game, type: 'lichess' })

      if (updateUrl) {
        router.push(`/analysis/${id}/lichess`, undefined, { shallow: true })
      }
    },
    [router, loadGameAnalysisCache],
  )

  const getAndSetUserGame = useCallback(
    async (
      id: string,
      type: 'play' | 'hand' | 'brain' | 'custom',
      setCurrentMove?: Dispatch<SetStateAction<number>>,
      updateUrl = true,
    ) => {
      const game = await fetchAnalyzedMaiaGame(id, type)

      if (setCurrentMove) setCurrentMove(0)

      setAnalyzedGame({ ...game, type })
      setCurrentId([id, type])
      await loadGameAnalysisCache({ ...game, type })

      if (updateUrl) {
        router.push(`/analysis/${id}/${type}`, undefined, {
          shallow: true,
        })
      }
    },
    [router, loadGameAnalysisCache],
  )

  useEffect(() => {
    ;(async () => {
      const queryId = id as string[]
      if (!queryId || queryId.length === 0) return

      const needsNewGame =
        !analyzedGame || currentId.join('/') !== queryId.join('/')

      if (needsNewGame) {
        if (queryId[1] === 'lichess') {
          const pgn = await fetchPgnOfLichessGame(queryId[0])
          getAndSetLichessGame(queryId[0], pgn, undefined, false)
        } else if (['play', 'hand', 'brain', 'custom'].includes(queryId[1])) {
          getAndSetUserGame(
            queryId[0],
            queryId[1] as 'play' | 'hand' | 'brain' | 'custom',
            undefined,
            false,
          )
        } else {
          getAndSetWorldChampionshipGame(queryId, undefined, false)
        }
      }
    })()
  }, [
    id,
    analyzedGame,
    getAndSetWorldChampionshipGame,
    getAndSetLichessGame,
    getAndSetUserGame,
  ])

  return (
    <>
      {analyzedGame ? (
        <Analysis
          currentId={currentId}
          analyzedGame={analyzedGame}
          getAndSetTournamentGame={getAndSetWorldChampionshipGame}
          getAndSetLichessGame={getAndSetLichessGame}
          getAndSetUserGame={getAndSetUserGame}
          router={router}
        />
      ) : (
        <DelayedLoading isLoading={true}>
          <div></div>
        </DelayedLoading>
      )}
    </>
  )
}

interface Props {
  currentId: string[]
  analyzedGame: AnalyzedGame

  getAndSetTournamentGame: (
    newId: string[],
    setCurrentMove?: Dispatch<SetStateAction<number>>,
    updateUrl?: boolean,
  ) => Promise<void>
  getAndSetLichessGame: (
    id: string,
    pgn: string,
    setCurrentMove?: Dispatch<SetStateAction<number>>,
    updateUrl?: boolean,
  ) => Promise<void>
  getAndSetUserGame: (
    id: string,
    type: 'play' | 'hand' | 'brain' | 'custom',
    setCurrentMove?: Dispatch<SetStateAction<number>>,
    updateUrl?: boolean,
  ) => Promise<void>
  router: ReturnType<typeof useRouter>
}

const Analysis: React.FC<Props> = ({
  currentId,
  analyzedGame,
  getAndSetTournamentGame,
  getAndSetLichessGame,
  getAndSetUserGame,

  router,
}: Props) => {
  const { width } = useContext(WindowSizeContext)
  const isMobile = useMemo(() => width > 0 && width <= 670, [width])
  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)
  const [currentSquare, setCurrentSquare] = useState<Key | null>(null)
  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [showAnalysisConfigModal, setShowAnalysisConfigModal] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [analysisEnabled, setAnalysisEnabled] = useState(true)
  const [lastMoveResult, setLastMoveResult] = useState<
    'correct' | 'incorrect' | 'not-learning'
  >('not-learning')

  const controller = useAnalysisController(analyzedGame)

  useEffect(() => {
    if (analyzedGame?.tree) {
      try {
        const rootNode = analyzedGame.tree.getRoot()
        if (rootNode) {
          controller.setCurrentNode(rootNode)
        }
      } catch (error) {
        console.error('Error setting current node:', error)
      }
    }
  }, [analyzedGame])

  useEffect(() => {
    setHoverArrow(null)
  }, [controller.currentNode])

  const launchContinue = useCallback(() => {
    const fen = controller.currentNode?.fen as string
    const url = '/play' + '?fen=' + encodeURIComponent(fen)

    window.open(url)
  }, [controller.currentNode])

  const handleAnalyzeEntireGame = useCallback(() => {
    setShowAnalysisConfigModal(true)
  }, [])

  const handleAnalysisConfigConfirm = useCallback(
    (depth: number) => {
      controller.gameAnalysis.resetProgress()
      controller.gameAnalysis.startAnalysis(depth)
    },
    [controller.gameAnalysis],
  )

  const handleAnalysisCancel = useCallback(() => {
    controller.gameAnalysis.cancelAnalysis()
  }, [controller.gameAnalysis])

  const handleToggleAnalysis = useCallback(() => {
    setAnalysisEnabled((prev) => !prev)
  }, [])

  const handleCustomAnalysis = useCallback(
    (type: 'fen' | 'pgn', data: string, name?: string) => {
      ;(async () => {
        const { game_id } = await storeCustomGame({
          name: name,
          pgn: type === 'pgn' ? data : undefined,
          fen: type === 'fen' ? data : undefined,
        })

        setShowCustomModal(false)
        router.push(`/analysis/${game_id}/custom`)
      })()
    },
    [],
  )

  const handleLearnFromMistakes = useCallback(() => {
    controller.learnFromMistakes.start()
    setAnalysisEnabled(false) // Auto-disable analysis when starting learn mode
  }, [controller.learnFromMistakes])

  const handleStopLearnFromMistakes = useCallback(() => {
    controller.learnFromMistakes.stop()
    setLastMoveResult('not-learning')
    setAnalysisEnabled(true) // Auto-enable analysis when stopping learn mode
  }, [controller.learnFromMistakes])

  const handleShowSolution = useCallback(() => {
    controller.learnFromMistakes.showSolution()
    setAnalysisEnabled(true) // Auto-enable analysis when showing solution
  }, [controller.learnFromMistakes])

  const handleNextMistake = useCallback(() => {
    controller.learnFromMistakes.goToNext()
    setLastMoveResult('not-learning')
    setAnalysisEnabled(false) // Auto-disable analysis when going to next mistake
  }, [controller.learnFromMistakes])

  const handleSelectPlayer = useCallback(
    (color: 'white' | 'black') => {
      controller.learnFromMistakes.startWithColor(color)
      setAnalysisEnabled(false)
    },
    [controller.learnFromMistakes],
  )

  const emptyBlunderMeterData = useMemo(
    () => ({
      goodMoves: { moves: [], probability: 0 },
      okMoves: { moves: [], probability: 0 },
      blunderMoves: { moves: [], probability: 0 },
    }),
    [],
  )

  const emptyRecommendations = useMemo(
    () => ({
      maia: undefined,
      stockfish: undefined,
    }),
    [],
  )

  const hover = (move?: string) => {
    if (move && analysisEnabled) {
      setHoverArrow({
        orig: move.slice(0, 2) as Key,
        dest: move.slice(2, 4) as Key,
        brush: 'green',
        modifiers: {
          lineWidth: 10,
        },
      })
    } else {
      setHoverArrow(null)
    }
  }

  const mockHover = useCallback(() => void 0, [])
  const mockSetHoverArrow = useCallback(() => void 0, [])

  const makeMove = (move: string) => {
    if (!controller.currentNode || !analyzedGame.tree) return

    // Check if we're in learn from mistakes mode
    const learnResult = controller.learnFromMistakes.checkMove(move)
    setLastMoveResult(learnResult)

    // Don't allow moves if:
    // 1. Analysis is disabled and we're not in learn mode, OR
    // 2. We're in learn mode and puzzle is solved (analysis enabled)
    if (!analysisEnabled && learnResult === 'not-learning') return
    if (controller.learnFromMistakes.state.isActive && analysisEnabled) return

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

      // In learn from mistakes mode, if the move is incorrect, don't actually make it and return to original position
      if (learnResult === 'incorrect') {
        // Return to the original position after a half-second delay so the user can process what happened
        setTimeout(() => {
          controller.learnFromMistakes.returnToOriginalPosition()
        }, 750)
        return
      } else if (learnResult === 'correct') {
        // Auto-enable analysis when player gets the correct move
        setAnalysisEnabled(true)
      }

      if (controller.currentNode.mainChild?.move === moveString) {
        // Existing main line move - navigate to it
        controller.goToNode(controller.currentNode.mainChild)
      } else if (
        !controller.currentNode.mainChild &&
        controller.currentNode.isMainline
      ) {
        // No main child exists AND we're on main line - create main line move
        const newMainMove = analyzedGame.tree
          .getLastMainlineNode()
          .addChild(newFen, moveString, san, true, controller.currentMaiaModel)
        controller.goToNode(newMainMove)
      } else {
        // Either main child exists but different move, OR we're in a variation - create variation
        const newVariation = analyzedGame.tree.addVariationNode(
          controller.currentNode,
          newFen,
          moveString,
          san,
          controller.currentMaiaModel,
        )
        controller.goToNode(newVariation)
      }
    }
  }

  // Mock move handler for when analysis is disabled
  const mockMakeMove = useCallback(() => {
    // Intentionally empty - no moves when analysis disabled
  }, [])

  const onPlayerMakeMove = useCallback(
    (playedMove: [string, string] | null) => {
      if (!playedMove) return

      // Check for promotions in available moves
      const availableMoves = Array.from(
        controller.availableMoves.entries(),
      ).flatMap(([from, tos]) => tos.map((to) => ({ from, to })))

      const matching = availableMoves.filter((m) => {
        return m.from === playedMove[0] && m.to === playedMove[1]
      })

      if (matching.length > 1) {
        // Multiple matching moves (i.e. promotion)
        setPromotionFromTo(playedMove)
        return
      }

      // Single move
      const moveUci = playedMove[0] + playedMove[1]
      makeMove(moveUci)
    },
    [controller.availableMoves, makeMove],
  )

  const onPlayerSelectPromotion = useCallback(
    (piece: string) => {
      if (!promotionFromTo) {
        return
      }
      setPromotionFromTo(null)
      const moveUci = promotionFromTo[0] + promotionFromTo[1] + piece
      makeMove(moveUci)
    },
    [promotionFromTo, setPromotionFromTo, makeMove],
  )

  // Determine current player for promotion overlay
  const currentPlayer = useMemo(() => {
    if (!controller.currentNode) return 'white'
    const chess = new Chess(controller.currentNode.fen)
    return chess.turn() === 'w' ? 'white' : 'black'
  }, [controller.currentNode])

  const NestedGameInfo = () => (
    <div className="flex w-full flex-col">
      <div className="hidden md:block">
        {[analyzedGame.whitePlayer, analyzedGame.blackPlayer].map(
          (player, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-white' : 'border-[0.5px] bg-black'}`}
                />
                <p className="text-sm">{player.name}</p>
                <span className="text-xs">
                  {player.rating ? <>({player.rating})</> : null}
                </span>
              </div>
              {analyzedGame.termination?.winner ===
              (index == 0 ? 'white' : 'black') ? (
                <p className="text-xs text-engine-3">1</p>
              ) : analyzedGame.termination?.winner !== 'none' ? (
                <p className="text-xs text-human-3">0</p>
              ) : analyzedGame.termination === undefined ? (
                <></>
              ) : (
                <p className="text-xs text-secondary">½</p>
              )}
            </div>
          ),
        )}
      </div>
      <div className="flex w-full items-center justify-between text-xs md:hidden">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-white" />
          <span className="font-medium">{analyzedGame.whitePlayer.name}</span>
          {analyzedGame.whitePlayer.rating && (
            <span className="text-primary/60">
              ({analyzedGame.whitePlayer.rating})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {analyzedGame.termination?.winner === 'none' ? (
            <span className="font-medium text-primary/80">½-½</span>
          ) : (
            <span className="font-medium">
              <span className="text-primary/70">
                {analyzedGame.termination?.winner === 'white' ? '1' : '0'}
              </span>
              <span className="text-primary/70">-</span>
              <span className="text-primary/70">
                {analyzedGame.termination?.winner === 'black' ? '1' : '0'}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full border-[0.5px] bg-black" />
          <span className="font-medium">{analyzedGame.blackPlayer.name}</span>
          {analyzedGame.blackPlayer.rating && (
            <span className="text-primary/60">
              ({analyzedGame.blackPlayer.rating})
            </span>
          )}
        </div>
      </div>
    </div>
  )

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.2,
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 4,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: [0.25, 0.46, 0.45, 0.94],
        type: 'tween',
      },
    },
    exit: {
      opacity: 0,
      y: -4,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94],
        type: 'tween',
      },
    },
  }

  const desktopLayout = (
    <motion.div
      className="flex h-full w-full flex-col items-center py-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="flex h-full w-[90%] flex-row gap-3">
        <motion.div
          id="navigation"
          className="desktop-left-column-container flex flex-col overflow-hidden"
          variants={itemVariants}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-glassBorder bg-glass backdrop-blur-md">
            {/* Game info header */}
            <GameInfo
              title="Analysis"
              icon="bar_chart"
              type="analysis"
              embedded
            >
              <NestedGameInfo />
            </GameInfo>
            {/* Game list */}
            <div className="flex flex-col overflow-hidden">
              <div className="h-3" />
              <div className="max-h-[32vh] min-h-[32vh]">
                <AnalysisGameList
                  currentId={currentId}
                  loadNewWorldChampionshipGame={(newId, setCurrentMove) =>
                    getAndSetTournamentGame(newId, setCurrentMove)
                  }
                  loadNewLichessGame={(id, pgn, setCurrentMove) =>
                    getAndSetLichessGame(id, pgn, setCurrentMove)
                  }
                  loadNewMaiaGame={(id, type, setCurrentMove) =>
                    getAndSetUserGame(id, type, setCurrentMove)
                  }
                  onCustomAnalysis={() => setShowCustomModal(true)}
                  refreshTrigger={refreshTrigger}
                  embedded
                />
              </div>
            </div>
            {/* Moves + controller */}
            <div className="red-scrollbar flex h-full flex-1 flex-col overflow-y-auto">
              <div className="h-3 border-b border-glassBorder" />
              <MovesContainer
                game={analyzedGame}
                termination={analyzedGame.termination}
                showAnnotations={true}
                disableKeyboardNavigation={
                  controller.gameAnalysis.progress.isAnalyzing ||
                  controller.learnFromMistakes.state.isActive
                }
                disableMoveClicking={
                  controller.learnFromMistakes.state.isActive
                }
                embedded
                heightClass="h-40"
              />
              {/* No spacer here to keep controller tight to moves */}
              <BoardController
                gameTree={controller.gameTree}
                orientation={controller.orientation}
                setOrientation={controller.setOrientation}
                currentNode={controller.currentNode}
                plyCount={controller.plyCount}
                goToNode={controller.goToNode}
                goToNextNode={controller.goToNextNode}
                goToPreviousNode={controller.goToPreviousNode}
                goToRootNode={controller.goToRootNode}
                disableKeyboardNavigation={
                  controller.gameAnalysis.progress.isAnalyzing ||
                  controller.learnFromMistakes.state.isActive
                }
                disableNavigation={controller.learnFromMistakes.state.isActive}
                embedded
              />
            </div>
          </div>
        </motion.div>
        <motion.div
          className="desktop-middle-column-container flex flex-col gap-3"
          variants={itemVariants}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="flex w-full flex-col overflow-hidden">
            <PlayerInfo
              rounded="top"
              name={
                controller.orientation === 'white'
                  ? analyzedGame.blackPlayer.name
                  : analyzedGame.whitePlayer.name
              }
              rating={
                controller.orientation === 'white'
                  ? analyzedGame.blackPlayer.rating
                  : analyzedGame.whitePlayer.rating
              }
              color={controller.orientation === 'white' ? 'black' : 'white'}
              termination={analyzedGame.termination?.winner}
              currentFen={controller.currentNode?.fen}
              orientation={controller.orientation}
            />
            <div className="desktop-board-container relative flex aspect-square">
              <GameBoard
                game={analyzedGame}
                availableMoves={
                  controller.learnFromMistakes.state.isActive && analysisEnabled
                    ? new Map() // Empty moves when puzzle is solved
                    : controller.availableMoves
                }
                setCurrentSquare={setCurrentSquare}
                shapes={(() => {
                  const baseShapes = []

                  // Add analysis arrows only when analysis is enabled
                  if (analysisEnabled) {
                    baseShapes.push(...controller.arrows)
                  }

                  // Add mistake arrow during learn mode when analysis is disabled
                  if (
                    controller.learnFromMistakes.state.isActive &&
                    !analysisEnabled
                  ) {
                    const currentInfo =
                      controller.learnFromMistakes.getCurrentInfo()
                    if (currentInfo) {
                      const mistake = currentInfo.mistake
                      baseShapes.push({
                        brush: 'paleGrey',
                        orig: mistake.playedMove.slice(0, 2) as Key,
                        dest: mistake.playedMove.slice(2, 4) as Key,
                        modifiers: { lineWidth: 8 },
                      })
                    }
                  }

                  // Add hover arrow if present
                  if (hoverArrow) {
                    baseShapes.push(hoverArrow)
                  }

                  return baseShapes
                })()}
                currentNode={controller.currentNode as GameNode}
                orientation={controller.orientation}
                onPlayerMakeMove={onPlayerMakeMove}
                goToNode={controller.goToNode}
                gameTree={analyzedGame.tree}
              />
              {promotionFromTo ? (
                <PromotionOverlay
                  player={currentPlayer}
                  file={promotionFromTo[1].slice(0, 1)}
                  onPlayerSelectPromotion={onPlayerSelectPromotion}
                />
              ) : null}
            </div>
            <PlayerInfo
              rounded="bottom"
              name={
                controller.orientation === 'white'
                  ? analyzedGame.whitePlayer.name
                  : analyzedGame.blackPlayer.name
              }
              rating={
                controller.orientation === 'white'
                  ? analyzedGame.whitePlayer.rating
                  : analyzedGame.blackPlayer.rating
              }
              color={controller.orientation === 'white' ? 'white' : 'black'}
              termination={analyzedGame.termination?.winner}
              showArrowLegend={true}
              currentFen={controller.currentNode?.fen}
              orientation={controller.orientation}
            />
          </div>
          <ConfigurableScreens
            currentMaiaModel={controller.currentMaiaModel}
            setCurrentMaiaModel={controller.setCurrentMaiaModel}
            launchContinue={launchContinue}
            MAIA_MODELS={MAIA_MODELS}
            game={analyzedGame}
            currentNode={controller.currentNode as GameNode}
            onAnalyzeEntireGame={handleAnalyzeEntireGame}
            onLearnFromMistakes={handleLearnFromMistakes}
            isAnalysisInProgress={controller.gameAnalysis.progress.isAnalyzing}
            isLearnFromMistakesActive={
              controller.learnFromMistakes.state.isActive
            }
            autoSave={controller.gameAnalysis.autoSave}
            learnFromMistakesState={controller.learnFromMistakes.state}
            learnFromMistakesCurrentInfo={controller.learnFromMistakes.getCurrentInfo()}
            onShowSolution={handleShowSolution}
            onNextMistake={handleNextMistake}
            onStopLearnFromMistakes={handleStopLearnFromMistakes}
            onSelectPlayer={handleSelectPlayer}
            lastMoveResult={lastMoveResult}
          />
        </motion.div>
        <AnalysisSidebar
          hover={hover}
          makeMove={makeMove}
          controller={controller}
          setHoverArrow={setHoverArrow}
          analysisEnabled={analysisEnabled}
          handleToggleAnalysis={handleToggleAnalysis}
          itemVariants={itemVariants}
        />
      </div>
    </motion.div>
  )

  const [showGameListMobile, setShowGameListMobile] = useState(false)

  const mobileLayout = (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="flex h-full flex-1 flex-col justify-center gap-1">
        {showGameListMobile ? (
          <div className="flex w-full flex-col items-start justify-start gap-1">
            <div className="flex w-full flex-col items-start justify-start overflow-hidden bg-background-1 p-3">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center justify-start gap-1.5">
                  <span className="material-symbols-outlined text-xl">
                    format_list_bulleted
                  </span>
                  <h2 className="text-xl font-semibold">Switch Game</h2>
                </div>
                <button
                  className="flex items-center gap-1 rounded bg-background-2 px-2 py-1 text-sm duration-200 hover:bg-background-3"
                  onClick={() => setShowGameListMobile(false)}
                >
                  <span className="material-symbols-outlined text-sm">
                    arrow_back
                  </span>
                  <span>Back to Analysis</span>
                </button>
              </div>
              <p className="mt-1 text-sm text-secondary">
                Select a game to analyze
              </p>
            </div>
            <div className="flex h-[calc(100vh-10rem)] w-full flex-col overflow-hidden rounded bg-backdrop/30">
              <AnalysisGameList
                currentId={currentId}
                loadNewWorldChampionshipGame={(newId, setCurrentMove) =>
                  loadGameAndCloseList(
                    getAndSetTournamentGame(newId, setCurrentMove),
                  )
                }
                loadNewLichessGame={(id, pgn, setCurrentMove) =>
                  loadGameAndCloseList(
                    getAndSetLichessGame(id, pgn, setCurrentMove),
                  )
                }
                loadNewMaiaGame={(id, type, setCurrentMove) =>
                  loadGameAndCloseList(
                    getAndSetUserGame(id, type, setCurrentMove),
                  )
                }
                onCustomAnalysis={() => {
                  setShowCustomModal(true)
                  setShowGameListMobile(false)
                }}
                onGameSelected={() => setShowGameListMobile(false)}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
        ) : (
          <motion.div
            className="flex w-full flex-col items-start justify-start gap-1"
            variants={itemVariants}
            style={{ willChange: 'transform, opacity' }}
          >
            <GameInfo
              title="Analysis"
              icon="bar_chart"
              type="analysis"
              currentMaiaModel={controller.currentMaiaModel}
              setCurrentMaiaModel={controller.setCurrentMaiaModel}
              MAIA_MODELS={MAIA_MODELS}
              onGameListClick={() => setShowGameListMobile(true)}
              showGameListButton={true}
            >
              <NestedGameInfo />
            </GameInfo>
            <div id="analysis" className="relative flex h-[100vw] w-screen">
              <GameBoard
                game={analyzedGame}
                availableMoves={
                  controller.learnFromMistakes.state.isActive && analysisEnabled
                    ? new Map() // Empty moves when puzzle is solved
                    : controller.availableMoves
                }
                setCurrentSquare={setCurrentSquare}
                shapes={(() => {
                  const baseShapes = []

                  // Add analysis arrows only when analysis is enabled
                  if (analysisEnabled) {
                    baseShapes.push(...controller.arrows)
                  }

                  // Add mistake arrow during learn mode when analysis is disabled
                  if (
                    controller.learnFromMistakes.state.isActive &&
                    !analysisEnabled
                  ) {
                    const currentInfo =
                      controller.learnFromMistakes.getCurrentInfo()
                    if (currentInfo) {
                      const mistake = currentInfo.mistake
                      baseShapes.push({
                        brush: 'paleGrey',
                        orig: mistake.playedMove.slice(0, 2) as Key,
                        dest: mistake.playedMove.slice(2, 4) as Key,
                        modifiers: { lineWidth: 8 },
                      })
                    }
                  }

                  // Add hover arrow if present
                  if (hoverArrow) {
                    baseShapes.push(hoverArrow)
                  }

                  return baseShapes
                })()}
                currentNode={controller.currentNode as GameNode}
                orientation={controller.orientation}
                onPlayerMakeMove={onPlayerMakeMove}
                goToNode={controller.goToNode}
                gameTree={analyzedGame.tree}
              />
              {promotionFromTo ? (
                <PromotionOverlay
                  player={currentPlayer}
                  file={promotionFromTo[1].slice(0, 1)}
                  onPlayerSelectPromotion={onPlayerSelectPromotion}
                />
              ) : null}
            </div>
            <div className="flex w-full flex-col gap-0">
              <div className="w-full !flex-grow-0">
                <BoardController
                  gameTree={controller.gameTree}
                  orientation={controller.orientation}
                  setOrientation={controller.setOrientation}
                  currentNode={controller.currentNode}
                  plyCount={controller.plyCount}
                  goToNode={controller.goToNode}
                  goToNextNode={controller.goToNextNode}
                  goToPreviousNode={controller.goToPreviousNode}
                  goToRootNode={controller.goToRootNode}
                  disableKeyboardNavigation={
                    controller.gameAnalysis.progress.isAnalyzing ||
                    controller.learnFromMistakes.state.isActive
                  }
                  disableNavigation={
                    controller.learnFromMistakes.state.isActive
                  }
                />
              </div>
              <div className="relative bottom-0 h-48 max-h-48 flex-1 overflow-auto overflow-y-hidden">
                <MovesContainer
                  game={analyzedGame}
                  termination={analyzedGame.termination}
                  showAnnotations={true}
                  disableKeyboardNavigation={
                    controller.gameAnalysis.progress.isAnalyzing ||
                    controller.learnFromMistakes.state.isActive
                  }
                  disableMoveClicking={
                    controller.learnFromMistakes.state.isActive
                  }
                />
              </div>
            </div>
            <div className="flex w-full flex-col gap-1 overflow-hidden">
              {/* Analysis Toggle Bar */}
              <div className="flex items-center justify-between rounded bg-background-1 px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">
                    analytics
                  </span>
                  <h3 className="font-semibold">Analysis</h3>
                </div>
                <button
                  onClick={handleToggleAnalysis}
                  className={`flex items-center gap-2 rounded px-3 py-1 text-sm transition-colors ${
                    analysisEnabled
                      ? 'bg-human-4 text-white hover:bg-human-4/80'
                      : 'bg-background-2 text-secondary hover:bg-background-3'
                  }`}
                >
                  <span className="material-symbols-outlined !text-sm">
                    {analysisEnabled ? 'visibility' : 'visibility_off'}
                  </span>
                  {analysisEnabled ? 'Visible' : 'Hidden'}
                </button>
              </div>

              <div className="relative">
                <Highlight
                  hover={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? hover
                      : mockHover
                  }
                  makeMove={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? makeMove
                      : mockMakeMove
                  }
                  currentMaiaModel={controller.currentMaiaModel}
                  setCurrentMaiaModel={controller.setCurrentMaiaModel}
                  recommendations={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? controller.moveRecommendations
                      : emptyRecommendations
                  }
                  moveEvaluation={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? (controller.moveEvaluation as {
                          maia?: MaiaEvaluation
                          stockfish?: StockfishEvaluation
                        })
                      : {
                          maia: undefined,
                          stockfish: undefined,
                        }
                  }
                  colorSanMapping={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? controller.colorSanMapping
                      : {}
                  }
                  boardDescription={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? controller.boardDescription
                      : {
                          segments: [
                            {
                              type: 'text',
                              content: controller.learnFromMistakes.state
                                .isActive
                                ? 'Analysis is hidden during Learn from Mistakes mode.'
                                : 'Analysis is disabled. Enable analysis to see detailed move evaluations and recommendations.',
                            },
                          ],
                        }
                  }
                  currentNode={controller.currentNode}
                />
                {(!analysisEnabled ||
                  controller.learnFromMistakes.state.isActive) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                        lock
                      </span>
                      <p className="text-xs font-medium text-primary">
                        {controller.learnFromMistakes.state.isActive
                          ? 'Learning Mode Active'
                          : 'Analysis Disabled'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <BlunderMeter
                  hover={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? hover
                      : mockHover
                  }
                  makeMove={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? makeMove
                      : mockMakeMove
                  }
                  data={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? controller.blunderMeter
                      : emptyBlunderMeterData
                  }
                  colorSanMapping={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? controller.colorSanMapping
                      : {}
                  }
                  moveEvaluation={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? controller.moveEvaluation
                      : undefined
                  }
                />
                {(!analysisEnabled ||
                  controller.learnFromMistakes.state.isActive) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                        lock
                      </span>
                      <p className="text-xs font-medium text-primary">
                        {controller.learnFromMistakes.state.isActive
                          ? 'Learning Mode Active'
                          : 'Analysis Disabled'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <MovesByRating
                  moves={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? controller.movesByRating
                      : undefined
                  }
                  colorSanMapping={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? controller.colorSanMapping
                      : {}
                  }
                />
                {(!analysisEnabled ||
                  controller.learnFromMistakes.state.isActive) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                        lock
                      </span>
                      <p className="text-xs font-medium text-primary">
                        {controller.learnFromMistakes.state.isActive
                          ? 'Learning Mode Active'
                          : 'Analysis Disabled'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <MoveMap
                  moveMap={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? controller.moveMap
                      : undefined
                  }
                  colorSanMapping={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? controller.colorSanMapping
                      : {}
                  }
                  setHoverArrow={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? setHoverArrow
                      : mockSetHoverArrow
                  }
                  makeMove={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? makeMove
                      : mockMakeMove
                  }
                />
                {(!analysisEnabled ||
                  controller.learnFromMistakes.state.isActive) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                        lock
                      </span>
                      <p className="text-xs font-medium text-primary">
                        {controller.learnFromMistakes.state.isActive
                          ? 'Learning Mode Active'
                          : 'Analysis Disabled'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <ConfigurableScreens
              currentMaiaModel={controller.currentMaiaModel}
              setCurrentMaiaModel={controller.setCurrentMaiaModel}
              launchContinue={launchContinue}
              MAIA_MODELS={MAIA_MODELS}
              game={analyzedGame}
              onAnalyzeEntireGame={handleAnalyzeEntireGame}
              onLearnFromMistakes={handleLearnFromMistakes}
              isAnalysisInProgress={
                controller.gameAnalysis.progress.isAnalyzing
              }
              isLearnFromMistakesActive={
                controller.learnFromMistakes.state.isActive
              }
              autoSave={controller.gameAnalysis.autoSave}
              currentNode={controller.currentNode as GameNode}
              learnFromMistakesState={controller.learnFromMistakes.state}
              learnFromMistakesCurrentInfo={controller.learnFromMistakes.getCurrentInfo()}
              onShowSolution={handleShowSolution}
              onNextMistake={handleNextMistake}
              onStopLearnFromMistakes={handleStopLearnFromMistakes}
              onSelectPlayer={handleSelectPlayer}
              lastMoveResult={lastMoveResult}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  )

  // Helper function to load a game and close the game list
  const loadGameAndCloseList = async (loadFunction: Promise<void>) => {
    await loadFunction
    setShowGameListMobile(false)
  }

  return (
    <>
      <Head>
        <title>
          {analyzedGame
            ? `Analyze: ${analyzedGame.whitePlayer.name} vs ${analyzedGame.blackPlayer.name} – Maia Chess`
            : 'Analyze – Maia Chess'}
        </title>
        <meta
          name="description"
          content={
            analyzedGame
              ? `Analyze ${analyzedGame.whitePlayer.name} vs ${analyzedGame.blackPlayer.name} with human-aware AI. See what real players would do, explore moves by rating level, and spot where blunders are most likely to occur.`
              : 'Analyze chess games with human-aware AI. Combine Stockfish precision with human tendencies learned from millions of games. See what works at your rating level, not just for computers.'
          }
        />
      </Head>
      {/* Radial gradient backdrop to match new design language */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 60% at center top, rgba(239, 68, 68, 0.08) 0%, transparent 60%)',
        }}
      />
      <AnimatePresence>
        {controller.maia.status === 'no-cache' ||
        controller.maia.status === 'downloading' ? (
          <DownloadModelModal
            progress={controller.maia.progress}
            download={controller.maia.downloadModel}
          />
        ) : null}
      </AnimatePresence>
      <TreeControllerContext.Provider value={controller}>
        {analyzedGame && <div>{isMobile ? mobileLayout : desktopLayout}</div>}
      </TreeControllerContext.Provider>
      <AnimatePresence>
        {showCustomModal && (
          <CustomAnalysisModal
            onSubmit={handleCustomAnalysis}
            onClose={() => setShowCustomModal(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAnalysisConfigModal && (
          <AnalysisConfigModal
            isOpen={showAnalysisConfigModal}
            onClose={() => setShowAnalysisConfigModal(false)}
            onConfirm={handleAnalysisConfigConfirm}
            initialDepth={controller.gameAnalysis.config.targetDepth}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {controller.gameAnalysis.progress.isAnalyzing && (
          <>
            <AnalysisOverlay
              isActive={controller.gameAnalysis.progress.isAnalyzing}
            />
            <AnalysisNotification
              progress={controller.gameAnalysis.progress}
              onCancel={handleAnalysisCancel}
            />
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default function AuthenticatedAnalysisPage() {
  return (
    <AuthenticatedWrapper>
      <AnalysisPage />
    </AuthenticatedWrapper>
  )
}
