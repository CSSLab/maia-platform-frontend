/* eslint-disable @typescript-eslint/no-explicit-any */
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'
import React, { useEffect, useState } from 'react'

import { MARK_COLORS, Mark, PLAYERS, PlayerId, Player } from './data'

const Chessground = dynamic(() => import('@react-chess/chessground'), {
  ssr: false,
  loading: () => (
    <div className="aspect-square h-full w-full animate-pulse bg-white/[0.04]" />
  ),
})

interface BoardProps {
  fen: string
  lastMove?: string | null
  orientation?: 'white' | 'black'
  shapes?: DrawShape[]
  coordinates?: boolean
  className?: string
  /** When set, the side to move can play these moves. */
  dests?: Map<Key, Key[]>
  turnColor?: 'white' | 'black'
  onMove?: (from: string, to: string) => void
}

/** A view-only chessground board (brown, cburnett: the site's defaults). */
export const WchBoard: React.FC<BoardProps> = ({
  fen,
  lastMove,
  orientation = 'white',
  shapes = [],
  coordinates = true,
  className = '',
  dests,
  turnColor,
  onMove,
}) => {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true))
    return () => window.cancelAnimationFrame(id)
  }, [])
  return (
    <div className={`relative aspect-square w-full ${className}`}>
      {ready ? (
        <Chessground
          contained
          config={{
            fen,
            orientation,
            viewOnly: !dests,
            coordinates,
            ...(turnColor ? { turnColor } : {}),
            ...(dests
              ? {
                  movable: {
                    free: false,
                    color: turnColor,
                    dests: dests as any,
                    showDests: true,
                    events: { after: (o: Key, d: Key) => onMove?.(o, d) },
                  },
                }
              : {}),
            ...(lastMove
              ? {
                  lastMove: [
                    lastMove.slice(0, 2),
                    lastMove.slice(2, 4),
                  ] as Key[],
                }
              : {}),
            drawable: {
              enabled: false,
              visible: true,
              autoShapes: shapes,
              brushes: {
                maia: {
                  key: 'maia',
                  color: '#fe7f6d',
                  opacity: 0.85,
                  lineWidth: 12,
                },
                maiaSoft: {
                  key: 'maiaSoft',
                  color: '#fe7f6d',
                  opacity: 0.45,
                  lineWidth: 8,
                },
                engine: {
                  key: 'engine',
                  color: '#3f8cd0',
                  opacity: 0.8,
                  lineWidth: 8,
                },
                you: {
                  key: 'you',
                  color: '#e8e8e8',
                  opacity: 0.7,
                  lineWidth: 8,
                },
                gukesh: {
                  key: 'gukesh',
                  color: '#f2b45a',
                  opacity: 0.85,
                  lineWidth: 12,
                },
                sindarov: {
                  key: 'sindarov',
                  color: '#b9a3e8',
                  opacity: 0.85,
                  lineWidth: 12,
                },
              } as any,
            },
          }}
        />
      ) : (
        <div className="aspect-square h-full w-full animate-pulse bg-white/[0.04]" />
      )}
    </div>
  )
}

/** The human bar: White / draw / Black, always from White's side. */
export const WdlBar: React.FC<{
  W: number
  D: number
  B: number
  height?: number
  labels?: boolean
  className?: string
}> = ({ W, D, B, height = 20, labels = true, className = '' }) => {
  const total = W + D + B || 1
  const seg = [
    { v: W, cls: 'bg-[#ececec] text-black/85', t: 'White' },
    { v: D, cls: 'bg-[#9a9a9a] text-black/80', t: 'Draw' },
    { v: B, cls: 'bg-[#3f3a3b] text-white/90', t: 'Black' },
  ]
  return (
    <div
      className={`flex w-full overflow-hidden rounded-sm border border-white/15 ${className}`}
      style={{ height }}
    >
      {seg.map((s) => (
        <div
          key={s.t}
          title={`${s.t} ${Math.round((s.v / total) * 100)}%`}
          className={`flex items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-semibold tabular-nums transition-[width] duration-500 ${s.cls}`}
          style={{ width: `${(s.v / total) * 100}%` }}
        >
          {labels && s.v / total > 0.09
            ? `${Math.round((s.v / total) * 100)}`
            : ''}
        </div>
      ))}
    </div>
  )
}

export const MarkChip: React.FC<{ mark: Mark; size?: 'sm' | 'md' }> = ({
  mark,
  size = 'sm',
}) => (
  <span
    className={`inline-flex items-center justify-center rounded-full font-bold leading-none text-black ${
      size === 'sm'
        ? 'h-4 min-w-4 px-1 text-[10px]'
        : 'h-5 min-w-5 px-1.5 text-xs'
    }`}
    style={{ background: MARK_COLORS[mark] }}
  >
    {mark}
  </span>
)

export const PlayerDot: React.FC<{ id: PlayerId; className?: string }> = ({
  id,
  className = '',
}) => (
  <span
    className={`inline-block h-2.5 w-2.5 rounded-full ${className}`}
    style={{ background: PLAYERS[id].color }}
  />
)

export const PlayerName: React.FC<{
  player: Player
  piece?: 'white' | 'black'
  className?: string
}> = ({ player, piece, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}>
    {piece ? (
      <span
        className={`inline-block h-3 w-3 rounded-[3px] border ${
          piece === 'white'
            ? 'border-white/60 bg-[#ececec]'
            : 'border-white/30 bg-[#2a2627]'
        }`}
      />
    ) : null}
    <span style={{ color: player.color }} className="font-semibold">
      {player.short}
    </span>
  </span>
)

export const DIRECTIONS = [
  {
    slug: 'oracle',
    n: 1,
    name: 'The Oracle',
    pitch: 'Live game, prediction first: before every move, what will he play?',
  },
  {
    slug: 'odds',
    n: 2,
    name: 'Human Odds',
    pitch: 'The match told through practical chances, not engine evals.',
  },
  {
    slug: 'prep',
    n: 3,
    name: 'The Prep Room',
    pitch:
      'Before each round: the predicted opening and where each player departs from a generic 2750.',
  },
  {
    slug: 'tape',
    n: 4,
    name: 'Tale of the Tape',
    pitch: 'Two players, two clocks: a live dossier of habits, time and risk.',
  },
  {
    slug: 'guess',
    n: 5,
    name: 'Out-guess Maia',
    pitch:
      'Play along: predict each move before it lands, scored against Maia.',
  },
]

/** The prototype chrome: direction switcher and a demo-data notice. */
export const LabBar: React.FC = () => {
  const router = useRouter()
  const current = router.pathname.split('/').pop()
  return (
    <div className="sticky top-0 z-30 w-full border-b border-white/10 bg-[#171214]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 overflow-x-auto px-4 py-2 text-xs md:px-6">
        <Link
          href="/wch/lab"
          className="shrink-0 font-semibold uppercase tracking-[0.18em] text-white/50 hover:text-white/80"
        >
          WCh lab
        </Link>
        <span className="text-white/20">/</span>
        {DIRECTIONS.map((d) => (
          <Link
            key={d.slug}
            href={`/wch/lab/${d.slug}`}
            className={`shrink-0 rounded-full px-3 py-1 transition ${
              current === d.slug
                ? 'bg-white/15 text-white'
                : 'text-white/55 hover:bg-white/5 hover:text-white/85'
            }`}
          >
            {d.n}. {d.name}
          </Link>
        ))}
        <span className="ml-auto shrink-0 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-0.5 text-amber-100/80">
          prototype · demo game, not played
        </span>
      </div>
    </div>
  )
}

/** Small federation flags, drawn inline (emoji flags render unevenly). */
export const Flag: React.FC<{ fed: 'IND' | 'UZB'; className?: string }> = ({
  fed,
  className = '',
}) => (
  <svg
    viewBox="0 0 30 20"
    className={`inline-block h-[11px] w-[16.5px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-white/15 ${className}`}
    role="img"
    aria-label={fed === 'IND' ? 'India' : 'Uzbekistan'}
  >
    {fed === 'IND' ? (
      <>
        <rect width="30" height="6.67" fill="#FF9933" />
        <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
        <rect y="13.33" width="30" height="6.67" fill="#138808" />
        <circle
          cx="15"
          cy="10"
          r="2.4"
          fill="none"
          stroke="#000080"
          strokeWidth="0.7"
        />
        <circle cx="15" cy="10" r="0.6" fill="#000080" />
      </>
    ) : (
      <>
        <rect width="30" height="6.4" fill="#0099B5" />
        <rect y="6.4" width="30" height="0.6" fill="#CE1126" />
        <rect y="7" width="30" height="6" fill="#FFFFFF" />
        <rect y="13" width="30" height="0.6" fill="#CE1126" />
        <rect y="13.6" width="30" height="6.4" fill="#1EB53A" />
        <circle cx="5" cy="3.2" r="2.3" fill="#FFFFFF" />
        <circle cx="5.9" cy="3.2" r="2" fill="#0099B5" />
        <circle cx="9" cy="1.9" r="0.45" fill="#FFFFFF" />
        <circle cx="10.4" cy="1.9" r="0.45" fill="#FFFFFF" />
        <circle cx="9" cy="3.3" r="0.45" fill="#FFFFFF" />
        <circle cx="10.4" cy="3.3" r="0.45" fill="#FFFFFF" />
        <circle cx="10.4" cy="4.7" r="0.45" fill="#FFFFFF" />
      </>
    )}
  </svg>
)
