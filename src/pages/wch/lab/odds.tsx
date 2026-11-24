import Head from 'next/head'
import React, { useMemo, useRef, useState } from 'react'

import {
  DEMO_PLIES,
  MARK_COLORS,
  MATCH_GAMES_ASSUMED,
  PLAYERS,
  Ply,
  PREDICTOR_COLORS,
  SIMULATION,
  START_FEN,
  fmtThink,
  pct,
} from 'src/components/WCh/data'
import {
  LabBar,
  MarkChip,
  PlayerName,
  WchBoard,
  WdlBar,
} from 'src/components/WCh/ui'

const W = 1000
const H = 300
const PAD = { l: 8, r: 40, t: 18, b: 26 }
const EDGE_MAX = 0.25

const label = (p: Ply) =>
  `${p.moveNumber}${p.color === 'white' ? '.' : '...'}${p.san}`

const MOMENTS = [
  {
    ply: 27,
    title: 'A six-minute detour',
    body: "Gukesh spends 6m 28s and chooses 14.Nb3 over the engine's 14.d5. Maia had it as his second choice (33%), well above a generic 2750 (24%). The human bar barely moves: a matter of taste, not of risk.",
  },
  {
    ply: 33,
    title: 'The ten-minute rook',
    body: "17.Rc1, after 10m 11s. Stockfish preferred 17.a3. Humans read the rook move as the more testing try: White's chances tick up to 30%, the highest of the game so far.",
  },
  {
    ply: 38,
    title: 'Where the engine shrugs',
    body: "19...h6 costs almost nothing by Stockfish (a few hundredths). But against a player of Gukesh's strength, with this clock, it hands White 4 points of practical chances. ?! is a human mark, not an engine one.",
  },
]

export default function OddsPage() {
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const n = DEMO_PLIES.length
  const x = (i: number) => PAD.l + (i / n) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + v * (H - PAD.t - PAD.b)

  const points = useMemo(
    () => [{ W: 0.25, D: 0.57, B: 0.18 }, ...DEMO_PLIES.map((p) => p.bar)],
    [],
  )

  // White's practical edge in points: W - B, from White's side.
  const human = points.map((p) => p.W - p.B)
  // Stockfish's eval on the same scale (illustrative logistic conversion).
  const engine = [0.2, ...DEMO_PLIES.map((p) => p.eval)].map(
    (e) => 2 / (1 + Math.exp(-0.7 * e)) - 1,
  )
  const ey = (v: number) => y(0.5 - v / (2 * EDGE_MAX))
  const line = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${ey(v)}`).join('')
  const gap = `${line(human)}L${engine
    .map((v, i) => `${x(i)},${ey(v)}`)
    .reverse()
    .join('L')}Z`
  const humanFill = `${line(human)}L${x(n)},${ey(0)}L${x(0)},${ey(0)}Z`

  const sel = hover ?? n
  const selPly = sel === 0 ? null : DEMO_PLIES[sel - 1]
  const bar = points[sel]
  const last = DEMO_PLIES[n - 1]

  const onMove = (e: React.MouseEvent) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    const fx = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((fx - PAD.l) / (W - PAD.l - PAD.r)) * n)
    setHover(Math.max(0, Math.min(n, i)))
  }

  return (
    <>
      <Head>
        <title>Human Odds · WCh lab · Maia Chess</title>
        <meta name="robots" content="noindex" />
      </Head>
      <LabBar />
      <main className="mx-auto w-full max-w-[1240px] px-4 pb-20 pt-8 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-human-2">
          Human odds · Game 1 · after move 20
        </p>
        <h1 className="mt-3 max-w-4xl font-serif text-[34px] leading-[1.12] tracking-tight text-white md:text-[52px]">
          The engine calls it equal. Humans think{' '}
          <span style={{ color: PLAYERS.gukesh.color }}>Gukesh</span> is the one
          pressing.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
          Stockfish says +{last.eval.toFixed(1)}: nothing to see. Maia&apos;s
          human bar, which knows who is playing and how much time they have,
          gives White <b className="text-white/85">{pct(last.bar.W)}</b>, a draw{' '}
          <b className="text-white/85">{pct(last.bar.D)}</b> and Black{' '}
          <b className="text-white/85">{pct(last.bar.B)}</b>.
        </p>

        {/* Big ribbon chart */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[3px] w-5 bg-[#ececec]" />
                Human edge (White wins − Black wins)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-[2px] w-5"
                  style={{ background: PREDICTOR_COLORS.stockfish }}
                />
                What Stockfish&apos;s eval implies
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-4 rounded-sm bg-human-1/40" />
                The human factor
              </span>
            </div>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full cursor-crosshair select-none overflow-visible"
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            >
              {[-0.2, -0.1, 0.1, 0.2].map((v) => (
                <g key={v}>
                  <line
                    x1={PAD.l}
                    x2={W - PAD.r}
                    y1={ey(v)}
                    y2={ey(v)}
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <text
                    x={PAD.l + 2}
                    y={ey(v) - 4}
                    fontSize={11}
                    fill="rgba(255,255,255,0.3)"
                  >
                    {v > 0 ? `White +${v * 100}` : `Black +${-v * 100}`}
                  </text>
                </g>
              ))}
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={ey(0)}
                y2={ey(0)}
                stroke="rgba(255,255,255,0.25)"
              />
              <path d={humanFill} fill="rgba(236,236,236,0.06)" />
              <path d={gap} fill="rgba(254,127,109,0.32)" />
              <path
                d={line(engine)}
                fill="none"
                stroke={PREDICTOR_COLORS.stockfish}
                strokeWidth={2}
              />
              <path
                d={line(human)}
                fill="none"
                stroke="#ececec"
                strokeWidth={3}
                strokeLinejoin="round"
              />
              <text
                x={x(n) + 6}
                y={ey(human[n]) + 4}
                fontSize={13}
                fontWeight={700}
                fill="#ececec"
              >
                +{Math.round(human[n] * 100)}
              </text>
              <text
                x={x(n) + 6}
                y={ey(engine[n]) + 4}
                fontSize={13}
                fontWeight={700}
                fill={PREDICTOR_COLORS.stockfish}
              >
                +{Math.round(engine[n] * 100)}
              </text>
              {MOMENTS.map((m, k) => (
                <g key={m.ply}>
                  <line
                    x1={x(m.ply)}
                    x2={x(m.ply)}
                    y1={PAD.t}
                    y2={H - PAD.b}
                    stroke="rgba(254,127,109,0.55)"
                    strokeDasharray="2 3"
                  />
                  <circle
                    cx={x(m.ply)}
                    cy={ey(human[m.ply])}
                    r={5}
                    fill="rgb(254,127,109)"
                    stroke="#171214"
                    strokeWidth={2}
                  />
                  <text
                    x={x(m.ply)}
                    y={PAD.t - 2}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill="rgb(254,127,109)"
                  >
                    {k + 1}
                  </text>
                </g>
              ))}
              {DEMO_PLIES.filter((p) => p.mark).map((p) => (
                <text
                  key={p.index}
                  x={x(p.index + 1)}
                  y={ey(human[p.index + 1]) - 10}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill={MARK_COLORS[p.mark!]}
                >
                  {p.mark}
                </text>
              ))}
              {[5, 10, 15, 20].map((mv) => (
                <text
                  key={mv}
                  x={x(mv * 2)}
                  y={H - 6}
                  fontSize={11}
                  fill="rgba(255,255,255,0.4)"
                  textAnchor="middle"
                >
                  {mv}
                </text>
              ))}
              {hover !== null ? (
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD.t}
                  y2={H - PAD.b}
                  stroke="white"
                  strokeWidth={1}
                />
              ) : null}
            </svg>
            <p className="mt-1 text-[11px] text-white/35">
              Move number → · hover to scrub · numbered dots: the moments below
              · conversion of the eval is illustrative
            </p>
          </div>
          <div>
            <div className="overflow-hidden rounded-md">
              <WchBoard
                fen={selPly ? selPly.fen : START_FEN}
                lastMove={selPly?.uci}
                coordinates={false}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="font-mono font-semibold">
                {selPly ? label(selPly) : 'Start'}
              </span>
              {selPly?.mark ? <MarkChip mark={selPly.mark} /> : null}
              <span className="text-xs text-white/45">
                {selPly
                  ? `${fmtThink(selPly.think)} · eval ${selPly.eval.toFixed(2)}`
                  : ''}
              </span>
            </div>
            <WdlBar W={bar.W} D={bar.D} B={bar.B} className="mt-2" />
          </div>
        </section>

        {/* Moments */}
        <section className="mt-14">
          <h2 className="font-serif text-2xl text-white">Three moments</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {MOMENTS.map((m) => {
              const p = DEMO_PLIES[m.ply - 1]
              const prev = m.ply >= 2 ? DEMO_PLIES[m.ply - 2].bar : points[0]
              const dW = p.bar.W - prev.W
              return (
                <article
                  key={m.ply}
                  onMouseEnter={() => setHover(m.ply)}
                  onMouseLeave={() => setHover(null)}
                  className="group rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-human-2/50"
                >
                  <div className="flex gap-4">
                    <div className="w-28 shrink-0 overflow-hidden rounded">
                      <WchBoard
                        fen={p.fen}
                        lastMove={p.uci}
                        coordinates={false}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-mono text-lg font-semibold">
                        {label(p)} {p.mark ? <MarkChip mark={p.mark} /> : null}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Stockfish {p.eval >= 0 ? '+' : ''}
                        {p.eval.toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        White&apos;s human chances{' '}
                        <span
                          className={
                            dW >= 0 ? 'text-emerald-200' : 'text-rose-200'
                          }
                        >
                          {dW >= 0 ? '+' : ''}
                          {(dW * 100).toFixed(0)} pts
                        </span>
                      </p>
                    </div>
                  </div>
                  <h3 className="mt-4 font-serif text-lg text-white">
                    {m.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/60">
                    {m.body}
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        {/* Match strip */}
        <section className="mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-2xl text-white">
              The match, game by game
            </h2>
            <p className="text-xs text-white/40">
              {MATCH_GAMES_ASSUMED} games assumed · schedule to confirm
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: MATCH_GAMES_ASSUMED }).map((_, g) => (
              <div
                key={g}
                className={`rounded-xl border p-3 ${
                  g === 0
                    ? 'border-rose-300/30 bg-rose-500/[0.06]'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Game {g + 1}</span>
                  {g === 0 ? (
                    <span className="inline-flex items-center gap-1 text-rose-200">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />{' '}
                      live
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-[11px] text-white/45">
                  <PlayerName
                    player={PLAYERS[g % 2 === 0 ? 'gukesh' : 'sindarov']}
                    piece="white"
                  />
                </div>
                {g === 0 ? (
                  <MiniRibbon points={points} />
                ) : (
                  <div className="mt-2 h-8 rounded bg-white/[0.04]" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Explainer + experimental */}
        <section className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="font-serif text-xl text-white">
              Why not the engine bar?
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              An engine eval says what perfect play would do. The human bar says
              what tends to happen when <i>these two players</i>, on{' '}
              <i>these clocks</i>, play on from here. It is calibrated in every
              time class and beats the best Stockfish + time + material model on
              everyday games. Evals are from White&apos;s side; marks use the
              red-to-green scale, blue is the computer.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-amber-300/30 bg-amber-400/[0.04] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/80">
              Experimental · needs your call
            </p>
            <h3 className="mt-1 font-serif text-xl text-white">
              Match forecast from past form
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Gukesh-Maia vs Sindarov-Maia, played many times:{' '}
              {pct(SIMULATION.draw, 1)} draws (their real classical games:
              58.9%), Gukesh scoring {pct(SIMULATION.gukeshScore[0])}-
              {pct(SIMULATION.gukeshScore[1])} per game. A simulation of past
              form, not a prediction of the match.
            </p>
          </div>
        </section>
      </main>
    </>
  )
}

const MiniRibbon: React.FC<{
  points: { W: number; D: number; B: number }[]
}> = ({ points }) => {
  const w = 100
  const h = 32
  const x = (i: number) => (i / (points.length - 1)) * w
  const path = (top: (i: number) => number, bot: (i: number) => number) =>
    `M${points.map((_, i) => `${x(i)},${top(i) * h}`).join('L')}L${points
      .map((_, i) => `${x(i)},${bot(i) * h}`)
      .reverse()
      .join('L')}Z`
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="mt-2 h-8 w-full rounded"
    >
      <path
        d={path(
          () => 0,
          (i) => points[i].W,
        )}
        fill="#ececec"
      />
      <path
        d={path(
          (i) => points[i].W,
          (i) => points[i].W + points[i].D,
        )}
        fill="#9a9a9a"
      />
      <path
        d={path(
          (i) => points[i].W + points[i].D,
          () => 1,
        )}
        fill="#3f3a3b"
      />
    </svg>
  )
}
