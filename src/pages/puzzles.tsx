/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import {
  useMemo,
  Dispatch,
  useState,
  useEffect,
  useContext,
  useCallback,
  SetStateAction,
  useRef,
} from 'react'
import Head from 'next/head'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'
import { Chess, PieceSymbol } from 'chess.ts'
import { AnimatePresence, motion } from 'framer-motion'
import {
  fetchPuzzle,
  logPuzzleGuesses,
  fetchTrainingPlayerStats,
} from 'src/api'
import {
  trackPuzzleStarted,
  trackPuzzleMoveAttempted,
  trackPuzzleCompleted,
} from 'src/lib/analytics'
import {
  Loading,
  GameInfo,
  Feedback,
  PuzzleLog,
  StatsDisplay,
  BoardController,
  AuthenticatedWrapper,
  GameBoard,
  PromotionOverlay,
  DownloadModelModal,
  Highlight,
  MoveMap,
  BlunderMeter,
  AnalysisSidebar,
} from 'src/components'
import { useTrainingController } from 'src/hooks/useTrainingController'
import { useAnalysisController } from 'src/hooks/useAnalysisController'
import { AllStats, useStats } from 'src/hooks/useStats'
import { PuzzleGame, Status } from 'src/types/puzzle'
import { AnalyzedGame, MaiaEvaluation, StockfishEvaluation } from 'src/types'
import { WindowSizeContext, useTour } from 'src/contexts'
import { TrainingControllerContext } from 'src/contexts/TrainingControllerContext'
import {
  getCurrentPlayer,
  getAvailableMovesArray,
  requiresPromotion,
} from 'src/lib/puzzle'
import { tourConfigs } from 'src/constants/tours'

const statsLoader = async () => {
  const stats = await fetchTrainingPlayerStats()
  return {
    gamesPlayed: Math.max(0, stats.totalPuzzles),
    gamesWon: stats.puzzlesSolved,
    rating: stats.rating,
  }
}

const TrainPage: NextPage = () => {
  const router = useRouter()
  const { startTour, tourState } = useTour()

  const [trainingGames, setTrainingGames] = useState<PuzzleGame[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [status, setStatus] = useState<Status>('default')
  const [stats, incrementStats, updateRating] = useStats(statsLoader)
  const [userGuesses, setUserGuesses] = useState<string[]>([])
  const [previousGameResults, setPreviousGameResults] = useState<
    (PuzzleGame & { result?: boolean; ratingDiff?: number })[]
  >([])
  const [initialTourCheck, setInitialTourCheck] = useState(false)
  const [loadingGame, setLoadingGame] = useState(false)
  const [lastAttemptedMove, setLastAttemptedMove] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (!initialTourCheck && tourState.ready) {
      setInitialTourCheck(true)
      // Always attempt to start the tour - the tour context will handle completion checking
      startTour(tourConfigs.train.id, tourConfigs.train.steps, false)
    }
  }, [initialTourCheck, startTour, tourState.ready])

  const getNewGame = useCallback(async () => {
    setLoadingGame(true)
    let game
    try {
      game = await fetchPuzzle()
    } catch (e) {
      router.push('/401')
      return
    }

    // Track puzzle started
    trackPuzzleStarted(game.id, stats?.rating || 0)

    setStatus('default')
    setUserGuesses([])
    setLastAttemptedMove(null)
    setCurrentIndex(trainingGames.length)
    setTrainingGames(trainingGames.concat([game]))
    setPreviousGameResults(previousGameResults.concat([{ ...game }]))
    setLoadingGame(false)
  }, [trainingGames, previousGameResults, router, stats?.rating])

  const logGuess = useCallback(
    async (
      gameId: string,
      move: [string, string] | null,
      status: Status,
      setStatus: Dispatch<SetStateAction<Status>>,
      rating: number,
    ) => {
      const puzzleIdx = currentIndex

      if (puzzleIdx != trainingGames.length - 1) {
        return // No logging for past puzzles
      }

      const newGuesses = move
        ? userGuesses.concat([move[0] + move[1]])
        : userGuesses
      setUserGuesses(newGuesses)
      setStatus('loading')

      // Track move attempt if a move was made
      if (move) {
        const moveUci = move[0] + move[1]
        trackPuzzleMoveAttempted(gameId, moveUci, newGuesses.length, false) // Will update correctness after response
      }

      const response = await logPuzzleGuesses(
        gameId,
        newGuesses,
        status === 'forfeit',
      )

      if (status === 'forfeit') {
        setPreviousGameResults((prev) => {
          return prev.map((game, index) => {
            return index === puzzleIdx
              ? {
                  ...game,
                  result: false,
                  ratingDiff: game.ratingDiff ?? response.puzzle_elo - rating,
                }
              : game
          })
        })

        // Track puzzle completion (forfeit)
        trackPuzzleCompleted(
          gameId,
          'forfeit',
          newGuesses.length,
          0, // No time tracking for forfeit
          response.puzzle_elo,
          response.puzzle_elo - rating,
        )

        // If the user forfeits, update their stats
        if (userGuesses.length === 0) {
          updateRating(response.puzzle_elo)
          incrementStats(1, 0)
        }
        return
      }

      if (response.correct_moves.includes(newGuesses[newGuesses.length - 1])) {
        setStatus('correct')
      } else {
        setStatus('incorrect')
      }

      if (userGuesses.length == 0) {
        const result = response.correct_moves.includes(newGuesses[0])
        // This was the first guess, which is the only one that counts for correctness
        // After waiting for a while after logging the guess to accomodate slow server,
        // update stats
        if (newGuesses.length && response.correct_moves) {
          setPreviousGameResults((prev) => {
            return prev.map((game, index) => {
              return index === puzzleIdx
                ? {
                    ...game,
                    result,
                    ratingDiff: response.puzzle_elo - rating,
                  }
                : game
            })
          })
        }

        // Track puzzle completion (correct/incorrect)
        trackPuzzleCompleted(
          gameId,
          result ? 'correct' : 'forfeit',
          newGuesses.length,
          0, // No time tracking implemented yet
          response.puzzle_elo,
          response.puzzle_elo - rating,
        )

        updateRating(response.puzzle_elo)
        incrementStats(1, result ? 1 : 0)
      }
    },
    [currentIndex, trainingGames.length, userGuesses, incrementStats],
  )

  useEffect(() => {
    if (trainingGames.length === 0 && !loadingGame) getNewGame()
  }, [getNewGame, trainingGames.length, loadingGame])

  if (loadingGame || trainingGames.length === 0) {
    return (
      <Loading isLoading={true}>
        <div></div>
      </Loading>
    )
  }

  if (trainingGames.length && trainingGames[currentIndex])
    return (
      <Train
        key={trainingGames[currentIndex].id}
        status={status}
        setStatus={setStatus}
        trainingGame={trainingGames[currentIndex]}
        viewing={currentIndex !== trainingGames.length - 1}
        stats={stats}
        getNewGame={getNewGame}
        logGuess={logGuess}
        lastAttemptedMove={lastAttemptedMove}
        setLastAttemptedMove={setLastAttemptedMove}
        gamesController={
          <>
            <div className="relative bottom-0 flex h-full min-h-[38px] flex-1 flex-col justify-start overflow-auto">
              <div className="hidden md:block">
                <PuzzleLog
                  previousGameResults={previousGameResults}
                  setCurrentIndex={setCurrentIndex}
                  embedded
                />
              </div>
              <div className="md:hidden">
                <PuzzleLog
                  previousGameResults={previousGameResults}
                  setCurrentIndex={setCurrentIndex}
                />
              </div>
            </div>
          </>
        }
      />
    )

  return (
    <Loading isLoading={true}>
      <div></div>
    </Loading>
  )
}

interface Props {
  trainingGame: PuzzleGame
  gamesController: React.ReactNode
  stats: AllStats
  status: Status
  setStatus: Dispatch<SetStateAction<Status>>
  viewing?: boolean
  getNewGame: () => Promise<void>
  logGuess: (
    gameId: string,
    move: [string, string] | null,
    status: Status,
    setStatus: Dispatch<SetStateAction<Status>>,
    rating: number,
  ) => void
  lastAttemptedMove: string | null
  setLastAttemptedMove: Dispatch<SetStateAction<string | null>>
}

const Train: React.FC<Props> = ({
  trainingGame,
  gamesController,
  stats,
  status,
  setStatus,
  getNewGame,
  logGuess,
  lastAttemptedMove,
  setLastAttemptedMove,
}: Props) => {
  const controller = useTrainingController(trainingGame)

  const analyzedGame = useMemo(() => {
    return { ...trainingGame, type: 'play', availableMoves: [] } as AnalyzedGame
  }, [trainingGame])

  const analysisController = useAnalysisController(
    analyzedGame,
    controller.orientation,
    false, // Disable auto-saving on puzzles page
  )

  const { width } = useContext(WindowSizeContext)
  const isMobile = useMemo(() => width > 0 && width <= 670, [width])
  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)
  const analysisSyncedRef = useRef(false)
  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)
  const [userAnalysisEnabled, setUserAnalysisEnabled] = useState<
    boolean | null
  >(null) // User's choice, null means not set

  const showAnalysis =
    status === 'correct' || status === 'forfeit' || status === 'archived'

  // Analysis is enabled when:
  // 1. Puzzle is complete (showAnalysis is true) AND
  // 2. User hasn't explicitly disabled it, OR user has explicitly enabled it
  const analysisEnabled = showAnalysis && userAnalysisEnabled !== false

  const handleToggleAnalysis = useCallback(() => {
    setUserAnalysisEnabled((prev) => {
      // If user hasn't made a choice yet, set it to the opposite of current state
      if (prev === null) {
        return !analysisEnabled
      }
      // Otherwise, toggle the user's explicit choice
      return !prev
    })
  }, [analysisEnabled])

  // Create empty data structures for when analysis is disabled
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

  const currentPlayer = useMemo(() => {
    const currentNode =
      analysisEnabled && showAnalysis
        ? analysisController.currentNode
        : controller.currentNode
    return getCurrentPlayer(currentNode)
  }, [
    analysisEnabled,
    showAnalysis,
    analysisController.currentNode,
    controller.currentNode,
  ])

  useEffect(() => {
    if (analysisEnabled && showAnalysis && !analysisSyncedRef.current) {
      // Set the analysis controller to the current training controller's node
      // Only sync once when analysis mode is first enabled
      analysisController.setCurrentNode(controller.currentNode)
      analysisSyncedRef.current = true
    } else if (!showAnalysis || !analysisEnabled) {
      // Reset sync flag when exiting analysis mode
      analysisSyncedRef.current = false
    }
  }, [
    analysisEnabled,
    showAnalysis,
    analysisController,
    controller.currentNode,
  ])

  const onSelectSquare = useCallback(
    (square: Key) => {
      if (!analysisEnabled && !showAnalysis) {
        controller.reset()
        setLastAttemptedMove(null)
        setStatus('default')
      }
    },
    [controller, analysisEnabled, showAnalysis, setLastAttemptedMove],
  )

  const onPlayerMakeMove = useCallback(
    (playedMove: [string, string] | null) => {
      if (!playedMove) return

      if (analysisEnabled && showAnalysis) {
        const availableMoves = getAvailableMovesArray(
          analysisController.availableMoves,
        )

        if (requiresPromotion(playedMove, availableMoves)) {
          setPromotionFromTo(playedMove)
          return
        }

        // Single move or already has promotion
        const moveUci = playedMove[0] + playedMove[1]

        if (!analysisController.currentNode || !analyzedGame.tree) return

        const chess = new Chess(analysisController.currentNode.fen)
        const moveAttempt = chess.move({
          from: moveUci.slice(0, 2),
          to: moveUci.slice(2, 4),
          promotion: moveUci[4] ? (moveUci[4] as PieceSymbol) : undefined,
        })

        if (moveAttempt) {
          const newFen = chess.fen()
          const moveString =
            moveAttempt.from +
            moveAttempt.to +
            (moveAttempt.promotion ? moveAttempt.promotion : '')
          const san = moveAttempt.san

          if (analysisController.currentNode.mainChild?.move === moveString) {
            analysisController.goToNode(
              analysisController.currentNode.mainChild,
            )
          } else {
            const newVariation = analyzedGame.tree.addVariationNode(
              analysisController.currentNode,
              newFen,
              moveString,
              san,
              analysisController.currentMaiaModel,
            )
            analysisController.goToNode(newVariation)
          }
        }
      } else {
        // In puzzle mode, check for promotions in available moves
        const availableMoves = getAvailableMovesArray(
          controller.availableMovesMapped,
        )

        if (requiresPromotion(playedMove, availableMoves)) {
          setPromotionFromTo(playedMove)
          return
        }

        const moveUci = playedMove[0] + playedMove[1]

        // Capture the SAN notation before making the move
        const chess = new Chess(controller.currentNode.fen)
        const moveAttempt = chess.move({
          from: moveUci.slice(0, 2),
          to: moveUci.slice(2, 4),
          promotion: moveUci[4] ? (moveUci[4] as PieceSymbol) : undefined,
        })

        if (moveAttempt) {
          setLastAttemptedMove(moveAttempt.san)
        }

        controller.onPlayerGuess(moveUci)

        const currentStatus = status as Status
        if (currentStatus !== 'correct' && currentStatus !== 'forfeit') {
          logGuess(
            trainingGame.id,
            playedMove,
            currentStatus,
            setStatus,
            stats.rating ?? 0,
          )
        }
      }
    },
    [
      controller,
      logGuess,
      trainingGame.id,
      status,
      setStatus,
      showAnalysis,
      analysisController,
      analyzedGame,
    ],
  )

  const onPlayerSelectPromotion = useCallback(
    (piece: string) => {
      if (!promotionFromTo) {
        return
      }
      setPromotionFromTo(null)
      const moveUci = promotionFromTo[0] + promotionFromTo[1] + piece

      if (analysisEnabled && showAnalysis) {
        // In analysis mode
        if (!analysisController.currentNode || !analyzedGame.tree) return

        const chess = new Chess(analysisController.currentNode.fen)
        const moveAttempt = chess.move({
          from: moveUci.slice(0, 2),
          to: moveUci.slice(2, 4),
          promotion: piece as PieceSymbol,
        })

        if (moveAttempt) {
          const newFen = chess.fen()
          const moveString = moveUci
          const san = moveAttempt.san

          if (analysisController.currentNode.mainChild?.move === moveString) {
            analysisController.goToNode(
              analysisController.currentNode.mainChild,
            )
          } else {
            const newVariation = analyzedGame.tree.addVariationNode(
              analysisController.currentNode,
              newFen,
              moveString,
              san,
              analysisController.currentMaiaModel,
            )
            analysisController.goToNode(newVariation)
          }
        }
      } else {
        // In puzzle mode
        // Capture the SAN notation before making the move
        const chess = new Chess(controller.currentNode.fen)
        const moveAttempt = chess.move({
          from: moveUci.slice(0, 2),
          to: moveUci.slice(2, 4),
          promotion: piece as PieceSymbol,
        })

        if (moveAttempt) {
          setLastAttemptedMove(moveAttempt.san)
        }

        controller.onPlayerGuess(moveUci)

        const currentStatus = status as Status
        if (currentStatus !== 'correct' && currentStatus !== 'forfeit') {
          logGuess(
            trainingGame.id,
            promotionFromTo,
            currentStatus,
            setStatus,
            stats.rating ?? 0,
          )
        }
      }
    },
    [
      promotionFromTo,
      setPromotionFromTo,
      showAnalysis,
      analysisController,
      analyzedGame,
      controller,
      status,
      logGuess,
      trainingGame.id,
      setStatus,
      stats.rating,
    ],
  )

  const setAndGiveUp = useCallback(() => {
    logGuess(trainingGame.id, null, 'forfeit', setStatus, stats.rating ?? 0)
    setStatus('forfeit')
  }, [trainingGame.id, logGuess, setStatus, stats.rating])

  // Removed "Continue Against Maia" from puzzles page; no need for launcher

  const hover = useCallback(
    (move?: string) => {
      if (move && analysisEnabled && showAnalysis) {
        setHoverArrow({
          orig: move.slice(0, 2) as Key,
          dest: move.slice(2, 4) as Key,
          brush: 'green',
          modifiers: { lineWidth: 10 },
        })
      } else {
        setHoverArrow(null)
      }
    },
    [analysisEnabled, showAnalysis],
  )

  const makeMove = useCallback(
    (move: string) => {
      if (
        !analysisEnabled ||
        !showAnalysis ||
        !analysisController.currentNode ||
        !analyzedGame.tree
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
          const newVariation = analyzedGame.tree.addVariationNode(
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
    [showAnalysis, analysisController, analyzedGame],
  )

  /**
   * No-op handlers for blurred analysis components in puzzle mode
   */
  const mockHover = useCallback(() => {
    // Intentionally empty - no interaction allowed in puzzle mode
  }, [])
  const mockMakeMove = useCallback(() => {
    // Intentionally empty - no moves allowed in puzzle mode
  }, [])
  const mockSetHoverArrow = useCallback(() => {
    // Intentionally empty - no hover arrows in puzzle mode
  }, [])

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
          className="desktop-left-column-container flex flex-col overflow-hidden"
          variants={itemVariants}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="border-glass-border flex h-full w-full flex-col overflow-hidden rounded-md border bg-glass backdrop-blur-md">
            {/* Header */}
            <GameInfo title="Puzzles" icon="target" type="train" embedded>
              <div className="flex w-full flex-col justify-start text-sm text-secondary 2xl:text-base">
                <span>
                  Puzzle{' '}
                  <span className="text-secondary/60">#{trainingGame.id}</span>
                </span>
                <span>
                  Rating:{' '}
                  {status !== 'correct' && status !== 'forfeit' ? (
                    <span className="text-secondary/60">hidden</span>
                  ) : (
                    <span className="text-human-2">
                      {trainingGame.puzzle_elo}
                    </span>
                  )}
                </span>
              </div>
            </GameInfo>

            {/* Puzzle log */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="h-3" />
              {gamesController}
            </div>

            {/* Stats */}
            <div className="flex flex-col">
              <div className="h-3" />
              <StatsDisplay stats={stats} embedded />
            </div>
          </div>
        </motion.div>

        <motion.div
          className="desktop-middle-column-container flex flex-col gap-2"
          variants={itemVariants}
          style={{ willChange: 'transform, opacity' }}
        >
          <div
            id="train-page"
            className="desktop-board-container relative flex aspect-square"
          >
            <GameBoard
              game={trainingGame}
              currentNode={
                analysisEnabled && showAnalysis
                  ? analysisController.currentNode
                  : controller.currentNode
              }
              orientation={
                analysisEnabled && showAnalysis
                  ? analysisController.orientation
                  : controller.orientation
              }
              onPlayerMakeMove={onPlayerMakeMove}
              availableMoves={
                analysisEnabled && showAnalysis
                  ? analysisController.availableMoves
                  : controller.availableMovesMapped
              }
              shapes={
                analysisEnabled && showAnalysis
                  ? hoverArrow
                    ? [...analysisController.arrows, hoverArrow]
                    : [...analysisController.arrows]
                  : hoverArrow
                    ? [hoverArrow]
                    : []
              }
              onSelectSquare={onSelectSquare}
              goToNode={
                analysisEnabled && showAnalysis
                  ? analysisController.goToNode
                  : undefined
              }
              gameTree={
                analysisEnabled && showAnalysis ? analyzedGame.tree : undefined
              }
            />
            {promotionFromTo ? (
              <PromotionOverlay
                player={currentPlayer}
                file={promotionFromTo[1].slice(0, 1)}
                onPlayerSelectPromotion={onPlayerSelectPromotion}
              />
            ) : null}
          </div>
          <BoardController
            orientation={
              analysisEnabled && showAnalysis
                ? analysisController.orientation
                : controller.orientation
            }
            setOrientation={
              analysisEnabled && showAnalysis
                ? analysisController.setOrientation
                : controller.setOrientation
            }
            currentNode={
              analysisEnabled && showAnalysis
                ? analysisController.currentNode
                : controller.currentNode
            }
            plyCount={
              analysisEnabled && showAnalysis
                ? analysisController.plyCount
                : controller.plyCount
            }
            goToNode={
              analysisEnabled && showAnalysis
                ? analysisController.goToNode
                : controller.goToNode
            }
            goToNextNode={
              analysisEnabled && showAnalysis
                ? analysisController.goToNextNode
                : controller.goToNextNode
            }
            goToPreviousNode={
              analysisEnabled && showAnalysis
                ? analysisController.goToPreviousNode
                : controller.goToPreviousNode
            }
            goToRootNode={
              analysisEnabled && showAnalysis
                ? analysisController.goToRootNode
                : controller.goToRootNode
            }
            gameTree={
              analysisEnabled && showAnalysis
                ? analysisController.gameTree
                : controller.gameTree
            }
            embedded
          />
          <div className="flex w-full flex-1">
            <Feedback
              status={status}
              game={trainingGame}
              setStatus={setStatus}
              setAndGiveUp={setAndGiveUp}
              controller={controller}
              getNewGame={getNewGame}
              lastAttemptedMove={lastAttemptedMove}
              setLastAttemptedMove={setLastAttemptedMove}
            />
          </div>
        </motion.div>
        <AnalysisSidebar
          hover={hover}
          makeMove={makeMove}
          controller={analysisController}
          setHoverArrow={setHoverArrow}
          analysisEnabled={analysisEnabled}
          handleToggleAnalysis={handleToggleAnalysis}
          itemVariants={itemVariants}
        />
      </div>
    </motion.div>
  )

  const mobileLayout = (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="flex h-full flex-1 flex-col justify-center gap-1">
        <div className="mt-2 flex h-full flex-col items-start justify-start gap-1">
          <motion.div
            className="flex h-auto w-full flex-col"
            variants={itemVariants}
            style={{ willChange: 'transform, opacity' }}
          >
            <GameInfo title="Puzzles" icon="target" type="train">
              <div className="flex w-full items-center justify-between text-secondary">
                <span>
                  Puzzle{' '}
                  <span className="text-secondary/60">#{trainingGame.id}</span>
                </span>
                <span>
                  Rating:{' '}
                  {status !== 'correct' && status !== 'forfeit' ? (
                    <span className="text-secondary/60">hidden</span>
                  ) : (
                    <span className="text-human-2">
                      {trainingGame.puzzle_elo}
                    </span>
                  )}
                </span>
              </div>
            </GameInfo>
          </motion.div>
          <div
            id="train-page"
            className="relative flex aspect-square h-[100vw] w-screen"
          >
            <GameBoard
              game={trainingGame}
              currentNode={
                analysisEnabled && showAnalysis
                  ? analysisController.currentNode
                  : controller.currentNode
              }
              orientation={
                analysisEnabled && showAnalysis
                  ? analysisController.orientation
                  : controller.orientation
              }
              availableMoves={
                analysisEnabled && showAnalysis
                  ? analysisController.availableMoves
                  : controller.availableMovesMapped
              }
              onPlayerMakeMove={onPlayerMakeMove}
              shapes={
                analysisEnabled && showAnalysis
                  ? hoverArrow
                    ? [...analysisController.arrows, hoverArrow]
                    : [...analysisController.arrows]
                  : hoverArrow
                    ? [hoverArrow]
                    : []
              }
              onSelectSquare={onSelectSquare}
              goToNode={
                analysisEnabled && showAnalysis
                  ? analysisController.goToNode
                  : undefined
              }
              gameTree={
                analysisEnabled && showAnalysis ? analyzedGame.tree : undefined
              }
            />
            {promotionFromTo ? (
              <PromotionOverlay
                player={currentPlayer}
                file={promotionFromTo[1].slice(0, 1)}
                onPlayerSelectPromotion={onPlayerSelectPromotion}
              />
            ) : null}
          </div>
          <div className="flex h-auto w-full flex-col gap-1">
            <div className="flex-none">
              <BoardController
                orientation={
                  analysisEnabled && showAnalysis
                    ? analysisController.orientation
                    : controller.orientation
                }
                setOrientation={
                  analysisEnabled && showAnalysis
                    ? analysisController.setOrientation
                    : controller.setOrientation
                }
                currentNode={
                  analysisEnabled && showAnalysis
                    ? analysisController.currentNode
                    : controller.currentNode
                }
                plyCount={
                  analysisEnabled && showAnalysis
                    ? analysisController.plyCount
                    : controller.plyCount
                }
                goToNode={
                  analysisEnabled && showAnalysis
                    ? analysisController.goToNode
                    : controller.goToNode
                }
                goToNextNode={
                  analysisEnabled && showAnalysis
                    ? analysisController.goToNextNode
                    : controller.goToNextNode
                }
                goToPreviousNode={
                  analysisEnabled && showAnalysis
                    ? analysisController.goToPreviousNode
                    : controller.goToPreviousNode
                }
                goToRootNode={
                  analysisEnabled && showAnalysis
                    ? analysisController.goToRootNode
                    : controller.goToRootNode
                }
                gameTree={
                  analysisEnabled && showAnalysis
                    ? analysisController.gameTree
                    : controller.gameTree
                }
                embedded
              />
            </div>
            <div className="flex w-full">
              <Feedback
                status={status}
                game={trainingGame}
                setStatus={setStatus}
                controller={controller}
                setAndGiveUp={setAndGiveUp}
                getNewGame={getNewGame}
                lastAttemptedMove={lastAttemptedMove}
                setLastAttemptedMove={setLastAttemptedMove}
              />
            </div>
            <StatsDisplay stats={stats} />
            <div
              id="analysis"
              className="flex w-full flex-col gap-1 overflow-hidden"
            >
              {/* Analysis Toggle Bar - only show when puzzle is complete */}
              {showAnalysis && (
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
                    <span className="material-symbols-outlined text-sm">
                      {analysisEnabled ? 'visibility' : 'visibility_off'}
                    </span>
                    {analysisEnabled ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              )}

              <div className="relative">
                <Highlight
                  setCurrentMaiaModel={
                    analysisEnabled && showAnalysis
                      ? analysisController.setCurrentMaiaModel
                      : () => void 0
                  }
                  hover={analysisEnabled && showAnalysis ? hover : mockHover}
                  makeMove={
                    analysisEnabled && showAnalysis ? makeMove : mockMakeMove
                  }
                  currentMaiaModel={
                    analysisEnabled && showAnalysis
                      ? analysisController.currentMaiaModel
                      : 'maia_kdd_1500'
                  }
                  recommendations={
                    analysisEnabled && showAnalysis
                      ? analysisController.moveRecommendations
                      : emptyRecommendations
                  }
                  moveEvaluation={
                    analysisEnabled && showAnalysis
                      ? (analysisController.moveEvaluation as {
                          maia?: MaiaEvaluation
                          stockfish?: StockfishEvaluation
                        })
                      : {
                          maia: undefined,
                          stockfish: undefined,
                        }
                  }
                  colorSanMapping={
                    analysisEnabled && showAnalysis
                      ? analysisController.colorSanMapping
                      : {}
                  }
                  boardDescription={
                    analysisEnabled && showAnalysis
                      ? analysisController.boardDescription
                      : {
                          segments: [
                            {
                              type: 'text',
                              content:
                                'Complete the puzzle to unlock analysis, or analysis is disabled.',
                            },
                          ],
                        }
                  }
                />
                {!analysisEnabled && showAnalysis && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                        lock
                      </span>
                      <p className="text-xs font-medium text-primary">
                        Analysis Disabled
                      </p>
                    </div>
                  </div>
                )}
                {!showAnalysis && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                        lock
                      </span>
                      <p className="text-xs font-medium text-primary">
                        Analysis Locked
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <BlunderMeter
                  hover={analysisEnabled && showAnalysis ? hover : mockHover}
                  makeMove={
                    analysisEnabled && showAnalysis ? makeMove : mockMakeMove
                  }
                  data={
                    analysisEnabled && showAnalysis
                      ? analysisController.blunderMeter
                      : emptyBlunderMeterData
                  }
                  colorSanMapping={
                    analysisEnabled && showAnalysis
                      ? analysisController.colorSanMapping
                      : {}
                  }
                  moveEvaluation={
                    analysisEnabled && showAnalysis
                      ? analysisController.moveEvaluation
                      : undefined
                  }
                />
                {!analysisEnabled && showAnalysis && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                        lock
                      </span>
                      <p className="text-xs font-medium text-primary">
                        Analysis Disabled
                      </p>
                    </div>
                  </div>
                )}
                {!showAnalysis && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                        lock
                      </span>
                      <p className="text-xs font-medium text-primary">
                        Analysis Locked
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <MoveMap
                  moveMap={
                    analysisEnabled && showAnalysis
                      ? analysisController.moveMap
                      : undefined
                  }
                  colorSanMapping={
                    analysisEnabled && showAnalysis
                      ? analysisController.colorSanMapping
                      : {}
                  }
                  setHoverArrow={
                    analysisEnabled && showAnalysis
                      ? setHoverArrow
                      : mockSetHoverArrow
                  }
                  makeMove={
                    analysisEnabled && showAnalysis ? makeMove : mockMakeMove
                  }
                />
                {!analysisEnabled && showAnalysis && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                        lock
                      </span>
                      <p className="text-xs font-medium text-primary">
                        Analysis Disabled
                      </p>
                    </div>
                  </div>
                )}
                {!showAnalysis && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-2 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-1 text-xl text-human-3">
                        lock
                      </span>
                      <p className="text-xs font-medium text-primary">
                        Analysis Disabled
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {gamesController}
          </div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <>
      <Head>
        <title>Chess Puzzles – Maia Chess</title>
        <meta
          name="description"
          content="Train with Maia as your coach using human-centered puzzles. Curated based on how millions of players improve, with data showing how different ratings approach each position."
        />
      </Head>
      <AnimatePresence>
        {analysisController.maia.status === 'no-cache' ||
        analysisController.maia.status === 'downloading' ? (
          <DownloadModelModal
            progress={analysisController.maia.progress}
            download={analysisController.maia.downloadModel}
          />
        ) : null}
      </AnimatePresence>
      <TrainingControllerContext.Provider value={controller}>
        <AnimatePresence mode="wait">
          {trainingGame && (
            <motion.div key={trainingGame.id}>
              {isMobile ? mobileLayout : desktopLayout}
            </motion.div>
          )}
        </AnimatePresence>
      </TrainingControllerContext.Provider>
    </>
  )
}

export default function AuthenticatedTrainPage() {
  return (
    <AuthenticatedWrapper>
      <TrainPage />
    </AuthenticatedWrapper>
  )
}
