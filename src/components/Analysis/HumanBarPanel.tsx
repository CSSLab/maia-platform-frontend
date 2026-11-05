import React, { useMemo, useRef, useState } from 'react'
import type { HumanBarsState } from 'src/hooks/useHumanBars'
import type { HumanBarPly } from 'src/types'

interface Props {
  state: HumanBarsState
  onSelectPly: (ply: number) => void
  onHide?: () => void
  /** When set, the bars are covered (analysis hidden, learning mode...). */
  lockedMessage?: string | null
  variant?: 'desktop' | 'mobile'
  className?: string
}

const pct = (x: number | undefined) => {
  if (x === undefined || !Number.isFinite(x)) return '–'
  const v = x * 100
  if (v > 0 && v < 1) return '<1%'
  if (v < 100 && v > 99) return '>99%'
  return `${Math.round(v)}%`
}

const DANGER_COLOR = '#d73027'

const plyLabel = (ply: number) => {
  if (ply === 0) return 'Start'
  const moveNumber = Math.ceil(ply / 2)
  return ply % 2 === 1 ? `${moveNumber}.` : `${moveNumber}...`
}

const HumanBar: React.FC<{ bar?: HumanBarPly; compact: boolean }> = ({
  bar,
  compact,
}) => {
  const segments = bar
    ? [
        {
          key: 'white',
          value: bar.W,
          className: 'bg-[#ececec] text-black/85',
          title: `White wins ${pct(bar.W)}`,
        },
        {
          key: 'draw',
          value: bar.Dr,
          className: 'bg-[#9a9a9a] text-black/80',
          title: `Draw ${pct(bar.Dr)}`,
        },
        {
          key: 'black',
          value: bar.L,
          className: 'bg-[#3f3a3b] text-white/90',
          title: `Black wins ${pct(bar.L)}`,
        },
      ]
    : []
  const total = bar ? bar.W + bar.Dr + bar.L || 1 : 1
  return (
    <div
      className={`flex w-full overflow-hidden rounded-sm border border-white/15 ${compact ? 'h-[18px]' : 'h-5'} ${bar ? '' : 'animate-pulse bg-white/10'}`}
      aria-label={
        bar
          ? `Human bar: White ${pct(bar.W)}, draw ${pct(bar.Dr)}, Black ${pct(bar.L)}`
          : 'Human bar: computing'
      }
    >
      {segments.map((segment) => {
        const share = (segment.value / total) * 100
        return (
          <div
            key={segment.key}
            title={segment.title}
            className={`flex h-full items-center justify-center overflow-hidden whitespace-nowrap text-[10px] font-semibold tabular-nums transition-[width] duration-300 ${segment.className}`}
            style={{ width: `${share}%` }}
          >
            {share >= 13 ? pct(segment.value) : null}
          </div>
        )
      })}
    </div>
  )
}

const EngineBar: React.FC<{ bar?: HumanBarPly }> = ({ bar }) => {
  const white = bar ? Math.min(1, Math.max(0, bar.eng_w)) : 0.5
  return (
    <div
      className={`flex h-2 w-full overflow-hidden rounded-sm border border-white/15 ${bar ? '' : 'animate-pulse bg-white/10'}`}
      title={
        bar
          ? `Engine: White ${pct(bar.eng_w)}${
              bar.cpw !== undefined
                ? ` (eval ${bar.cpw > 0 ? '+' : ''}${(bar.cpw / 100).toFixed(2)})`
                : ''
            }`
          : 'Engine bar: computing'
      }
    >
      {bar ? (
        <>
          <div
            className="h-full bg-[#ececec] transition-[width] duration-300"
            style={{ width: `${white * 100}%` }}
          />
          <div className="h-full flex-1 bg-[#3f3a3b]" />
        </>
      ) : null}
    </div>
  )
}

const DangerCell: React.FC<{ value?: number; title: string }> = ({
  value,
  title,
}) => (
  <div className="flex min-w-0 items-center gap-1.5" title={title}>
    <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
        style={{
          width: `${Math.min(100, (value ?? 0) * 100)}%`,
          backgroundColor: DANGER_COLOR,
        }}
      />
    </div>
    <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-white/85">
      {pct(value)}
    </span>
  </div>
)

const GameChart: React.FC<{
  bars: (HumanBarPly | undefined)[]
  total: number
  ply: number | null
  onSelectPly: (ply: number) => void
}> = ({ bars, total, ply, onSelectPly }) => {
  const ref = useRef<SVGSVGElement | null>(null)
  const [hoverPly, setHoverPly] = useState<number | null>(null)
  const width = 1000
  const height = 100
  const last = Math.max(1, total - 1)
  const x = (p: number) => (p / last) * width
  const y = (score: number) => (1 - score) * height

  const paths = useMemo(() => {
    const build = (pick: (bar: HumanBarPly) => number) => {
      let d = ''
      let pen = false
      for (let p = 0; p < total; p++) {
        const bar = bars[p]
        if (!bar) {
          pen = false
          continue
        }
        d += `${pen ? 'L' : 'M'}${x(p).toFixed(1)},${y(pick(bar)).toFixed(1)}`
        pen = true
      }
      return d
    }
    return {
      human: build((bar) => bar.W + bar.Dr / 2),
      engine: build((bar) => bar.eng_w),
    }
  }, [bars, total])

  const plyFromEvent = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    const fraction = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    )
    return Math.round(fraction * last)
  }

  const shown = hoverPly ?? ply
  const shownBar = shown !== null ? bars[shown] : undefined

  return (
    <div className="flex w-full flex-col gap-0.5">
      <div className="flex items-center justify-between text-[10px] text-white/60">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded bg-human-1" />
            Human
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded bg-engine-2" />
            Engine
          </span>
        </div>
        <span className="tabular-nums">
          {shown !== null
            ? `${plyLabel(shown)} ${
                shownBar
                  ? `${pct(shownBar.W + shownBar.Dr / 2)} / ${pct(shownBar.eng_w)}`
                  : ''
              }`
            : ''}
        </span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-12 w-full cursor-pointer rounded-sm bg-black/20"
        role="img"
        aria-label="White's expected score over the game: human bar and engine bar. Click to jump to a move."
        onMouseMove={(e) => setHoverPly(plyFromEvent(e.clientX))}
        onMouseLeave={() => setHoverPly(null)}
        onClick={(e) => {
          const p = plyFromEvent(e.clientX)
          if (p !== null) onSelectPly(p)
        }}
      >
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="rgba(255,255,255,0.18)"
          strokeDasharray="6 6"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={paths.engine}
          fill="none"
          style={{ stroke: 'rgb(var(--color-engine-accent2))' }}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={paths.human}
          fill="none"
          style={{ stroke: 'rgb(var(--color-human-accent1))' }}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {hoverPly !== null ? (
          <line
            x1={x(hoverPly)}
            x2={x(hoverPly)}
            y1={0}
            y2={height}
            stroke="rgba(255,255,255,0.3)"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {ply !== null ? (
          <line
            x1={x(ply)}
            x2={x(ply)}
            y1={0}
            y2={height}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </div>
  )
}

/**
 * The human bars for a Lichess game: White / draw / Black chances for these
 * two players at the current position, the engine bar for contrast, each
 * player's danger of a "??", and a clickable chart over the whole game.
 */
export const HumanBarPanel: React.FC<Props> = ({
  state,
  onSelectPly,
  onHide,
  lockedMessage,
  variant = 'desktop',
  className = '',
}) => {
  const compact = variant === 'mobile'
  const bar = state.ply !== null ? state.bars[state.ply] : undefined
  const running = state.status === 'running' || state.status === 'waiting-maia'

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="material-symbols-outlined !text-base text-human-2">
          groups
        </span>
        <h3 className="truncate text-sm font-semibold text-white">
          Human bars
        </h3>
        <span
          className="material-symbols-outlined cursor-help !text-sm text-white/50"
          title={
            "Chances for these two players, given their ratings, their clocks and the position (Maia + Stockfish), from White's side: White wins / draw / Black wins. " +
            "The engine bar is Lichess's winning chances on the Stockfish eval. " +
            '"??" risk is the chance that a player\'s next move, or one of their next 5 moves, gets Lichess\'s blunder mark.'
          }
        >
          info
        </span>
      </div>
      {onHide ? (
        <button
          type="button"
          onClick={onHide}
          className="flex items-center text-white/50 transition-colors hover:text-white/90"
          title="Hide human bars (turn back on in Options)"
          aria-label="Hide human bars"
        >
          <span className="material-symbols-outlined !text-base">
            visibility_off
          </span>
        </button>
      ) : null}
    </div>
  )

  let body: React.ReactNode
  if (state.status === 'unavailable') {
    body = (
      <p className="text-xs text-white/70">
        {state.reason ?? 'Human bars are not available for this game.'}
      </p>
    )
  } else {
    body = (
      <>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-11 shrink-0 text-[10px] font-semibold text-human-1">
              Human
            </span>
            <HumanBar bar={bar} compact={compact} />
          </div>
          {/* The full panel width, so the three labels stay on one line in
              the narrow sidebar. */}
          <div className="-mt-0.5 flex w-full justify-between gap-x-2 whitespace-nowrap text-[10px] tabular-nums text-white/60">
            <span>White {bar ? pct(bar.W) : '–'}</span>
            <span>Draw {bar ? pct(bar.Dr) : '–'}</span>
            <span>Black {bar ? pct(bar.L) : '–'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-11 shrink-0 text-[10px] font-semibold text-engine-1">
              Engine
            </span>
            <div className="flex w-full items-center gap-1.5">
              <EngineBar bar={bar} />
              <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-white/70">
                {bar ? pct(bar.eng_w) : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
          <span className="text-[10px] font-semibold text-white/60">
            ?? risk
          </span>
          <span className="text-[10px] text-white/60">next move</span>
          <span className="text-[10px] text-white/60">within 5</span>
          {(['W', 'B'] as const).map((side) => {
            const name = side === 'W' ? state.whiteName : state.blackName
            const k1 = side === 'W' ? bar?.dW_K1_T15 : bar?.dB_K1_T15
            const k5 = side === 'W' ? bar?.dW_K5_T15 : bar?.dB_K5_T15
            const t30 = side === 'W' ? bar?.dW_K5_T30 : bar?.dB_K5_T30
            const k10 = side === 'W' ? bar?.dW_K10_T15 : bar?.dB_K10_T15
            const flag = side === 'W' ? bar?.dW_flag5 : bar?.dB_flag5
            const extra = [
              t30 !== undefined ? `major blunder within 5: ${pct(t30)}` : '',
              k10 !== undefined ? `?? within 10: ${pct(k10)}` : '',
              flag !== undefined ? `flags within 5: ${pct(flag)}` : '',
            ]
              .filter(Boolean)
              .join(', ')
            return (
              <React.Fragment key={side}>
                <span
                  className="flex min-w-0 items-center gap-1 text-[10px] text-white/85"
                  title={name}
                >
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${side === 'W' ? 'bg-white' : 'border border-white/60 bg-black'}`}
                  />
                  {side === 'W' ? 'White' : 'Black'}
                </span>
                <DangerCell
                  value={k1}
                  title={`${name}: chance of a ?? on their next move`}
                />
                <DangerCell
                  value={k5}
                  title={`${name}: chance of a ?? within their next 5 moves${extra ? ` (${extra})` : ''}`}
                />
              </React.Fragment>
            )
          })}
        </div>

        <GameChart
          bars={state.bars}
          total={state.total}
          ply={state.ply}
          onSelectPly={onSelectPly}
        />

        {state.inVariation ? (
          <p className="text-[10px] text-white/50">
            Showing the game position this variation starts from.
          </p>
        ) : null}
      </>
    )
  }

  const total = Math.max(1, state.total)
  const spinner = (
    <span
      className="material-symbols-outlined shrink-0 animate-spin !text-[12px] text-white/60"
      aria-hidden="true"
    >
      progress_activity
    </span>
  )
  const footer =
    state.status === 'error' ? (
      <div className="flex items-center justify-between gap-2 text-[10px] text-orange-300">
        <span className="min-w-0 truncate" title={state.error ?? undefined}>
          {state.error ?? 'Something went wrong.'}
        </span>
        <button
          type="button"
          onClick={state.retry}
          className="shrink-0 rounded border border-glass-border bg-glass px-1.5 py-0.5 text-white/90 hover:bg-glass-stronger"
        >
          Retry
        </button>
      </div>
    ) : running && !bar ? (
      <span className="flex items-center gap-1 text-[10px] text-white/50">
        {spinner}
        <span className="min-w-0">
          {state.status === 'waiting-maia'
            ? 'Loading the Maia model…'
            : state.firstAnswerPending && state.waitingForServer
              ? 'Looking up both players on Lichess…'
              : 'Analysing this position in your browser…'}
          {state.error ? ' · server unreachable, retrying' : ''}
        </span>
      </span>
    ) : running ? (
      <div className="flex items-center gap-2">
        <div className="h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-human-2/70 transition-[width] duration-300"
            style={{ width: `${(100 * state.progress.bars) / total}%` }}
          />
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-white/40">
          Rest of the game {state.progress.bars}/{state.total}
        </span>
      </div>
    ) : null
  // The first bars use the players' Lichess profiles; their recent games
  // follow a few seconds later and the bars are redone with them. If
  // Lichess is slow or down, the first bars use neither ("none").
  const withoutHistory = state.shownForm === 'none'
  const formNote =
    bar && (state.upgradePending || withoutHistory) ? (
      <span className="flex items-center gap-1 text-[10px] text-white/40">
        {state.upgradePending ? spinner : null}
        <span className="min-w-0">
          {withoutHistory
            ? state.upgradePending
              ? 'Without the players’ Lichess history for now · looking it up…'
              : 'Without the players’ Lichess history: Lichess did not answer'
            : 'From the players’ profiles · adding their recent games…'}
        </span>
      </span>
    ) : null

  return (
    <div
      id="analysis-human-bars"
      className={`relative flex w-full flex-col gap-2 p-3 ${className}`}
    >
      {header}
      {body}
      {footer}
      {formNote}
      {lockedMessage && state.status !== 'unavailable' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-backdrop/90 backdrop-blur-sm">
          <p className="text-xs font-medium text-primary">{lockedMessage}</p>
        </div>
      ) : null}
    </div>
  )
}
