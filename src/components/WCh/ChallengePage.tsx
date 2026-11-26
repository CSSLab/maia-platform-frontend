/*
 * One challenge: can you beat Maia at a given level from a key position of
 * the World Championship? The position, the button to play it, and how the
 * people who tried did (shown once enough of them have).
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { buildPositionPlayLink } from 'src/lib/positionLinks'

import {
  CHALLENGE_LEVELS,
  SITE,
  challengeCard,
  challengePath,
  recapPath,
} from './cards'
import {
  PositionStats,
  fetchPositionStats,
  maiaName,
  winShare,
} from './challenge'
import type { RecapGame, RecapMoment } from './recap'
import { surname } from './recap'
import { ShareButtons, Who } from './RecapPage'
import { WchBoard } from './ui'

const pct = (x: number) => `${Math.round(x * 100)}%`

/** How the people who tried did, or how many more it takes to show it. */
const Results: React.FC<{ stats: PositionStats | null; level: number }> = ({
  stats,
  level,
}) => {
  if (!stats)
    return (
      <p className="text-sm text-white/50">
        Be one of the first to try it. The results show here once enough people
        have played it.
      </p>
    )
  const share = winShare(stats)
  if (!share) {
    const left = Math.max(0, stats.reveal_after - stats.attempts)
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-white/75">
          <span className="font-semibold text-white">{stats.attempts}</span>{' '}
          {stats.attempts === 1 ? 'game' : 'games'} played so far. The results
          show once {stats.reveal_after} have been played:{' '}
          {left === 1 ? 'one more to go' : `${left} more to go`}.
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#fe7f6d]"
            style={{
              width: `${Math.min(100, (stats.attempts / stats.reveal_after) * 100)}%`,
            }}
          />
        </div>
      </div>
    )
  }
  const parts = [
    { key: 'win', label: 'beat Maia', v: share.win, color: '#5fbf8a' },
    {
      key: 'draw',
      label: 'drew',
      v: share.draw,
      color: 'rgba(255,255,255,0.45)',
    },
    { key: 'loss', label: 'lost', v: share.loss, color: '#e2685a' },
  ]
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-white/75">
        <span className="text-3xl font-bold text-white">{pct(share.win)}</span>{' '}
        of {stats.attempts} games against Maia {level} from here were won by the
        human ({stats.players} {stats.players === 1 ? 'player' : 'players'}
        ).
      </p>
      <div className="flex h-3 overflow-hidden rounded-full">
        {parts.map((p) => (
          <div
            key={p.key}
            style={{ width: `${p.v * 100}%`, background: p.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-white/70">
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: p.color }}
            />
            {pct(p.v)} {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export const WchChallenge: React.FC<{
  game: RecapGame
  moment: RecapMoment
  level: number
  stats: PositionStats | null
}> = ({ game, moment: m, level, stats: initial }) => {
  const [stats, setStats] = useState(initial)
  useEffect(() => {
    setStats(initial)
    const ctrl = new AbortController()
    fetchPositionStats(m.fenBefore, level, m.color, ctrl.signal)
      .then((s) => s && setStats(s))
      .catch(() => undefined)
    return () => ctrl.abort()
  }, [m.fenBefore, level, m.color, initial])

  const moveNo = Math.floor(m.index / 2) + 1
  const path = challengePath(game.n, m, level)
  const playHref = buildPositionPlayLink({
    fen: m.fenBefore,
    maiaVersion: maiaName(level),
    forcedPlayerColor: m.color,
    challengeId: `wch-g${game.n}-${m.index}-${level}`,
    returnTo: path,
    modalTitle: `Can you beat Maia ${level}?`,
    modalSubtitle: `World Championship Game ${game.n}, move ${moveNo}: you are ${surname(m.mover)}`,
  })
  const share = stats ? winShare(stats) : null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-8 md:px-6">
      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <div className="w-full shrink-0 md:w-[440px]">
          <WchBoard fen={m.fenBefore} orientation={m.color} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">
              World Championship 2026 · Game {game.n} challenge
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Can you beat Maia {level} from here?
            </h1>
            <p className="text-base text-white/75">
              You are <Who id={m.mover} />, with{' '}
              {m.color === 'white' ? 'White' : 'Black'}, to play move {moveNo}{' '}
              of game {game.n}. Play it out against Maia {level}, an AI that
              plays like a {level}-rated human.
            </p>
            <details className="text-sm text-white/55">
              <summary className="cursor-pointer select-none text-white/65 hover:text-white">
                What did {surname(m.mover)} play here?
              </summary>
              <p className="mt-1.5">
                {m.label}. {m.headline}: {m.stat} {m.statLabel}.
              </p>
            </details>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-white/45">Maia level</p>
            <div className="flex flex-wrap gap-2">
              {CHALLENGE_LEVELS.map((l) => (
                <Link
                  key={l}
                  href={challengePath(game.n, m, l)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    l === level
                      ? 'border-[#fe7f6d] text-white'
                      : 'border-white/15 text-white/65 hover:border-white/30'
                  }`}
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <Link
              href={playHref}
              className="inline-flex items-center gap-2 rounded-full bg-[#fe7f6d]/90 px-6 py-3 text-base font-semibold text-black transition hover:bg-[#fe7f6d]"
            >
              <span className="material-symbols-outlined !text-[20px]">
                swords
              </span>
              Take the challenge
            </Link>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45">
              How people have done
            </p>
            <Results stats={stats} level={level} />
          </div>

          <ShareButtons
            url={`${SITE}${path}`}
            text={
              share
                ? `${pct(share.win)} of players beat Maia ${level} from this World Championship position. Can you?`
                : `Can you beat Maia ${level} from this World Championship position?`
            }
            image={challengeCard(game, m, level, null)}
          />

          <Link
            href={recapPath(game.n, m)}
            className="text-sm text-white/55 hover:text-white"
          >
            ← Game {game.n} through Maia&apos;s eyes
          </Link>
        </div>
      </div>
    </div>
  )
}
