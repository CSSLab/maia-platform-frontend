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
}

const PAD_L = 22
const PAD_R = 12
const PAD_TOP = 8
const AXIS = 16
const RISK = 7
const RISK_GAP = 3
const BLUNDER = '#d73027'
const INACCURACY = '#fee08b'

/** 0 at the player's usual risk, 1 at twice it or more. */
const riskStrength = (risk: number, usual: number) =>
  Math.max(0, Math.min(1, risk / usual - 1))

/**
 * The game at a glance: the left bar, unrolled over the moves. White's chance
 * is the filled shape, its mistakes sit on the line, and two thin ribbons under
 * it turn red where a player's risk of a blunder runs above their usual.
 */
export const GameGraph: React.FC<Props> = ({
  bars,
  mainline,
  ply,
  usual,
  onSelectPly,
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
  const plotBottom = h - AXIS - 2 * RISK - 2 * RISK_GAP
  const x = useCallback(
    (p: number) => PAD_L + (p / (n - 1)) * (w - PAD_L - PAD_R),
    [n, w],
  )
  const y = useCallback(
    (v: number) => PAD_TOP + (1 - v) * (plotBottom - PAD_TOP),
    [plotBottom],
  )

  const { line, area } = useMemo(() => {
    let lineD = ''
    let areaD = ''
    let run: [number, number][] = []
    const flush = () => {
      if (run.length > 1) {
        const path = run
          .map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`)
          .join('')
        lineD += path
        areaD += `${path}L${run[run.length - 1][0].toFixed(1)} ${plotBottom}L${run[0][0].toFixed(1)} ${plotBottom}Z`
      }
      run = []
    }
    for (let p = 0; p < n; p++) {
      const bar = bars[p]
      if (bar) run.push([x(p), y(bar.W)])
      else flush()
    }
    flush()
    return { line: lineD, area: areaD }
  }, [bars, n, plotBottom, x, y])

  // Each player's risk on their own moves, red in proportion to how far it
  // runs above their usual.
  const riskStops = useMemo(
    () =>
      [0, 1].map((row) => {
        const stops: [number, number][] = []
        for (let p = row; p < n - 1; p += 2) {
          const bar = bars[p]
          const risk = row === 0 ? bar?.dW_K5_T15 : bar?.dB_K5_T15
          const s =
            risk === undefined
              ? 0
              : riskStrength(risk, row === 0 ? usual.white : usual.black)
          stops.push([p / (n - 1), s > 0 ? 0.15 + 0.85 * s : 0])
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
  const ribbon = (row: number) =>
    plotBottom + RISK_GAP + row * (RISK + RISK_GAP)
  const step = (w - PAD_L - PAD_R) / (n - 1)

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
            <linearGradient id="game-graph-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgb(245 186 186)" stopOpacity="0.5" />
              <stop offset="1" stopColor="rgb(122 24 24)" stopOpacity="0.5" />
            </linearGradient>
            {riskStops.map((stops, row) => (
              <linearGradient
                key={row}
                id={`game-graph-risk-${row}`}
                x1="0"
                x2="1"
                y1="0"
                y2="0"
              >
                {stops.map(([offset, opacity]) => (
                  <stop
                    key={offset}
                    offset={offset}
                    stopColor={BLUNDER}
                    stopOpacity={opacity}
                  />
                ))}
              </linearGradient>
            ))}
          </defs>
          <path d={area} fill="url(#game-graph-fill)" />
          <line
            x1={PAD_L}
            x2={w - PAD_R}
            y1={y(0.5)}
            y2={y(0.5)}
            stroke="rgb(255 255 255 / 0.22)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <path
            d={line}
            fill="none"
            stroke="rgb(250 225 225)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {[0, 1].map((row) => (
            <g key={row}>
              <rect
                x={PAD_L}
                y={ribbon(row)}
                width={Math.max(0, w - PAD_L - PAD_R)}
                height={RISK}
                rx="1"
                fill="rgb(255 255 255 / 0.06)"
              />
              <circle
                cx={PAD_L - 11}
                cy={ribbon(row) + RISK / 2}
                r="3"
                fill={row === 0 ? 'white' : 'rgb(18 14 14)'}
                stroke={row === 0 ? 'none' : 'rgb(255 255 255 / 0.7)'}
              />
              <rect
                x={PAD_L}
                y={ribbon(row)}
                width={Math.max(0, w - PAD_L - PAD_R)}
                height={RISK}
                rx="1"
                fill={`url(#game-graph-risk-${row})`}
              />
            </g>
          ))}
          {mainline.map((node, p) => {
            const bar = bars[p]
            if (!bar || !(node.blunder || node.inaccuracy)) return null
            return (
              <circle
                key={p}
                cx={x(p)}
                cy={y(bar.W)}
                r={node.blunder ? 3.5 : 2.75}
                fill={node.blunder ? BLUNDER : INACCURACY}
                stroke="rgb(18 14 14)"
                strokeWidth="1"
              />
            )
          })}
          {shown !== null ? (
            <line
              x1={x(shown)}
              x2={x(shown)}
              y1={PAD_TOP}
              y2={ribbon(1) + RISK}
              stroke="rgb(255 255 255 / 0.4)"
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
            x={PAD_L}
            y={PAD_TOP + 11}
            fontSize="10"
            fill="rgb(255 255 255 / 0.55)"
          >
            White&apos;s chance
          </text>
          <text
            x={PAD_L - 5}
            y={y(0.5) + 3}
            textAnchor="end"
            fontSize="9"
            fill="rgb(255 255 255 / 0.35)"
          >
            50
          </text>
          <text x={PAD_L} y={h - 3} fontSize="10" fill="rgb(255 255 255 / 0.4)">
            blunder risk
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
