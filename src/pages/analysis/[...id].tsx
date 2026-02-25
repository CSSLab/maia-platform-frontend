import React, {
  useMemo,
  Dispatch,
  useState,
  useEffect,
  useLayoutEffect,
  useContext,
  useCallback,
  useRef,
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
import { Loading } from 'src/components'
import { AuthenticatedWrapper } from 'src/components/Common/AuthenticatedWrapper'
import { MoveMap } from 'src/components/Analysis/MoveMap'
import { Highlight } from 'src/components/Analysis/Highlight'
import { AnalysisSidebar } from 'src/components/Analysis'
import {
  AnalysisArrowLegend,
  AnalysisCompactBlunderMeter,
  AnalysisMaiaWinrateBar,
  AnalysisStockfishEvalBar,
} from 'src/components/Analysis/BoardChrome'
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
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion'
import { useAnalysisController } from 'src/hooks'
import { tourConfigs } from 'src/constants/tours'
import type { DrawBrushes, DrawShape } from 'chessground/draw'
import { MAIA_MODELS } from 'src/constants/common'
import { applyEngineAnalysisData } from 'src/lib/analysis'
import { cpToWinrate } from 'src/lib'

const EVAL_BAR_RANGE = 4
const CUSTOM_PGN_RESULT_OVERRIDES_STORAGE_KEY =
  'maia_custom_pgn_result_overrides'
const DEFAULT_STOCKFISH_EVAL_BAR = {
  hasEval: false,
  pawns: 0,
  displayPawns: 0,
  label: '--',
}
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

const PGN_HEADER_LINE_REGEX = /^\s*\[[^\]]+\]\s*$/

const ensureBlankLineAfterPgnHeaders = (pgn: string): string => {
  const normalizedNewlines = pgn.replace(/\r\n/g, '\n')
  const lines = normalizedNewlines.split('\n')

  let firstContentLine = 0
  while (
    firstContentLine < lines.length &&
    lines[firstContentLine].trim().length === 0
  ) {
    firstContentLine++
  }

  let headerEndLine = firstContentLine
  while (
    headerEndLine < lines.length &&
    PGN_HEADER_LINE_REGEX.test(lines[headerEndLine])
  ) {
    headerEndLine++
  }

  const hasHeaderBlock = headerEndLine > firstContentLine
  const hasMovetextAfterHeaders = headerEndLine < lines.length
  const needsSeparator =
    hasHeaderBlock &&
    hasMovetextAfterHeaders &&
    lines[headerEndLine].trim().length > 0

  if (needsSeparator) {
    lines.splice(headerEndLine, 0, '')
  }

  return lines.join('\n').trim()
}

const formatMoveHistoryAsPgn = (moves: string[]): string => {
  const tokens: string[] = []

  for (let i = 0; i < moves.length; i += 2) {
    tokens.push(`${Math.floor(i / 2) + 1}. ${moves[i]}`)
    if (moves[i + 1]) {
      tokens.push(moves[i + 1])
    }
  }

  return tokens.join(' ').trim()
}

const normalizeCustomPgnForBackendStore = (pgn: string): string => {
  const trimmed = pgn.trim()
  const candidates = Array.from(
    new Set([trimmed, ensureBlankLineAfterPgnHeaders(trimmed)]),
  )

  for (const candidate of candidates) {
    const chess = new Chess()
    if (!chess.loadPgn(candidate, { sloppy: true })) {
      continue
    }

    const header = { ...chess.header() }

    const moveText = formatMoveHistoryAsPgn(chess.history())
    const headerText = Object.entries(header)
      .map(([key, value]) => `[${key} "${value}"]`)
      .join('\n')

    if (!headerText) {
      return moveText
    }

    return moveText ? `${headerText}\n\n${moveText}` : headerText
  }

  return ensureBlankLineAfterPgnHeaders(trimmed)
}

const extractPgnResultToken = (pgn: string): string | undefined => {
  const headerMatch = pgn.match(/\[\s*Result\s+"(1-0|0-1|1\/2-1\/2|\*)"\s*\]/i)
  if (headerMatch) {
    return headerMatch[1]
  }

  const tailMatch = pgn.match(/(?:^|\s)(1-0|0-1|1\/2-1\/2|\*)(?:\s*)$/)
  return tailMatch?.[1]
}

const getCustomPgnResultOverrides = (): Record<string, string> => {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(
      CUSTOM_PGN_RESULT_OVERRIDES_STORAGE_KEY,
    )
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    console.warn('Failed to read custom PGN result overrides:', error)
    return {}
  }
}

const setCustomPgnResultOverride = (gameId: string, result: string): void => {
  if (typeof window === 'undefined') return

  try {
    const overrides = getCustomPgnResultOverrides()
    overrides[gameId] = result
    window.localStorage.setItem(
      CUSTOM_PGN_RESULT_OVERRIDES_STORAGE_KEY,
      JSON.stringify(overrides),
    )
  } catch (error) {
    console.warn('Failed to store custom PGN result override:', error)
  }
}

const resultTokenToWinner = (result: string): 'white' | 'black' | 'none' => {
  if (result === '1-0') return 'white'
  if (result === '0-1') return 'black'
  return 'none'
}

const applyCustomPgnResultOverride = (
  gameId: string,
  game: AnalyzedGame,
): AnalyzedGame => {
  const result = getCustomPgnResultOverrides()[gameId]
  if (!result || result === '*') return game

  return {
    ...game,
    termination: {
      ...(game.termination || {}),
      result,
      winner: resultTokenToWinner(result),
    },
  }
}

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
      const rawGame = await fetchAnalyzedMaiaGame(id, type)
      const game =
        type === 'custom' ? applyCustomPgnResultOverride(id, rawGame) : rawGame

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
        <Loading isLoading={true}>
          <div></div>
        </Loading>
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
  const { width, height } = useContext(WindowSizeContext)
  const isMobile = useMemo(() => width > 0 && width <= 670, [width])
  const useMobileStyleAnalysisLayout = useMemo(() => {
    if (isMobile) return true

    // Use mobile-style analysis layout for tablet/medium widths to avoid the
    // cramped intermediate desktop layout (e.g. iPad and narrow desktop windows).
    return width > 670 && width <= 1120
  }, [isMobile, width])
  const isTabletUsingMobileStyleLayout = useMemo(
    () => useMobileStyleAnalysisLayout && !isMobile,
    [isMobile, useMobileStyleAnalysisLayout],
  )
  const desktopBoardHeaderStripRef = useRef<HTMLDivElement | null>(null)
  const desktopBlunderMeterSectionRef = useRef<HTMLDivElement | null>(null)
  const [desktopMiddleMeasuredHeights, setDesktopMiddleMeasuredHeights] =
    useState({
      boardHeaderStripPx: 28,
      blunderMeterSectionPx: 126,
    })

  useIsomorphicLayoutEffect(() => {
    if (useMobileStyleAnalysisLayout) return

    const headerEl = desktopBoardHeaderStripRef.current
    const blunderEl = desktopBlunderMeterSectionRef.current
    if (!headerEl && !blunderEl) return

    const updateHeights = () => {
      const next = {
        boardHeaderStripPx:
          headerEl?.getBoundingClientRect().height ??
          desktopMiddleMeasuredHeights.boardHeaderStripPx,
        blunderMeterSectionPx:
          blunderEl?.getBoundingClientRect().height ??
          desktopMiddleMeasuredHeights.blunderMeterSectionPx,
      }

      setDesktopMiddleMeasuredHeights((prev) => {
        if (
          Math.abs(prev.boardHeaderStripPx - next.boardHeaderStripPx) < 0.5 &&
          Math.abs(prev.blunderMeterSectionPx - next.blunderMeterSectionPx) <
            0.5
        ) {
          return prev
        }
        return next
      })
    }

    updateHeights()
    // Intentionally avoid observing live content changes here; the blunder-meter
    // rows can vary slightly by move, which causes distracting board-size jitter
    // during arrow-key paging. Re-measure on width changes only.
  }, [useMobileStyleAnalysisLayout, width])
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
  const destinationBadges = useMemo(() => {
    if (
      !analysisEnabled ||
      !controller.showTopMoveBadges ||
      !controller.topHumanMoveBadge
    ) {
      return []
    }

    return [
      {
        square: controller.topHumanMoveBadge.square,
        classification: controller.topHumanMoveBadge.classification,
      },
    ]
  }, [
    analysisEnabled,
    controller.showTopMoveBadges,
    controller.topHumanMoveBadge,
  ])

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
        try {
          const pgnResult =
            type === 'pgn' ? extractPgnResultToken(data) : undefined
          const { game_id } = await storeCustomGame({
            name: name,
            pgn:
              type === 'pgn'
                ? normalizeCustomPgnForBackendStore(data)
                : undefined,
            fen: type === 'fen' ? data : undefined,
          })

          if (pgnResult && pgnResult !== '*') {
            setCustomPgnResultOverride(game_id, pgnResult)
          }

          setShowCustomModal(false)
          router.push(`/analysis/${game_id}/custom`)
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to store custom game'
          console.error('Custom analysis import failed:', error)
          toast.error(message)
        }
      })()
    },
    [router],
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

  const rawCompactBlunderMeterData = useMemo(
    () =>
      analysisEnabled && !controller.learnFromMistakes.state.isActive
        ? controller.blunderMeter
        : emptyBlunderMeterData,
    [
      analysisEnabled,
      controller.learnFromMistakes.state.isActive,
      controller.blunderMeter,
      emptyBlunderMeterData,
    ],
  )
  const [
    displayedCompactBlunderMeterData,
    setDisplayedCompactBlunderMeterData,
  ] = useState(rawCompactBlunderMeterData)

  const hasUsableBlunderMeterData = useMemo(() => {
    const totalProbability =
      rawCompactBlunderMeterData.goodMoves.probability +
      rawCompactBlunderMeterData.okMoves.probability +
      rawCompactBlunderMeterData.blunderMoves.probability
    const hasMoves =
      rawCompactBlunderMeterData.goodMoves.moves.length > 0 ||
      rawCompactBlunderMeterData.okMoves.moves.length > 0 ||
      rawCompactBlunderMeterData.blunderMoves.moves.length > 0

    return totalProbability > 0 || hasMoves
  }, [rawCompactBlunderMeterData])

  useIsomorphicLayoutEffect(() => {
    if (!analysisEnabled || controller.learnFromMistakes.state.isActive) {
      setDisplayedCompactBlunderMeterData(emptyBlunderMeterData)
      return
    }

    if (hasUsableBlunderMeterData) {
      setDisplayedCompactBlunderMeterData(rawCompactBlunderMeterData)
    }
  }, [
    analysisEnabled,
    controller.learnFromMistakes.state.isActive,
    emptyBlunderMeterData,
    hasUsableBlunderMeterData,
    rawCompactBlunderMeterData,
  ])

  const compactBlunderMeterData = displayedCompactBlunderMeterData

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

  const analysisArrowBrushes = useMemo(
    () => ({
      playedMoveOutline: {
        key: 'playedMoveOutline',
        color: '#4A8FB3',
        opacity: 0.95,
        lineWidth: 11,
      },
      playedMoveCore: {
        key: 'playedMoveCore',
        color: '#FFFFFF',
        opacity: 0.98,
        lineWidth: 8,
      },
    }),
    [],
  )

  const playedMoveShapes = useMemo<DrawShape[]>(() => {
    const playedMove = controller.currentNode?.mainChild?.move
    if (!playedMove || playedMove.length < 4) {
      return []
    }

    return [
      {
        brush: 'playedMoveOutline',
        orig: playedMove.slice(0, 2) as Key,
        dest: playedMove.slice(2, 4) as Key,
      },
      {
        brush: 'playedMoveCore',
        orig: playedMove.slice(0, 2) as Key,
        dest: playedMove.slice(2, 4) as Key,
      },
    ] as DrawShape[]
  }, [controller.currentNode?.mainChild?.move])

  const staggerOverlappingArrows = useCallback((shapes: DrawShape[]) => {
    const overlapGroups = new Map<string, number[]>()

    shapes.forEach((shape, index) => {
      const arrow = shape as DrawShape & { orig?: string; dest?: string }
      if (!arrow.orig || !arrow.dest) return

      const key = `${arrow.orig}-${arrow.dest}`
      const indices = overlapGroups.get(key) ?? []
      indices.push(index)
      overlapGroups.set(key, indices)
    })

    const layeredShapes = shapes.map((shape) => {
      const arrow = shape as DrawShape & {
        modifiers?: { [key: string]: unknown; lineWidth?: number }
      }

      return {
        ...arrow,
        modifiers: arrow.modifiers ? { ...arrow.modifiers } : undefined,
      } as DrawShape
    })

    overlapGroups.forEach((indices) => {
      if (indices.length < 2) return

      indices.forEach((shapeIndex, order) => {
        const shape = layeredShapes[shapeIndex] as DrawShape & {
          modifiers?: { [key: string]: unknown; lineWidth?: number }
        }

        const baseWidth =
          typeof shape.modifiers?.lineWidth === 'number'
            ? shape.modifiers.lineWidth
            : 8

        const expandedWidth = baseWidth + (indices.length - order - 1) * 1.25
        const adjustedWidth = Math.min(13.5, Math.max(2.5, expandedWidth))

        shape.modifiers = {
          ...(shape.modifiers || {}),
          lineWidth: adjustedWidth,
        }
      })
    })

    return layeredShapes
  }, [])

  const rawStockfishEvalBar = useMemo(() => {
    const stockfish = controller.moveEvaluation?.stockfish
    const sideToMove = controller.currentNode?.turn || 'w'

    if (!stockfish) {
      return {
        ...DEFAULT_STOCKFISH_EVAL_BAR,
        depth: 0,
      }
    }

    const mateIn = stockfish.mate_vec?.[stockfish.model_move]
    if (mateIn !== undefined) {
      // Stockfish mate sign is relative to side-to-move; map to white/black perspective for the bar.
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
  }, [controller.currentNode?.turn, controller.moveEvaluation?.stockfish])

  const [displayedStockfishEvalBar, setDisplayedStockfishEvalBar] = useState(
    DEFAULT_STOCKFISH_EVAL_BAR,
  )

  useIsomorphicLayoutEffect(() => {
    if (!rawStockfishEvalBar.hasEval || rawStockfishEvalBar.depth <= 10) {
      return
    }

    setDisplayedStockfishEvalBar({
      hasEval: true,
      pawns: rawStockfishEvalBar.pawns,
      displayPawns: rawStockfishEvalBar.displayPawns,
      label: rawStockfishEvalBar.label,
    })
  }, [rawStockfishEvalBar])

  const evalPositionPercent = useMemo(() => {
    const normalized =
      (displayedStockfishEvalBar.pawns + EVAL_BAR_RANGE) / (EVAL_BAR_RANGE * 2)
    return Math.max(0, Math.min(1, normalized)) * 100
  }, [displayedStockfishEvalBar.pawns])

  const displayedStockfishEvalText = useMemo(() => {
    if (!displayedStockfishEvalBar.hasEval) {
      return '--'
    }

    if (displayedStockfishEvalBar.label.startsWith('M')) {
      return displayedStockfishEvalBar.label
    }

    const roundedPawns =
      Math.round(displayedStockfishEvalBar.displayPawns * 10) / 10
    const safePawns = Math.abs(roundedPawns) < 0.05 ? 0 : roundedPawns
    return `${safePawns > 0 ? '+' : ''}${safePawns.toFixed(1)}`
  }, [
    displayedStockfishEvalBar.displayPawns,
    displayedStockfishEvalBar.hasEval,
    displayedStockfishEvalBar.label,
  ])

  const currentTurnForBars: 'w' | 'b' = controller.currentNode?.turn || 'w'

  const isCurrentPositionCheckmateForBars = useMemo(() => {
    if (!controller.currentNode) return false
    try {
      const chess = new Chess(controller.currentNode.fen)
      return chess.inCheckmate()
    } catch {
      return false
    }
  }, [controller.currentNode])

  const isInFirst10PlyForBars = useMemo(() => {
    if (!controller.currentNode) return false
    const moveNumber = controller.currentNode.moveNumber
    const turn = controller.currentNode.turn
    const plyFromStart = (moveNumber - 1) * 2 + (turn === 'b' ? 1 : 0)
    return plyFromStart < 10
  }, [controller.currentNode])

  const rawMaiaWhiteWinBar = useMemo(() => {
    const stockfishEval = controller.moveEvaluation?.stockfish

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

    if (controller.moveEvaluation?.maia) {
      const percent = Math.max(
        0,
        Math.min(100, controller.moveEvaluation.maia.value * 100),
      )
      return {
        hasValue: true,
        percent,
        label: `${(Math.round(percent * 10) / 10).toFixed(1)}%`,
      }
    }

    return { hasValue: false, percent: 50, label: '--' }
  }, [
    controller.moveEvaluation?.maia,
    controller.moveEvaluation?.stockfish,
    currentTurnForBars,
    isCurrentPositionCheckmateForBars,
    isInFirst10PlyForBars,
  ])

  const [displayedMaiaWhiteWinBar, setDisplayedMaiaWhiteWinBar] =
    useState(rawMaiaWhiteWinBar)

  useIsomorphicLayoutEffect(() => {
    if (!rawMaiaWhiteWinBar.hasValue) {
      return
    }

    setDisplayedMaiaWhiteWinBar(rawMaiaWhiteWinBar)
  }, [rawMaiaWhiteWinBar])

  const maiaWhiteWinPositionPercent = useMemo(
    () => Math.max(0, Math.min(100, displayedMaiaWhiteWinBar.percent)),
    [displayedMaiaWhiteWinBar.percent],
  )
  const renderedMaiaWhiteWinBar = useMemo(
    () =>
      analysisEnabled
        ? displayedMaiaWhiteWinBar
        : { hasValue: false, percent: 50, label: '--' },
    [analysisEnabled, displayedMaiaWhiteWinBar],
  )
  const maiaWhiteWinBarPositionTargetPercent = analysisEnabled
    ? maiaWhiteWinPositionPercent
    : 50

  const smoothedMaiaWhiteWinPosition = useSpring(50, {
    stiffness: 520,
    damping: 42,
    mass: 0.25,
  })
  const smoothedMaiaWhiteWinVerticalPositionLabel = useTransform(
    smoothedMaiaWhiteWinPosition,
    (value) => `${100 - value}%`,
  )

  useIsomorphicLayoutEffect(() => {
    smoothedMaiaWhiteWinPosition.set(maiaWhiteWinBarPositionTargetPercent)
  }, [maiaWhiteWinBarPositionTargetPercent, smoothedMaiaWhiteWinPosition])

  const desktopMaiaBubbleReservePx = useMemo(
    () => (width >= 1360 ? 62 : 52),
    [width],
  )

  const desktopEvalBubbleReservePx = useMemo(
    () => (width >= 1360 ? 56 : 48),
    [width],
  )

  const desktopEvalGutterWidthPx = useMemo(
    () => desktopEvalBubbleReservePx + 6,
    [desktopEvalBubbleReservePx],
  )
  const desktopMaiaGutterWidthPx = useMemo(
    () => desktopMaiaBubbleReservePx + 6,
    [desktopMaiaBubbleReservePx],
  )
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
    const extraGapPx = 4 // gap-1 between the top text strip and the board row
    const measuredNonBoardHeightPx =
      desktopMiddleMeasuredHeights.boardHeaderStripPx +
      desktopMiddleMeasuredHeights.blunderMeterSectionPx +
      extraGapPx

    return Math.max(
      320,
      Math.floor(targetColumnHeightPx - measuredNonBoardHeightPx),
    )
  }, [desktopMiddleMeasuredHeights, height])
  const desktopBoardSizeCss = useMemo(() => {
    const heightCapCss =
      desktopBoardHeightCapPx !== null ? `${desktopBoardHeightCapPx}px` : '72vh'
    const expandedTargetCss = `min(${desktopBoardWidthCapVw}vw, ${heightCapCss})`

    // Never shrink below the prior desktop sizing behavior; only grow when extra room exists.
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
  const desktopConfigPanelHeightCss = '12.5rem'
  const desktopSidebarContentHeightCss = `calc(${desktopColumnTargetHeightCss} - ${desktopConfigPanelHeightCss} - 0.75rem)`
  const desktopBarChromeSize: 'compact' | 'expanded' =
    width >= 1360 ? 'expanded' : 'compact'
  const desktopCompactBlunderMaiaHeaderLabel = useMemo(() => {
    const ratingLevel =
      controller.currentMaiaModel?.replace('maia_kdd_', '') || '----'
    return `Maia %\n@ ${ratingLevel}`
  }, [controller.currentMaiaModel])
  const desktopLeftPanelTabs = [
    {
      id: 'moves',
      name: 'Moves',
    },
    {
      id: 'select-game',
      name: 'Select Game',
    },
  ] as const
  const [desktopLeftPanelTab, setDesktopLeftPanelTab] = useState<
    (typeof desktopLeftPanelTabs)[number]['id']
  >(desktopLeftPanelTabs[0].id)

  useEffect(() => {
    if (useMobileStyleAnalysisLayout || desktopLeftPanelTab !== 'select-game') {
      return
    }

    const keyboardNavigationDisabled =
      controller.gameAnalysis.progress.isAnalyzing ||
      controller.learnFromMistakes.state.isActive

    if (keyboardNavigationDisabled) return

    const handleDesktopSelectGamePaging = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable)
      ) {
        return
      }

      if (event.key === 'ArrowLeft' && controller.currentNode?.parent) {
        event.preventDefault()
        event.stopPropagation()
        controller.goToPreviousNode()
        setDesktopLeftPanelTab('moves')
        return
      }

      if (event.key === 'ArrowRight' && controller.currentNode?.mainChild) {
        event.preventDefault()
        event.stopPropagation()
        controller.goToNextNode()
        setDesktopLeftPanelTab('moves')
      }
    }

    window.addEventListener('keydown', handleDesktopSelectGamePaging, true)
    return () =>
      window.removeEventListener('keydown', handleDesktopSelectGamePaging, true)
  }, [
    controller.currentNode,
    controller.gameAnalysis.progress.isAnalyzing,
    controller.goToNextNode,
    controller.goToPreviousNode,
    controller.learnFromMistakes.state.isActive,
    desktopLeftPanelTab,
    useMobileStyleAnalysisLayout,
  ])

  const smoothedEvalPosition = useSpring(50, {
    stiffness: 520,
    damping: 42,
    mass: 0.25,
  })
  const smoothedEvalVerticalPositionLabel = useTransform(
    smoothedEvalPosition,
    (value) => `${100 - value}%`,
  )
  const renderedStockfishEvalBar = useMemo(
    () =>
      analysisEnabled
        ? displayedStockfishEvalBar
        : {
            hasEval: false,
            pawns: 0,
            displayPawns: 0,
            label: '--',
          },
    [analysisEnabled, displayedStockfishEvalBar],
  )
  const renderedStockfishEvalText = analysisEnabled
    ? displayedStockfishEvalText
    : '--'
  const evalBarPositionTargetPercent = analysisEnabled
    ? evalPositionPercent
    : 50

  useIsomorphicLayoutEffect(() => {
    smoothedEvalPosition.set(evalBarPositionTargetPercent)
  }, [evalBarPositionTargetPercent, smoothedEvalPosition])

  const formatAnalysisPlayerName = (name: string) => {
    const maiaMatch = name.match(/^maia_kdd_(\d+)$/i)
    if (maiaMatch) {
      return `Maia ${maiaMatch[1]}`
    }
    return name
  }

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
                <p className="text-sm">
                  {formatAnalysisPlayerName(player.name)}
                </p>
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
          <span className="inline-flex w-4 items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-white" />
          </span>
          <span className="font-medium">
            {formatAnalysisPlayerName(analyzedGame.whitePlayer.name)}
          </span>
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
          <span className="inline-flex w-4 items-center justify-center">
            <div className="h-2 w-2 rounded-full border-[0.5px] bg-black" />
          </span>
          <span className="font-medium">
            {formatAnalysisPlayerName(analyzedGame.blackPlayer.name)}
          </span>
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
      className="flex h-full w-full flex-col items-center py-4 2xl:items-end"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="flex h-full w-[92%] flex-row gap-4 xl:w-[94%] xl:gap-5 2xl:w-[97%]">
        <motion.div
          id="navigation"
          className="desktop-left-column-container flex min-h-0 flex-col gap-2"
          variants={itemVariants}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="w-full overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
            {/* Game info header */}
            <GameInfo
              title="Analysis"
              icon="bar_chart"
              type="analysis"
              embedded
            >
              <NestedGameInfo />
            </GameInfo>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
            <div className="flex flex-row border-b border-glass-border">
              {desktopLeftPanelTabs.map((tab) => {
                const selected = tab.id === desktopLeftPanelTab
                return (
                  <div
                    key={tab.id}
                    tabIndex={0}
                    role="button"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') setDesktopLeftPanelTab(tab.id)
                    }}
                    onClick={() => setDesktopLeftPanelTab(tab.id)}
                    className={`relative flex cursor-pointer select-none flex-row px-3 py-1.5 outline-none transition duration-200 focus:outline-none focus-visible:outline-none ${selected ? 'bg-white/5' : 'hover:bg-white hover:bg-opacity-[0.02]'}`}
                  >
                    <p
                      className={`text-xs transition duration-200 2xl:text-sm ${selected ? 'text-primary' : 'text-secondary'}`}
                    >
                      {tab.name}
                    </p>
                    {selected ? (
                      <motion.div
                        layoutId="analysisDesktopLeftPanelTab"
                        className="absolute bottom-0 left-0 h-[1px] w-full bg-white"
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <div
                aria-hidden={desktopLeftPanelTab !== 'moves'}
                className={`red-scrollbar absolute inset-0 flex h-full flex-col overflow-y-auto transition-opacity duration-150 ${
                  desktopLeftPanelTab === 'moves'
                    ? 'visible opacity-100'
                    : 'pointer-events-none invisible opacity-0'
                }`}
              >
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
                  disableNavigation={
                    controller.learnFromMistakes.state.isActive
                  }
                  embedded
                />
              </div>
              <div
                aria-hidden={desktopLeftPanelTab !== 'select-game'}
                className={`absolute inset-0 flex min-h-0 flex-col transition-opacity duration-150 ${
                  desktopLeftPanelTab === 'select-game'
                    ? 'visible opacity-100'
                    : 'pointer-events-none invisible opacity-0'
                }`}
              >
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
          </div>
        </motion.div>
        <motion.div
          className="desktop-middle-column-container flex flex-col gap-3"
          variants={itemVariants}
          style={{
            willChange: 'transform, opacity',
            width: desktopBoardSizeCss,
            minWidth: desktopBoardMinSizeCss,
            height: desktopColumnTargetHeightCss,
          }}
        >
          <div className="flex h-full w-full flex-col overflow-visible">
            <div
              className="desktop-board-container relative flex shrink-0"
              style={{
                width: desktopBoardSizeCss,
                minWidth: desktopBoardMinSizeCss,
                height: 'auto',
                minHeight: 0,
              }}
            >
              <div className="flex w-full flex-col gap-1">
                <div
                  ref={desktopBoardHeaderStripRef}
                  className="grid w-full items-center gap-1.5 py-1.5 pr-1"
                  style={{
                    gridTemplateColumns: `${desktopMaiaGutterWidthPx}px minmax(0,1fr) ${desktopEvalGutterWidthPx}px`,
                  }}
                >
                  <div className="pointer-events-none relative flex justify-center">
                    <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-human-2">
                      White Win %
                    </span>
                  </div>
                  <div className="pointer-events-none flex justify-center">
                    <AnalysisArrowLegend
                      labelMode="short"
                      className="gap-x-3 text-[10px]"
                    />
                  </div>
                  <div className="pointer-events-none flex justify-center">
                    <span className="text-[10px] font-semibold leading-none text-engine-2">
                      SF Eval
                    </span>
                  </div>
                </div>
                <div
                  className="grid w-full items-stretch gap-1.5 pr-1"
                  style={{
                    gridTemplateColumns: `${desktopMaiaGutterWidthPx}px minmax(0,1fr) ${desktopEvalGutterWidthPx}px`,
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
                      desktopSize={desktopBarChromeSize}
                    />
                  </div>
                  <div className="relative flex aspect-square w-full">
                    <GameBoard
                      game={analyzedGame}
                      availableMoves={
                        controller.learnFromMistakes.state.isActive &&
                        analysisEnabled
                          ? new Map() // Empty moves when puzzle is solved
                          : controller.availableMoves
                      }
                      setCurrentSquare={setCurrentSquare}
                      shapes={(() => {
                        const baseShapes = [...playedMoveShapes]

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

                        return staggerOverlappingArrows(baseShapes)
                      })()}
                      currentNode={controller.currentNode as GameNode}
                      orientation={controller.orientation}
                      onPlayerMakeMove={onPlayerMakeMove}
                      goToNode={controller.goToNode}
                      gameTree={analyzedGame.tree}
                      destinationBadges={destinationBadges}
                      brushes={analysisArrowBrushes as unknown as DrawBrushes}
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
                      hasEval={renderedStockfishEvalBar.hasEval}
                      displayText={renderedStockfishEvalText}
                      labelPositionTop={smoothedEvalVerticalPositionLabel}
                      disabled={!analysisEnabled}
                      variant="desktop"
                      desktopSize={desktopBarChromeSize}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div ref={desktopBlunderMeterSectionRef} className="shrink-0 pt-3">
              <AnalysisCompactBlunderMeter
                variant="desktop"
                data={compactBlunderMeterData}
                colorSanMapping={controller.colorSanMapping}
                playedMove={
                  controller.currentNode?.mainChild?.move ?? undefined
                }
                maiaHeaderLabel={desktopCompactBlunderMaiaHeaderLabel}
                hover={analysisEnabled ? hover : mockHover}
                makeMove={analysisEnabled ? makeMove : mockMakeMove}
              />
            </div>
          </div>
        </motion.div>
        <AnalysisSidebar
          hover={hover}
          makeMove={makeMove}
          controller={controller}
          setHoverArrow={setHoverArrow}
          analysisEnabled={analysisEnabled}
          handleToggleAnalysis={handleToggleAnalysis}
          hideDetailedBlunderMeter={true}
          desktopContentHeightCss={desktopSidebarContentHeightCss}
          containerStyle={{
            width: 'clamp(23rem, 27vw, 26rem)',
            minWidth: '23rem',
            flexBasis: 'clamp(23rem, 27vw, 26rem)',
          }}
          footerContent={
            <div
              className="flex h-full min-h-0 flex-col overflow-hidden"
              style={{ height: desktopConfigPanelHeightCss }}
            >
              <ConfigurableScreens
                currentMaiaModel={controller.currentMaiaModel}
                setCurrentMaiaModel={controller.setCurrentMaiaModel}
                showTopMoveBadges={controller.showTopMoveBadges}
                setShowTopMoveBadges={controller.setShowTopMoveBadges}
                launchContinue={launchContinue}
                MAIA_MODELS={MAIA_MODELS}
                game={analyzedGame}
                currentNode={controller.currentNode as GameNode}
                onAnalyzeEntireGame={handleAnalyzeEntireGame}
                onLearnFromMistakes={handleLearnFromMistakes}
                isAnalysisInProgress={
                  controller.gameAnalysis.progress.isAnalyzing
                }
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
            </div>
          }
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
          <div className="flex w-full flex-col items-start justify-start">
            <div className="flex w-full flex-col items-start justify-start overflow-hidden p-3">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center justify-start gap-1.5">
                  <span className="material-symbols-outlined text-xl">
                    format_list_bulleted
                  </span>
                  <h2 className="text-xl font-semibold">Switch Game</h2>
                </div>
                <button
                  className="flex items-center gap-1 rounded bg-glass-strong px-2 py-1 text-sm duration-200 hover:bg-glass-stronger"
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
            <div className="flex h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-backdrop/30">
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
            className="flex w-full flex-col items-start justify-start"
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
              mobileActions={
                <button
                  type="button"
                  onClick={handleToggleAnalysis}
                  className={`flex items-center gap-1 rounded bg-human-4/30 px-2 py-1 text-xxs text-human-2 duration-200 hover:bg-human-4/50 md:hidden md:text-sm ${
                    analysisEnabled ? 'text-human-2' : 'text-white/80'
                  }`}
                  aria-pressed={analysisEnabled}
                >
                  <span className="material-symbols-outlined text-xxs md:text-sm">
                    {analysisEnabled ? 'visibility_off' : 'visibility'}
                  </span>
                  <span>{analysisEnabled ? 'Hide' : 'Show'}</span>
                </button>
              }
            >
              <NestedGameInfo />
            </GameInfo>
            <div className="flex w-full flex-col items-center px-3">
              <div className="pointer-events-none mb-0.5 grid h-5 w-full max-w-[560px] grid-cols-[30px_minmax(0,1fr)_30px] items-center gap-3">
                <div className="flex justify-center">
                  <span className="translate-y-px whitespace-nowrap text-[8px] font-extrabold leading-none text-human-2">
                    Maia %
                  </span>
                </div>
                <AnalysisArrowLegend
                  labelMode="short"
                  className="translate-y-px justify-center gap-x-3 self-center text-[8px] font-semibold"
                />
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
                    labelPositionTop={smoothedMaiaWhiteWinVerticalPositionLabel}
                    disabled={!analysisEnabled}
                    variant="mobile"
                  />
                </div>
                <div
                  id="analysis"
                  className="relative flex aspect-square w-full"
                >
                  <GameBoard
                    game={analyzedGame}
                    availableMoves={
                      controller.learnFromMistakes.state.isActive &&
                      analysisEnabled
                        ? new Map()
                        : controller.availableMoves
                    }
                    setCurrentSquare={setCurrentSquare}
                    shapes={(() => {
                      const baseShapes = [...playedMoveShapes]

                      if (analysisEnabled) {
                        baseShapes.push(...controller.arrows)
                      }

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

                      if (hoverArrow) {
                        baseShapes.push(hoverArrow)
                      }

                      return staggerOverlappingArrows(baseShapes)
                    })()}
                    currentNode={controller.currentNode as GameNode}
                    orientation={controller.orientation}
                    onPlayerMakeMove={onPlayerMakeMove}
                    goToNode={controller.goToNode}
                    gameTree={analyzedGame.tree}
                    destinationBadges={destinationBadges}
                    brushes={analysisArrowBrushes as unknown as DrawBrushes}
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
                    hasEval={renderedStockfishEvalBar.hasEval}
                    displayText={renderedStockfishEvalText}
                    labelPositionTop={smoothedEvalVerticalPositionLabel}
                    disabled={!analysisEnabled}
                    variant="mobile"
                  />
                </div>
              </div>
              <AnalysisCompactBlunderMeter
                className="mb-1.5 mt-3 w-full max-w-[560px]"
                data={compactBlunderMeterData}
                colorSanMapping={controller.colorSanMapping}
                playedMove={
                  controller.currentNode?.mainChild?.move ?? undefined
                }
                hover={analysisEnabled ? hover : mockHover}
                makeMove={analysisEnabled ? makeMove : mockMakeMove}
              />
            </div>
            <div className="flex w-full flex-col gap-0">
              <div className="w-full !flex-grow-0">
                <BoardController
                  embedded
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
              <div
                className={`relative bottom-0 overflow-auto overflow-y-hidden ${
                  isTabletUsingMobileStyleLayout
                    ? 'h-12 max-h-12 flex-none'
                    : 'h-48 max-h-48 flex-1'
                }`}
              >
                <MovesContainer
                  game={analyzedGame}
                  termination={analyzedGame.termination}
                  showAnnotations={true}
                  forceMobileLayout={useMobileStyleAnalysisLayout}
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
            <div className="flex w-full flex-col overflow-hidden">
              <div className="relative border-t border-glass-border bg-glass backdrop-blur-md">
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
                  hideWhiteWinRateSummary={true}
                  hideStockfishEvalSummary={true}
                />
                {(!analysisEnabled ||
                  controller.learnFromMistakes.state.isActive) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-backdrop/90 backdrop-blur-sm">
                    <div className="rounded border border-glass-border bg-glass p-4 text-center shadow-lg">
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
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-backdrop/90 backdrop-blur-sm">
                    <div className="rounded border border-glass-border bg-glass p-4 text-center shadow-lg">
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
                  playerToMove={
                    analysisEnabled &&
                    !controller.learnFromMistakes.state.isActive
                      ? (controller.currentNode?.turn ?? 'w')
                      : 'w'
                  }
                />
                {(!analysisEnabled ||
                  controller.learnFromMistakes.state.isActive) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-backdrop/90 backdrop-blur-sm">
                    <div className="rounded border border-glass-border bg-glass p-4 text-center shadow-lg">
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
              showTopMoveBadges={controller.showTopMoveBadges}
              setShowTopMoveBadges={controller.setShowTopMoveBadges}
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
            ? `Analyze: ${formatAnalysisPlayerName(analyzedGame.whitePlayer.name)} vs ${formatAnalysisPlayerName(analyzedGame.blackPlayer.name)} – Maia Chess`
            : 'Analyze – Maia Chess'}
        </title>
        <meta
          name="description"
          content={
            analyzedGame
              ? `Analyze ${formatAnalysisPlayerName(analyzedGame.whitePlayer.name)} vs ${formatAnalysisPlayerName(analyzedGame.blackPlayer.name)} with human-aware AI. See what real players would do, explore moves by rating level, and spot where blunders are most likely to occur.`
              : 'Analyze chess games with human-aware AI. Combine Stockfish precision with human tendencies learned from millions of games. See what works at your rating level, not just for computers.'
          }
        />
      </Head>
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
        {analyzedGame && (
          <div>
            {useMobileStyleAnalysisLayout ? mobileLayout : desktopLayout}
          </div>
        )}
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
