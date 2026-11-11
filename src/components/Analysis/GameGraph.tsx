import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { MoveMark } from 'src/lib/humanBar'
import type { HumanBarPly } from 'src/types'
import type { GameNode } from 'src/types/node'

interface Props {
  bars: (HumanBarPly | undefined)[]
  mainline: GameNode[]
  ply: number | null
  /** How often each player usually blunders within 5 moves (0-1). */
  usual: { white: number; black: number }
  onSelectPly: (ply: number) => void
  /** Where an eval in centipawns sits on the Stockfish bar (0-1). */
  engineAt: (cpw: number) => number
  /**
   * The mark of the move into main-line node p (the human bars' marks;
   * undefined: the site's own classification).
   */
  markAt?: (p: number) => MoveMark | null | undefined
}

const PAD_L = 22
const PAD_R = 12
const PAD_TOP = 8
const AXIS = 16
/** Each player's danger lane under the plot: its height and the gap above it. */
const LANE = 8
const LANE_GAP = 3
const LANES = 2 * (LANE + LANE_GAP)
const DANGER = '#e0301e'
const BLUNDER = '#ff3b2f'
const MISTAKE = '#ff8a3d'
const INACCURACY = '#fee08b'
const INTERESTING = '#38bdf8'
/** Each mark's dot on the line: radius and colour. */
const MARK_DOT: Record<MoveMark, [number, string]> = {
  '??': [4, BLUNDER],
  '?': [3.5, MISTAKE],
  '?!': [3, INACCURACY],
  '!?': [3, INTERESTING],
  inaccuracy: [2.25, INACCURACY],
}

/** 0 at the player's usual risk of a blunder, 1 at twice it or more. */
const dangerOf = (risk: number | undefined, usual: number) =>
  risk === undefined ? 0 : Math.max(0, Math.min(1, risk / usual - 1))

const FADE = (d: number) => (d > 0 ? 0.18 + 0.67 * d : 0)

/**
 * The two bars unrolled over the game: the white line is White's chance (below
 * it White's share, above it Black's), the blue line the Stockfish bar. Under
 * them each player has a lane of their own that turns red while they are in
 * danger of a blunder (above their usual risk), so White's danger and Black's
 * read apart. A marker runs through all of it at the move on screen.
 */
export const GameGraph: React.FC<Props> = ({
  bars,
  mainline,
  ply,
  usual,
  onSelectPly,
  engineAt,
  markAt,
}) => {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [pointed, setPointed] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { w, h } = size
  const n = Math.max(mainline.length, 2)
  const plotBottom = h - AXIS - LANES
  const lane = (side: number) =>
    plotBottom + LANE_GAP + side * (LANE + LANE_GAP)
  const lanesBottom = lane(1) + LANE
  const x = useCallback(
    (p: number) => PAD_L + (p / (n - 1)) * (w - PAD_L - PAD_R),
    [n, w],
  )
  const y = useCallback(
    (v: number) => PAD_TOP + (1 - v) * (plotBottom - PAD_TOP),
    [plotBottom],
  )

  const { line, below } = useMemo(() => {
    let lineD = ''
    let belowD = ''
    let run: [number, number][] = []
    const flush = () => {
      if (run.length > 1) {
        const path = run
          .map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`)
          .join('')
        const first = run[0][0].toFixed(1)
        const last = run[run.length - 1][0].toFixed(1)
        lineD += path
        belowD += `${path}L${last} ${plotBottom}L${first} ${plotBottom}Z`
      }
      run = []
    }
    for (let p = 0; p < n; p++) {
      const bar = bars[p]
      if (bar) run.push([x(p), y(bar.W)])
      else flush()
    }
    flush()
    return { line: lineD, below: belowD }
  }, [bars, n, plotBottom, x, y])

  const engineLine = useMemo(() => {
    let d = ''
    let open = false
    for (let p = 0; p < n; p++) {
      const cpw = bars[p]?.cpw
      if (cpw === undefined) {
        open = false
        continue
      }
      d += `${open ? 'L' : 'M'}${x(p).toFixed(1)} ${y(engineAt(cpw)).toFixed(1)}`
      open = true
    }
    return d
  }, [bars, engineAt, n, x, y])

  // Each player's danger on their own moves, as a gradient across the moves.
  const dangerStops = useMemo(
    () =>
      [0, 1].map((side) => {
        const stops: [number, number][] = []
        for (let p = side; p < n - 1; p += 2) {
          const bar = bars[p]
          const d =
            side === 0
              ? dangerOf(bar?.dW_K5_T15, usual.white)
              : dangerOf(bar?.dB_K5_T15, usual.black)
          stops.push([p / (n - 1), FADE(d)])
        }
        return stops
      }),
    [bars, n, usual],
  )

  const pointAt = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || w === 0) return null
    const p = Math.round(
      ((clientX - rect.left - PAD_L) / (w - PAD_L - PAD_R)) * (n - 1),
    )
    return Math.max(0, Math.min(n - 1, p))
  }

  /** The move into node p's mark: the human bars' when given, else the site's. */
  const markOfMove = (p: number): MoveMark | null => {
    const m = markAt?.(p)
    if (m !== undefined) return m
    const node = mainline[p]
    return node?.blunder ? '??' : node?.inaccuracy ? 'inaccuracy' : null
  }

  const moveLabel = (p: number) => {
    const node = mainline[p]
    if (!node?.san) return 'Start'
    const number = Math.ceil(p / 2)
    const m = markOfMove(p)
    const mark = m && m !== 'inaccuracy' ? m : ''
    return `${number}${p % 2 ? '.' : '...'}${node.san}${mark}`
  }

  const shown = pointed ?? ply
  const shownBar = shown !== null ? bars[shown] : undefined
  const ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].filter(
    (m) => m * 2 < n - 2,
  )

  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label="White's chance through the game"
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuenow={ply ?? 0}
      className="relative h-full w-full cursor-pointer select-none outline-none"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && pointed !== null) onSelectPly(pointed)
      }}
      onMouseMove={(e) => setPointed(pointAt(e.clientX))}
      onMouseLeave={() => setPointed(null)}
      onClick={(e) => {
        const p = pointAt(e.clientX)
        if (p !== null) onSelectPly(p)
      }}
    >
      {w > 0 && h > 0 ? (
        <svg width={w} height={h} className="absolute inset-0 block">
          <defs>
            {dangerStops.map((stops, side) => (
              <linearGradient
                key={side}
                id={`game-graph-danger-${side}`}
                gradientUnits="userSpaceOnUse"
                x1={PAD_L}
                x2={w - PAD_R}
                y1="0"
                y2="0"
              >
                {stops.map(([offset, opacity]) => (
                  <stop
                    key={offset}
                    offset={offset}
                    stopColor={DANGER}
                    stopOpacity={opacity}
                  />
                ))}
              </linearGradient>
            ))}
          </defs>
          <path d={below} fill="rgb(255 255 255 / 0.13)" />
          {[0, 1].map((side) => (
            <g key={side}>
              <rect
                x={PAD_L}
                y={lane(side)}
                width={Math.max(0, w - PAD_L - PAD_R)}
                height={LANE}
                rx="1"
                fill="rgb(255 255 255 / 0.07)"
              />
              <rect
                x={PAD_L}
                y={lane(side)}
                width={Math.max(0, w - PAD_L - PAD_R)}
                height={LANE}
                rx="1"
                fill={`url(#game-graph-danger-${side})`}
              />
              <circle
                cx={PAD_L - 11}
                cy={lane(side) + LANE / 2}
                r="3"
                fill={side === 0 ? 'white' : 'rgb(18 14 14)'}
                stroke={side === 0 ? 'none' : 'rgb(255 255 255 / 0.7)'}
              >
                <title>{side === 0 ? 'White' : 'Black'}: blunder danger</title>
              </circle>
            </g>
          ))}
          <line
            x1={PAD_L}
            x2={w - PAD_R}
            y1={y(0.5)}
            y2={y(0.5)}
            stroke="rgb(255 255 255 / 0.25)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <path
            d={engineLine}
            fill="none"
            stroke="rgb(120 185 240)"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path
            d={line}
            fill="none"
            stroke="white"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          {mainline.map((_, p) => {
            const bar = bars[p]
            const mark = bar ? markOfMove(p) : null
            if (!bar || !mark) return null
            const [r, fill] = MARK_DOT[mark]
            return (
              <circle
                key={p}
                cx={x(p)}
                cy={y(bar.W)}
                r={r}
                fill={fill}
                stroke="rgb(18 14 14)"
                strokeWidth="1.25"
              />
            )
          })}
          {pointed !== null && pointed !== ply ? (
            <line
              x1={x(pointed)}
              x2={x(pointed)}
              y1={PAD_TOP}
              y2={lanesBottom}
              stroke="rgb(255 255 255 / 0.35)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
          ) : null}
          {ply !== null ? (
            <g>
              <line
                x1={x(ply)}
                x2={x(ply)}
                y1={PAD_TOP - 2}
                y2={lanesBottom + 2}
                stroke="rgb(255 255 255 / 0.9)"
                strokeWidth="1.5"
              />
              <path
                d={`M${(x(ply) - 4).toFixed(1)} ${PAD_TOP - 6}L${(x(ply) + 4).toFixed(1)} ${PAD_TOP - 6}L${x(ply).toFixed(1)} ${PAD_TOP - 1}Z`}
                fill="white"
              />
              {bars[ply] ? (
                <circle
                  cx={x(ply)}
                  cy={y((bars[ply] as HumanBarPly).W)}
                  r="4"
                  fill="white"
                  stroke="rgb(18 14 14)"
                  strokeWidth="1.25"
                />
              ) : null}
            </g>
          ) : null}
          {pointed !== null && pointed !== ply && shownBar ? (
            <circle
              cx={x(pointed)}
              cy={y(shownBar.W)}
              r="3"
              fill="rgb(255 255 255 / 0.6)"
              stroke="rgb(18 14 14)"
              strokeWidth="1"
            />
          ) : null}
          <text
            x={PAD_L - 5}
            y={y(0.5) + 3}
            textAnchor="end"
            fontSize="9"
            fill="rgb(255 255 255 / 0.4)"
          >
            50
          </text>
          {ticks.map((m) => (
            <text
              key={m}
              x={x(m * 2)}
              y={h - 3}
              textAnchor="middle"
              fontSize="10"
              fill="rgb(255 255 255 / 0.4)"
            >
              {m}
            </text>
          ))}
          <text
            x={PAD_L + 2}
            y={plotBottom - 3}
            fontSize="10"
            fontWeight="600"
            fill="rgb(255 255 255 / 0.7)"
          >
            White
          </text>
          <text
            x={PAD_L}
            y={PAD_TOP + 10}
            fontSize="10"
            fontWeight="600"
            fill="rgb(255 255 255 / 0.7)"
          >
            Black
          </text>
          <rect
            x={w - PAD_R - 100}
            y={PAD_TOP + 2}
            width="9"
            height="9"
            rx="2"
            fill={DANGER}
          />
          <text
            x={w - PAD_R}
            y={PAD_TOP + 10}
            textAnchor="end"
            fontSize="10"
            fontWeight="600"
            fill="rgb(255 255 255 / 0.7)"
          >
            blunder danger
          </text>
        </svg>
      ) : null}
      {pointed !== null && shownBar ? (
        <div
          className="pointer-events-none absolute top-1 whitespace-nowrap rounded bg-backdrop/90 px-1.5 py-0.5 text-[11px] font-medium text-primary"
          style={{
            left: Math.max(4, Math.min(w - 96, x(pointed) - 44)),
          }}
        >
          {moveLabel(pointed)} · {Math.round(shownBar.W * 100)}%
        </div>
      ) : null}
    </div>
  )
}
