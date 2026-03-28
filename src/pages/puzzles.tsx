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
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion'
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
  AnalysisSidebar,
  AnalysisArrowLegend,
  AnalysisCompactBlunderMeter,
  AnalysisMaiaWinrateBar,
  AnalysisStockfishEvalBar,
  SimplifiedAnalysisOverview,
  MovesByRating,
} from 'src/components'
import { useTrainingController } from 'src/hooks/useTrainingController'
import { useAnalysisController } from 'src/hooks/useAnalysisController'
import { AllStats, useStats } from 'src/hooks/useStats'
import { PuzzleGame, Status } from 'src/types/puzzle'
import { AnalyzedGame, MaiaEvaluation, StockfishEvaluation } from 'src/types'
import { TABLET_BREAKPOINT_PX, WindowSizeContext, useTour } from 'src/contexts'
import { TrainingControllerContext } from 'src/contexts/TrainingControllerContext'
import {
  getCurrentPlayer,
  getAvailableMovesArray,
  requiresPromotion,
} from 'src/lib/puzzle'
import { cpToWinrate } from 'src/lib/analysis'
import { tourConfigs } from 'src/constants/tours'

const EVAL_BAR_RANGE = 4
const DEFAULT_STOCKFISH_EVAL_BAR = {
  hasEval: false,
  pawns: 0,
  displayPawns: 0,
  label: '--',
}

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
  const [solutionMoveSan, setSolutionMoveSan] = useState<string | null>(null)

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
    setSolutionMoveSan(null)
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
      const solutionMoveUci = response.correct_moves?.[0]
      const solutionSan =
        solutionMoveUci && trainingGames[puzzleIdx]
          ? trainingGames[puzzleIdx].availableMoves?.[solutionMoveUci]?.san ??
            null
          : null

      if (solutionSan) {
        setSolutionMoveSan(solutionSan)
      }

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
        solutionMoveSan={solutionMoveSan}
        gamesController={
          <div className="relative bottom-0 flex h-full min-h-[38px] flex-1 flex-col justify-start overflow-auto">
            <div className="hidden md:block">
              <PuzzleLog
                previousGameResults={previousGameResults}
                setCurrentIndex={setCurrentIndex}
              />
            </div>
            <div className="md:hidden">
              <PuzzleLog
                previousGameResults={previousGameResults}
                setCurrentIndex={setCurrentIndex}
              />
            </div>
          </div>
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
  solutionMoveSan: string | null
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
  solutionMoveSan,
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

  const { width, height } = useContext(WindowSizeContext)
  const isMobile = useMemo(
    () => width > 0 && width <= TABLET_BREAKPOINT_PX,
    [width],
  )
  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)
  const analysisSyncedRef = useRef(false)
  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)
  const [userAnalysisEnabled, setUserAnalysisEnabled] = useState<
    boolean | null
  >(null) // User's choice, null means not set
  const desktopBoardHeaderStripRef = useRef<HTMLDivElement | null>(null)
  const desktopBlunderMeterSectionRef = useRef<HTMLDivElement | null>(null)
  const desktopBoardControllerSectionRef = useRef<HTMLDivElement | null>(null)
  const [desktopMeasuredHeights, setDesktopMeasuredHeights] = useState({
    headerPx: 28,
    blunderMeterPx: 126,
    boardControllerPx: 44,
  })

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

  const compactBlunderMeterData = useMemo(
    () =>
      analysisEnabled && showAnalysis
        ? analysisController.blunderMeter
        : emptyBlunderMeterData,
    [
      analysisEnabled,
      showAnalysis,
      analysisController.blunderMeter,
      emptyBlunderMeterData,
    ],
  )

  const rawStockfishEvalBar = useMemo(() => {
    const stockfish = analysisController.moveEvaluation?.stockfish
    const sideToMove = analysisController.currentNode?.turn || 'w'

    if (!stockfish) {
      return {
        ...DEFAULT_STOCKFISH_EVAL_BAR,
        depth: 0,
      }
    }

    const mateIn = stockfish.mate_vec?.[stockfish.model_move]
    if (mateIn !== undefined) {
      const matingColor =
        mateIn > 0 ? sideToMove : sideToMove === 'w' ? 'b' : 'w'
      const whitePerspectiveSign = matingColor === 'w' ? 1 : -1
      return {
        hasEval: true,
        pawns: whitePerspectiveSign * EVAL_BAR_RANGE,
        displayPawns: whitePerspectiveSign * EVAL_BAR_RANGE,
        label: `M${Math.abs(mateIn)}`,
        depth: stockfish.depth ?? 0,
      }
    }

    const cp =
      stockfish.model_optimal_cp ?? Object.values(stockfish.cp_vec)[0] ?? 0
    const rawPawns = cp / 100
    const clampedPawns = Math.max(
      -EVAL_BAR_RANGE,
      Math.min(EVAL_BAR_RANGE, rawPawns),
    )

    return {
      hasEval: true,
      pawns: clampedPawns,
      displayPawns: rawPawns,
      label: `${rawPawns > 0 ? '+' : ''}${rawPawns.toFixed(2)}`,
      depth: stockfish.depth ?? 0,
    }
  }, [
    analysisController.currentNode?.turn,
    analysisController.moveEvaluation?.stockfish,
  ])

  const displayedStockfishEvalText = useMemo(() => {
    if (!analysisEnabled || !showAnalysis || !rawStockfishEvalBar.hasEval) {
      return '--'
    }

    if (rawStockfishEvalBar.label.startsWith('M')) {
      return rawStockfishEvalBar.label
    }

    const roundedPawns = Math.round(rawStockfishEvalBar.displayPawns * 10) / 10
    const safePawns = Math.abs(roundedPawns) < 0.05 ? 0 : roundedPawns
    return `${safePawns > 0 ? '+' : ''}${safePawns.toFixed(1)}`
  }, [
    analysisEnabled,
    showAnalysis,
    rawStockfishEvalBar.displayPawns,
    rawStockfishEvalBar.hasEval,
    rawStockfishEvalBar.label,
  ])

  const evalPositionPercent = useMemo(() => {
    const normalized =
      (rawStockfishEvalBar.pawns + EVAL_BAR_RANGE) / (EVAL_BAR_RANGE * 2)
    return Math.max(0, Math.min(1, normalized)) * 100
  }, [rawStockfishEvalBar.pawns])

  const smoothedEvalPosition = useSpring(50, {
    stiffness: 520,
    damping: 42,
    mass: 0.25,
  })
  const smoothedEvalVerticalPositionLabel = useTransform(
    smoothedEvalPosition,
    (value) => `${100 - value}%`,
  )

  useEffect(() => {
    smoothedEvalPosition.set(
      analysisEnabled && showAnalysis && rawStockfishEvalBar.hasEval
        ? evalPositionPercent
        : 50,
    )
  }, [
    analysisEnabled,
    showAnalysis,
    rawStockfishEvalBar.hasEval,
    evalPositionPercent,
    smoothedEvalPosition,
  ])

  const currentTurnForBars: 'w' | 'b' = analysisController.currentNode?.turn || 'w'

  const isCurrentPositionCheckmateForBars = useMemo(() => {
    if (!analysisController.currentNode) return false

    try {
      const chess = new Chess(analysisController.currentNode.fen)
      return chess.inCheckmate()
    } catch {
      return false
    }
  }, [analysisController.currentNode])

  const isInFirst10PlyForBars = useMemo(() => {
    if (!analysisController.currentNode) return false

    const moveNumber = analysisController.currentNode.moveNumber
    const turn = analysisController.currentNode.turn
    const plyFromStart = (moveNumber - 1) * 2 + (turn === 'b' ? 1 : 0)
    return plyFromStart < 10
  }, [analysisController.currentNode])

  const rawMaiaWhiteWinBar = useMemo(() => {
    const stockfishEval = analysisController.moveEvaluation?.stockfish

    if (isCurrentPositionCheckmateForBars) {
      const percent = currentTurnForBars === 'w' ? 0 : 100
      return { hasValue: true, percent, label: `${percent.toFixed(1)}%` }
    }

    if (stockfishEval?.is_checkmate) {
      const percent = currentTurnForBars === 'w' ? 0 : 100
      return { hasValue: true, percent, label: `${percent.toFixed(1)}%` }
    }

    if (
      stockfishEval?.model_move &&
      stockfishEval.mate_vec &&
      stockfishEval.mate_vec[stockfishEval.model_move] !== undefined
    ) {
      const mateValue = stockfishEval.mate_vec[stockfishEval.model_move]
      const deliveringColor =
        mateValue > 0
          ? currentTurnForBars
          : currentTurnForBars === 'w'
            ? 'b'
            : 'w'
      const percent = deliveringColor === 'w' ? 100 : 0
      return { hasValue: true, percent, label: `${percent.toFixed(1)}%` }
    }

    if (
      isInFirst10PlyForBars &&
      stockfishEval?.model_optimal_cp !== undefined
    ) {
      const percent = Math.max(
        0,
        Math.min(100, cpToWinrate(stockfishEval.model_optimal_cp) * 100),
      )
      return {
        hasValue: true,
        percent,
        label: `${(Math.round(percent * 10) / 10).toFixed(1)}%`,
      }
    }

    if (analysisController.moveEvaluation?.maia) {
      const percent = Math.max(
        0,
        Math.min(100, analysisController.moveEvaluation.maia.value * 100),
      )
      return {
        hasValue: true,
        percent,
        label: `${(Math.round(percent * 10) / 10).toFixed(1)}%`,
      }
    }

    return { hasValue: false, percent: 50, label: '--' }
  }, [
    analysisController.moveEvaluation?.maia,
    analysisController.moveEvaluation?.stockfish,
    currentTurnForBars,
    isCurrentPositionCheckmateForBars,
    isInFirst10PlyForBars,
  ])

  const maiaWhiteWinPositionPercent = useMemo(
    () => Math.max(0, Math.min(100, rawMaiaWhiteWinBar.percent)),
    [rawMaiaWhiteWinBar.percent],
  )
  const renderedMaiaWhiteWinBar = useMemo(
    () =>
      analysisEnabled && showAnalysis
        ? rawMaiaWhiteWinBar
        : { hasValue: false, percent: 50, label: '--' },
    [analysisEnabled, showAnalysis, rawMaiaWhiteWinBar],
  )

  const smoothedMaiaWhiteWinPosition = useSpring(50, {
    stiffness: 520,
    damping: 42,
    mass: 0.25,
  })
  const smoothedMaiaWhiteWinVerticalPositionLabel = useTransform(
    smoothedMaiaWhiteWinPosition,
    (value) => `${100 - value}%`,
  )

  useEffect(() => {
    smoothedMaiaWhiteWinPosition.set(
      analysisEnabled && showAnalysis ? maiaWhiteWinPositionPercent : 50,
    )
  }, [
    analysisEnabled,
    showAnalysis,
    maiaWhiteWinPositionPercent,
    smoothedMaiaWhiteWinPosition,
  ])

  useEffect(() => {
    if (isMobile) return

    const headerEl = desktopBoardHeaderStripRef.current
    const blunderEl = desktopBlunderMeterSectionRef.current
    const controllerEl = desktopBoardControllerSectionRef.current

    if (!headerEl && !blunderEl && !controllerEl) return

    const next = {
      headerPx:
        headerEl?.getBoundingClientRect().height ??
        desktopMeasuredHeights.headerPx,
      blunderMeterPx:
        blunderEl?.getBoundingClientRect().height ??
        desktopMeasuredHeights.blunderMeterPx,
      boardControllerPx:
        controllerEl?.getBoundingClientRect().height ??
        desktopMeasuredHeights.boardControllerPx,
    }

    setDesktopMeasuredHeights((prev) => {
      if (
        Math.abs(prev.headerPx - next.headerPx) < 0.5 &&
        Math.abs(prev.blunderMeterPx - next.blunderMeterPx) < 0.5 &&
        Math.abs(prev.boardControllerPx - next.boardControllerPx) < 0.5
      ) {
        return prev
      }

      return next
    })
  }, [desktopMeasuredHeights, isMobile, showAnalysis, status, width])

  const desktopColumnTargetHeightCss = '85vh'
  const desktopBoardBaselineSizeCss = 'min(42vw, 72vh)'
  const desktopBoardWidthCapVw = useMemo(() => {
    if (width >= 1536) return 48
    if (width >= 1280) return 46
    return 42
  }, [width])
  const desktopBoardHeightCapPx = useMemo(() => {
    if (height <= 0) return null

    const targetColumnHeightPx = height * 0.85
    const gapAllowancePx = showAnalysis ? 24 : 12
    const measuredNonBoardHeightPx =
      desktopMeasuredHeights.headerPx +
      (showAnalysis ? desktopMeasuredHeights.blunderMeterPx : 0) +
      desktopMeasuredHeights.boardControllerPx +
      gapAllowancePx

    return Math.max(
      340,
      Math.floor(targetColumnHeightPx - measuredNonBoardHeightPx),
    )
  }, [desktopMeasuredHeights, height, showAnalysis])
  const desktopBoardSizeCss = useMemo(() => {
    const heightCapCss =
      desktopBoardHeightCapPx !== null ? `${desktopBoardHeightCapPx}px` : '72vh'
    const expandedTargetCss = `min(${desktopBoardWidthCapVw}vw, ${heightCapCss})`

    return `max(${desktopBoardBaselineSizeCss}, ${expandedTargetCss})`
  }, [
    desktopBoardBaselineSizeCss,
    desktopBoardHeightCapPx,
    desktopBoardWidthCapVw,
  ])
  const desktopBoardMinSizeCss = useMemo(
    () => `calc(max(24rem, ${desktopBoardSizeCss}))`,
    [desktopBoardSizeCss],
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
      // Start post-puzzle analysis from the original puzzle position rather
      // than the solution move that may have just been played.
      analysisController.setCurrentNode(controller.puzzleStartingNode)
      analysisSyncedRef.current = true
    } else if (!showAnalysis || !analysisEnabled) {
      // Reset sync flag when exiting analysis mode
      analysisSyncedRef.current = false
    }
  }, [
    analysisEnabled,
    showAnalysis,
    analysisController,
    controller.puzzleStartingNode,
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
      <div className="flex h-full flex-row gap-4 w-[92%] xl:w-[94%] xl:gap-5 2xl:w-[97%]">
        <motion.div
          className="desktop-left-column-container flex min-h-0 flex-col gap-2"
          variants={itemVariants}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="w-full overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
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
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">{gamesController}</div>

          <Feedback
            status={status}
            game={trainingGame}
            setStatus={setStatus}
            setAndGiveUp={setAndGiveUp}
            controller={controller}
            getNewGame={getNewGame}
            lastAttemptedMove={lastAttemptedMove}
            setLastAttemptedMove={setLastAttemptedMove}
            solutionMoveSan={solutionMoveSan}
          />

          <StatsDisplay stats={stats} />
        </motion.div>

        <motion.div
          className="desktop-middle-column-container flex flex-col gap-2"
          variants={itemVariants}
          style={{
            willChange: 'transform, opacity',
            width: desktopBoardSizeCss,
            minWidth: desktopBoardMinSizeCss,
            height: desktopColumnTargetHeightCss,
          }}
        >
          {showAnalysis ? (
            <div
              className="desktop-board-container flex shrink-0 flex-col overflow-visible"
              style={{
                width: desktopBoardSizeCss,
                minWidth: desktopBoardMinSizeCss,
                height: 'auto',
                minHeight: 0,
              }}
            >
              <div
                ref={desktopBoardHeaderStripRef}
                className="pointer-events-none mb-1 grid w-full grid-cols-[42px_minmax(0,1fr)_42px] items-center gap-3 px-1"
              >
                <div className="flex justify-center">
                  <span className="whitespace-nowrap text-[10px] font-semibold leading-none text-human-2">
                    White Win %
                  </span>
                </div>
                <div className="flex min-w-0 items-center justify-center">
                  <AnalysisArrowLegend
                    labelMode="short"
                    className="gap-x-3 text-[10px]"
                  />
                </div>
                <div className="flex justify-center">
                  <span className="whitespace-nowrap text-[10px] font-semibold leading-none text-engine-2">
                    SF Eval
                  </span>
                </div>
              </div>
              <div
                id="train-page"
                className="grid w-full items-stretch gap-3"
                style={{
                  gridTemplateColumns: '42px minmax(0,1fr) 42px',
                }}
              >
                <div className="pointer-events-none flex justify-center py-1">
                  <AnalysisMaiaWinrateBar
                    hasValue={renderedMaiaWhiteWinBar.hasValue}
                    displayText={renderedMaiaWhiteWinBar.label}
                    labelPositionTop={
                      smoothedMaiaWhiteWinVerticalPositionLabel
                    }
                    disabled={!analysisEnabled}
                    variant="desktop"
                  />
                </div>
                <div className="relative flex aspect-square w-full">
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
                      analysisEnabled && showAnalysis
                        ? analyzedGame.tree
                        : undefined
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
                <div className="pointer-events-none flex justify-center py-1">
                  <AnalysisStockfishEvalBar
                    hasEval={analysisEnabled && showAnalysis}
                    displayText={displayedStockfishEvalText}
                    labelPositionTop={smoothedEvalVerticalPositionLabel}
                    disabled={!analysisEnabled}
                    variant="desktop"
                  />
                </div>
              </div>
              <div ref={desktopBlunderMeterSectionRef} className="shrink-0 pt-3">
                <AnalysisCompactBlunderMeter
                  variant="desktop"
                  data={compactBlunderMeterData}
                  colorSanMapping={
                    analysisEnabled && showAnalysis
                      ? analysisController.colorSanMapping
                      : {}
                  }
                  playedMove={
                    analysisEnabled && showAnalysis
                      ? (analysisController.currentNode?.mainChild?.move ??
                          undefined)
                      : undefined
                  }
                  hover={analysisEnabled ? hover : mockHover}
                  makeMove={analysisEnabled ? makeMove : mockMakeMove}
                />
              </div>
            </div>
          ) : (
            <div
              id="train-page"
              className="desktop-board-container relative flex aspect-square"
              style={{
                width: desktopBoardSizeCss,
                minWidth: desktopBoardMinSizeCss,
                height: desktopBoardSizeCss,
                minHeight: desktopBoardMinSizeCss,
              }}
            >
              <GameBoard
                game={trainingGame}
                currentNode={controller.currentNode}
                orientation={controller.orientation}
                onPlayerMakeMove={onPlayerMakeMove}
                availableMoves={controller.availableMovesMapped}
                shapes={hoverArrow ? [hoverArrow] : []}
                onSelectSquare={onSelectSquare}
              />
              {promotionFromTo ? (
                <PromotionOverlay
                  player={currentPlayer}
                  file={promotionFromTo[1].slice(0, 1)}
                  onPlayerSelectPromotion={onPlayerSelectPromotion}
                />
              ) : null}
            </div>
          )}
          <div ref={desktopBoardControllerSectionRef} className="shrink-0">
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
        </motion.div>
        <AnalysisSidebar
          hover={hover}
          makeMove={makeMove}
          controller={analysisController}
          setHoverArrow={setHoverArrow}
          analysisEnabled={analysisEnabled}
          handleToggleAnalysis={handleToggleAnalysis}
          hideDetailedBlunderMeter={true}
          containerStyle={{
            width: 'clamp(23rem, 27vw, 26rem)',
            minWidth: '23rem',
            flexBasis: 'clamp(23rem, 27vw, 26rem)',
          }}
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
          {showAnalysis ? (
            <div className="flex w-full flex-col items-center px-3">
              <div className="pointer-events-none mb-0.5 grid w-full max-w-[560px] grid-cols-[30px_minmax(0,1fr)_30px] items-center gap-3">
                <div className="flex justify-center">
                  <span className="translate-y-px whitespace-nowrap text-[8px] font-extrabold leading-none text-human-2">
                    Maia %
                  </span>
                </div>
                <div className="flex min-w-0 items-center justify-center">
                  <AnalysisArrowLegend
                    labelMode="short"
                    className="translate-y-px justify-center gap-x-3 self-center text-[8px] font-semibold"
                  />
                </div>
                <div className="flex justify-center">
                  <span className="translate-y-px whitespace-nowrap text-[8px] font-extrabold leading-none text-engine-2">
                    SF Eval
                  </span>
                </div>
              </div>
              <div className="grid w-full max-w-[560px] grid-cols-[30px_minmax(0,1fr)_30px] items-stretch gap-3">
                <div className="pointer-events-none flex min-h-0 min-w-0 justify-center self-stretch">
                  <AnalysisMaiaWinrateBar
                    hasValue={renderedMaiaWhiteWinBar.hasValue}
                    displayText={
                      renderedMaiaWhiteWinBar.hasValue
                        ? `${Math.round(renderedMaiaWhiteWinBar.percent)}%`
                        : '--'
                    }
                    labelPositionTop={
                      smoothedMaiaWhiteWinVerticalPositionLabel
                    }
                    disabled={!analysisEnabled}
                    variant="mobile"
                  />
                </div>
                <div
                  id="train-page"
                  className="relative flex aspect-square w-full"
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
                      analysisEnabled && showAnalysis
                        ? analyzedGame.tree
                        : undefined
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
                <div className="pointer-events-none flex min-h-0 min-w-0 justify-center self-stretch">
                  <AnalysisStockfishEvalBar
                    hasEval={analysisEnabled && showAnalysis}
                    displayText={displayedStockfishEvalText}
                    labelPositionTop={smoothedEvalVerticalPositionLabel}
                    disabled={!analysisEnabled}
                    variant="mobile"
                  />
                </div>
              </div>
              <AnalysisCompactBlunderMeter
                className="mb-1.5 mt-3 w-full max-w-[560px]"
                data={compactBlunderMeterData}
                colorSanMapping={
                  analysisEnabled && showAnalysis
                    ? analysisController.colorSanMapping
                    : {}
                }
                playedMove={
                  analysisEnabled && showAnalysis
                    ? (analysisController.currentNode?.mainChild?.move ??
                        undefined)
                    : undefined
                }
                hover={analysisEnabled ? hover : mockHover}
                makeMove={analysisEnabled ? makeMove : mockMakeMove}
              />
            </div>
          ) : (
            <div
              id="train-page"
              className="relative flex aspect-square h-[100vw] w-screen"
            >
              <GameBoard
                game={trainingGame}
                currentNode={controller.currentNode}
                orientation={controller.orientation}
                availableMoves={controller.availableMovesMapped}
                onPlayerMakeMove={onPlayerMakeMove}
                shapes={hoverArrow ? [hoverArrow] : []}
                onSelectSquare={onSelectSquare}
              />
              {promotionFromTo ? (
                <PromotionOverlay
                  player={currentPlayer}
                  file={promotionFromTo[1].slice(0, 1)}
                  onPlayerSelectPromotion={onPlayerSelectPromotion}
                />
              ) : null}
            </div>
          )}
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
                solutionMoveSan={solutionMoveSan}
              />
            </div>
            <StatsDisplay stats={stats} />
            <div
              id="analysis"
              className="flex w-full flex-col gap-1 overflow-hidden"
            >
              {/* Analysis Toggle Bar - only show when puzzle is complete */}
              {showAnalysis && (
                <div className="flex items-center justify-between rounded bg-glass px-4 py-2">
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
                        : 'bg-glass text-secondary hover:bg-glass-strong'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {analysisEnabled ? 'visibility' : 'visibility_off'}
                    </span>
                    {analysisEnabled ? 'Hide' : 'Show'}
                  </button>
                </div>
              )}

              <div className="relative border-t border-glass-border bg-glass backdrop-blur-md">
                <SimplifiedAnalysisOverview
                  highlightProps={{
                    setCurrentMaiaModel:
                      analysisEnabled && showAnalysis
                        ? analysisController.setCurrentMaiaModel
                        : () => void 0,
                    hover:
                      analysisEnabled && showAnalysis ? hover : mockHover,
                    makeMove:
                      analysisEnabled && showAnalysis
                        ? makeMove
                        : mockMakeMove,
                    currentMaiaModel:
                      analysisEnabled && showAnalysis
                        ? analysisController.currentMaiaModel
                        : 'maia_kdd_1500',
                    recommendations:
                      analysisEnabled && showAnalysis
                        ? analysisController.moveRecommendations
                        : emptyRecommendations,
                    moveEvaluation:
                      analysisEnabled && showAnalysis
                        ? (analysisController.moveEvaluation as {
                            maia?: MaiaEvaluation
                            stockfish?: StockfishEvaluation
                          })
                        : {
                            maia: undefined,
                            stockfish: undefined,
                          },
                    colorSanMapping:
                      analysisEnabled && showAnalysis
                        ? analysisController.colorSanMapping
                        : {},
                    boardDescription:
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
                          },
                    currentNode: analysisController.currentNode ?? undefined,
                    simplified: true,
                    hideWhiteWinRateSummary: true,
                    hideStockfishEvalSummary: true,
                  }}
                  blunderMeterProps={{
                    hover:
                      analysisEnabled && showAnalysis ? hover : mockHover,
                    makeMove:
                      analysisEnabled && showAnalysis
                        ? makeMove
                        : mockMakeMove,
                    data:
                      analysisEnabled && showAnalysis
                        ? analysisController.blunderMeter
                        : emptyBlunderMeterData,
                    colorSanMapping:
                      analysisEnabled && showAnalysis
                        ? analysisController.colorSanMapping
                        : {},
                    moveEvaluation:
                      analysisEnabled && showAnalysis
                        ? analysisController.moveEvaluation
                        : undefined,
                    playerToMove:
                      analysisEnabled && showAnalysis
                        ? (analysisController.currentNode?.turn ?? 'w')
                        : 'w',
                  }}
                  analysisEnabled={analysisEnabled && showAnalysis}
                  hideBlunderMeter={true}
                />
                {!analysisEnabled && showAnalysis && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-backdrop/90 backdrop-blur-sm">
                    <div className="rounded border border-glass-border bg-glass p-4 text-center shadow-lg">
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
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-backdrop/90 backdrop-blur-md">
                    <div className="rounded border border-glass-border bg-glass p-4 text-center shadow-lg">
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
                <MovesByRating
                  moves={
                    analysisEnabled && showAnalysis
                      ? analysisController.movesByRating
                      : undefined
                  }
                  colorSanMapping={
                    analysisEnabled && showAnalysis
                      ? analysisController.colorSanMapping
                      : {}
                  }
                  positionKey={
                    analysisEnabled && showAnalysis
                      ? analysisController.currentNode?.fen
                      : undefined
                  }
                />
                {!analysisEnabled && showAnalysis && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-backdrop/90 backdrop-blur-sm">
                    <div className="rounded border border-glass-border bg-glass p-4 text-center shadow-lg">
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
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-backdrop/90 backdrop-blur-md">
                    <div className="rounded border border-glass-border bg-glass p-4 text-center shadow-lg">
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
