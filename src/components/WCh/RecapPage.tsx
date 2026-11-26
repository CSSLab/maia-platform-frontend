/*
 * The recap page: the latest game through Maia's eyes (its key moments, each
 * one playable and shareable), the match so far, the openings to drill, and
 * what the players' own models expect next.
 */
import Link from 'next/link'
import type { Key } from 'chessground/types'
import { useEffect, useState } from 'react'

import {
  buildAnalysisPositionLink,
  buildPositionDrillLink,
} from 'src/lib/positionLinks'

import { PLAYERS, PlayerId } from './data'
import { RATING_KEYS } from './feed'
import { SITE, challengePath, gameTitle, momentCard, recapPath } from './cards'
import type { Recap, RecapGame, RecapMoment } from './recap'
import { surname } from './recap'
import { WchBoard } from './ui'

const MAIA = '#fe7f6d'

const pct = (x: number) =>
  x < 0.01 ? '<1%' : x > 0.99 ? '>99%' : `${Math.round(x * 100)}%`

const Section: React.FC<{
  id: string
  kicker: string
  title: string
  children: React.ReactNode
}> = ({ id, kicker, title, children }) => (
  <section id={id} className="flex flex-col gap-4">
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">
        {kicker}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-white md:text-2xl">
        {title}
      </h2>
    </div>
    {children}
  </section>
)

export const Who: React.FC<{ id: PlayerId }> = ({ id }) => (
  <span className="font-medium" style={{ color: PLAYERS[id].color }}>
    {surname(id)}
  </span>
)

const resultLine = (g: RecapGame) =>
  g.result === '1-0' ? (
    <>
      <Who id={g.white} /> beat <Who id={g.black} />
    </>
  ) : g.result === '0-1' ? (
    <>
      <Who id={g.black} /> beat <Who id={g.white} />
    </>
  ) : (
    <>
      <Who id={g.white} /> and <Who id={g.black} /> drew
    </>
  )

/** The played move's chance at each rating, as five small bars. */
const Ratings: React.FC<{ values: number[] }> = ({ values }) => {
  const max = Math.max(...values, 0.01)
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="flex h-10 w-full items-end rounded-sm bg-white/[0.05]">
            <div
              className="w-full rounded-sm"
              style={{
                height: `${Math.max(4, (v / max) * 100)}%`,
                background: 'rgb(254 127 109 / 0.55)',
              }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-white/70">
            {pct(v)}
          </span>
          <span className="text-[10px] text-white/40">{RATING_KEYS[i]}</span>
        </div>
      ))}
    </div>
  )
}

export const ShareButtons: React.FC<{
  url: string
  text: string
  image: string
}> = ({ url, text, image }) => {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copy this link', url)
    }
  }
  const tweet = `https://twitter.com/intent/tweet?${new URLSearchParams({
    text,
    url,
  }).toString()}`
  const btn =
    'inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/30 hover:text-white'
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className={btn}>
        <span className="material-symbols-outlined !text-[16px]">link</span>
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <a href={tweet} target="_blank" rel="noreferrer" className={btn}>
        <span className="material-symbols-outlined !text-[16px]">
          arrow_outward
        </span>
        Post on X
      </a>
      <a href={image} target="_blank" rel="noreferrer" className={btn}>
        <span className="material-symbols-outlined !text-[16px]">download</span>
        Image
      </a>
    </div>
  )
}

const MomentCard: React.FC<{
  game: RecapGame
  m: RecapMoment
  focused: boolean
}> = ({ game, m, focused }) => {
  const analyzeHref = buildAnalysisPositionLink({
    fen: m.fenBefore,
    name: `WCh Game ${game.n}, before ${m.label}`,
  })
  return (
    <article
      id={`m-${m.index}`}
      className={`flex flex-col gap-4 rounded-2xl border bg-white/[0.02] p-4 md:flex-row md:p-5 ${
        focused ? 'border-[#fe7f6d]/60' : 'border-white/10'
      }`}
    >
      <div className="w-full shrink-0 md:w-[300px]">
        <WchBoard
          fen={m.fenBefore}
          orientation={m.color}
          coordinates={false}
          shapes={[
            {
              orig: m.uci.slice(0, 2) as Key,
              dest: m.uci.slice(2, 4) as Key,
              brush: 'maia',
            },
          ]}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="text-xs text-white/45">
            {m.label} · <Who id={m.mover} />
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            {m.headline}
          </h3>
        </div>
        <div className="flex items-baseline gap-3">
          <span
            className="text-4xl font-bold tabular-nums"
            style={{ color: MAIA }}
          >
            {m.stat}
          </span>
          <span className="text-sm text-white/70">{m.statLabel}</span>
        </div>
        <p className="text-sm text-white/60">{m.detail}</p>
        {m.ratings ? (
          <div className="max-w-sm">
            <p className="mb-1.5 text-[11px] text-white/45">
              How likely players at each rating are to play {m.san}
            </p>
            <Ratings values={m.ratings} />
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Link
            href={challengePath(game.n, m)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#fe7f6d]/90 px-4 py-2 text-sm font-medium text-black transition hover:bg-[#fe7f6d]"
          >
            <span className="material-symbols-outlined !text-[18px]">
              swords
            </span>
            Can you beat Maia from here?
          </Link>
          <Link
            href={analyzeHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white/85 transition hover:border-white/30"
          >
            <span className="material-symbols-outlined !text-[18px]">
              analytics
            </span>
            Analyze
          </Link>
        </div>
        <ShareButtons
          url={`${SITE}${recapPath(game.n, m)}`}
          text={`World Championship Game ${game.n}, ${m.label}: ${m.headline.toLowerCase()}. ${m.stat} ${m.statLabel}.`}
          image={momentCard(game, m)}
        />
      </div>
    </article>
  )
}

const CalledBar: React.FC<{ value: number; total: number; color: string }> = ({
  value,
  total,
  color,
}) => (
  <div className="flex items-center gap-2">
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full"
        style={{
          width: `${total ? (value / total) * 100 : 0}%`,
          background: color,
        }}
      />
    </div>
    <span className="tabular-nums text-white/80">
      {value}/{total}
    </span>
  </div>
)

/** The match so far: one row per game, then each player's totals. */
const MatchStrip: React.FC<{ recap: Recap }> = ({ recap }) => {
  const totals = (['gukesh', 'sindarov'] as PlayerId[]).map((id) => {
    const mine = recap.games.flatMap((g) => g.sides.filter((s) => s.id === id))
    return {
      id,
      maia: mine.reduce((a, s) => a + s.maia, 0),
      stockfish: mine.reduce((a, s) => a + s.stockfish, 0),
      moves: mine.reduce((a, s) => a + s.moves, 0),
    }
  })
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {totals.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
          >
            <p className="text-sm">
              <Who id={t.id} />{' '}
              <span className="text-white/50">
                · {recap.score[t.id]} point{recap.score[t.id] === 1 ? '' : 's'}
              </span>
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">
              {t.moves ? pct(t.maia / t.moves) : '-'}
            </p>
            <p className="text-xs text-white/55">
              of his moves were Maia{surname(t.id)}&apos;s first choice (
              {t.maia} of {t.moves}). Stockfish&apos;s best:{' '}
              {t.moves ? pct(t.stockfish / t.moves) : '-'}.
            </p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-white/45">
            <tr className="border-b border-white/10">
              <th className="px-3 py-2 font-normal">Game</th>
              <th className="px-3 py-2 font-normal">Result</th>
              <th className="px-3 py-2 font-normal">Own model called</th>
              <th className="px-3 py-2 font-normal">Riskiest moment</th>
              <th className="px-3 py-2 font-normal">Longest think</th>
            </tr>
          </thead>
          <tbody>
            {recap.games.map((g) => (
              <tr key={g.n} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-2.5">
                  <Link
                    href={recapPath(g.n)}
                    className="text-white underline-offset-2 hover:underline"
                  >
                    Game {g.n}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-white/80">
                  {g.result.replace('1/2-1/2', '½-½')}{' '}
                  <span className="text-white/45">in {g.moves}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    {g.sides.map((s) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <span
                          className="w-16 text-xs"
                          style={{ color: PLAYERS[s.id].color }}
                        >
                          {surname(s.id)}
                        </span>
                        <CalledBar
                          value={s.maia}
                          total={s.moves}
                          color={PLAYERS[s.id].color}
                        />
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-white/80">
                  {g.peakRisk ? (
                    <>
                      {pct(g.peakRisk.risk)}{' '}
                      <span className="text-white/45">
                        {surname(g.peakRisk.who)}, {g.peakRisk.label}
                      </span>
                    </>
                  ) : (
                    <span className="text-white/45">none worth a mention</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-white/80">
                  {g.longestThink ? (
                    <>
                      {Math.round(g.longestThink.seconds / 60)} min{' '}
                      <span className="text-white/45">
                        {surname(g.longestThink.who)}, {g.longestThink.label}
                      </span>
                    </>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
            {recap.live ? (
              <tr>
                <td className="px-3 py-2.5">
                  <Link href="/wch" className="text-white hover:underline">
                    Game {recap.live.n}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-white/60" colSpan={4}>
                  In progress, move {recap.live.moves}.{' '}
                  <Link href="/wch" className="text-[#fe7f6d] hover:underline">
                    Follow it live with Maia
                  </Link>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const Openings: React.FC<{ games: RecapGame[] }> = ({ games }) => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {games.map((g) => (
      <div
        key={g.n}
        className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
      >
        <div>
          <p className="text-xs text-white/45">
            Game {g.n} · <Who id={g.white} /> with White
          </p>
          <p className="mt-1.5 font-mono text-[13px] leading-6 text-white/85">
            {g.opening}
          </p>
          <p className="mt-1.5 text-xs text-white/55">
            {g.inTree > 0
              ? `The first ${g.inTree} move${g.inTree === 1 ? '' : 's'} followed the lines Maia${surname(g.white)} expected from his past games.`
              : `It left the lines Maia${surname(g.white)} expected from move 1.`}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Link
            href={buildPositionDrillLink({
              fen: g.openingFen,
              name: `WCh Game ${g.n}: ${g.opening.split(' ').slice(0, 6).join(' ')}`,
            })}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/15"
          >
            <span className="material-symbols-outlined !text-[16px]">
              school
            </span>
            Drill this opening
          </Link>
          <Link
            href={buildAnalysisPositionLink({
              fen: g.openingFen,
              name: `WCh Game ${g.n}`,
              pgn: g.pgn,
            })}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/30"
          >
            <span className="material-symbols-outlined !text-[16px]">
              analytics
            </span>
            Analyze the game
          </Link>
        </div>
      </div>
    ))}
  </div>
)

const LookaheadView: React.FC<{ recap: Recap }> = ({ recap }) => {
  const la = recap.lookahead
  if (!la) return null
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-sm text-white/70">
          <Who id={la.white} />
          &apos;s first move, by his own model
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {la.firstMoves.map((m) => (
            <div key={m.san} className="flex items-center gap-3">
              <span className="w-10 font-mono text-sm text-white">
                1.{m.san}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${m.p * 100}%`,
                    background: PLAYERS[la.white].color,
                  }}
                />
              </div>
              <span className="w-10 text-right text-sm tabular-nums text-white/75">
                {pct(m.p)}
              </span>
            </div>
          ))}
        </div>
        {la.played.length ? (
          <p className="mt-3 text-xs text-white/55">
            With White in this match:{' '}
            {la.played.map((p, i) => (
              <span key={p.n}>
                {i ? '; ' : ''}
                game {p.n}, <span className="font-mono">{p.first}</span>
              </span>
            ))}
            .
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-sm text-white/70">
          The likeliest lines, from both players&apos; own models
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {la.lines.map((l) => (
            <div
              key={l.san}
              className="flex items-center justify-between gap-3"
            >
              <span className="font-mono text-[13px] text-white/85">
                {l.san}
              </span>
              <span className="text-xs tabular-nums text-white/50">
                {pct(l.p)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-white/45">
          From each player&apos;s past games, not his preparation for this
          match: the models know his habits, not his files.
        </p>
      </div>
    </div>
  )
}

export const WchRecap: React.FC<{ recap: Recap; focus?: number | null }> = ({
  recap,
  focus = null,
}) => {
  const g = recap.game
  useEffect(() => {
    if (focus === null) return
    document
      .getElementById(`m-${focus}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focus])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 pb-16 pt-8 md:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">
          World Championship 2026 · Gukesh vs Sindarov
        </p>
        <h1 className="text-3xl font-bold text-white md:text-4xl">
          {g
            ? `Game ${g.n} through Maia's eyes`
            : 'The match through Maia’s eyes'}
        </h1>
        {g ? (
          <p className="text-base text-white/75">
            {resultLine(g)} in {g.moves} moves. The match stands at{' '}
            <Who id="gukesh" /> {recap.score.gukesh}, <Who id="sindarov" />{' '}
            {recap.score.sindarov}.
          </p>
        ) : null}
        <p className="max-w-3xl text-sm leading-6 text-white/55">
          Maia learns to play like people, not like an engine. Here each player
          has his own Maia, trained on his past games, so we can ask what he was
          likely to play, how often players at every rating would find his
          moves, and how often people win the positions he reached.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/wch"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#fe7f6d]/90 px-4 py-2 text-sm font-medium text-black transition hover:bg-[#fe7f6d]"
          >
            <span className="material-symbols-outlined !text-[18px]">
              live_tv
            </span>
            Follow the match live with Maia
          </Link>
          {recap.games.map((x) => (
            <Link
              key={x.n}
              href={recapPath(x.n)}
              className={`inline-flex items-center rounded-full border px-3 py-2 text-sm transition ${
                x.n === g?.n
                  ? 'border-white/40 text-white'
                  : 'border-white/15 text-white/70 hover:border-white/30'
              }`}
            >
              Game {x.n}
            </Link>
          ))}
        </div>
      </header>

      {g ? (
        <Section
          id="moments"
          kicker={gameTitle(g)}
          title="The key moments, and you can play them"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {g.sides.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/70"
              >
                Maia{surname(s.id)} called{' '}
                <span className="font-semibold text-white">
                  {s.maia} of {s.moves}
                </span>{' '}
                of <Who id={s.id} />
                &apos;s moves; Stockfish&apos;s best was his move {
                  s.stockfish
                }{' '}
                times.
              </div>
            ))}
          </div>
          {g.moments.map((m) => (
            <MomentCard
              key={m.index}
              game={g}
              m={m}
              focused={m.index === focus}
            />
          ))}
        </Section>
      ) : null}

      <Section id="match" kicker="Games 1 to date" title="The match so far">
        <MatchStrip recap={recap} />
      </Section>

      {recap.games.length ? (
        <Section
          id="openings"
          kicker="Your turn"
          title="Drill the openings they played"
        >
          <Openings games={recap.games} />
        </Section>
      ) : null}

      {recap.lookahead ? (
        <Section
          id="next"
          kicker={`Game ${recap.lookahead.n}`}
          title={`What to expect: ${surname(recap.lookahead.white)} has White`}
        >
          <LookaheadView recap={recap} />
        </Section>
      ) : null}
    </div>
  )
}
