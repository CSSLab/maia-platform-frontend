import { useEffect, useRef } from 'react'
import { motion, type MotionValue } from 'framer-motion'
import type { ColorSanMapping, BlunderMeterResult } from 'src/types'

type ArrowLegendLayout = 'horizontal' | 'vertical'
type ArrowLegendLabelMode = 'full' | 'short'
type CompactBlunderMeterVariant = 'mobile' | 'desktop'
type StockfishEvalBarVariant = 'mobile' | 'desktop'

interface AnalysisArrowLegendProps {
  layout?: ArrowLegendLayout
  labelMode?: ArrowLegendLabelMode
  className?: string
}

interface AnalysisStockfishEvalBarProps {
  hasEval: boolean
  displayText: string
  labelPositionTop: MotionValue<string>
  disabled?: boolean
  variant?: StockfishEvalBarVariant
  className?: string
  range?: number
  bubbleMinWidthPx?: number
  desktopSize?: 'compact' | 'expanded'
}

interface AnalysisCompactBlunderMeterProps {
  data: BlunderMeterResult
  colorSanMapping?: ColorSanMapping
  playedMove?: string
  maiaHeaderLabel?: string
  hover: (move?: string) => void
  makeMove: (move: string) => void
  className?: string
  variant?: CompactBlunderMeterVariant
}

interface AnalysisMaiaWinrateBarProps {
  hasValue: boolean
  displayText: string
  labelPositionTop: MotionValue<string>
  disabled?: boolean
  variant?: StockfishEvalBarVariant
  className?: string
  bubbleMinWidthPx?: number
  desktopSize?: 'compact' | 'expanded'
}

type ArrowLegendItem = {
  key: 'maia' | 'stockfish' | 'played'
  shortLabel: string
  fullLabel: string
  color: string
  accentLine?: boolean
  thicknessClass: string
}

const ARROW_LEGEND_ITEMS: ArrowLegendItem[] = [
  {
    key: 'maia',
    shortLabel: 'Maia',
    fullLabel: 'Most Human Move',
    color: '#882020',
    thicknessClass: 'h-[3px]',
  },
  {
    key: 'stockfish',
    shortLabel: 'SF',
    fullLabel: 'Best Engine Move',
    color: '#003088',
    thicknessClass: 'h-[3px]',
  },
  {
    key: 'played',
    shortLabel: 'Played',
    fullLabel: 'Move Played',
    color: '#4A8FB3',
    accentLine: true,
    thicknessClass: 'h-[4.5px]',
  },
]
const renderArrowSwatch = (item: ArrowLegendItem, swatchWidthClass: string) => (
  <span className={`relative inline-flex h-3 items-center ${swatchWidthClass}`}>
    <span
      className={`${item.thicknessClass} w-[calc(100%-4px)] rounded-full`}
      style={{ backgroundColor: item.color }}
    />
    {item.accentLine ? (
      <span className="absolute left-[1px] right-[5px] top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white" />
    ) : null}
    <span
      className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[4px] border-l-[5px] border-y-transparent"
      style={{ borderLeftColor: item.color }}
    />
  </span>
)

export const AnalysisArrowLegend: React.FC<AnalysisArrowLegendProps> = ({
  layout = 'horizontal',
  labelMode = 'full',
  className,
}) => {
  const isVertical = layout === 'vertical'
  const containerClass = isVertical
    ? 'flex flex-col items-center gap-2.5'
    : 'flex flex-wrap items-center gap-x-2.5 gap-y-0.5'
  const textClass = isVertical
    ? 'text-[8px] leading-none text-secondary/90'
    : 'text-xxs leading-none text-secondary/90'
  const swatchWidthClass = isVertical ? 'w-5' : 'w-4'

  return (
    <div className={[containerClass, className].filter(Boolean).join(' ')}>
      {ARROW_LEGEND_ITEMS.map((item) => (
        <span
          key={item.key}
          className={
            isVertical
              ? 'inline-flex w-full flex-col items-center gap-0.5 font-semibold'
              : 'inline-flex items-center gap-1 font-medium'
          }
          title={item.fullLabel}
        >
          {renderArrowSwatch(item, swatchWidthClass)}
          <span className={textClass}>
            {labelMode === 'short' ? item.shortLabel : item.fullLabel}
          </span>
        </span>
      ))}
    </div>
  )
}

export const AnalysisStockfishEvalBar: React.FC<
  AnalysisStockfishEvalBarProps
> = ({
  hasEval,
  displayText,
  labelPositionTop,
  disabled = false,
  variant = 'mobile',
  className,
  range = 4,
  bubbleMinWidthPx,
  desktopSize = 'compact',
}) => {
  const isDesktop = variant === 'desktop'
  const isExpandedDesktop = isDesktop && desktopSize === 'expanded'
  const widthClass = isDesktop
    ? isExpandedDesktop
      ? 'w-[18px]'
      : 'w-[16px]'
    : 'w-4'
  const tickTextClass = isDesktop
    ? isExpandedDesktop
      ? 'text-[9px]'
      : 'text-[8px]'
    : 'text-[7px]'
  const bubbleClass = isDesktop
    ? isExpandedDesktop
      ? 'h-6 min-w-[42px] rounded-full px-2 text-[11px]'
      : 'h-5 min-w-[36px] rounded-full px-1.5 text-[10px]'
    : 'h-[18px] w-[36px] rounded-full px-1 text-[9px]'

  return (
    <div
      className={['relative h-full', widthClass, className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={`relative h-full ${widthClass}`}>
        <div
          className="absolute inset-0 overflow-hidden rounded-[5px] border border-glass-border bg-glass-strong shadow-[0_0_0_1px_rgb(var(--color-backdrop)/0.35)]"
          style={{
            filter: disabled ? 'grayscale(0.85) saturate(0.35)' : undefined,
            opacity: disabled ? 0.55 : 1,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgb(154 203 242 / 1) 0%, rgb(14 54 86 / 1) 100%)',
            }}
          />
          {Array.from(
            { length: range * 2 - 1 },
            (_, index) => range - 1 - index,
          ).map((value) => (
            <div
              key={`sf-tick-${value}`}
              className="absolute inset-x-0 -translate-y-1/2"
              style={{
                top: `${((range - value) / (range * 2)) * 100}%`,
                height: value === 0 ? '2px' : '1px',
                backgroundColor:
                  value === 0
                    ? 'rgb(var(--color-backdrop) / 0.75)'
                    : 'rgb(var(--color-backdrop) / 0.35)',
              }}
            />
          ))}
          <div
            className={`absolute left-1/2 top-0 -translate-x-1/2 font-bold leading-none text-black/90 [text-shadow:0_1px_1px_rgb(255_255_255_/_0.5)] ${tickTextClass}`}
          >
            +{range}
          </div>
          <div
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 font-bold leading-none text-white/95 [text-shadow:0_1px_1px_rgb(0_0_0_/_0.55)] ${tickTextClass}`}
          >
            -{range}
          </div>
          {disabled ? (
            <div className="absolute inset-0 bg-backdrop/25" />
          ) : null}
        </div>
        <motion.div
          className={`absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-black/45 bg-white font-bold leading-none text-black/85 ${bubbleClass}`}
          style={{
            top: labelPositionTop,
            boxShadow: '0 0 0 2px rgb(255 255 255 / 0.32)',
            opacity: disabled ? 0.45 : hasEval ? 1 : 0.6,
            minWidth: bubbleMinWidthPx,
          }}
        >
          {displayText}
        </motion.div>
      </div>
    </div>
  )
}

export const AnalysisMaiaWinrateBar: React.FC<AnalysisMaiaWinrateBarProps> = ({
  hasValue,
  displayText,
  labelPositionTop,
  disabled = false,
  variant = 'desktop',
  className,
  bubbleMinWidthPx,
  desktopSize = 'compact',
}) => {
  const isDesktop = variant === 'desktop'
  const isExpandedDesktop = desktopSize === 'expanded'
  const widthClass = isDesktop
    ? isExpandedDesktop
      ? 'w-[18px]'
      : 'w-[16px]'
    : 'w-4'
  const tickTextClass = isDesktop
    ? isExpandedDesktop
      ? 'text-[9px]'
      : 'text-[8px]'
    : 'text-[8px]'
  const bubbleClass = isDesktop
    ? isExpandedDesktop
      ? 'h-6 min-w-[42px] px-2 text-[11px]'
      : 'h-5 min-w-[36px] px-1.5 text-[10px]'
    : 'h-[18px] w-[36px] rounded-full px-1 text-[9px]'
  return (
    <div
      className={[`relative h-full ${widthClass}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={`relative h-full ${widthClass}`}>
        <div
          className="absolute inset-0 overflow-hidden rounded-[5px] border border-glass-border bg-glass-strong shadow-[0_0_0_1px_rgb(var(--color-backdrop)/0.35)]"
          style={{
            filter: disabled ? 'grayscale(0.85) saturate(0.35)' : undefined,
            opacity: disabled ? 0.55 : 1,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgb(245 186 186 / 1) 0%, rgb(122 24 24 / 1) 100%)',
            }}
          />
          {Array.from({ length: 9 }, (_, index) => 90 - index * 10).map(
            (value) => (
              <div
                key={`maia-winrate-tick-${value}`}
                className="absolute inset-x-0 -translate-y-1/2"
                style={{
                  top: `${100 - value}%`,
                  height: value === 50 ? '2px' : '1px',
                  backgroundColor:
                    value === 50
                      ? 'rgb(var(--color-backdrop) / 0.75)'
                      : 'rgb(var(--color-backdrop) / 0.35)',
                }}
              />
            ),
          )}
          <div
            className={`absolute left-1/2 top-0 -translate-x-1/2 font-bold leading-none text-black/90 [text-shadow:0_1px_1px_rgb(255_255_255_/_0.5)] ${tickTextClass}`}
          >
            100
          </div>
          <div
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 font-bold leading-none text-white/95 [text-shadow:0_1px_1px_rgb(0_0_0_/_0.55)] ${tickTextClass}`}
          >
            0
          </div>
          {disabled ? (
            <div className="absolute inset-0 bg-backdrop/25" />
          ) : null}
        </div>
        <motion.div
          className={`absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/45 bg-white font-bold leading-none text-black/85 ${bubbleClass}`}
          style={{
            top: labelPositionTop,
            boxShadow: '0 0 0 2px rgb(255 255 255 / 0.32)',
            opacity: disabled ? 0.45 : hasValue ? 1 : 0.6,
            minWidth: bubbleMinWidthPx,
          }}
        >
          {displayText}
        </motion.div>
      </div>
    </div>
  )
}

type SegmentConfig = {
  key: 'blunder' | 'ok' | 'good'
  label: string
  mobileLabel?: string
  probability: number
  topMoves: { move: string; probability: number; label: string }[]
  badge: string
  bgClass: string
  badgeClass: string
  pctClass: string
  moveClass: string
}

export const AnalysisCompactBlunderMeter: React.FC<
  AnalysisCompactBlunderMeterProps
> = ({
  data,
  colorSanMapping,
  playedMove,
  maiaHeaderLabel = 'Maia %',
  hover,
  makeMove,
  className,
  variant = 'mobile',
}) => {
  const isDesktop = variant === 'desktop'
  const sanLabelCacheRef = useRef<Record<string, string>>({})

  useEffect(() => {
    if (!colorSanMapping) return

    for (const [move, entry] of Object.entries(colorSanMapping)) {
      if (entry?.san) {
        sanLabelCacheRef.current[move] = entry.san
      }
    }
  }, [colorSanMapping])

  const getDisplayMoveLabel = (move: string) =>
    colorSanMapping?.[move]?.san ?? sanLabelCacheRef.current[move] ?? '...'

  const getTopCategoryMoves = (
    moves: { move: string; probability: number }[],
  ) => {
    const topMoves = moves
      .filter((entry) => entry.probability >= 5)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 2)
      .map((entry) => ({
        move: entry.move,
        probability: Math.round(entry.probability),
        label: getDisplayMoveLabel(entry.move),
      }))

    if (!playedMove || topMoves.some((entry) => entry.move === playedMove)) {
      return topMoves
    }

    const playedMoveEntry = moves.find((entry) => entry.move === playedMove)
    if (!playedMoveEntry) {
      return topMoves
    }

    return [
      ...topMoves,
      {
        move: playedMoveEntry.move,
        probability: Math.round(playedMoveEntry.probability),
        label: getDisplayMoveLabel(playedMoveEntry.move),
      },
    ]
  }

  const segments: SegmentConfig[] = [
    {
      key: 'blunder',
      label: 'Blunders',
      mobileLabel: 'Blunders',
      probability: data.blunderMoves.probability,
      topMoves: getTopCategoryMoves(data.blunderMoves.moves),
      badge: '??',
      bgClass: 'bg-[#d73027]',
      badgeClass: isDesktop
        ? 'border-[#7f1813] bg-white/95 text-[#d73027]'
        : 'border-[#a81f1a] bg-white/95 text-[#e13a31]',
      pctClass: 'text-white/95',
      moveClass: 'text-[#d73027]',
    },
    {
      key: 'ok',
      label: 'Mistakes',
      mobileLabel: 'Mistakes',
      probability: data.okMoves.probability,
      topMoves: getTopCategoryMoves(data.okMoves.moves),
      badge: '?!',
      bgClass: 'bg-[#fee08b]',
      badgeClass: isDesktop
        ? 'border-[#8f6b00] bg-white/95 text-[#8f6b00]'
        : 'border-[#b58800] bg-white/95 text-[#a27700]',
      pctClass: 'text-black/80',
      moveClass: 'text-[#fee08b]',
    },
    {
      key: 'good',
      label: 'Best Moves',
      mobileLabel: 'Best',
      probability: data.goodMoves.probability,
      topMoves: getTopCategoryMoves(data.goodMoves.moves),
      badge: '✓',
      bgClass: 'bg-[#1a9850]',
      badgeClass: isDesktop
        ? 'border-[#0e5a2f] bg-white/95 text-[#1a9850]'
        : 'border-[#148145] bg-white/95 text-[#22ab5d]',
      pctClass: 'text-white/95',
      moveClass: 'text-[#1a9850]',
    },
  ]

  const barHeightClass = isDesktop ? 'h-6' : 'h-[22px]'
  const barLabelWidthClass = isDesktop ? 'w-[44px]' : ''
  const badgeSizeClass = isDesktop
    ? 'h-5 min-w-5 text-[10px]'
    : 'h-3.5 min-w-3.5 text-[8px]'
  const percentTextClass = isDesktop ? 'text-[11px]' : 'text-[9px]'
  const metaTextClass = isDesktop ? 'text-xs py-1.5' : 'text-[10px] py-1.5'
  const playedMoveOutlineOuterInsetClass = isDesktop
    ? '-inset-x-[11px] -inset-y-[5px]'
    : '-inset-x-[6px] -inset-y-[2px]'
  const playedMoveOutlineInnerInsetClass = isDesktop
    ? '-inset-x-[8px] -inset-y-[3px]'
    : '-inset-x-[4px] -inset-y-[1px]'
  const renderTopMoveButton = (
    segmentKey: string,
    topMove: { move: string; probability: number; label: string },
  ) => {
    const isPlayedMove = playedMove === topMove.move

    return (
      <button
        key={`${segmentKey}-${topMove.move}`}
        type="button"
        className={`max-w-full text-left underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current ${isPlayedMove ? 'decoration-current' : ''}`}
        onMouseEnter={() => hover(topMove.move)}
        onMouseLeave={() => hover()}
        onClick={() => makeMove(topMove.move)}
        title={`Play ${topMove.label}${isPlayedMove ? ' (move played)' : ''}`}
      >
        {isPlayedMove ? (
          <span className="relative inline-flex max-w-full items-center">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute rounded-full ${playedMoveOutlineOuterInsetClass}`}
              style={{
                background: 'transparent',
                boxShadow:
                  'inset 0 0 0 3px rgb(74 143 179 / 0.98), 0 1px 2px rgb(0 0 0 / 0.15)',
              }}
            />
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute rounded-full ${playedMoveOutlineInnerInsetClass}`}
              style={{
                background: 'transparent',
                boxShadow: 'inset 0 0 0 1.25px rgb(255 255 255 / 0.92)',
              }}
            />
            <span className="relative truncate">
              {topMove.label} {topMove.probability}%
            </span>
          </span>
        ) : (
          <span className="inline-flex max-w-full items-center gap-1">
            <span className="truncate">
              {topMove.label} {topMove.probability}%
            </span>
          </span>
        )}
      </button>
    )
  }
  const renderMobileMoveSequence = (
    segmentKey: string,
    moves: { move: string; probability: number; label: string }[],
    startIndex = 0,
  ) =>
    moves.map((topMove, index) => {
      const absoluteIndex = startIndex + index
      return (
        <span
          key={`${segmentKey}-${topMove.move}-${absoluteIndex}`}
          className="inline-flex min-w-0 items-baseline"
        >
          {absoluteIndex > 0 ? <span className="mr-1"> </span> : null}
          {renderTopMoveButton(segmentKey, topMove)}
          {absoluteIndex < startIndex + moves.length - 1 ? (
            <span className="mr-1">,</span>
          ) : null}
        </span>
      )
    })

  return (
    <div
      className={['flex w-full flex-col gap-1', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex w-full items-center gap-1">
        <span
          className={`shrink-0 font-semibold text-primary/90 ${isDesktop ? `translate-y-[2px] whitespace-pre-line text-[9px] leading-[1.02] xl:text-[10px] ${barLabelWidthClass}` : 'text-[8px] leading-none'}`}
        >
          {maiaHeaderLabel}
        </span>
        <div
          className={`relative flex flex-1 overflow-hidden rounded-full border border-glass-border bg-glass-strong shadow-[0_0_0_1px_rgb(var(--color-backdrop)/0.2)] ${barHeightClass}`}
        >
          {segments.map((segment) => (
            <motion.div
              key={`maia-horizontal-${segment.key}`}
              className={`relative flex h-full items-center justify-center gap-0.5 px-1 ${segment.bgClass}`}
              animate={{ width: `${Math.max(segment.probability, 0)}%` }}
              transition={{ type: 'spring', stiffness: 220, damping: 28 }}
            >
              {segment.probability >= 7 ? (
                <>
                  <span
                    className={`inline-flex items-center justify-center rounded-full border-2 font-bold leading-none shadow-sm ${badgeSizeClass} ${segment.badgeClass}`}
                  >
                    {segment.badge}
                  </span>
                  <span
                    className={`font-bold leading-none ${percentTextClass} ${segment.pctClass}`}
                  >
                    {segment.probability}%
                  </span>
                </>
              ) : null}
            </motion.div>
          ))}
        </div>
      </div>
      <div className="w-full">
        {isDesktop ? (
          <div className="flex items-start gap-1 py-1">
            <div
              aria-hidden="true"
              className={`shrink-0 ${barLabelWidthClass}`}
            />
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-3 pl-2">
              {segments.map((segment) => (
                <div key={`maia-top-moves-${segment.key}`} className="min-w-0">
                  <div
                    className={`mb-1.5 text-sm font-extrabold tracking-[0.01em] xl:text-base ${segment.moveClass}`}
                  >
                    {segment.label}
                  </div>
                  <div
                    className={`min-w-0 text-sm font-medium leading-snug xl:text-base ${segment.moveClass}`}
                  >
                    {segment.topMoves.length ? (
                      <div className="flex flex-col items-start gap-1">
                        {segment.topMoves.map((topMove) =>
                          renderTopMoveButton(segment.key, topMove),
                        )}
                      </div>
                    ) : (
                      <span className="text-primary/60">-</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className={`flex min-h-[38px] items-start gap-2.5 pt-1 font-semibold leading-snug tracking-[0.01em] ${metaTextClass}`}
          >
            {segments.map((segment) => (
              <div
                key={`maia-top-moves-${segment.key}`}
                className={`flex min-w-0 flex-1 items-start ${segment.moveClass}`}
              >
                <span
                  className={`mr-1.5 inline-flex shrink-0 items-center justify-center rounded-full border-2 font-bold leading-none shadow-sm ${badgeSizeClass} ${segment.badgeClass}`}
                  aria-hidden="true"
                >
                  {segment.badge}
                </span>
                {segment.topMoves.length ? (
                  segment.topMoves.length >= 3 ? (
                    <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
                      <span className="-mx-[6px] inline-flex min-w-0 items-baseline whitespace-nowrap px-[6px]">
                        {renderMobileMoveSequence(
                          segment.key,
                          segment.topMoves.slice(0, 2),
                          0,
                        )}
                      </span>
                      <span className="-mx-[6px] inline-flex min-w-0 items-baseline whitespace-nowrap px-[6px]">
                        {renderMobileMoveSequence(
                          segment.key,
                          segment.topMoves.slice(2),
                          2,
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="-mx-[6px] inline-flex min-w-0 items-baseline whitespace-nowrap px-[6px]">
                      {renderMobileMoveSequence(
                        segment.key,
                        segment.topMoves,
                        0,
                      )}
                    </span>
                  )
                ) : (
                  '-'
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
