import React, {
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useContext,
  useRef,
} from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import type { Key } from 'chessground/types'
import { Chess, PieceSymbol } from 'chess.ts'
import type { DrawBrushes, DrawShape } from 'chessground/draw'

import { WindowSizeContext } from 'src/contexts'
import { MAIA_MODELS } from 'src/constants/common'
import { cpToWinrate } from 'src/lib'
import {
  AnalysisArrowLegend,
  AnalysisCompactBlunderMeter,
  AnalysisMaiaWinrateBar,
  AnalysisStockfishEvalBar,
} from 'src/components/Analysis/BoardChrome'
import { GameInfo } from 'src/components/Common/GameInfo'
import { MaterialBalance } from 'src/components/Common/MaterialBalance'
import { GameBoard } from 'src/components/Board/GameBoard'
import { MovesContainer } from 'src/components/Board/MovesContainer'
import { LiveGame, GameNode, BroadcastStreamController } from 'src/types'
import { BoardController } from 'src/components/Board/BoardController'
import { PromotionOverlay } from 'src/components/Board/PromotionOverlay'
import {
  AnalysisSidebar,
  MovesByRating,
  SimplifiedAnalysisOverview,
} from 'src/components/Analysis'
import { ConfigurableScreens } from 'src/components/Analysis/ConfigurableScreens'
import { BroadcastGameList } from 'src/components/Analysis/BroadcastGameList'
import { useAnalysisController } from 'src/hooks/useAnalysisController'
import type { MaiaEvaluation, StockfishEvaluation } from 'src/types'

const EVAL_BAR_RANGE = 4
const DEFAULT_STOCKFISH_EVAL_BAR = {
  hasEval: false,
  pawns: 0,
  displayPawns: 0,
  label: '--',
}
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface Props {
  game: LiveGame
  broadcastController: BroadcastStreamController & {
    currentLiveGame: LiveGame | null
  }
  analysisController: ReturnType<typeof useAnalysisController>
}

export const BroadcastAnalysis: React.FC<Props> = ({
  game,
  broadcastController,
  analysisController,
}) => {
  const { width, height } = useContext(WindowSizeContext)
  const isMobile = useMemo(() => width > 0 && width <= 670, [width])
  const useMobileStyleAnalysisLayout = useMemo(() => {
    if (isMobile) return true

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
  const [showGameListMobile, setShowGameListMobile] = useState(false)
  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)
  const [currentSquare, setCurrentSquare] = useState<Key | null>(null)
  const [promotionFromTo, setPromotionFromTo] = useState<
    [string, string] | null
  >(null)

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
  }, [useMobileStyleAnalysisLayout, width])

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
  const mockHover = useCallback(() => void 0, [])
  const mockMakeMove = useCallback(() => void 0, [])
  const destinationBadges = useMemo(() => {
    if (
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
  ])

  useEffect(() => {
    setHoverArrow(null)
  }, [analysisController.currentNode])

  const hover = (move?: string) => {
    if (move) {
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

  const makeMove = (move: string) => {
    if (!analysisController.currentNode || !game.tree) return

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
        const newVariation = game.tree
          .getLastMainlineNode()
          .addChild(
            newFen,
            moveString,
            san,
            false,
            analysisController.currentMaiaModel,
          )
        analysisController.goToNode(newVariation)
      }
    }
  }

  const onPlayerMakeMove = useCallback(
    (playedMove: [string, string] | null) => {
      if (!playedMove) return

      const availableMoves = Array.from(
        analysisController.availableMoves.entries(),
      ).flatMap(([from, tos]) => tos.map((to) => ({ from, to })))

      const matching = availableMoves.filter((m) => {
        return m.from === playedMove[0] && m.to === playedMove[1]
      })

      if (matching.length > 1) {
        setPromotionFromTo(playedMove)
        return
      }

      const moveUci = playedMove[0] + playedMove[1]
      makeMove(moveUci)
    },
    [analysisController.availableMoves],
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
    [promotionFromTo, setPromotionFromTo],
  )

  const launchContinue = useCallback(() => {
    const fen = analysisController.currentNode?.fen as string
    const url = '/play' + '?fen=' + encodeURIComponent(fen)
    window.open(url)
  }, [analysisController.currentNode])

  const currentPlayer = useMemo(() => {
    if (!analysisController.currentNode) return 'white'
    const chess = new Chess(analysisController.currentNode.fen)
    return chess.turn() === 'w' ? 'white' : 'black'
  }, [analysisController.currentNode])

  const playedMoveShapes = useMemo<DrawShape[]>(() => {
    const playedMove = analysisController.currentNode?.mainChild?.move
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
  }, [analysisController.currentNode?.mainChild?.move])

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

  const rawCompactBlunderMeterData = analysisController.blunderMeter
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
    if (hasUsableBlunderMeterData) {
      setDisplayedCompactBlunderMeterData(rawCompactBlunderMeterData)
    }
  }, [hasUsableBlunderMeterData, rawCompactBlunderMeterData])

  const compactBlunderMeterData = displayedCompactBlunderMeterData

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
  }, [analysisController.currentNode?.turn, analysisController.moveEvaluation])

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
    analysisController.moveEvaluation,
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
    smoothedMaiaWhiteWinPosition.set(maiaWhiteWinPositionPercent)
  }, [maiaWhiteWinPositionPercent, smoothedMaiaWhiteWinPosition])

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
    smoothedEvalPosition.set(evalPositionPercent)
  }, [evalPositionPercent, smoothedEvalPosition])

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

  const NestedGameInfo = () => (
    <div className="flex w-full flex-col">
      <div className="hidden md:block">
        {[game.whitePlayer, game.blackPlayer].map((player, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-white' : 'border-[0.5px] bg-black'}`}
              />
              <p className="truncate whitespace-nowrap text-sm">
                {player.name}
              </p>
              <span className="text-xs">
                {player.rating ? <>({player.rating})</> : null}
              </span>
            </div>
            {game.termination?.winner === (index === 0 ? 'white' : 'black') ? (
              <p className="text-xs text-engine-3">1</p>
            ) : game.termination?.winner !== 'none' ? (
              <p className="text-xs text-human-3">0</p>
            ) : game.termination === undefined ? null : (
              <p className="text-xs text-secondary">1/2</p>
            )}
          </div>
        ))}
        <div className="mt-1 flex items-center justify-center gap-1">
          <span className="truncate whitespace-nowrap text-xxs text-secondary">
            {broadcastController.currentBroadcast?.tour.name}
            {broadcastController.currentRound && (
              <> • {broadcastController.currentRound.name}</>
            )}
          </span>
        </div>
      </div>
      <div className="flex w-full items-center justify-between text-xs md:hidden">
        <div className="flex items-center gap-1">
          <span className="inline-flex w-4 items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-white" />
          </span>
          <span className="font-medium">{game.whitePlayer.name}</span>
          {game.whitePlayer.rating && (
            <span className="text-primary/60">({game.whitePlayer.rating})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {broadcastController.broadcastState.isLive && !game.termination ? (
            <span className="font-medium text-red-400">LIVE</span>
          ) : game.termination?.winner === 'none' ? (
            <span className="font-medium text-primary/80">1/2-1/2</span>
          ) : (
            <span className="font-medium">
              <span className="text-primary/70">
                {game.termination?.winner === 'white' ? '1' : '0'}
              </span>
              <span className="text-primary/70">-</span>
              <span className="text-primary/70">
                {game.termination?.winner === 'black' ? '1' : '0'}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-flex w-4 items-center justify-center">
            <div className="h-2 w-2 rounded-full border-[0.5px] bg-black" />
          </span>
          <span className="font-medium">{game.blackPlayer.name}</span>
          {game.blackPlayer.rating && (
            <span className="text-primary/60">({game.blackPlayer.rating})</span>
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
            <GameInfo
              title="Broadcast"
              icon="live_tv"
              type="analysis"
              streamState={broadcastController.broadcastState}
              embedded
            >
              <NestedGameInfo />
            </GameInfo>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
            <div className="min-h-[18rem] border-b border-glass-border">
              <BroadcastGameList
                broadcastController={broadcastController}
                embedded
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <MovesContainer
                game={game}
                termination={game.termination}
                showAnnotations={true}
                disableKeyboardNavigation={false}
                disableMoveClicking={false}
                embedded
                heightClass="h-40"
              />
              <BoardController
                gameTree={analysisController.gameTree}
                orientation={analysisController.orientation}
                setOrientation={analysisController.setOrientation}
                currentNode={analysisController.currentNode}
                plyCount={analysisController.plyCount}
                goToNode={analysisController.goToNode}
                goToNextNode={analysisController.goToNextNode}
                goToPreviousNode={analysisController.goToPreviousNode}
                goToRootNode={analysisController.goToRootNode}
                disableKeyboardNavigation={false}
                disableNavigation={false}
                embedded
              />
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
                  <div className="pointer-events-none relative flex min-w-0 items-center justify-center">
                    <div className="absolute left-[12%] top-1/2 -translate-y-1/2">
                      <MaterialBalance
                        fen={analysisController.currentNode?.fen}
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
                        fen={analysisController.currentNode?.fen}
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
                      hasValue={displayedMaiaWhiteWinBar.hasValue}
                      displayText={displayedMaiaWhiteWinBar.label}
                      labelPositionTop={
                        smoothedMaiaWhiteWinVerticalPositionLabel
                      }
                      desktopSize={desktopBarChromeSize}
                    />
                  </div>
                  <div className="relative flex aspect-square w-full">
                    <GameBoard
                      game={game}
                      availableMoves={analysisController.availableMoves}
                      setCurrentSquare={setCurrentSquare}
                      shapes={(() => {
                        const baseShapes = [...playedMoveShapes]
                        baseShapes.push(...analysisController.arrows)

                        if (hoverArrow) {
                          baseShapes.push(hoverArrow)
                        }

                        return staggerOverlappingArrows(baseShapes)
                      })()}
                      currentNode={analysisController.currentNode as GameNode}
                      orientation={analysisController.orientation}
                      onPlayerMakeMove={onPlayerMakeMove}
                      goToNode={analysisController.goToNode}
                      gameTree={game.tree}
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
                      hasEval={displayedStockfishEvalBar.hasEval}
                      displayText={displayedStockfishEvalText}
                      labelPositionTop={smoothedEvalVerticalPositionLabel}
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
                  analysisController.currentNode?.mainChild?.move ?? undefined
                }
                maiaHeaderLabel={desktopCompactBlunderMaiaHeaderLabel}
                hover={hover}
                makeMove={makeMove}
              />
            </div>
          </div>
        </motion.div>
        <AnalysisSidebar
          hover={hover}
          makeMove={makeMove}
          controller={analysisController}
          setHoverArrow={setHoverArrow}
          analysisEnabled={true}
          handleToggleAnalysis={() => {
            // Broadcast analysis is always enabled.
          }}
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
                currentMaiaModel={analysisController.currentMaiaModel}
                setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
                showTopMoveBadges={analysisController.showTopMoveBadges}
                setShowTopMoveBadges={analysisController.setShowTopMoveBadges}
                launchContinue={launchContinue}
                MAIA_MODELS={MAIA_MODELS}
                game={game}
                currentNode={analysisController.currentNode as GameNode}
              />
            </div>
          }
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
        {showGameListMobile ? (
          <div className="flex w-full flex-col items-start justify-start">
            <div className="flex w-full flex-col items-start justify-start overflow-hidden p-3">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center justify-start gap-1.5">
                  <span className="material-symbols-outlined text-xl">
                    live_tv
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
                Select a broadcast game to analyze
              </p>
            </div>
            <div className="flex h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-backdrop/30">
              <BroadcastGameList
                broadcastController={broadcastController}
                onGameSelected={() => setShowGameListMobile(false)}
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
              title="Broadcast"
              icon="live_tv"
              type="analysis"
              currentMaiaModel={analysisController.currentMaiaModel}
              setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
              MAIA_MODELS={MAIA_MODELS}
              streamState={broadcastController.broadcastState}
              onGameListClick={() => setShowGameListMobile(true)}
              showGameListButton={true}
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
                <div className="relative flex min-w-0 items-center justify-center">
                  <div className="absolute left-[10%] top-1/2 -translate-y-1/2">
                    <MaterialBalance
                      fen={analysisController.currentNode?.fen}
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
                      fen={analysisController.currentNode?.fen}
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
                    hasValue={displayedMaiaWhiteWinBar.hasValue}
                    displayText={
                      displayedMaiaWhiteWinBar.hasValue
                        ? `${Math.round(displayedMaiaWhiteWinBar.percent)}%`
                        : '--'
                    }
                    labelPositionTop={smoothedMaiaWhiteWinVerticalPositionLabel}
                    variant="mobile"
                  />
                </div>
                <div
                  id="analysis"
                  className="relative flex aspect-square w-full"
                >
                  <GameBoard
                    game={game}
                    availableMoves={analysisController.availableMoves}
                    setCurrentSquare={setCurrentSquare}
                    shapes={(() => {
                      const baseShapes = [...playedMoveShapes]
                      baseShapes.push(...analysisController.arrows)

                      if (hoverArrow) {
                        baseShapes.push(hoverArrow)
                      }

                      return staggerOverlappingArrows(baseShapes)
                    })()}
                    currentNode={analysisController.currentNode as GameNode}
                    orientation={analysisController.orientation}
                    onPlayerMakeMove={onPlayerMakeMove}
                    goToNode={analysisController.goToNode}
                    gameTree={game.tree}
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
                    hasEval={displayedStockfishEvalBar.hasEval}
                    displayText={displayedStockfishEvalText}
                    labelPositionTop={smoothedEvalVerticalPositionLabel}
                    variant="mobile"
                  />
                </div>
              </div>
              <AnalysisCompactBlunderMeter
                className="mb-1.5 mt-3 w-full max-w-[560px]"
                data={compactBlunderMeterData}
                colorSanMapping={analysisController.colorSanMapping}
                playedMove={
                  analysisController.currentNode?.mainChild?.move ?? undefined
                }
                hover={hover}
                makeMove={makeMove}
              />
            </div>
            <div className="flex w-full flex-col gap-0">
              <div className="w-full !flex-grow-0">
                <BoardController
                  embedded
                  gameTree={analysisController.gameTree}
                  orientation={analysisController.orientation}
                  setOrientation={analysisController.setOrientation}
                  currentNode={analysisController.currentNode}
                  plyCount={analysisController.plyCount}
                  goToNode={analysisController.goToNode}
                  goToNextNode={analysisController.goToNextNode}
                  goToPreviousNode={analysisController.goToPreviousNode}
                  goToRootNode={analysisController.goToRootNode}
                  disableKeyboardNavigation={false}
                  disableNavigation={false}
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
                  game={game}
                  termination={game.termination}
                  showAnnotations={true}
                  forceMobileLayout={useMobileStyleAnalysisLayout}
                  disableKeyboardNavigation={false}
                  disableMoveClicking={false}
                />
              </div>
            </div>
            <div className="flex w-full flex-col overflow-hidden">
              <div className="relative border-t border-glass-border bg-glass backdrop-blur-md">
                <SimplifiedAnalysisOverview
                  highlightProps={{
                    hover,
                    makeMove,
                    currentMaiaModel: analysisController.currentMaiaModel,
                    setCurrentMaiaModel: analysisController.setCurrentMaiaModel,
                    recommendations: analysisController.moveRecommendations,
                    moveEvaluation: analysisController.moveEvaluation as {
                      maia?: MaiaEvaluation
                      stockfish?: StockfishEvaluation
                    },
                    colorSanMapping: analysisController.colorSanMapping,
                    boardDescription: analysisController.boardDescription,
                    currentNode: analysisController.currentNode,
                    simplified: true,
                    hideWhiteWinRateSummary: true,
                    hideStockfishEvalSummary: true,
                  }}
                  blunderMeterProps={{
                    hover,
                    makeMove,
                    data: compactBlunderMeterData,
                    colorSanMapping: analysisController.colorSanMapping,
                    moveEvaluation: analysisController.moveEvaluation,
                    playerToMove: analysisController.currentNode?.turn ?? 'w',
                  }}
                  analysisEnabled={true}
                  hideBlunderMeter={true}
                />
              </div>

              <div className="relative">
                <MovesByRating
                  moves={analysisController.movesByRating}
                  colorSanMapping={analysisController.colorSanMapping}
                  positionKey={analysisController.currentNode?.fen}
                />
              </div>
            </div>
            <ConfigurableScreens
              currentMaiaModel={analysisController.currentMaiaModel}
              setCurrentMaiaModel={analysisController.setCurrentMaiaModel}
              showTopMoveBadges={analysisController.showTopMoveBadges}
              setShowTopMoveBadges={analysisController.setShowTopMoveBadges}
              launchContinue={launchContinue}
              MAIA_MODELS={MAIA_MODELS}
              game={game}
              currentNode={analysisController.currentNode as GameNode}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  )

  return (
    <div>{useMobileStyleAnalysisLayout ? mobileLayout : desktopLayout}</div>
  )
}
