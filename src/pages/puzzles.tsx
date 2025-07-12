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
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  getTrainingGame,
  logPuzzleGuesses,
  getTrainingPlayerStats,
} from 'src/api'
import {
  Loading,
  GameInfo,
  Feedback,
  PuzzleLog,
  StatsDisplay,
  BoardController,
  ContinueAgainstMaia,
  AuthenticatedWrapper,
  GameBoard,
  PromotionOverlay,
  DownloadModelModal,
  Highlight,
  MoveMap,
  BlunderMeter,
  MovesByRating,
} from 'src/components'
import { useTrainingController } from 'src/hooks/useTrainingController'
import { useAnalysisController } from 'src/hooks/useAnalysisController'
import { AllStats, useStats } from 'src/hooks/useStats'
import { TrainingGame, Status } from 'src/types/training'
import { MaiaEvaluation, StockfishEvaluation } from 'src/types'
import { ModalContext, WindowSizeContext, useTour } from 'src/contexts'
import { TrainingControllerContext } from 'src/contexts/TrainingControllerContext'
import {
  convertTrainingGameToAnalyzedGame,
  getCurrentPlayer,
  getAvailableMovesArray,
  requiresPromotion,
} from 'src/utils/train/utils'
import { mockAnalysisData } from 'src/hooks/useAnalysisController/mockData'
import { tourConfigs } from 'src/config/tours'

const statsLoader = async () => {
  const stats = await getTrainingPlayerStats()
  return {
    gamesPlayed: Math.max(0, stats.totalPuzzles),
    gamesWon: stats.puzzlesSolved,
    rating: stats.rating,
  }
}

const TrainPage: NextPage = () => {
  const router = useRouter()
  const { startTour, tourState } = useTour()

  const [trainingGames, setTrainingGames] = useState<TrainingGame[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [status, setStatus] = useState<Status>('default')
  const [stats, incrementStats, updateRating] = useStats(statsLoader)
  const [userGuesses, setUserGuesses] = useState<string[]>([])
  const [previousGameResults, setPreviousGameResults] = useState<
    (TrainingGame & { result?: boolean; ratingDiff?: number })[]
  >([])
  const [initialTourCheck, setInitialTourCheck] = useState(false)

  useEffect(() => {
    if (!initialTourCheck && tourState.ready) {
      setInitialTourCheck(true)
      // Always attempt to start the tour - the tour context will handle completion checking
      startTour(tourConfigs.train.id, tourConfigs.train.steps, false)
    }
  }, [initialTourCheck, startTour, tourState.ready])

  const getNewGame = useCallback(async () => {
    let game
    try {
      game = await getTrainingGame()
    } catch (e) {
      router.push('/401')
      return
    }

    setStatus('default')
    setUserGuesses([])
    setCurrentIndex(trainingGames.length)
    setTrainingGames(trainingGames.concat([game]))
    setPreviousGameResults(previousGameResults.concat([{ ...game }]))
  }, [trainingGames, previousGameResults, router])

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

        updateRating(response.puzzle_elo)
        incrementStats(1, result ? 1 : 0)
      }
    },
    [currentIndex, trainingGames.length, userGuesses, incrementStats],
  )

  useEffect(() => {
    if (trainingGames.length === 0) getNewGame()
  }, [getNewGame, trainingGames.length])

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
        gamesController={
          <>
            <div className="relative bottom-0 flex h-full min-h-[38px] flex-1 flex-col justify-end overflow-auto">
              <PuzzleLog
                previousGameResults={previousGameResults}
                setCurrentIndex={setCurrentIndex}
              />
            </div>
          </>
        }
      />
    )
  return <Loading />
}

interface Props {
  trainingGame: TrainingGame
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
}

const Train: React.FC<Props> = ({
  trainingGame,
  gamesController,
  stats,
  status,
  setStatus,
  getNewGame,
  logGuess,
}: Props) => {
  const controller = useTrainingController(trainingGame)

  const analyzedGame = useMemo(() => {
    return convertTrainingGameToAnalyzedGame(trainingGame)
  }, [trainingGame])

  const analysisController = useAnalysisController(
    analyzedGame,
    controller.orientation,
  )

  const { width } = useContext(WindowSizeContext)
  const isMobile = useMemo(() => width > 0 && width <= 670, [width])
  const [movePlotHover, setMovePlotHover] = useState<DrawShape | null>(null)
  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)
  const [arrows, setArrows] = useState<DrawShape[]>([])
  const analysisSyncedRef = useRef(false)
  const toastId = useRef<string | null>(null)
  const stockfishToastId = useRef<string | null>(null)
  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)

  const showAnalysis =
    status === 'correct' || status === 'forfeit' || status === 'archived'

  const currentPlayer = useMemo(() => {
    const currentNode = showAnalysis
      ? analysisController.currentNode
      : controller.currentNode
    return getCurrentPlayer(currentNode)
  }, [showAnalysis, analysisController.currentNode, controller.currentNode])

  useEffect(() => {
    if (showAnalysis && !analysisSyncedRef.current) {
      // Set the analysis controller to the current training controller's node
      // Only sync once when analysis mode is first enabled
      analysisController.setCurrentNode(controller.currentNode)
      analysisSyncedRef.current = true
    } else if (!showAnalysis) {
      // Reset sync flag when exiting analysis mode
      analysisSyncedRef.current = false
    }
  }, [showAnalysis, analysisController, controller.currentNode])

  // Toast notifications for Maia model status
  useEffect(() => {
    return () => {
      toast.dismiss()
    }
  }, [])

  useEffect(() => {
    if (analysisController.maiaStatus === 'loading' && !toastId.current) {
      toastId.current = toast.loading('Loading Maia Model...')
    } else if (analysisController.maiaStatus === 'ready') {
      if (toastId.current) {
        toast.success('Loaded Maia! Analysis is ready', {
          id: toastId.current,
        })
      } else {
        toast.success('Loaded Maia! Analysis is ready')
      }
    }
  }, [analysisController.maiaStatus])

  useEffect(() => {
    if (analysisController.stockfishStatus === 'loading' && !stockfishToastId.current) {
      stockfishToastId.current = toast.loading('Loading Stockfish Engine...')
    } else if (analysisController.stockfishStatus === 'ready') {
      if (stockfishToastId.current) {
        toast.success('Loaded Stockfish! Engine is ready', {
          id: stockfishToastId.current,
        })
        stockfishToastId.current = null
      } else {
        toast.success('Loaded Stockfish! Engine is ready')
      }
    } else if (analysisController.stockfishStatus === 'error') {
      if (stockfishToastId.current) {
        toast.error('Failed to load Stockfish engine', {
          id: stockfishToastId.current,
        })
        stockfishToastId.current = null
      } else {
        toast.error('Failed to load Stockfish engine')
      }
    }
  }, [analysisController.stockfishStatus])

  const onSelectSquare = useCallback(
    (square: Key) => {
      if (!showAnalysis) {
        controller.reset()
        setStatus('default')
      }
    },
    [controller, showAnalysis],
  )

  const onPlayerMakeMove = useCallback(
    (playedMove: [string, string] | null) => {
      if (!playedMove) return

      if (showAnalysis) {
        const availableMoves = getAvailableMovesArray(analysisController.moves)

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

      if (showAnalysis) {
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
      } else {
        // In puzzle mode
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

  const launchContinue = useCallback(() => {
    const currentNode = showAnalysis
      ? analysisController.currentNode
      : controller.currentNode
    const url = '/play' + '?fen=' + encodeURIComponent(currentNode.fen)
    window.open(url)
  }, [controller, analysisController, showAnalysis])

  const hover = useCallback(
    (move?: string) => {
      if (move && showAnalysis) {
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
    [showAnalysis],
  )

  const makeMove = useCallback(
    (move: string) => {
      if (
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

  useEffect(() => {
    if (!showAnalysis || !analysisController.moveEvaluation) {
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
    showAnalysis,
    analysisController.moveEvaluation,
    analysisController.currentNode,
    analysisController.orientation,
  ])

  const desktopLayout = (
    <>
      <div className="flex h-full w-full flex-col items-center py-4 md:py-10">
        <div className="flex h-full w-[90%] flex-row gap-4">
          <div className="flex h-[85vh] w-72 min-w-60 max-w-72 flex-col gap-2 overflow-hidden 2xl:min-w-72">
            <GameInfo title="Puzzles" icon="target" type="train">
              <p className="text-secondary">
                Puzzle{' '}
                <span className="text-secondary/60">#{trainingGame.id}</span>
              </p>
              <p className="text-secondary">
                Rating of puzzle:{' '}
                {status !== 'correct' && status !== 'forfeit' ? (
                  <span className="text-secondary/60">hidden</span>
                ) : (
                  <span className="text-human-2">
                    {trainingGame.puzzle_elo}
                  </span>
                )}
              </p>
            </GameInfo>
            <ContinueAgainstMaia launchContinue={launchContinue} />
            {gamesController}
            <StatsDisplay stats={stats} />
          </div>

          <div className="flex h-[85vh] w-[45vh] flex-col gap-2 2xl:w-[55vh]">
            <div
              id="train-page"
              className="relative flex aspect-square w-[45vh] 2xl:w-[55vh]"
            >
              <GameBoard
                game={trainingGame}
                currentNode={
                  showAnalysis
                    ? analysisController.currentNode
                    : controller.currentNode
                }
                orientation={
                  showAnalysis
                    ? analysisController.orientation
                    : controller.orientation
                }
                onPlayerMakeMove={onPlayerMakeMove}
                availableMoves={
                  showAnalysis
                    ? analysisController.moves
                    : controller.availableMovesMapped
                }
                shapes={hoverArrow ? [...arrows, hoverArrow] : [...arrows]}
                onSelectSquare={onSelectSquare}
                goToNode={
                  showAnalysis ? analysisController.goToNode : undefined
                }
                gameTree={showAnalysis ? analyzedGame.tree : undefined}
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
                showAnalysis
                  ? analysisController.orientation
                  : controller.orientation
              }
              setOrientation={
                showAnalysis
                  ? analysisController.setOrientation
                  : controller.setOrientation
              }
              currentNode={
                showAnalysis
                  ? analysisController.currentNode
                  : controller.currentNode
              }
              plyCount={
                showAnalysis ? analysisController.plyCount : controller.plyCount
              }
              goToNode={
                showAnalysis ? analysisController.goToNode : controller.goToNode
              }
              goToNextNode={
                showAnalysis
                  ? analysisController.goToNextNode
                  : controller.goToNextNode
              }
              goToPreviousNode={
                showAnalysis
                  ? analysisController.goToPreviousNode
                  : controller.goToPreviousNode
              }
              goToRootNode={
                showAnalysis
                  ? analysisController.goToRootNode
                  : controller.goToRootNode
              }
              gameTree={
                showAnalysis ? analysisController.gameTree : controller.gameTree
              }
            />
            <div className="flex w-full flex-1">
              <Feedback
                status={status}
                game={trainingGame}
                setStatus={setStatus}
                setAndGiveUp={setAndGiveUp}
                controller={controller}
                getNewGame={getNewGame}
              />
            </div>
          </div>
          <div
            id="analysis"
            className="flex h-[calc(85vh)] w-full flex-col gap-2 xl:h-[calc(55vh+4.5rem)]"
          >
            <div className="relative">
              {/* Large screens (xl+): Side by side layout */}
              <div className="hidden xl:flex xl:h-[calc((55vh+4.5rem)/2)]">
                <div className="flex h-full w-full overflow-hidden rounded border-[0.5px] border-white/40">
                  <div className="flex h-full w-auto min-w-[40%] max-w-[40%] border-r-[0.5px] border-white/40">
                    <div className="relative w-full">
                      <Highlight
                        setCurrentMaiaModel={
                          showAnalysis
                            ? analysisController.setCurrentMaiaModel
                            : () => void 0
                        }
                        hover={showAnalysis ? hover : mockHover}
                        makeMove={showAnalysis ? makeMove : mockMakeMove}
                        currentMaiaModel={
                          showAnalysis
                            ? analysisController.currentMaiaModel
                            : 'maia_kdd_1500'
                        }
                        recommendations={
                          showAnalysis
                            ? analysisController.moveRecommendations
                            : mockAnalysisData.recommendations
                        }
                        moveEvaluation={
                          showAnalysis
                            ? (analysisController.moveEvaluation as {
                                maia?: MaiaEvaluation
                                stockfish?: StockfishEvaluation
                              })
                            : mockAnalysisData.moveEvaluation
                        }
                        colorSanMapping={
                          showAnalysis
                            ? analysisController.colorSanMapping
                            : mockAnalysisData.colorSanMapping
                        }
                        boardDescription={
                          showAnalysis
                            ? analysisController.boardDescription
                            : {
                                segments: [
                                  {
                                    type: 'text',
                                    content:
                                      'This position offers multiple strategic options. Consider central control and piece development.',
                                  },
                                ],
                              }
                        }
                      />
                      {!showAnalysis && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded bg-background-1/80 backdrop-blur-sm">
                          <div className="rounded bg-background-2/90 p-4 text-center shadow-lg">
                            <span className="material-symbols-outlined mb-2 text-3xl text-human-3">
                              lock
                            </span>
                            <p className="font-medium text-primary">
                              Analysis Locked
                            </p>
                            <p className="text-sm text-secondary">
                              Complete the puzzle to unlock analysis
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex h-full w-full bg-background-1">
                    <MovesByRating
                      moves={
                        showAnalysis
                          ? analysisController.movesByRating
                          : mockAnalysisData.movesByRating
                      }
                      colorSanMapping={
                        showAnalysis
                          ? analysisController.colorSanMapping
                          : mockAnalysisData.colorSanMapping
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Smaller screens (below xl): Combined Highlight + BlunderMeter container */}
              <div className="flex h-[calc((85vh)*0.4)] overflow-hidden rounded border-[0.5px] border-white/40 bg-background-1 xl:hidden">
                <div className="flex h-full w-full border-r-[0.5px] border-white/40">
                  <Highlight
                    setCurrentMaiaModel={
                      showAnalysis
                        ? analysisController.setCurrentMaiaModel
                        : () => void 0
                    }
                    hover={showAnalysis ? hover : mockHover}
                    makeMove={showAnalysis ? makeMove : mockMakeMove}
                    currentMaiaModel={
                      showAnalysis
                        ? analysisController.currentMaiaModel
                        : 'maia_kdd_1500'
                    }
                    recommendations={
                      showAnalysis
                        ? analysisController.moveRecommendations
                        : mockAnalysisData.recommendations
                    }
                    moveEvaluation={
                      showAnalysis
                        ? (analysisController.moveEvaluation as {
                            maia?: MaiaEvaluation
                            stockfish?: StockfishEvaluation
                          })
                        : mockAnalysisData.moveEvaluation
                    }
                    colorSanMapping={
                      showAnalysis
                        ? analysisController.colorSanMapping
                        : mockAnalysisData.colorSanMapping
                    }
                    boardDescription={
                      showAnalysis
                        ? analysisController.boardDescription
                        : {
                            segments: [
                              {
                                type: 'text',
                                content:
                                  'This position offers multiple strategic options. Consider central control and piece development.',
                              },
                            ],
                          }
                    }
                  />
                </div>
                <div className="flex h-full w-auto min-w-[40%] max-w-[40%] bg-background-1 p-3">
                  <div className="h-full w-full">
                    <BlunderMeter
                      hover={showAnalysis ? hover : mockHover}
                      makeMove={showAnalysis ? makeMove : mockMakeMove}
                      data={
                        showAnalysis
                          ? analysisController.blunderMeter
                          : mockAnalysisData.blunderMeter
                      }
                      colorSanMapping={
                        showAnalysis
                          ? analysisController.colorSanMapping
                          : mockAnalysisData.colorSanMapping
                      }
                      showContainer={false}
                    />
                  </div>
                </div>
              </div>

              {!showAnalysis && (
                <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded bg-background-1/80 backdrop-blur-sm">
                  <div className="rounded bg-background-2/90 p-4 text-center shadow-lg">
                    <span className="material-symbols-outlined mb-2 text-3xl text-human-3">
                      lock
                    </span>
                    <p className="font-medium text-primary">Analysis Locked</p>
                    <p className="text-sm text-secondary">
                      Complete the puzzle to unlock analysis
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              {/* Large screens (xl+): Side by side layout */}
              <div className="hidden xl:flex xl:h-[calc((55vh+4.5rem)/2)] xl:flex-row xl:gap-2">
                <div className="flex h-full w-full flex-col">
                  <MoveMap
                    moveMap={
                      showAnalysis
                        ? analysisController.moveMap
                        : mockAnalysisData.moveMap
                    }
                    colorSanMapping={
                      showAnalysis
                        ? analysisController.colorSanMapping
                        : mockAnalysisData.colorSanMapping
                    }
                    setHoverArrow={
                      showAnalysis ? setHoverArrow : mockSetHoverArrow
                    }
                    makeMove={showAnalysis ? makeMove : mockMakeMove}
                  />
                </div>
                <BlunderMeter
                  hover={showAnalysis ? hover : mockHover}
                  makeMove={showAnalysis ? makeMove : mockMakeMove}
                  data={
                    showAnalysis
                      ? analysisController.blunderMeter
                      : mockAnalysisData.blunderMeter
                  }
                  colorSanMapping={
                    showAnalysis
                      ? analysisController.colorSanMapping
                      : mockAnalysisData.colorSanMapping
                  }
                />
              </div>

              {/* Smaller screens (below xl): MoveMap full width */}
              <div className="flex h-[calc((85vh)*0.3)] w-full xl:hidden">
                <div className="h-full w-full">
                  <MoveMap
                    moveMap={
                      showAnalysis
                        ? analysisController.moveMap
                        : mockAnalysisData.moveMap
                    }
                    colorSanMapping={
                      showAnalysis
                        ? analysisController.colorSanMapping
                        : mockAnalysisData.colorSanMapping
                    }
                    setHoverArrow={
                      showAnalysis ? setHoverArrow : mockSetHoverArrow
                    }
                    makeMove={showAnalysis ? makeMove : mockMakeMove}
                  />
                </div>
              </div>

              {!showAnalysis && (
                <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded bg-background-1/80 backdrop-blur-sm">
                  <div className="rounded bg-background-2/90 p-4 text-center shadow-lg">
                    <span className="material-symbols-outlined mb-2 text-3xl text-human-3">
                      lock
                    </span>
                    <p className="font-medium text-primary">Analysis Locked</p>
                    <p className="text-sm text-secondary">
                      Complete the puzzle to unlock analysis
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Smaller screens (below xl): MovesByRating full width */}
            <div className="flex h-[calc((85vh)*0.3)] w-full rounded bg-background-1/60 xl:hidden">
              <div className="relative h-full w-full">
                <MovesByRating
                  moves={
                    showAnalysis
                      ? analysisController.movesByRating
                      : mockAnalysisData.movesByRating
                  }
                  colorSanMapping={
                    showAnalysis
                      ? analysisController.colorSanMapping
                      : mockAnalysisData.colorSanMapping
                  }
                />
                {!showAnalysis && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded bg-background-1/80 backdrop-blur-sm">
                    <div className="rounded bg-background-2/90 p-4 text-center shadow-lg">
                      <span className="material-symbols-outlined mb-2 text-3xl text-human-3">
                        lock
                      </span>
                      <p className="font-medium text-primary">
                        Analysis Locked
                      </p>
                      <p className="text-sm text-secondary">
                        Complete the puzzle to unlock analysis
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  const mobileLayout = (
    <>
      <div className="flex h-full flex-1 flex-col justify-center gap-1">
        <div className="mt-2 flex h-full flex-col items-start justify-start gap-1">
          <div className="flex h-auto w-full flex-col">
            <GameInfo title="Training" icon="target" type="train">
              <p className="text-secondary">
                Puzzle{' '}
                <span className="text-secondary/60">#{trainingGame.id}</span>
              </p>
              <p className="text-secondary">
                Rating of puzzle:{' '}
                {status !== 'correct' && status !== 'forfeit' ? (
                  <span className="text-secondary/60">hidden</span>
                ) : (
                  <span className="text-human-2">
                    {trainingGame.puzzle_elo}
                  </span>
                )}
              </p>
            </GameInfo>
          </div>
          <div
            id="train-page"
            className="relative flex aspect-square h-[100vw] w-screen"
          >
            <GameBoard
              game={trainingGame}
              currentNode={
                showAnalysis
                  ? analysisController.currentNode
                  : controller.currentNode
              }
              orientation={
                showAnalysis
                  ? analysisController.orientation
                  : controller.orientation
              }
              availableMoves={
                showAnalysis
                  ? analysisController.moves
                  : controller.availableMovesMapped
              }
              onPlayerMakeMove={onPlayerMakeMove}
              shapes={hoverArrow ? [...arrows, hoverArrow] : [...arrows]}
              onSelectSquare={onSelectSquare}
              goToNode={showAnalysis ? analysisController.goToNode : undefined}
              gameTree={showAnalysis ? analyzedGame.tree : undefined}
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
                  showAnalysis
                    ? analysisController.orientation
                    : controller.orientation
                }
                setOrientation={
                  showAnalysis
                    ? analysisController.setOrientation
                    : controller.setOrientation
                }
                currentNode={
                  showAnalysis
                    ? analysisController.currentNode
                    : controller.currentNode
                }
                plyCount={
                  showAnalysis
                    ? analysisController.plyCount
                    : controller.plyCount
                }
                goToNode={
                  showAnalysis
                    ? analysisController.goToNode
                    : controller.goToNode
                }
                goToNextNode={
                  showAnalysis
                    ? analysisController.goToNextNode
                    : controller.goToNextNode
                }
                goToPreviousNode={
                  showAnalysis
                    ? analysisController.goToPreviousNode
                    : controller.goToPreviousNode
                }
                goToRootNode={
                  showAnalysis
                    ? analysisController.goToRootNode
                    : controller.goToRootNode
                }
                gameTree={
                  showAnalysis
                    ? analysisController.gameTree
                    : controller.gameTree
                }
              />
            </div>
            <StatsDisplay stats={stats} />
            <ContinueAgainstMaia launchContinue={launchContinue} />
            <div
              id="analysis"
              className="flex w-full flex-col gap-1 overflow-hidden"
            >
              <div className="relative">
                <BlunderMeter
                  hover={showAnalysis ? hover : mockHover}
                  makeMove={showAnalysis ? makeMove : mockMakeMove}
                  data={
                    showAnalysis
                      ? analysisController.blunderMeter
                      : mockAnalysisData.blunderMeter
                  }
                  colorSanMapping={
                    showAnalysis
                      ? analysisController.colorSanMapping
                      : mockAnalysisData.colorSanMapping
                  }
                />
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
                <Highlight
                  setCurrentMaiaModel={
                    showAnalysis
                      ? analysisController.setCurrentMaiaModel
                      : () => void 0
                  }
                  hover={showAnalysis ? hover : mockHover}
                  makeMove={showAnalysis ? makeMove : mockMakeMove}
                  currentMaiaModel={
                    showAnalysis
                      ? analysisController.currentMaiaModel
                      : 'maia_kdd_1500'
                  }
                  recommendations={
                    showAnalysis
                      ? analysisController.moveRecommendations
                      : mockAnalysisData.recommendations
                  }
                  moveEvaluation={
                    showAnalysis
                      ? (analysisController.moveEvaluation as {
                          maia?: MaiaEvaluation
                          stockfish?: StockfishEvaluation
                        })
                      : mockAnalysisData.moveEvaluation
                  }
                  colorSanMapping={
                    showAnalysis
                      ? analysisController.colorSanMapping
                      : mockAnalysisData.colorSanMapping
                  }
                  boardDescription={
                    showAnalysis
                      ? analysisController.boardDescription
                      : {
                          segments: [
                            {
                              type: 'text',
                              content:
                                'This position offers multiple strategic options. Consider central control and piece development.',
                            },
                          ],
                        }
                  }
                />
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
                    showAnalysis
                      ? analysisController.moveMap
                      : mockAnalysisData.moveMap
                  }
                  colorSanMapping={
                    showAnalysis
                      ? analysisController.colorSanMapping
                      : mockAnalysisData.colorSanMapping
                  }
                  setHoverArrow={
                    showAnalysis ? setHoverArrow : mockSetHoverArrow
                  }
                  makeMove={showAnalysis ? makeMove : mockMakeMove}
                />
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
            </div>
            <div className="flex w-full">
              <Feedback
                status={status}
                game={trainingGame}
                setStatus={setStatus}
                controller={controller}
                setAndGiveUp={setAndGiveUp}
                getNewGame={getNewGame}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <Head>
        <title>Maia Chess - Train</title>
        <meta
          name="description"
          content="Collection of chess training and analysis tools centered around Maia."
        />
      </Head>
      <AnimatePresence>
        {analysisController.maiaStatus === 'no-cache' ||
        analysisController.maiaStatus === 'downloading' ? (
          <DownloadModelModal
            progress={analysisController.maiaProgress}
            download={analysisController.downloadMaia}
          />
        ) : null}
      </AnimatePresence>
      <TrainingControllerContext.Provider value={controller}>
        {trainingGame && (isMobile ? mobileLayout : desktopLayout)}
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
