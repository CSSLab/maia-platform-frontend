import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ColorSanMapping } from 'src/types'
import {
  ChartLine,
  NESTED_WIDTHS,
  buildLayout,
  nameColor,
  nearestMove,
  shareText,
} from './movesByRatingLayout'

export interface MovesByRatingAreaProps {
  displayedMoves: { [key: string]: number }[] | undefined
  moveKeys: string[]
  displayedColorSanMapping: ColorSanMapping
  isHomePage: boolean
  displayedPositionKey?: string
  /** The rating chosen in the Maia menu (the home page's demo: 1500). */
  selectedRating?: number
  /** Stockfish's best move (UCI), drawn in colour when it is in the chart. */
  stockfishBest?: string
}

// The panel behind the chart: halos and rings in this colour keep names and
// points clear of the lines.
const PANEL = '#1e1d22'
const GRID = 'rgba(255, 255, 255, 0.07)'
const TICK = 'rgba(255, 255, 255, 0.55)'
const MARKER = 'rgba(236, 233, 239, 0.4)'
const GREY = 'rgba(236, 233, 239, 0.24)'
const SHARE = 'rgba(255, 255, 255, 0.92)'
const FADED = 0.18
const halo = {
  paintOrder: 'stroke' as const,
  stroke: PANEL,
  strokeWidth: 3,
  strokeLinejoin: 'round' as const,
}

const pathOf = (
  values: number[],
  x: (i: number) => number,
  y: (v: number) => number,
) =>
  'M' + values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('L')

/**
 * The Moves by Rating chart: each move's probability at every rating from 600
 * to 2600, the moves that matter at the chosen rating in colour (see
 * movesByRatingLayout). Hovering (or tapping) a move brings it to the front
 * and fades the others; the readout lists every move at the rating under the
 * pointer.
 */
export const MovesByRatingArea: React.FC<MovesByRatingAreaProps> = ({
  displayedMoves,
  moveKeys,
  displayedColorSanMapping,
  selectedRating = 1500,
  stockfishBest,
}) => {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState<{
    i: number
    move: string | null
  } | null>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () =>
      setSize({
        w: Math.floor(el.clientWidth),
        h: Math.floor(el.clientHeight),
      })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The ratings the data has (600-2600 on the analysis page; the home page's
  // demo has 1100-1900).
  const ratings = useMemo(
    () =>
      [...new Set((displayedMoves ?? []).map((row) => Number(row.rating)))]
        .filter((r) => Number.isFinite(r))
        .sort((a, b) => a - b),
    [displayedMoves],
  )
  const lines = useMemo<ChartLine[]>(() => {
    if (ratings.length < 2) return []
    const byRating = new Map(
      (displayedMoves ?? []).map((row) => [Number(row.rating), row]),
    )
    return moveKeys
      .filter((key) => displayedColorSanMapping[key])
      .map((key) => ({
        key,
        san: displayedColorSanMapping[key].san,
        color: displayedColorSanMapping[key].color,
        values: ratings.map((r) => Number(byRating.get(r)?.[key]) || 0),
      }))
  }, [displayedMoves, ratings, moveKeys, displayedColorSanMapping])

  const layout = useMemo(
    () =>
      size.w > 120 && size.h > 80 && lines.length
        ? buildLayout(
            lines,
            selectedRating,
            stockfishBest,
            size.w,
            size.h,
            ratings,
          )
        : null,
    [lines, selectedRating, stockfishBest, size, ratings],
  )

  useEffect(() => setHover(null), [displayedMoves])

  const names = useMemo(
    () =>
      Object.fromEntries(lines.map((l) => [l.key, nameColor(l.color, PANEL)])),
    [lines],
  )

  if (!layout) {
    return <div ref={box} className="relative min-h-0 w-full flex-1" />
  }

  const { x, y, index, focus, grey, kept, last } = layout
  const lineOf = Object.fromEntries(kept.map((l) => [l.key, l]))
  const hot = hover?.move ?? null
  const opacity = (key: string) => (!hot || hot === key ? 1 : FADED)
  // The hovered move is drawn last, on top of the others.
  const onTop = (a: ChartLine, b: ChartLine) =>
    Number(a.key === hot) - Number(b.key === hot)
  const focusOrder = [...focus].sort(onTop)
  const greyOrder = [...grey].sort(onTop)

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const vx = e.clientX - r.left
    const vy = e.clientY - r.top
    let i = 0
    for (let k = 1; k <= last; k++) {
      if (Math.abs(x(k) - vx) < Math.abs(x(i) - vx)) i = k
    }
    const named = (e.target as Element)
      .closest?.('[data-move]')
      ?.getAttribute('data-move')
    setHover({ i, move: named ?? nearestMove(layout, vx, vy) })
  }

  const readout = hover
    ? [...kept].sort((a, b) => b.values[hover.i] - a.values[hover.i])
    : []
  const tipX = hover ? x(hover.i) : 0
  const tipOnLeft = tipX > layout.width / 2

  return (
    <div ref={box} className="relative min-h-0 w-full flex-1">
      <svg
        width={layout.width}
        height={layout.height}
        className="block touch-pan-y select-none"
        role="img"
        aria-label={`Moves by rating at Maia ${selectedRating}: ${focus
          .map((l) => `${l.san} ${shareText(l.values[index])}`)
          .join(', ')}`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          {focus.map((l) => (
            <linearGradient
              key={l.key}
              id={`wash-${uid}-${l.key}`}
              gradientUnits="userSpaceOnUse"
              x1={0}
              x2={0}
              y1={Math.min(...l.values.map(y))}
              y2={y(0)}
            >
              <stop offset="0%" stopColor={l.color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={l.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {layout.yTicks.map((t) => (
          <g key={t}>
            <line
              x1={layout.left}
              x2={layout.width - layout.right}
              y1={y(t)}
              y2={y(t)}
              stroke={GRID}
              shapeRendering="crispEdges"
            />
            <text
              x={layout.left - 5}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="central"
              fill={TICK}
              fontSize={11}
            >
              {t}%
            </text>
          </g>
        ))}
        <text
          x={layout.yTitle.x}
          y={layout.yTitle.y}
          transform={`rotate(-90 ${layout.yTitle.x} ${layout.yTitle.y})`}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#FE7F6D"
          fontWeight={600}
          fontSize={layout.yTitle.size}
        >
          {layout.yTitle.text}
        </text>
        {layout.xTicks.map((r) => (
          <text
            key={r}
            x={x(layout.ratings.indexOf(r))}
            y={layout.height - 5}
            textAnchor="middle"
            fill={TICK}
            fontSize={11}
          >
            {r}
          </text>
        ))}

        {[...focus].reverse().map((l) => (
          <path
            key={l.key}
            d={pathOf(l.values, x, y) + `L${x(last)},${y(0)}L${x(0)},${y(0)}Z`}
            fill={`url(#wash-${uid}-${l.key})`}
            opacity={!hot || hot === l.key ? 1 : 0.15}
          />
        ))}

        <line
          x1={x(index)}
          x2={x(index)}
          y1={layout.top - 4}
          y2={y(0)}
          stroke={MARKER}
          shapeRendering="crispEdges"
        />
        <text
          x={x(index) + (layout.markerTitleLeft ? -5 : 5)}
          y={layout.top - 6}
          textAnchor={layout.markerTitleLeft ? 'end' : 'start'}
          fill={TICK}
          fontSize={10}
          style={halo}
        >
          Maia {selectedRating}
        </text>

        {greyOrder.map((l) => (
          <path
            key={l.key}
            data-move={l.key}
            d={pathOf(l.values, x, y)}
            fill="none"
            stroke={hot === l.key ? l.color : GREY}
            strokeWidth={hot === l.key ? 2 : 1}
            strokeLinejoin="round"
            opacity={opacity(l.key)}
          />
        ))}
        {focusOrder.map((l) => (
          <g key={l.key} data-move={l.key} opacity={opacity(l.key)}>
            <path
              d={pathOf(l.values, x, y)}
              fill="none"
              stroke={l.color}
              strokeWidth={
                NESTED_WIDTHS[
                  Math.min(focus.indexOf(l), NESTED_WIDTHS.length - 1)
                ]
              }
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle
              cx={x(index)}
              cy={y(l.values[index])}
              r={3.5}
              fill={l.color}
              stroke={PANEL}
              strokeWidth={1.5}
            />
          </g>
        ))}

        {layout.markerLabels.map((m) => {
          const l = lineOf[m.key]
          return (
            <g key={m.key} data-move={m.key} opacity={opacity(m.key)}>
              {m.y !== m.py ? (
                <path
                  d={`M${m.px + m.side * 3},${m.py - 3}L${m.px + m.side * 7},${m.y}`}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={1.25}
                  strokeLinecap="round"
                />
              ) : null}
              <text
                x={m.x}
                y={m.y}
                textAnchor={m.side > 0 ? 'start' : 'end'}
                dominantBaseline="central"
                fontSize={layout.nameSize}
                fontWeight={600}
                style={halo}
              >
                <tspan fill={names[m.key]}>{l.san}</tspan>
                <tspan fill={SHARE} dx={4} fontWeight={500}>
                  {shareText(l.values[index])}
                </tspan>
              </text>
            </g>
          )
        })}

        {layout.rightLabels.map((r) => {
          const l = lineOf[r.key]
          return (
            <g key={r.key} data-move={r.key} opacity={opacity(r.key)}>
              {Math.abs(r.y - r.lineY) > 1 ? (
                <path
                  d={`M${x(last) + 3},${r.lineY}L${x(last) + 9},${r.y}`}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              <text
                x={x(last) + 12}
                y={r.y}
                dominantBaseline="central"
                fontSize={layout.nameSize}
                fontWeight={600}
              >
                <tspan fill={names[r.key]}>{l.san}</tspan>
                {layout.edge ? (
                  <tspan fill={SHARE} dx={4} fontWeight={500}>
                    {shareText(l.values[index])}
                  </tspan>
                ) : null}
              </text>
            </g>
          )
        })}

        {hover ? (
          <line
            x1={tipX}
            x2={tipX}
            y1={layout.top}
            y2={y(0)}
            stroke="rgba(236, 233, 239, 0.5)"
            shapeRendering="crispEdges"
            pointerEvents="none"
          />
        ) : null}
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute flex w-32 flex-col rounded-md border border-glass-border pb-2 text-white/90"
          style={{
            top: layout.top,
            left: tipOnLeft ? undefined : tipX + 12,
            right: tipOnLeft ? layout.width - tipX + 12 : undefined,
            background:
              'radial-gradient(ellipse 110% 90% at 20% 10%, rgba(239, 68, 68, 0.10) 0%, rgba(239, 68, 68, 0.06) 35%, transparent 75%), #171214',
          }}
        >
          <p className="px-3 py-2 text-sm">{layout.ratings[hover.i]}</p>
          {readout.map((l) => (
            <div
              key={l.key}
              className="flex items-center justify-between px-3"
              style={{ opacity: hot && hot !== l.key ? 0.4 : 1 }}
            >
              <p className="text-xs" style={{ color: names[l.key] }}>
                {l.san}
              </p>
              <p className="text-xs font-semibold tabular-nums">
                {shareText(l.values[hover.i])}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
