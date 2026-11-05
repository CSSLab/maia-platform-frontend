import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
}

const PAD_L = 22
const PAD_R = 12
const PAD_TOP = 8
const AXIS = 16
const DANGER = '#e0301e'
const BLUNDER = '#ff3b2f'
const INACCURACY = '#fee08b'

/** 0 at the player's usual risk of a blunder, 1 at twice it or more. */
const dangerOf = (risk: number | undefined, usual: number) =>
  risk === undefined ? 0 : Math.max(0, Math.min(1, risk / usual - 1))

const FADE = (d: number) => (d > 0 ? 0.18 + 0.67 * d : 0)

/**
 * The two bars unrolled over the game. Below the white line is White's share of
 * the game and above it Black's; a side turns red while that player is in danger
 * of a blunder, so danger shows where it can cost them. The blue line is the
 * Stockfish bar.
 */
export const GameGraph: React.FC<Props> = ({
  bars,
  mainline,
  ply,
  usual,
  onSelectPly,
  engineAt,
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
  const plotBottom = h - AXIS
  const x = useCallback(
    (p: number) => PAD_L + (p / (n - 1)) * (w - PAD_L - PAD_R),
    [n, w],
  )
  const y = useCallback(
    (v: number) => PAD_TOP + (1 - v) * (plotBottom - PAD_TOP),
    [plotBottom],
  )

  const { line, below, above } = useMemo(() => {
    let lineD = ''
    let belowD = ''
    let aboveD = ''
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
        aboveD += `${path}L${last} ${PAD_TOP}L${first} ${PAD_TOP}Z`
      }
      run = []
    }
    for (let p = 0; p < n; p++) {
      const bar = bars[p]
      if (bar) run.push([x(p), y(bar.W)])
      else flush()
    }
    flush()
    return { line: lineD, below: belowD, above: aboveD }
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

  const moveLabel = (p: number) => {
    const node = mainline[p]
    if (!node?.san) return 'Start'
    const number = Math.ceil(p / 2)
    const mark = node.blunder ? '??' : node.inaccuracy ? '?!' : ''
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
          <path d={below} fill="url(#game-graph-danger-0)" />
          <path d={above} fill="url(#game-graph-danger-1)" />
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
          {mainline.map((node, p) => {
            const bar = bars[p]
            if (!bar || !(node.blunder || node.inaccuracy)) return null
            return (
              <circle
                key={p}
                cx={x(p)}
                cy={y(bar.W)}
                r={node.blunder ? 4 : 3}
                fill={node.blunder ? BLUNDER : INACCURACY}
                stroke="rgb(18 14 14)"
                strokeWidth="1.25"
              />
            )
          })}
          {shown !== null ? (
            <line
              x1={x(shown)}
              x2={x(shown)}
              y1={PAD_TOP}
              y2={plotBottom}
              stroke="rgb(255 255 255 / 0.45)"
              strokeWidth="1"
            />
          ) : null}
          {shownBar && shown !== null ? (
            <circle
              cx={x(shown)}
              cy={y(shownBar.W)}
              r="3.5"
              fill="white"
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
            x={PAD_L}
            y={h - 3}
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
            x={w - PAD_R - 88}
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
