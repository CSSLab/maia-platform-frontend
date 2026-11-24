import Head from 'next/head'
import Link from 'next/link'
import React from 'react'

import { DIRECTIONS, LabBar } from 'src/components/WCh/ui'

const NOTES: Record<string, { works: string; changed: string; next: string }> =
  {
    oracle: {
      works:
        'Round 2: Game 1 as it will look (Sindarov–Gukesh). You lock in a guess; then Maia and the other visitors appear; then the move lands and everyone is scored.',
      changed:
        "One screen down to 1366×768: board, human-chances graph, players with photos and flags, a move list with Maia's rank and the eval, and the guess panel.",
      next: 'Needs a guesses endpoint and the per-move outputs (Maia, Stockfish, bar) computed once on the server.',
    },
    odds: {
      works:
        'A newspaper voice: a headline written from the human bar. The coral wedge between the human edge and the engine is "the human factor".',
      changed:
        'Dropped the stacked White/draw/Black ribbon: on a 0-100% scale a drawish game is a flat grey block. The edge chart magnifies what matters.',
      next: 'Headlines need writing per game (by hand, or drafted from the bar). Strong as a daily recap.',
    },
    prep: {
      works:
        'The icicle "skyline" shows the whole predicted repertoire at once and makes departures from generic play findable.',
      changed:
        'Started as Miller columns, which read like a file browser. Collapsed them to one "next choice" list next to the board.',
      next: "Best before each round, and for the novelty watch once a game leaves both players' histories.",
    },
    tape: {
      works:
        'The clock race against each player\'s usual curve makes "Gukesh gets short of time" visible move by move.',
      changed:
        'Fixed the usual-pace curves to include the increment (they were wrong). Added "What the clock is worth": the same bar with clocks swapped, which only Maia can show.',
      next: 'Works as a side panel on the live page rather than a page of its own.',
    },
    guess: {
      works:
        'Turns watching into playing: you against Maia against Stockfish, on the real moves.',
      changed:
        'Defaulted to the big decisions (2+ minute thinks): 24 guesses in a row was a chore. Your guess now draws in grey (blue is the computer), and the board shows the real move after you guess.',
      next: 'The most shareable. A crowd split needs real visitor guesses (shown here as illustrative).',
    },
  }

export default function WchLabIndex() {
  return (
    <>
      <Head>
        <title>WCh lab · Maia Chess</title>
        <meta name="robots" content="noindex" />
      </Head>
      <LabBar />
      <main className="mx-auto w-full max-w-[1100px] px-4 pb-20 pt-10 md:px-6">
        <p className="text-xs uppercase tracking-[0.24em] text-human-2">
          World Championship 2026 · Gukesh vs Sindarov
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          Five ways to watch the match with Maia
        </h1>
        <p className="mt-4 max-w-2xl text-white/60">
          Design prototypes for a Maia-first World Championship page. All use
          one illustrative game (a Closed Ruy Lopez, not played by these two)
          with hand-set model outputs. The aggregate numbers (accuracy, clocks,
          repertoire, opening departures) come from the strong-players brief.
        </p>
        <div className="mt-10 flex flex-col gap-4">
          {DIRECTIONS.map((d) => {
            const n = NOTES[d.slug]
            return (
              <Link
                key={d.slug}
                href={`/wch/lab/${d.slug}`}
                className="group grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/25 hover:bg-white/[0.04] md:grid-cols-[260px_1fr]"
              >
                <div>
                  <p className="text-sm text-white/40">Direction {d.n}</p>
                  <h2 className="mt-0.5 text-2xl font-semibold group-hover:text-human-1">
                    {d.name}
                  </h2>
                  <p className="mt-2 text-sm text-white/60">{d.pitch}</p>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-emerald-200/70">
                      What works
                    </dt>
                    <dd className="mt-1 leading-6 text-white/70">{n.works}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-amber-200/70">
                      What I changed
                    </dt>
                    <dd className="mt-1 leading-6 text-white/70">
                      {n.changed}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-white/45">
                      Where it goes
                    </dt>
                    <dd className="mt-1 leading-6 text-white/70">{n.next}</dd>
                  </div>
                </dl>
              </Link>
            )
          })}
        </div>
      </main>
    </>
  )
}
