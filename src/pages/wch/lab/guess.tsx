import Head from 'next/head'
import React, { useMemo, useState } from 'react'
import { Chess } from 'chess.ts'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'

import {
  DEMO_PLIES,
  PLAYERS,
  PREDICTOR_COLORS,
  pct,
  sanToSquares,
} from 'src/components/WCh/data'
import { LabBar, PlayerName, WchBoard } from 'src/components/WCh/ui'

// The guessing starts after the opening book, at 9.h3.
const FIRST = 16

interface Guess {
  ply: number
  san: string
}

/** Illustrative crowd split: a flattened copy of the generic model. */
const crowdFor = (gen: [string, number][], played: string) => {
  const flat = gen.map(([s, p]) => [s, Math.pow(p, 0.7)] as [string, number])
  if (!flat.find(([s]) => s === played)) flat.push([played, 0.05])
  const z = flat.reduce((a, [, p]) => a + p, 0)
  return flat.map(([s, p]) => [s, p / z] as [string, number])
}

const BIG = DEMO_PLIES.filter((p) => p.index >= FIRST && p.think >= 120).map(
  (p) => p.index,
)
const ALL = DEMO_PLIES.filter((p) => p.index >= FIRST).map((p) => p.index)

export default function GuessPage() {
  const [mode, setMode] = useState<'big' | 'all'>('big')
  const [step, setStep] = useState(0)
  const [guesses, setGuesses] = useState<Guess[]>([])
  const sequence = mode === 'big' ? BIG : ALL
  const ply = sequence[step] ?? DEMO_PLIES.length
  const current = DEMO_PLIES[ply]
  const guess = guesses.find((g) => g.ply === ply)

  const dests = useMemo(() => {
    if (!current || guess) return undefined
    const c = new Chess(current.fenBefore)
    const map = new Map<Key, Key[]>()
    c.moves({ verbose: true }).forEach((m) => {
      const list = map.get(m.from as Key) ?? []
      list.push(m.to as Key)
      map.set(m.from as Key, list)
    })
    return map
  }, [current, guess])

  const onMove = (from: string, to: string) => {
    if (!current) return
    const c = new Chess(current.fenBefore)
    const m = c.move({ from, to, promotion: 'q' } as never)
    if (!m) return
    setGuesses((g) => [...g, { ply, san: m.san }])
  }

  const scored = guesses
    .map((g) => ({ g, p: DEMO_PLIES[g.ply] }))
    .filter(({ p }) => !!p)
  const you = scored.filter(({ g, p }) => g.san === p.san).length
  const maia = scored.filter(({ p }) => p.hit).length
  const sf = scored.filter(({ p }) => p.sfHit).length
  const beatMaia = scored.filter(({ g, p }) => g.san === p.san && !p.hit).length

  const shapes: DrawShape[] = []
  if (current && guess) {
    const mine = sanToSquares(current.fenBefore, guess.san)
    const maiaTop = sanToSquares(current.fenBefore, current.pred[0][0])
    if (maiaTop && current.pred[0][0] !== current.san)
      shapes.push({
        orig: maiaTop[0] as Key,
        dest: maiaTop[1] as Key,
        brush: 'maiaSoft',
      })
    if (mine && guess.san !== current.san && guess.san !== current.pred[0][0])
      shapes.push({
        orig: mine[0] as Key,
        dest: mine[1] as Key,
        brush: 'you',
        modifiers: { lineWidth: 6 },
      })
  }

  const mover = current ? PLAYERS[current.mover] : null

  return (
    <>
      <Head>
        <title>Out-guess Maia · WCh lab · Maia Chess</title>
        <meta name="robots" content="noindex" />
      </Head>
      <LabBar />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/45">
              Play along · Game 1
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
              Can you read them better than Maia?
            </h1>
            <div className="mt-3 flex gap-1 text-sm">
              {(
                [
                  ['big', `The big decisions (${BIG.length})`],
                  ['all', `Every move from 9.h3 (${ALL.length})`],
                ] as const
              ).map(([m, t]) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m)
                    setStep(0)
                    setGuesses([])
                  }}
                  className={`rounded-full px-3 py-1 ${
                    mode === m
                      ? 'bg-white/15 text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-stretch gap-2">
            <ScoreTile name="You" v={you} n={scored.length} c="#ffffff" big />
            <ScoreTile
              name="Maia"
              v={maia}
              n={scored.length}
              c={PREDICTOR_COLORS.maia}
            />
            <ScoreTile
              name="Stockfish"
              v={sf}
              n={scored.length}
              c={PREDICTOR_COLORS.stockfish}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_380px]">
          <div
            className="mx-auto w-full"
            style={{ maxWidth: 'min(620px, calc(100vh - 220px))' }}
          >
            {current ? (
              <>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>
                    <PlayerName player={mover!} piece={current.color} /> to play{' '}
                    <span className="font-mono text-white/50">
                      {current.moveNumber}
                      {current.color === 'white' ? '.' : '...'}
                    </span>
                  </span>
                  <span className="text-white/40">
                    guess {step + 1} of {sequence.length}
                  </span>
                </div>
                <div className="overflow-hidden rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
                  <WchBoard
                    key={`${ply}-${guess ? 'r' : 'g'}`}
                    fen={guess ? current.fen : current.fenBefore}
                    lastMove={
                      guess
                        ? current.uci
                        : ply > 0
                          ? DEMO_PLIES[ply - 1].uci
                          : null
                    }
                    orientation="white"
                    dests={dests}
                    turnColor={current.color}
                    onMove={onMove}
                    shapes={shapes}
                  />
                </div>
              </>
            ) : (
              <Summary
                you={you}
                maia={maia}
                sf={sf}
                n={scored.length}
                beat={beatMaia}
              />
            )}
          </div>

          <aside className="flex flex-col gap-4">
            {current && !guess ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-2xl font-semibold leading-tight">
                  What will{' '}
                  <span style={{ color: mover!.color }}>{mover!.short}</span>{' '}
                  play?
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Make the move you think he&apos;ll make. Maia has already
                  locked in its guess. Not the best move: <i>his</i> move.
                </p>
                <div className="mt-4 rounded-lg bg-black/20 p-3 text-xs text-white/50">
                  {current.think >= 120 ? (
                    <>
                      ⏱ He thought for{' '}
                      <b className="text-white/80">
                        {Math.round(current.think / 60)} minutes
                      </b>{' '}
                      here. Something is on his mind.
                    </>
                  ) : (
                    <>⏱ A quick one: {current.think}s on the clock.</>
                  )}
                </div>
              </div>
            ) : null}

            {current && guess ? (
              <Reveal
                ply={ply}
                guess={guess}
                onNext={() => setStep((k) => k + 1)}
              />
            ) : null}

            {/* History */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <p className="px-1 pb-2 text-[11px] uppercase tracking-wider text-white/40">
                Your guesses
              </p>
              {scored.length === 0 ? (
                <p className="px-1 pb-1 text-sm text-white/40">None yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {scored.map(({ g, p }) => {
                    const ok = g.san === p.san
                    return (
                      <span
                        key={g.ply}
                        title={`${p.moveNumber}${p.color === 'white' ? '.' : '...'}${p.san}: you ${g.san}, Maia ${p.pred[0][0]}`}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs ${
                          ok
                            ? 'bg-emerald-400/15 text-emerald-100'
                            : 'bg-white/[0.05] text-white/50'
                        }`}
                      >
                        {p.san}
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: p.hit
                              ? PREDICTOR_COLORS.maia
                              : 'transparent',
                            border: `1px solid ${PREDICTOR_COLORS.maia}`,
                          }}
                        />
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  )
}

const ScoreTile: React.FC<{
  name: string
  v: number
  n: number
  c: string
  big?: boolean
}> = ({ name, v, n, c, big }) => (
  <div
    className={`rounded-xl border px-4 py-2 text-center ${
      big
        ? 'border-white/30 bg-white/[0.07]'
        : 'border-white/10 bg-white/[0.03]'
    }`}
  >
    <p className="text-2xl font-semibold tabular-nums" style={{ color: c }}>
      {v}
      <span className="text-sm text-white/35">/{n}</span>
    </p>
    <p className="text-[11px] text-white/55">{name}</p>
  </div>
)

const Reveal: React.FC<{ ply: number; guess: Guess; onNext: () => void }> = ({
  ply,
  guess,
  onNext,
}) => {
  const p = DEMO_PLIES[ply]
  const ok = guess.san === p.san
  const mover = PLAYERS[p.mover]
  const yourP = p.pred.find(([s]) => s === guess.san)?.[1]
  const crowd = crowdFor(p.gen, p.san)
  const headline = ok
    ? p.hit
      ? 'You and Maia both called it'
      : 'You beat Maia!'
    : p.hit
      ? 'Maia saw it, you didn’t'
      : 'He fooled everyone'
  return (
    <div
      className={`rounded-2xl border p-5 ${
        ok
          ? 'border-emerald-300/30 bg-emerald-400/[0.06]'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-white/45">
        {mover.short} played
      </p>
      <p className="font-mono text-3xl font-bold">
        {p.moveNumber}
        {p.color === 'white' ? '.' : '...'}
        {p.san}
      </p>
      <p
        className={`mt-1 text-lg font-semibold ${ok ? 'text-emerald-200' : 'text-white/80'}`}
      >
        {headline}
      </p>
      <p className="mt-1 text-sm text-white/55">
        You said <b className="font-mono text-white/80">{guess.san}</b>
        {yourP !== undefined
          ? ` (Maia gave it ${pct(yourP)})`
          : ' (not in Maia’s top choices)'}
        .
      </p>

      <div className="mt-4 flex flex-col gap-1.5">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          {mover.short}-Maia vs visitors (illustrative)
        </p>
        {p.pred.slice(0, 4).map(([san, v]) => {
          const cr = crowd.find(([s]) => s === san)?.[1] ?? 0
          return (
            <div
              key={san}
              className="grid grid-cols-[52px_1fr_36px] items-center gap-2 text-sm"
            >
              <span
                className={`font-mono ${san === p.san ? 'font-bold text-white' : 'text-white/60'}`}
              >
                {san}
              </span>
              <div className="flex flex-col gap-0.5">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${v * 100}%`,
                    background: PREDICTOR_COLORS.maia,
                  }}
                />
                <div
                  className="h-1.5 rounded-full bg-white/40"
                  style={{ width: `${cr * 100}%` }}
                />
              </div>
              <span className="text-right text-xs tabular-nums text-white/60">
                {pct(v)}
              </span>
            </div>
          )
        })}
      </div>

      <button
        onClick={onNext}
        className="mt-5 w-full rounded-lg bg-human-3 py-2.5 text-sm font-semibold text-white hover:bg-human-2"
      >
        Next move →
      </button>
    </div>
  )
}

const Summary: React.FC<{
  you: number
  maia: number
  sf: number
  n: number
  beat: number
}> = ({ you, maia, sf, n, beat }) => (
  <div className="flex aspect-square flex-col items-center justify-center rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(254,127,109,0.14),transparent_65%)] p-8 text-center">
    <p className="text-sm uppercase tracking-[0.22em] text-white/45">
      Game 1 · your result
    </p>
    <p className="mt-3 text-6xl font-bold">
      {you}
      <span className="text-2xl text-white/40">/{n}</span>
    </p>
    <p className="mt-3 max-w-sm text-white/70">
      Maia got {maia}, Stockfish&apos;s best move {sf}.
      {beat > 0
        ? ` You called ${beat} move${beat > 1 ? 's' : ''} Maia missed.`
        : ''}
    </p>
    <button className="mt-6 rounded-full bg-white/10 px-5 py-2 text-sm hover:bg-white/15">
      Share result
    </button>
  </div>
)
