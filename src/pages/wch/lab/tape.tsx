import Head from 'next/head'
import React from 'react'

import {
  ANALYTICS,
  BASE_SECONDS,
  DEMO_PLIES,
  PLAYERS,
  PlayerId,
  clockCurve,
  fmtClock,
  pct,
} from 'src/components/WCh/data'
import { LabBar, WdlBar } from 'src/components/WCh/ui'

const G = PLAYERS.gukesh
const S = PLAYERS.sindarov

// The live game's clocks by move number (after each player's move).
const liveClock = (id: PlayerId) => {
  const color = id === 'gukesh' ? 'white' : 'black'
  const pts: [number, number][] = [[0, 1]]
  DEMO_PLIES.filter((p) => p.color === color).forEach((p) => {
    pts.push([
      p.moveNumber,
      (color === 'white' ? p.clockWhite : p.clockBlack) / BASE_SECONDS,
    ])
  })
  return pts
}

const LIVE_MOVE = 20

export default function TapePage() {
  const gLive = liveClock('gukesh')
  const sLive = liveClock('sindarov')
  const gNow = gLive[gLive.length - 1][1]
  const sNow = sLive[sLive.length - 1][1]
  const gUsual = clockCurve('gukesh', LIVE_MOVE)
  const sUsual = clockCurve('sindarov', LIVE_MOVE)
  const gDiffMin = Math.round(((gNow - gUsual) * BASE_SECONDS) / 60)
  const sDiffMin = Math.round(((sNow - sUsual) * BASE_SECONDS) / 60)

  return (
    <>
      <Head>
        <title>Tale of the Tape · WCh lab · Maia Chess</title>
        <meta name="robots" content="noindex" />
      </Head>
      <LabBar />
      <main className="mx-auto w-full max-w-[1240px] px-4 pb-20 pt-8 md:px-6">
        {/* Name plates */}
        <section className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <NamePlate id="gukesh" align="right" />
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-white/30">
            vs
          </span>
          <NamePlate id="sindarov" align="left" />
        </section>

        {/* Clock race */}
        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                Game 1 · live · move {LIVE_MOVE}
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                The clock is the story
              </h2>
            </div>
            <div className="flex gap-3">
              <PaceCard id="gukesh" now={gNow} diffMin={gDiffMin} />
              <PaceCard id="sindarov" now={sNow} diffMin={sDiffMin} />
            </div>
          </div>
          <ClockChart gLive={gLive} sLive={sLive} />
          <p className="mt-2 text-xs text-white/40">
            Solid: this game. Dashed: each player&apos;s usual curve in
            classical OTB games 2023-26. Grey: 2700+ peers. Red band: under 5
            minutes. Assumes 120 minutes for 40 moves, increment from move 41
            (to confirm).
          </p>
        </section>

        {/* What the clock is worth */}
        <section className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-human-2">
              Only Maia can show this
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              What the clock is worth
            </h3>
            <p className="mt-1 text-sm text-white/55">
              The human bar reads both clocks. Same position, three clock
              situations:
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {[
                {
                  t: 'As it stands',
                  c: `${fmtClock(gNow * BASE_SECONDS)} vs ${fmtClock(sNow * BASE_SECONDS)}`,
                  bar: DEMO_PLIES[DEMO_PLIES.length - 1].bar,
                  strong: true,
                },
                {
                  t: 'Level clocks',
                  c: 'both 1:35:00',
                  bar: { W: 0.35, D: 0.52, B: 0.13 },
                },
                {
                  t: 'Clocks swapped',
                  c: `${fmtClock(sNow * BASE_SECONDS)} vs ${fmtClock(gNow * BASE_SECONDS)}`,
                  bar: { W: 0.37, D: 0.52, B: 0.11 },
                },
              ].map((r) => (
                <div
                  key={r.t}
                  className="grid grid-cols-[120px_1fr] items-center gap-3"
                >
                  <div>
                    <p
                      className={`text-sm ${r.strong ? 'font-semibold text-white' : 'text-white/70'}`}
                    >
                      {r.t}
                    </p>
                    <p className="font-mono text-[11px] text-white/40">{r.c}</p>
                  </div>
                  <WdlBar W={r.bar.W} D={r.bar.D} B={r.bar.B} height={22} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/40">
              Gukesh&apos;s time deficit is worth about 2-4 points of his
              winning chances here. Illustrative numbers.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <RiskRow
              id="gukesh"
              piece="White"
              level="moderate"
              why={`${Math.abs(gDiffMin)} min behind his usual pace with 20 moves to the control`}
            />
            <RiskRow
              id="sindarov"
              piece="Black"
              level="low"
              why="time in hand; blunders 3.1% of moves under 2 min, 1.3% otherwise"
            />
            <p className="px-1 text-xs leading-5 text-white/40">
              Both players blunder 2.5-3× as often under two minutes. The risk
              note turns on when a player drops under 5 minutes before move 40.
            </p>
          </div>
        </section>

        {/* Butterfly */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Habits, side by side</h2>
          <p className="mt-1 text-sm text-white/50">
            Classical OTB, 2023-2026. The tick on each side is the 2700+
            average.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Butterfly
              label="Median think, moves 1-10"
              g={ANALYTICS.gukesh.thinkOpening}
              s={ANALYTICS.sindarov.thinkOpening}
              peer={ANALYTICS.peers.thinkOpening}
              max={40}
              fmt={(v) => `${v}s`}
            />
            <Butterfly
              label="Median think, moves 11-20"
              g={ANALYTICS.gukesh.thinkMiddle}
              s={ANALYTICS.sindarov.thinkMiddle}
              peer={ANALYTICS.peers.thinkMiddle}
              max={160}
              fmt={(v) =>
                `${Math.floor(v / 60)}m ${String(v % 60).padStart(2, '0')}s`
              }
            />
            <Butterfly
              label="Clock left after move 40"
              g={ANALYTICS.gukesh.clockAt40}
              s={ANALYTICS.sindarov.clockAt40}
              peer={ANALYTICS.peers.clockAt40}
              max={0.3}
              fmt={(v) => pct(v)}
            />
            <Butterfly
              label="Games under 5 min before move 40"
              g={ANALYTICS.gukesh.shortBefore40}
              s={ANALYTICS.sindarov.shortBefore40}
              peer={ANALYTICS.peers.shortBefore40}
              max={0.8}
              fmt={(v) => pct(v)}
              warn
            />
            <Butterfly
              label="Blunder rate, all moves"
              g={ANALYTICS.gukesh.blunderAll}
              s={ANALYTICS.sindarov.blunderAll}
              peer={ANALYTICS.peers.blunderAll}
              max={0.05}
              fmt={(v) => pct(v, 1)}
              warn
            />
            <Butterfly
              label="Blunder rate, under 2 minutes"
              g={ANALYTICS.gukesh.blunderUnder2}
              s={ANALYTICS.sindarov.blunderUnder2}
              peer={ANALYTICS.peers.blunderUnder2}
              max={0.05}
              fmt={(v) => pct(v, 1)}
              warn
            />
            <Butterfly
              label="Queens off by move 20"
              g={ANALYTICS.gukesh.queensOff20}
              s={ANALYTICS.sindarov.queensOff20}
              peer={ANALYTICS.peers.queensOff20}
              max={0.3}
              fmt={(v) => pct(v)}
            />
            <Butterfly
              label="Average game length"
              g={ANALYTICS.gukesh.gameLength}
              s={ANALYTICS.sindarov.gameLength}
              peer={ANALYTICS.peers.gameLength}
              max={60}
              fmt={(v) => `${v.toFixed(0)} moves`}
            />
          </div>
        </section>

        {/* Repertoire */}
        <section className="mt-10 grid gap-5 md:grid-cols-2">
          {(['gukesh', 'sindarov'] as PlayerId[]).map((id) => {
            const a = ANALYTICS[id]
            const pl = PLAYERS[id]
            return (
              <div
                key={id}
                className="rounded-2xl border border-white/10 p-5"
                style={{
                  background: `linear-gradient(180deg, ${pl.colorSoft}, transparent 60%)`,
                }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ color: pl.color }}
                >
                  {pl.short}&apos;s repertoire
                </p>
                <p className="mt-3 text-xs uppercase tracking-wider text-white/45">
                  As White
                </p>
                <div className="mt-2 flex h-7 overflow-hidden rounded">
                  {a.asWhite.map(([m, v], i) => (
                    <div
                      key={m}
                      className="flex items-center justify-center text-xs font-semibold text-black/80"
                      style={{
                        width: `${v * 100}%`,
                        background: pl.color,
                        opacity: 1 - i * 0.3,
                      }}
                    >
                      {m} {pct(v)}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs uppercase tracking-wider text-white/45">
                  As Black
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-white/75">
                  {a.asBlack.map((x) => (
                    <li key={x}>· {x}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      </main>
    </>
  )
}

const NamePlate: React.FC<{ id: PlayerId; align: 'left' | 'right' }> = ({
  id,
  align,
}) => {
  const pl = PLAYERS[id]
  const a = ANALYTICS[id]
  const blurb =
    id === 'gukesh'
      ? `Invests in the middlegame: a median ${Math.round(a.thinkMiddle / 60)}+ minutes a move from 11 to 20, and short of time before move 40 in ${pct(a.shortBefore40)} of games.`
      : `Rattles out the opening (median ${a.thinkOpening}s a move) and banks time: ${pct(a.clockAt40)} of his clock left at move 40.`
  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <p className="text-sm text-white/50">
        {pl.flag} {pl.country}
      </p>
      <h1
        className="mt-1 text-4xl font-bold tracking-tight md:text-6xl"
        style={{ color: pl.color }}
      >
        {pl.short}
      </h1>
      <p
        className={`mt-3 max-w-sm text-sm leading-6 text-white/60 ${
          align === 'right' ? 'ml-auto' : ''
        }`}
      >
        {blurb}
      </p>
    </div>
  )
}

const PaceCard: React.FC<{ id: PlayerId; now: number; diffMin: number }> = ({
  id,
  now,
  diffMin,
}) => {
  const pl = PLAYERS[id]
  const behind = diffMin < 0
  return (
    <div className="min-w-[180px] rounded-xl border border-white/10 bg-black/20 px-4 py-2.5">
      <p className="text-xs" style={{ color: pl.color }}>
        {pl.short}
      </p>
      <p className="font-mono text-2xl font-semibold tabular-nums">
        {fmtClock(now * BASE_SECONDS)}
      </p>
      <p
        className={`text-xs ${behind ? 'text-amber-200' : 'text-emerald-200'}`}
      >
        {Math.abs(diffMin)} min {behind ? 'behind' : 'ahead of'} his usual pace
      </p>
    </div>
  )
}

const CW = 1000
const CH = 260
const CP = { l: 44, r: 16, t: 10, b: 28 }

const ClockChart: React.FC<{
  gLive: [number, number][]
  sLive: [number, number][]
}> = ({ gLive, sLive }) => {
  const x = (m: number) => CP.l + (m / 40) * (CW - CP.l - CP.r)
  const y = (v: number) => CP.t + (1 - v) * (CH - CP.t - CP.b)
  const curve = (id: PlayerId | 'peers') =>
    Array.from({ length: 41 })
      .map((_, m) => `${m === 0 ? 'M' : 'L'}${x(m)},${y(clockCurve(id, m))}`)
      .join('')
  const live = (pts: [number, number][]) =>
    pts.map(([m, v], i) => `${i === 0 ? 'M' : 'L'}${x(m)},${y(v)}`).join('')
  const fiveMin = 300 / BASE_SECONDS
  const gEnd = gLive[gLive.length - 1]
  const sEnd = sLive[sLive.length - 1]
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="mt-4 w-full overflow-visible">
      <rect
        x={CP.l}
        y={y(fiveMin)}
        width={CW - CP.l - CP.r}
        height={y(0) - y(fiveMin)}
        fill="rgba(215,48,39,0.22)"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line
            x1={CP.l}
            x2={CW - CP.r}
            y1={y(v)}
            y2={y(v)}
            stroke="rgba(255,255,255,0.06)"
          />
          <text
            x={CP.l - 8}
            y={y(v) + 4}
            fontSize={11}
            textAnchor="end"
            fill="rgba(255,255,255,0.35)"
          >
            {Math.round(v * 120)}m
          </text>
        </g>
      ))}
      {[10, 20, 30, 40].map((m) => (
        <text
          key={m}
          x={x(m)}
          y={CH - 8}
          fontSize={11}
          textAnchor="middle"
          fill="rgba(255,255,255,0.35)"
        >
          move {m}
        </text>
      ))}
      <path
        d={curve('peers')}
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={1.5}
      />
      <path
        d={curve('gukesh')}
        fill="none"
        stroke={G.color}
        strokeWidth={2}
        strokeDasharray="5 5"
        opacity={0.7}
      />
      <path
        d={curve('sindarov')}
        fill="none"
        stroke={S.color}
        strokeWidth={2}
        strokeDasharray="5 5"
        opacity={0.7}
      />
      <path
        d={live(gLive)}
        fill="none"
        stroke={G.color}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <path
        d={live(sLive)}
        fill="none"
        stroke={S.color}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <circle cx={x(gEnd[0])} cy={y(gEnd[1])} r={6} fill={G.color} />
      <circle cx={x(sEnd[0])} cy={y(sEnd[1])} r={6} fill={S.color} />
      <line
        x1={x(gEnd[0])}
        x2={x(gEnd[0])}
        y1={y(gEnd[1])}
        y2={y(clockCurve('gukesh', gEnd[0]))}
        stroke={G.color}
        strokeWidth={1}
      />
    </svg>
  )
}

const Butterfly: React.FC<{
  label: string
  g: number
  s: number
  peer: number
  max: number
  fmt: (v: number) => string
  warn?: boolean
}> = ({ label, g, s, peer, max, fmt }) => {
  const w = (v: number) => `${Math.min(1, v / max) * 100}%`
  return (
    <div className="grid grid-cols-[1fr_200px_1fr] items-center gap-3">
      <div className="relative flex h-7 items-center justify-end">
        <span
          className="mr-2 text-sm font-semibold tabular-nums"
          style={{ color: G.color }}
        >
          {fmt(g)}
        </span>
        <div className="relative h-full w-[70%]">
          <div
            className="absolute inset-y-0 right-0 rounded-l"
            style={{ width: w(g), background: G.color }}
          />
          <div
            className="absolute -inset-y-1 w-[2px] bg-white/70"
            style={{ right: w(peer) }}
          />
        </div>
      </div>
      <p className="text-center text-xs text-white/60">{label}</p>
      <div className="relative flex h-7 items-center">
        <div className="relative h-full w-[70%]">
          <div
            className="absolute inset-y-0 left-0 rounded-r"
            style={{ width: w(s), background: S.color }}
          />
          <div
            className="absolute -inset-y-1 w-[2px] bg-white/70"
            style={{ left: w(peer) }}
          />
        </div>
        <span
          className="ml-2 text-sm font-semibold tabular-nums"
          style={{ color: S.color }}
        >
          {fmt(s)}
        </span>
      </div>
    </div>
  )
}

const RiskRow: React.FC<{
  id: PlayerId
  piece: string
  level: 'low' | 'moderate' | 'high'
  why: string
}> = ({ id, piece, level, why }) => {
  const color =
    level === 'high' ? '#d73027' : level === 'moderate' ? '#fdae61' : '#66bd63'
  const filled = level === 'high' ? 3 : level === 'moderate' ? 2 : 1
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm">
          Blunder risk: <b style={{ color }}>{level}</b>{' '}
          <span className="text-white/50">· {piece}</span>
        </p>
        <div className="flex gap-1">
          {[1, 2, 3].map((k) => (
            <span
              key={k}
              className="h-2 w-6 rounded-full"
              style={{
                background: k <= filled ? color : 'rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-white/50">
        <span style={{ color: PLAYERS[id].color }}>{PLAYERS[id].short}</span>:{' '}
        {why}
      </p>
    </div>
  )
}
