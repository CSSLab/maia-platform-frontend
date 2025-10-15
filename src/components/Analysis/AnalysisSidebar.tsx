import {
  MoveMap,
  Highlight,
  BlunderMeter,
  MovesByRating,
  SimplifiedAnalysisOverview,
  SimplifiedBlunderMeter,
} from 'src/components/Analysis'
import { motion } from 'framer-motion'
import type { DrawShape } from 'chessground/draw'
import { Dispatch, SetStateAction, useCallback, useMemo } from 'react'
import type { ComponentProps } from 'react'
import { useLocalStorage } from 'src/hooks'
import { useAnalysisController } from 'src/hooks/useAnalysisController'
import type { MaiaEvaluation, StockfishEvaluation } from 'src/types'

type AnalysisViewMode = 'simple' | 'detailed'
type HighlightBoardDescription = ComponentProps<
  typeof Highlight
>['boardDescription']

interface Props {
  hover: (move?: string) => void
  makeMove: (move: string) => void
  setHoverArrow: Dispatch<SetStateAction<DrawShape | null>>
  analysisEnabled: boolean
  controller: ReturnType<typeof useAnalysisController>
  handleToggleAnalysis: () => void
  itemVariants?: {
    hidden: {
      opacity: number
      y: number
    }
    visible: {
      opacity: number
      y: number
      transition: {
        duration: number
        ease: number[]
        type: string
      }
    }
    exit: {
      opacity: number
      y: number
      transition: {
        duration: number
        ease: number[]
        type: string
      }
    }
  }
}

export const AnalysisSidebar: React.FC<Props> = ({
  hover,
  makeMove,
  controller,
  setHoverArrow,
  analysisEnabled,
  handleToggleAnalysis,
  itemVariants,
}) => {
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
  const mockSetHoverArrow = useCallback(() => void 0, [])
  const mockMakeMove = useCallback(() => void 0, [])

  const [analysisViewMode, setAnalysisViewMode] =
    useLocalStorage<AnalysisViewMode>('maia-analysis-view-mode', 'simple')
  const isSimplifiedView = analysisViewMode !== 'detailed'

  const handleToggleViewMode = useCallback(() => {
    setAnalysisViewMode(isSimplifiedView ? 'detailed' : 'simple')
  }, [isSimplifiedView, setAnalysisViewMode])

  const highlightMoveEvaluation = analysisEnabled
    ? (controller.moveEvaluation as {
        maia?: MaiaEvaluation
        stockfish?: StockfishEvaluation
      })
    : {
        maia: undefined,
        stockfish: undefined,
      }

  const highlightBoardDescription: HighlightBoardDescription = analysisEnabled
    ? controller.boardDescription
    : {
        segments: [
          {
            type: 'text',
            content:
              'Analysis is disabled. Enable analysis to see detailed move evaluations and recommendations.',
          },
        ],
      }

  const highlightProps: ComponentProps<typeof Highlight> = {
    hover: analysisEnabled ? hover : mockHover,
    makeMove: analysisEnabled ? makeMove : mockMakeMove,
    currentMaiaModel: controller.currentMaiaModel,
    setCurrentMaiaModel: controller.setCurrentMaiaModel,
    recommendations: analysisEnabled
      ? controller.moveRecommendations
      : emptyRecommendations,
    moveEvaluation: highlightMoveEvaluation,
    colorSanMapping: analysisEnabled ? controller.colorSanMapping : {},
    boardDescription: highlightBoardDescription,
    currentNode: controller.currentNode ?? undefined,
    simplified: isSimplifiedView,
  }

  const simplifiedBlunderMeterProps: ComponentProps<
    typeof SimplifiedBlunderMeter
  > = {
    hover: analysisEnabled ? hover : mockHover,
    makeMove: analysisEnabled ? makeMove : mockMakeMove,
    data: analysisEnabled ? controller.blunderMeter : emptyBlunderMeterData,
    colorSanMapping: analysisEnabled ? controller.colorSanMapping : {},
    moveEvaluation: analysisEnabled ? controller.moveEvaluation : undefined,
  }

  const blunderMeterProps: ComponentProps<typeof BlunderMeter> = {
    ...simplifiedBlunderMeterProps,
  }

  const moveMapProps = {
    moveMap: analysisEnabled ? controller.moveMap : undefined,
    colorSanMapping: analysisEnabled ? controller.colorSanMapping : {},
    setHoverArrow: analysisEnabled ? setHoverArrow : mockSetHoverArrow,
    makeMove: analysisEnabled ? makeMove : mockMakeMove,
  }

  const movesByRatingProps = {
    moves: analysisEnabled ? controller.movesByRating : undefined,
    colorSanMapping: analysisEnabled ? controller.colorSanMapping : {},
  }

  const renderHeader = (
    variant: 'desktop' | 'mobile',
    extraClasses?: string,
  ) => {
    const containerClasses = [
      'flex h-10 min-h-10 items-center justify-between border-b border-glass-border bg-transparent text-white/90',
      variant === 'desktop' ? 'px-4' : 'px-3',
      variant === 'mobile' ? 'backdrop-blur-md' : '',
      extraClasses ?? '',
    ]
      .filter(Boolean)
      .join(' ')

    const buttonBase =
      variant === 'desktop'
        ? 'flex items-center gap-1 rounded-md border border-glass-border bg-glass px-2 py-1 text-xs transition-colors hover:bg-glass-stronger'
        : 'flex items-center gap-1 rounded-md border border-glass-border bg-glass px-2 py-1 text-xs transition-colors'

    const viewButtonClass = `${buttonBase} ${
      isSimplifiedView ? 'text-white' : 'text-white/80'
    }`
    const visibilityButtonClass = `${buttonBase} ${
      analysisEnabled ? 'text-white' : 'text-white/80'
    }`

    return (
      <div className={containerClasses}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-xl text-white/80">
            analytics
          </span>
          <h3
            className={
              variant === 'desktop'
                ? 'font-semibold text-white'
                : 'text-sm font-semibold text-white'
            }
          >
            Analysis
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleViewMode}
            className={viewButtonClass}
            aria-pressed={isSimplifiedView}
          >
            <span className="material-symbols-outlined !text-xs text-white/80">
              {isSimplifiedView ? 'expand_all' : 'collapse_all'}
            </span>
            <span className="text-white/90">
              {isSimplifiedView ? 'Expand' : 'Collapse'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleToggleAnalysis}
            className={visibilityButtonClass}
            aria-pressed={analysisEnabled}
          >
            <span className="material-symbols-outlined !text-xs text-white/80">
              {analysisEnabled ? 'visibility_off' : 'visibility'}
            </span>
            <span className="text-white/90">
              {analysisEnabled ? 'Hide' : 'Show'}
            </span>
          </button>
        </div>
      </div>
    )
  }

  const renderDisabledOverlay = (
    message: string,
    options: { offsetTop?: boolean } = {},
  ) => {
    const offsetClasses = options.offsetTop
      ? 'bottom-0 left-0 right-0 top-10'
      : 'inset-0'

    return (
      <div
        className={`pointer-events-none absolute z-10 flex items-center justify-center overflow-hidden rounded-md border border-glass-border bg-backdrop/90 backdrop-blur-md ${offsetClasses}`}
      >
        <div className="rounded-md border border-glass-border bg-gradient-to-br from-white/10 to-white/5 p-4 text-center">
          <span className="material-symbols-outlined mb-2 text-3xl text-white/80">
            lock
          </span>
          <p className="font-medium tracking-wide text-white">
            Analysis Disabled
          </p>
          <p className="text-xs text-secondary">{message}</p>
        </div>
      </div>
    )
  }

  const simplifiedLayout = (
    <>
      <div className="hidden xl:flex xl:flex-col xl:gap-3">
        <div className="relative flex h-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass-strong backdrop-blur-md">
          {renderHeader('desktop')}
          <div className="flex h-full w-full flex-1">
            <SimplifiedAnalysisOverview
              highlightProps={highlightProps}
              blunderMeterProps={simplifiedBlunderMeterProps}
              analysisEnabled={analysisEnabled}
            />
          </div>
          {!analysisEnabled &&
            renderDisabledOverlay('Enable analysis to see move evaluations', {
              offsetTop: true,
            })}
        </div>
      </div>
      <div className="flex h-full flex-col gap-3 xl:hidden">
        <div className="relative flex overflow-hidden rounded-md border border-glass-border bg-glass-strong pt-10 backdrop-blur-md">
          {renderHeader('mobile', 'absolute left-0 top-0 z-10 w-full')}
          <div className="flex h-full w-full flex-col gap-3 p-3">
            <SimplifiedAnalysisOverview
              highlightProps={highlightProps}
              blunderMeterProps={simplifiedBlunderMeterProps}
              analysisEnabled={analysisEnabled}
            />
          </div>
          {!analysisEnabled &&
            renderDisabledOverlay('Enable analysis to see move evaluations', {
              offsetTop: true,
            })}
        </div>
      </div>
    </>
  )

  const detailedLayout = (
    <>
      <div className="hidden xl:flex xl:h-full xl:flex-col xl:gap-3">
        <div className="desktop-analysis-big-row-1-container relative flex gap-3">
          <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass-strong backdrop-blur-md">
            {renderHeader('desktop')}
            <div className="flex h-full w-full flex-1">
              <div className="flex h-full w-auto min-w-[40%] max-w-[40%] border-r border-glass-border">
                <Highlight {...highlightProps} />
              </div>
              <div className="flex h-full w-full">
                <MovesByRating {...movesByRatingProps} />
              </div>
            </div>
          </div>
          {!analysisEnabled &&
            renderDisabledOverlay('Enable analysis to see move evaluations', {
              offsetTop: true,
            })}
        </div>

        <div className="desktop-analysis-big-row-2-container relative flex flex-row gap-3">
          <div className="flex h-full w-full flex-col">
            <MoveMap {...moveMapProps} />
          </div>
          <BlunderMeter {...blunderMeterProps} />
          {!analysisEnabled &&
            renderDisabledOverlay('Enable analysis to see position evaluation')}
        </div>
      </div>

      <div className="flex h-full flex-col gap-3 xl:hidden">
        <div className="desktop-analysis-small-row-1-container relative flex overflow-hidden rounded-md border border-glass-border bg-glass-strong pt-10 backdrop-blur-md">
          {renderHeader('mobile', 'absolute left-0 top-0 z-10 w-full')}
          <div className="flex h-full w-full border-r border-glass-border">
            <Highlight {...highlightProps} />
          </div>
          <div className="flex h-full w-auto min-w-[40%] max-w-[40%] p-3">
            <div className="h-full w-full">
              <BlunderMeter {...blunderMeterProps} showContainer={false} />
            </div>
          </div>
          {!analysisEnabled &&
            renderDisabledOverlay('Enable analysis to see move evaluations', {
              offsetTop: true,
            })}
        </div>

        <div className="desktop-analysis-small-row-2-container relative flex w-full">
          <div className="h-full w-full">
            <MoveMap {...moveMapProps} />
          </div>
          {!analysisEnabled &&
            renderDisabledOverlay('Enable analysis to see position evaluation')}
        </div>

        <div className="desktop-analysis-small-row-3-container relative flex w-full">
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
            <MovesByRating {...movesByRatingProps} />
            {!analysisEnabled &&
              renderDisabledOverlay('Enable analysis to see move evaluations')}
          </div>
        </div>
      </div>
    </>
  )

  return (
    <motion.div
      id="analysis"
      variants={itemVariants ?? {}}
      className="desktop-right-column-container flex flex-col gap-3"
      style={{ willChange: 'transform, opacity' }}
    >
      {isSimplifiedView ? simplifiedLayout : detailedLayout}
    </motion.div>
  )
}
