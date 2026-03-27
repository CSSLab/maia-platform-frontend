import Head from 'next/head'
import { NextPage } from 'next'
import {
  useState,
  useEffect,
  useLayoutEffect,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { useRouter } from 'next/router'
import { Chess, PieceSymbol } from 'chess.ts'
import { AnimatePresence, useSpring, useTransform } from 'framer-motion'
import type { Key } from 'chessground/types'
import type { DrawBrushes, DrawShape } from 'chessground/draw'

import {
  WindowSizeContext,
  PHONE_BREAKPOINT_PX,
  MaiaEngineContext,
  TreeControllerContext,
} from 'src/contexts'
import {
  DrillConfiguration,
  AnalyzedGame,
  GameNode,
  MaiaEvaluation,
  StockfishEvaluation,
} from 'src/types'
import {
  MovesContainer,
  BoardController,
  OpeningSelectionModal,
  OpeningDrillSidebar,
  DrillPerformanceModal,
  GameBoard,
  PromotionOverlay,
  DownloadModelModal,
  AuthenticatedWrapper,
  AnalysisNotification,
  AnalysisOverlay,
} from 'src/components'
import {
  AnalysisSidebar,
  ConfigurableScreens,
  SimplifiedAnalysisOverview,
  MovesByRating,
} from 'src/components/Analysis'
import {
  AnalysisArrowLegend,
  AnalysisCompactBlunderMeter,
  AnalysisMaiaWinrateBar,
  AnalysisStockfishEvalBar,
} from 'src/components/Analysis/BoardChrome'
import { MaterialBalance } from 'src/components/Common/MaterialBalance'
import openings from 'src/constants/maia_openings_expanded.json'
import endgamesRaw from 'src/constants/endgames.json'
import { buildEndgameDataset, createEndgameOpenings } from 'src/lib/endgames'
import { MAIA_MODELS } from 'src/constants/common'
import { cpToWinrate } from 'src/lib/analysis'

import { useOpeningDrillController, useAnalysisController } from 'src/hooks'
import {
  getCurrentPlayer,
  getAvailableMovesArray,
  requiresPromotion,
} from 'src/lib/puzzle'

const EVAL_BAR_RANGE = 4
const DEFAULT_STOCKFISH_EVAL_BAR = {
  hasEval: false,
  pawns: 0,
  displayPawns: 0,
  label: '--',
}
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

const OpeningsPage: NextPage = () => {
  const router = useRouter()
  const [showSelectionModal, setShowSelectionModal] = useState(true)

  const endgameDataset = useMemo(() => buildEndgameDataset(endgamesRaw), [])
  const endgameOpenings = useMemo(
    () => createEndgameOpenings(endgameDataset),
    [endgameDataset],
  )

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

  const safeConfiguration = useMemo<DrillConfiguration>(
    () => drillConfiguration ?? { selections: [] },
    [drillConfiguration],
  )

  const controller = useOpeningDrillController(safeConfiguration)
  const { width: windowWidth, height: windowHeight } =
    useContext(WindowSizeContext)
  const [, setCurrentSquare] = useState<Key | null>(null)

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
    controller.analysisEnabled || controller.continueAnalyzingMode, // Disable engine analysis during drill play
  )

  // Sync analysis controller with current node — only when analysis is active
  // (post-drill continue-analyzing mode). During drill play, the analysis
  // controller's auto-stockfish would conflict with background analysis.
  useEffect(() => {
    if (
      controller.currentNode &&
      analysisController.setCurrentNode &&
      (controller.analysisEnabled || controller.continueAnalyzingMode)
    ) {
      analysisController.setCurrentNode(controller.currentNode)
    }
  }, [
    controller.currentNode,
    controller.analysisEnabled,
    controller.continueAnalyzingMode,
    analysisController.setCurrentNode,
  ])

  // --- Board chrome state (mirrors analysis page) ---
  const width = windowWidth
  const height = windowHeight
  const isPhone = useMemo(
    () => width > 0 && width <= PHONE_BREAKPOINT_PX,
    [width],
  )
  const useMobileStyleAnalysisLayout = useMemo(() => {
    if (isPhone) return true

    return width > PHONE_BREAKPOINT_PX && width <= 1120
  }, [isPhone, width])
  const isTabletUsingMobileStyleLayout = useMemo(
    () => useMobileStyleAnalysisLayout && !isPhone,
    [isPhone, useMobileStyleAnalysisLayout],
  )
  const analysisEnabled =
    controller.analysisEnabled || controller.continueAnalyzingMode

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
      analysisEnabled ? analysisController.blunderMeter : emptyBlunderMeterData,
    [analysisEnabled, analysisController.blunderMeter, emptyBlunderMeterData],
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
    if (!analysisEnabled) {
      setDisplayedCompactBlunderMeterData(emptyBlunderMeterData)
      return
    }
    if (hasUsableBlunderMeterData) {
      setDisplayedCompactBlunderMeterData(rawCompactBlunderMeterData)
    }
  }, [
    analysisEnabled,
    emptyBlunderMeterData,
    hasUsableBlunderMeterData,
    rawCompactBlunderMeterData,
  ])
  const compactBlunderMeterData = displayedCompactBlunderMeterData

  const currentTurnForBars: 'w' | 'b' =
    analysisController.currentNode?.turn || 'w'
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

  // Stockfish eval bar
  const rawStockfishEvalBar = useMemo(() => {
    const stockfish = analysisController.moveEvaluation?.stockfish
    const sideToMove = analysisController.currentNode?.turn || 'w'
    if (!stockfish) return { ...DEFAULT_STOCKFISH_EVAL_BAR, depth: 0 }

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

  const [displayedStockfishEvalBar, setDisplayedStockfishEvalBar] = useState(
    DEFAULT_STOCKFISH_EVAL_BAR,
  )
  useIsomorphicLayoutEffect(() => {
    if (!rawStockfishEvalBar.hasEval || rawStockfishEvalBar.depth <= 10) return
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
  const renderedStockfishEvalBar = useMemo(
    () =>
      analysisEnabled
        ? displayedStockfishEvalBar
        : { hasEval: false, pawns: 0, displayPawns: 0, label: '--' },
    [analysisEnabled, displayedStockfishEvalBar],
  )
  const displayedStockfishEvalText = useMemo(() => {
    if (!displayedStockfishEvalBar.hasEval) return '--'
    if (displayedStockfishEvalBar.label.startsWith('M'))
      return displayedStockfishEvalBar.label
    const roundedPawns =
      Math.round(displayedStockfishEvalBar.displayPawns * 10) / 10
    const safePawns = Math.abs(roundedPawns) < 0.05 ? 0 : roundedPawns
    return `${safePawns > 0 ? '+' : ''}${safePawns.toFixed(1)}`
  }, [displayedStockfishEvalBar])
  const renderedStockfishEvalText = analysisEnabled
    ? displayedStockfishEvalText
    : '--'
  const evalBarPositionTargetPercent = analysisEnabled
    ? evalPositionPercent
    : 50
  const smoothedEvalPosition = useSpring(50, {
    stiffness: 520,
    damping: 42,
    mass: 0.25,
  })
  const smoothedEvalVerticalPositionLabel = useTransform(
    smoothedEvalPosition,
    (value) => `${100 - value}%`,
  )
  useIsomorphicLayoutEffect(() => {
    smoothedEvalPosition.set(evalBarPositionTargetPercent)
  }, [evalBarPositionTargetPercent, smoothedEvalPosition])

  // Maia win rate bar
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

  const [displayedMaiaWhiteWinBar, setDisplayedMaiaWhiteWinBar] =
    useState(rawMaiaWhiteWinBar)
  useIsomorphicLayoutEffect(() => {
    if (!rawMaiaWhiteWinBar.hasValue) return
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

  // Desktop board sizing
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
        )
          return prev
        return next
      })
    }
    updateHeights()
  }, [useMobileStyleAnalysisLayout, width])
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
    const extraGapPx = 4
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
  const desktopConfigPanelHeightCss = '9.5rem'
  const desktopSidebarContentHeightCss = `calc(${desktopColumnTargetHeightCss} - ${desktopConfigPanelHeightCss} - 0.75rem)`
  const desktopBarChromeSize: 'compact' | 'expanded' =
    width >= 1360 ? 'expanded' : 'compact'
  const desktopCompactBlunderMaiaHeaderLabel = useMemo(() => {
    const ratingLevel =
      analysisController.currentMaiaModel?.replace('maia_kdd_', '') || '----'
    return `Maia %\n@ ${ratingLevel}`
  }, [analysisController.currentMaiaModel])

  const mockHoverForChrome = useCallback(() => void 0, [])
  const mockMakeMoveForChrome = useCallback(() => void 0, [])
  const destinationBadges = useMemo(() => {
    if (
      !analysisEnabled ||
      !analysisController.showTopMoveBadges ||
      !analysisController.topHumanMoveBadge
    ) {
      return []
    }

    return [
      {
        square: analysisController.topHumanMoveBadge.square,
        classification: analysisController.topHumanMoveBadge.classification,
      },
    ]
  }, [
    analysisController.showTopMoveBadges,
    analysisController.topHumanMoveBadge,
    analysisEnabled,
  ])
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

  // Create game object for MovesContainer
  const gameForContainer = useMemo(() => {
    if (!controller.gameTree) return null

    return {
      id: `opening-drill-${controller.currentDrill?.id || 'current'}`,
      tree: controller.gameTree, // Use the original tree
      moves: [], // Not used when tree is provided
    }
  }, [controller.gameTree, controller.currentDrill?.id])

  const targetMoves = controller.currentDrill?.targetMoveNumber ?? null
  const targetMovesLabel = typeof targetMoves === 'number' ? targetMoves : '∞'
  const moveProgressPercent =
    controller.currentDrillGame &&
    typeof targetMoves === 'number' &&
    targetMoves > 0
      ? Math.min(
          (controller.currentDrillGame.playerMoveCount / targetMoves) * 100,
          100,
        )
      : 0

  const moveListTerminationNote = useMemo(() => {
    if (!controller.drillEndReasonMessage) return undefined

    return controller.drillEndReasonMessage
      .replace(/^Drill ended:\s*/i, '')
      .replace(/\.$/, '')
  }, [controller.drillEndReasonMessage])

  // Removed auto-reopen behavior so the modal can be dismissed even without configuration

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

  const handleToggleAnalysis = useCallback(() => {
    controller.setAnalysisEnabled(!controller.analysisEnabled)
  }, [controller])
  const launchContinue = useCallback(() => {
    const fen = controller.currentNode?.fen
    if (!fen) return

    window.open('/play?fen=' + encodeURIComponent(fen))
  }, [controller.currentNode?.fen])
  const handleAnalyzeEntireGame = useCallback(() => {
    analysisController.gameAnalysis.resetProgress()
    analysisController.gameAnalysis.startAnalysis(18)
  }, [analysisController.gameAnalysis])

  const currentPlayer = useMemo(() => {
    if (!controller.currentNode) return 'white'
    const chess = new Chess(controller.currentNode.fen)
    return chess.turn() === 'w' ? 'white' : 'black'
  }, [controller.currentNode])
  const isPostDrillAnalysisView = controller.continueAnalyzingMode

  const renderDrillProgress = (className?: string) =>
    controller.currentDrillGame && controller.currentDrill ? (
      <div
        className={
          className ??
          'flex w-full items-center gap-3 rounded-md border border-glass-border bg-glass p-3 backdrop-blur-md'
        }
      >
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-white/70">Move Progress</span>
            <span className="font-medium text-white/90">
              {controller.currentDrillGame.playerMoveCount}/{targetMovesLabel}
            </span>
          </div>
          <div className="h-2 w-full rounded bg-white/10">
            <div
              className="h-full rounded bg-human-3 transition-all duration-300"
              style={{
                width: `${moveProgressPercent}%`,
                maxWidth: '100%',
              }}
            />
          </div>
          {controller.drillEndReasonMessage && (
            <p className="mt-2 text-xs font-medium text-human-4">
              {controller.drillEndReasonMessage}
            </p>
          )}
        </div>
      </div>
    ) : null

  const renderDrillActionButtons = (fullWidth = false) => (
    <div className="flex w-full justify-center gap-1">
      {controller.currentPerformanceData &&
        !controller.showPerformanceModal && (
          <button
            onClick={controller.showCurrentPerformance}
            className={`${fullWidth ? 'w-full' : ''} rounded-md border border-glass-border bg-glass px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-glass-stronger`}
          >
            View Performance
          </button>
        )}
      {!controller.currentPerformanceData &&
        !controller.showPerformanceModal &&
        !controller.continueAnalyzingMode && (
          <button
            onClick={controller.endCurrentDrillWithFeedback}
            className={`${fullWidth ? 'w-full' : ''} rounded-md border border-human-4/50 bg-human-4/10 px-4 py-2 text-sm font-medium text-human-3 transition-colors hover:bg-human-4/20`}
          >
            End Drill + Feedback
          </button>
        )}
      <button
        onClick={controller.moveToNextDrill}
        className={`${fullWidth ? 'w-full' : ''} rounded bg-human-4 px-4 py-2 text-sm font-medium transition-colors hover:bg-human-4/80`}
      >
        Next Drill
      </button>
    </div>
  )

  const renderLiveDrillSummary = () =>
    controller.currentDrill ? (
      <div className="rounded-md border border-glass-border bg-glass p-3 backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Current Drill
        </p>
        <p className="mt-1 text-sm font-semibold text-white">
          {controller.currentDrill.opening.name}
          {controller.currentDrill.variation
            ? `, ${controller.currentDrill.variation.name}`
            : ''}
        </p>
        <p className="mt-1 text-xs text-white/70">
          Drill {controller.currentDrillNumber || 1} · vs Maia{' '}
          {controller.currentDrill.maiaVersion.replace('maia_kdd_', '')}
        </p>
        <p className="mt-3 text-center text-sm font-semibold uppercase tracking-wider text-white">
          {controller.currentPerformanceData
            ? 'Drill Complete'
            : controller.isPlayerTurn
              ? 'Your Turn'
              : 'Waiting for Maia'}
        </p>
        {controller.drillEndReasonMessage && (
          <p className="mt-2 text-center text-xs font-medium text-human-4">
            {controller.drillEndReasonMessage}
          </p>
        )}
      </div>
    ) : null

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
  if (showSelectionModal) {
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
            endgames={endgameOpenings}
            endgameDataset={endgameDataset}
            initialSelections={drillConfiguration?.selections || []}
            onComplete={handleCompleteSelection}
            onClose={handleCloseModal}
          />
        </AnimatePresence>
      </>
    )
  }

  const desktopPlayLayout = () => (
    <div className="flex h-full w-full flex-1 flex-col justify-center gap-1 py-2 md:py-4">
      <div className="mx-auto mt-2 flex w-[92%] flex-row items-start justify-between gap-4 xl:w-[94%] xl:gap-5 2xl:w-[97%]">
        <div className="flex h-[75vh] min-w-[18rem] max-w-[22rem] flex-shrink-0 flex-col">
          <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
            <OpeningDrillSidebar
              currentDrill={controller.currentDrill}
              completedDrills={controller.completedDrills}
              selectionPool={controller.selectionPool}
              onLoadCompletedDrill={controller.loadCompletedDrill}
              openingEndNode={controller.currentDrillGame?.openingEndNode}
              drillTerminationNote={moveListTerminationNote}
              analysisEnabled={controller.analysisEnabled}
              continueAnalyzingMode={controller.continueAnalyzingMode}
              showBottomNavigation={false}
              embedded
            />
          </div>
        </div>
        <div
          id="play-page"
          className="relative flex aspect-square w-full max-w-[75vh] flex-shrink-0"
        >
          <GameBoard
            game={analyzedGame || undefined}
            currentNode={controller.currentNode}
            orientation={controller.orientation}
            availableMoves={controller.availableMoves}
            onPlayerMakeMove={onPlayerMakeMove}
            onSelectSquare={onSelectSquare}
          />
          {promotionFromTo && (
            <PromotionOverlay
              player={currentPlayer}
              file={promotionFromTo[1].slice(0, 1)}
              onPlayerSelectPromotion={onPlayerSelectPromotion}
            />
          )}
        </div>
        <div className="flex h-[75vh] min-w-[18rem] flex-grow flex-col gap-2">
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-glass-border bg-glass backdrop-blur-md">
            <div className="flex-1 overflow-hidden border-b border-glass-border">
              {controller.currentDrillGame && (
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
                  terminationNote={moveListTerminationNote}
                  showAnnotations={false}
                  showVariations={false}
                  embedded
                  heightClass="h-full"
                />
              )}
            </div>
            <div className="border-b border-glass-border">
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
                embedded
              />
            </div>
            <div className="flex flex-col gap-3 px-4 py-3">
              {renderLiveDrillSummary()}
              {renderDrillProgress()}
              {renderDrillActionButtons()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const mobilePlayLayout = () => (
    <div className="flex h-full flex-1 flex-col justify-center gap-1">
      <div className="mt-2 flex h-full flex-col items-start justify-start gap-2">
        <div className="w-full px-2">{renderLiveDrillSummary()}</div>
        <div
          id="play-page"
          className="relative mx-auto flex aspect-square w-full max-w-3xl"
        >
          <GameBoard
            game={analyzedGame || undefined}
            currentNode={controller.currentNode}
            orientation={controller.orientation}
            availableMoves={controller.availableMoves}
            onPlayerMakeMove={onPlayerMakeMove}
            onSelectSquare={onSelectSquare}
          />
          {promotionFromTo && (
            <PromotionOverlay
              player={getCurrentPlayer(controller.currentNode)}
              file={promotionFromTo[1].slice(0, 1)}
              onPlayerSelectPromotion={onPlayerSelectPromotion}
            />
          )}
        </div>
        <div className="flex h-auto w-full flex-col gap-1">
          <div className="w-full">
            <div className="flex flex-col overflow-hidden rounded-lg border border-glass-border bg-glass backdrop-blur-md">
              <div className="border-b border-glass-border">
                {controller.currentDrillGame && (
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
                    terminationNote={moveListTerminationNote}
                    showAnnotations={false}
                    showVariations={false}
                    embedded
                    forceMobileLayout={useMobileStyleAnalysisLayout}
                  />
                )}
              </div>
              <div className="border-b border-glass-border">
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
              <div className="flex flex-col gap-3 px-4 py-3">
                {renderDrillProgress()}
                {renderDrillActionButtons(true)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const desktopAnalysisLayout = () => (
    <div className="flex h-full w-full flex-col items-center py-4 2xl:items-end">
      <div className="flex h-full w-[92%] flex-row gap-4 xl:w-[94%] xl:gap-5 2xl:w-[97%]">
        {/* Left Panel - Drill Sidebar + Moves */}
        <div
          id="navigation"
          className="desktop-left-column-container flex min-h-0 flex-col gap-2"
        >
          <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
            <OpeningDrillSidebar
              currentDrill={controller.currentDrill}
              completedDrills={controller.completedDrills}
              selectionPool={controller.selectionPool}
              onLoadCompletedDrill={controller.loadCompletedDrill}
              openingEndNode={controller.currentDrillGame?.openingEndNode}
              drillTerminationNote={moveListTerminationNote}
              analysisEnabled={controller.analysisEnabled}
              continueAnalyzingMode={controller.continueAnalyzingMode}
              embedded
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
            {controller.currentDrillGame && (
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <div className="absolute inset-0 flex h-full flex-col">
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
                    terminationNote={moveListTerminationNote}
                    showAnnotations={analysisEnabled}
                    showVariations={controller.continueAnalyzingMode}
                    embedded
                    heightClass="h-40"
                  />
                </div>
              </div>
            )}
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
              embedded
            />
          </div>
        </div>

        {/* Center - Board with eval bars */}
        <div
          className="desktop-middle-column-container flex flex-col gap-3"
          style={{
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
                  <div className="pointer-events-none relative flex min-w-0 items-center justify-center">
                    <div className="absolute left-[12%] top-1/2 -translate-y-1/2">
                      <MaterialBalance
                        fen={controller.currentNode?.fen}
                        color="white"
                        className="whitespace-nowrap"
                        iconClassName="!text-[18px]"
                        textClassName="text-[14px] text-white/90"
                      />
                    </div>
                    <AnalysisArrowLegend
                      labelMode="short"
                      className="gap-x-3 text-[10px]"
                    />
                    <div className="absolute right-[12%] top-1/2 -translate-y-1/2">
                      <MaterialBalance
                        fen={controller.currentNode?.fen}
                        color="black"
                        className="whitespace-nowrap"
                        iconClassName="!text-[18px]"
                        textClassName="text-[14px] text-white/90"
                      />
                    </div>
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
                      game={analyzedGame || undefined}
                      currentNode={controller.currentNode}
                      orientation={controller.orientation}
                      availableMoves={availableMoves}
                      onPlayerMakeMove={onPlayerMakeMove}
                      onSelectSquare={onSelectSquare}
                      setCurrentSquare={setCurrentSquare}
                      goToNode={controller.goToNode}
                      gameTree={controller.gameTree}
                      shapes={(() => {
                        const baseShapes = [...playedMoveShapes]
                        if (analysisEnabled) {
                          baseShapes.push(...analysisController.arrows)
                        }
                        if (hoverArrow) {
                          baseShapes.push(hoverArrow)
                        }
                        return staggerOverlappingArrows(baseShapes)
                      })()}
                      destinationBadges={destinationBadges}
                      brushes={analysisArrowBrushes as unknown as DrawBrushes}
                    />
                    {promotionFromTo && (
                      <PromotionOverlay
                        player={currentPlayer}
                        file={promotionFromTo[1].slice(0, 1)}
                        onPlayerSelectPromotion={onPlayerSelectPromotion}
                      />
                    )}
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
                colorSanMapping={analysisController.colorSanMapping}
                playedMove={
                  controller.currentNode?.mainChild?.move ?? undefined
                }
                maiaHeaderLabel={desktopCompactBlunderMaiaHeaderLabel}
                hover={analysisEnabled ? hover : mockHoverForChrome}
                makeMove={analysisEnabled ? makeMove : mockMakeMoveForChrome}
              />
            </div>
          </div>

          {renderDrillActionButtons()}
        </div>

        {/* Right Panel - Analysis Sidebar (same as analysis page) */}
        <AnalysisSidebar
          hover={hover}
          makeMove={makeMove}
          controller={analysisController}
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
            analyzedGame ? (
              <div
                className="flex h-full min-h-0 flex-col overflow-hidden"
                style={{ height: desktopConfigPanelHeightCss }}
              >
                <ConfigurableScreens
                  currentMaiaModel={analysisController.currentMaiaModel}
                  setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
                  showTopMoveBadges={analysisController.showTopMoveBadges}
                  setShowTopMoveBadges={analysisController.setShowTopMoveBadges}
                  launchContinue={() => {
                    launchContinue()
                  }}
                  MAIA_MODELS={MAIA_MODELS}
                  game={analyzedGame}
                  currentNode={
                    (controller.currentNode ||
                      analysisController.currentNode) as GameNode
                  }
                  onAnalyzeEntireGame={handleAnalyzeEntireGame}
                  isAnalysisInProgress={
                    analysisController.gameAnalysis.progress.isAnalyzing
                  }
                  autoSave={analysisController.gameAnalysis.autoSave}
                />
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  )

  const mobileAnalysisLayout = () => (
    <div className="flex h-full flex-1 flex-col justify-center gap-1">
      <div className="flex h-full flex-col items-start justify-start gap-1">
        {/* Current Drill Info Header */}
        <div className="flex w-full flex-col bg-glass p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-primary">Current Drill</h3>
            <button
              type="button"
              onClick={handleToggleAnalysis}
              className={`flex items-center gap-1 rounded bg-human-4/30 px-2 py-1 text-xxs text-human-2 duration-200 hover:bg-human-4/50 md:text-sm ${
                analysisEnabled ? 'text-human-2' : 'text-white/80'
              }`}
              aria-pressed={analysisEnabled}
            >
              <span className="material-symbols-outlined text-xxs md:text-sm">
                {analysisEnabled ? 'visibility_off' : 'visibility'}
              </span>
              <span>{analysisEnabled ? 'Hide' : 'Show'}</span>
            </button>
          </div>
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
        <div className="flex w-full flex-col items-center px-3">
          <div className="pointer-events-none mb-0.5 grid h-5 w-full max-w-[560px] grid-cols-[30px_minmax(0,1fr)_30px] items-center gap-3">
            <div className="flex justify-center">
              <span className="translate-y-px whitespace-nowrap text-[8px] font-extrabold leading-none text-human-2">
                Maia %
              </span>
            </div>
            <div className="relative flex min-w-0 items-center justify-center">
              <div className="absolute left-[10%] top-1/2 -translate-y-1/2">
                <MaterialBalance
                  fen={controller.currentNode?.fen}
                  color="white"
                  className="whitespace-nowrap"
                  iconClassName="!text-[13px]"
                  textClassName="text-[11px] text-primary/80"
                />
              </div>
              <AnalysisArrowLegend
                labelMode="short"
                className="translate-y-px justify-center gap-x-3 self-center text-[8px] font-semibold"
              />
              <div className="absolute right-[10%] top-1/2 -translate-y-1/2">
                <MaterialBalance
                  fen={controller.currentNode?.fen}
                  color="black"
                  className="whitespace-nowrap"
                  iconClassName="!text-[13px]"
                  textClassName="text-[11px] text-primary/80"
                />
              </div>
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
                labelPositionTop={smoothedMaiaWhiteWinVerticalPositionLabel}
                disabled={!analysisEnabled}
                variant="mobile"
              />
            </div>
            <div className="relative flex aspect-square w-full">
              <GameBoard
                game={analyzedGame || undefined}
                currentNode={controller.currentNode}
                orientation={controller.orientation}
                availableMoves={availableMoves}
                onPlayerMakeMove={onPlayerMakeMove}
                onSelectSquare={onSelectSquare}
                setCurrentSquare={setCurrentSquare}
                goToNode={controller.goToNode}
                gameTree={controller.gameTree}
                shapes={(() => {
                  const baseShapes = [...playedMoveShapes]

                  if (analysisEnabled) {
                    baseShapes.push(...analysisController.arrows)
                  }

                  if (hoverArrow) {
                    baseShapes.push(hoverArrow)
                  }

                  return staggerOverlappingArrows(baseShapes)
                })()}
                destinationBadges={destinationBadges}
                brushes={analysisArrowBrushes as unknown as DrawBrushes}
              />
              {promotionFromTo && (
                <PromotionOverlay
                  player={getCurrentPlayer(controller.currentNode)}
                  file={promotionFromTo[1].slice(0, 1)}
                  onPlayerSelectPromotion={onPlayerSelectPromotion}
                />
              )}
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
            colorSanMapping={analysisController.colorSanMapping}
            playedMove={controller.currentNode?.mainChild?.move ?? undefined}
            hover={analysisEnabled ? hover : mockHoverForChrome}
            makeMove={analysisEnabled ? makeMove : mockMakeMoveForChrome}
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
            <div
              className={`relative bottom-0 overflow-auto overflow-y-hidden ${
                isTabletUsingMobileStyleLayout
                  ? 'h-12 max-h-12 flex-none'
                  : 'h-48 max-h-48 flex-1'
              }`}
            >
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
                terminationNote={moveListTerminationNote}
                showAnnotations={
                  controller.analysisEnabled || controller.continueAnalyzingMode
                }
                showVariations={controller.continueAnalyzingMode}
                forceMobileLayout={useMobileStyleAnalysisLayout}
              />
            </div>
          )}

          {/* Action Buttons */}
          {renderDrillActionButtons(true)}

          {/* Analysis Components Stacked */}
          <div className="flex w-full flex-col gap-1 overflow-hidden">
            <div className="relative border-t border-glass-border bg-glass backdrop-blur-md">
              <SimplifiedAnalysisOverview
                highlightProps={{
                  hover: analysisEnabled ? hover : mockHoverForChrome,
                  makeMove: analysisEnabled ? makeMove : mockMakeMoveForChrome,
                  currentMaiaModel: analysisController.currentMaiaModel,
                  setCurrentMaiaModel: analysisController.setCurrentMaiaModel,
                  recommendations: analysisEnabled
                    ? analysisController.moveRecommendations
                    : emptyRecommendations,
                  moveEvaluation: analysisEnabled
                    ? (analysisController.moveEvaluation as {
                        maia?: MaiaEvaluation
                        stockfish?: StockfishEvaluation
                      })
                    : {
                        maia: undefined,
                        stockfish: undefined,
                      },
                  colorSanMapping: analysisEnabled
                    ? analysisController.colorSanMapping
                    : {},
                  boardDescription: analysisEnabled
                    ? analysisController.boardDescription || {
                        segments: [
                          { type: 'text', content: 'Analyzing position...' },
                        ],
                      }
                    : {
                        segments: [
                          {
                            type: 'text',
                            content:
                              'Analysis is disabled. Enable analysis to see detailed move evaluations and recommendations.',
                          },
                        ],
                      },
                  currentNode:
                    analysisController.currentNode || controller.currentNode,
                  simplified: true,
                  hideWhiteWinRateSummary: true,
                  hideStockfishEvalSummary: true,
                }}
                blunderMeterProps={{
                  hover: analysisEnabled ? hover : mockHoverForChrome,
                  makeMove: analysisEnabled ? makeMove : mockMakeMoveForChrome,
                  data: analysisEnabled
                    ? compactBlunderMeterData
                    : emptyBlunderMeterData,
                  colorSanMapping: analysisEnabled
                    ? analysisController.colorSanMapping
                    : {},
                  moveEvaluation: analysisEnabled
                    ? analysisController.moveEvaluation
                    : undefined,
                  playerToMove: analysisEnabled
                    ? (controller.currentNode?.turn ?? 'w')
                    : 'w',
                }}
                analysisEnabled={analysisEnabled}
                hideBlunderMeter={true}
              />
              {!analysisEnabled && (
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
            </div>

            <div className="relative">
              <MovesByRating
                moves={
                  analysisEnabled ? analysisController.movesByRating : undefined
                }
                colorSanMapping={
                  analysisEnabled ? analysisController.colorSanMapping : {}
                }
              />
              {!analysisEnabled && (
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
            </div>

            {analyzedGame && (
              <ConfigurableScreens
                currentMaiaModel={analysisController.currentMaiaModel}
                setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
                showTopMoveBadges={analysisController.showTopMoveBadges}
                setShowTopMoveBadges={analysisController.setShowTopMoveBadges}
                launchContinue={launchContinue}
                MAIA_MODELS={MAIA_MODELS}
                game={analyzedGame}
                currentNode={
                  (controller.currentNode ||
                    analysisController.currentNode) as GameNode
                }
                onAnalyzeEntireGame={handleAnalyzeEntireGame}
                isAnalysisInProgress={
                  analysisController.gameAnalysis.progress.isAnalyzing
                }
                autoSave={analysisController.gameAnalysis.autoSave}
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
        {isPostDrillAnalysisView
          ? useMobileStyleAnalysisLayout
            ? mobileAnalysisLayout()
            : desktopAnalysisLayout()
          : useMobileStyleAnalysisLayout
            ? mobilePlayLayout()
            : desktopPlayLayout()}
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
