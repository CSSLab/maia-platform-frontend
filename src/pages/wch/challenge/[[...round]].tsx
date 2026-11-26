import Head from 'next/head'
import Link from 'next/link'
import type { GetStaticPaths, GetStaticProps } from 'next'
import { useEffect, useRef, useState } from 'react'

import {
  CHALLENGE_LEVEL,
  SITE,
  challengeCard,
  challengesCard,
  challengePath,
} from 'src/components/WCh/cards'
import {
  PositionStats,
  fetchPositionStats,
  loadPositionStats,
  maiaName,
  winShare,
} from 'src/components/WCh/challenge'
import {
  Challenge,
  ChallengePosition,
  WCH_CHALLENGES,
  challengeId,
  challengePosition,
} from 'src/components/WCh/challenges'
import { PLAYERS, PlayerId } from 'src/components/WCh/data'
import { surname } from 'src/components/WCh/recap'
import { ChallengeShareModal } from 'src/components/WCh/ChallengeShare'
import { WchBoard } from 'src/components/WCh/ui'
import { ChallengeTally, readChallengeTallies } from 'src/lib/challengeProgress'
import { buildPositionPlayLink } from 'src/lib/positionLinks'
import { loadRecap } from 'src/lib/wchRecap'

interface Item {
  challenge: Challenge
  pos: ChallengePosition
  /** How everyone did against Maia at CHALLENGE_LEVEL. */
  stats: PositionStats | null
  /** The game's players. */
  white: PlayerId
  black: PlayerId
}

interface Props {
  items: Item[]
  /** The round the address names (/wch/challenge/3), if any. */
  focus: number | null
}

/*
 * /wch/challenge: every round's Maia Challenge. /wch/challenge/3: the same
 * page, opened at round 3, with its card as the link preview (the link to
 * send friends).
 */
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: 'blocking',
})

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const slug = (params?.round as string[] | undefined) ?? []
  if (slug.length > 1 || (slug[0] && !/^\d{1,2}$/.test(slug[0])))
    return { notFound: true, revalidate: 60 }
  const focus = slug[0] ? Number(slug[0]) : null
  if (focus !== null && !WCH_CHALLENGES.some((c) => c.round === focus))
    return { notFound: true, revalidate: 60 }
  const recap = await loadRecap()
  const items: Item[] = []
  for (const c of WCH_CHALLENGES) {
    const g = recap.games.find((x) => x.n === c.round)
    const pos = g ? challengePosition(c, g.pgn) : null
    if (!pos) continue
    const stats = await loadPositionStats(pos.fen, CHALLENGE_LEVEL, pos.color)
    items.push({ challenge: c, pos, stats, white: g!.white, black: g!.black })
  }
  if (focus !== null && !items.some((i) => i.challenge.round === focus))
    return { notFound: true, revalidate: 60 }
  return { props: { items, focus }, revalidate: 60 }
}

const GREEN = '#5fbf8a'

/** Text with each player's name in his colour, and moves kept whole. */
const Named: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text
      .split(/(Gukesh|Sindarov|\d+\.(?:\.\.|…)?\s?[KQRBNa-hO][\w+#=-]*)/)
      .map((part, i) =>
        part === 'Gukesh' || part === 'Sindarov' ? (
          <span
            key={i}
            style={{
              color: PLAYERS[part === 'Gukesh' ? 'gukesh' : 'sindarov'].color,
            }}
          >
            {part}
          </span>
        ) : i % 2 ? (
          <span key={i} className="whitespace-nowrap">
            {part}
          </span>
        ) : (
          part
        ),
      )}
  </>
)

/**
 * How everyone did against the default Maia, in a line: only once the
 * results are out (the API holds them back until enough games are in).
 */
const Everyone: React.FC<{ stats: PositionStats | null }> = ({ stats }) => {
  const share = stats ? winShare(stats) : null
  if (!share || !stats) return null
  return (
    <p className="text-sm text-white/55">
      Everyone vs Maia {CHALLENGE_LEVEL}: {Math.round(share.win * 100)}% won,{' '}
      {stats.attempts} games
    </p>
  )
}

const ChallengeCard: React.FC<{
  item: Item
  tally: ChallengeTally | undefined
  focused: boolean
  onShare: () => void
}> = ({ item, tally, focused, onShare }) => {
  const { challenge: c, pos } = item
  const [stats, setStats] = useState(item.stats)
  useEffect(() => {
    const ctrl = new AbortController()
    fetchPositionStats(pos.fen, CHALLENGE_LEVEL, pos.color, ctrl.signal)
      .then((s) => s && setStats(s))
      .catch(() => undefined)
    return () => ctrl.abort()
  }, [pos.fen, pos.color])

  const side = pos.color === 'white' ? 'White' : 'Black'

  // The board's drawn width, for the banner and the caption.
  const boardRef = useRef<HTMLDivElement>(null)
  const [boardWidth, setBoardWidth] = useState<number | null>(null)
  useEffect(() => {
    const wrap = boardRef.current
    if (!wrap) return
    let ro: ResizeObserver | null = null
    let raf = 0
    const attach = () => {
      const cg = wrap.querySelector('cg-container')
      if (!cg) {
        raf = window.requestAnimationFrame(attach)
        return
      }
      ro = new ResizeObserver(() =>
        setBoardWidth(cg.getBoundingClientRect().width),
      )
      ro.observe(cg)
    }
    attach()
    return () => {
      window.cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [])
  const playHref = buildPositionPlayLink({
    fen: pos.fen,
    maiaVersion: maiaName(CHALLENGE_LEVEL),
    forcedPlayerColor: pos.color,
    challengeId: challengeId(c.round),
    returnTo: challengePath(c.round),
    modalTitle: `Maia Challenge: World Championship 2026, Game ${c.round}`,
    modalSubtitle: `${c.title} You're ${surname(c.you)}, playing ${side}.`,
  })
  const beaten = tally?.beaten ?? []

  return (
    <article
      id={`r${c.round}`}
      className={`flex scroll-mt-24 flex-col overflow-hidden rounded-xl border bg-white/[0.02] ${
        focused ? 'border-[#fe7f6d]/70' : 'border-white/10'
      }`}
    >
      {/* The board shrinks on short screens, so the page fits on one. */}
      <div
        className="w-full px-3 pt-3"
        style={{ maxWidth: 'max(220px, calc(100vh - 560px))' }}
      >
        {/* The board's width (it rounds its size down to whole squares). */}
        <p
          className="mb-2 flex items-center gap-1.5 text-base font-semibold text-[#fe7f6d]"
          style={{ width: boardWidth ?? '100%' }}
        >
          <span className="material-symbols-outlined !text-[17px]">swords</span>
          Game {c.round} Challenge
        </p>
        <div ref={boardRef}>
          <WchBoard
            fen={pos.fen}
            orientation={pos.color}
            lastMove={pos.lastMove}
            coordinates={false}
          />
        </div>
        <p
          className="mt-1.5 text-xs text-white/55"
          style={{ width: boardWidth ?? '100%' }}
        >
          <Named
            text={`${surname(item.white)} – ${surname(item.black)}, Game ${c.round}, World Championship 2026`}
          />
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-3 pb-3 pt-2">
        <h2 className="text-lg font-semibold leading-snug text-white">
          <Named text={c.title} />
        </h2>
        <p className="text-[15px] leading-snug text-white/70">
          <Named text={c.setup} />
        </p>
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <Link
            href={playHref}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#fe7f6d] px-4 py-2 text-base font-semibold text-black transition hover:brightness-110"
          >
            <span className="material-symbols-outlined !text-[20px]">
              swords
            </span>
            Play Challenge {c.round}
          </Link>
          <Everyone stats={stats} />
        </div>
      </div>
      <div className="flex h-14 items-center justify-between gap-3 border-t border-white/10 px-3">
        {beaten.length ? (
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black"
              style={{ background: GREEN }}
            >
              <span className="material-symbols-outlined !text-[26px] !font-bold">
                check
              </span>
            </span>
            <span
              className="text-[15px] font-semibold"
              style={{ color: GREEN }}
            >
              {c.pass === 'draw' ? 'You held' : 'You beat'} Maia{' '}
              {beaten.join(', ')}
            </span>
          </div>
        ) : (
          <span className="text-[15px] text-white/65">
            {tally?.tries
              ? `Tried ${tally.tries} ${tally.tries === 1 ? 'time' : 'times'}`
              : 'Not tried yet'}
          </span>
        )}
        <button
          type="button"
          onClick={onShare}
          className="flex shrink-0 items-center gap-1 text-sm text-white/65 transition hover:text-white"
        >
          <span className="material-symbols-outlined !text-[16px]">link</span>
          Share
        </button>
      </div>
    </article>
  )
}

export default function WchChallenges({ items, focus }: Props) {
  const [tallies, setTallies] = useState<Record<string, ChallengeTally>>({})
  // The challenge whose share dialog is open.
  const [sharing, setSharing] = useState<number | null>(null)
  const sharingTally = sharing ? tallies[challengeId(sharing)] : undefined
  useEffect(() => {
    const load = () => setTallies(readChallengeTallies())
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])
  useEffect(() => {
    if (focus !== null)
      document
        .getElementById(`r${focus}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focus])
  const done = items.filter(
    (i) => tallies[challengeId(i.challenge.round)]?.beaten?.length,
  ).length

  const focused = items.find((i) => i.challenge.round === focus)
  const title = focused
    ? `Maia Challenge: ${focused.challenge.title} World Championship 2026, Game ${focused.challenge.round}`
    : 'Maia Challenges: World Championship 2026'
  const description = focused
    ? `You're ${surname(focused.challenge.you)}. ${focused.challenge.setup}`
    : 'Play key positions from the World Championship against Maia at the level you choose.'
  const url = `${SITE}${focused ? challengePath(focused.challenge.round) : '/wch/challenge'}`
  const image = focused
    ? challengeCard(focused.challenge, focused.pos, true)
    : challengesCard(items, true)

  return (
    <>
      <Head>
        <title>{`${title} – Maia Chess`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {image ? (
          <>
            <meta key="og:image" property="og:image" content={image} />
            <meta key="og:image:url" property="og:image:url" content={image} />
            <meta
              key="og:image:secure_url"
              property="og:image:secure_url"
              content={image}
            />
            <meta key="og:image:alt" property="og:image:alt" content={title} />
            <meta key="twitter:image" name="twitter:image" content={image} />
            <meta
              key="twitter:image:src"
              name="twitter:image:src"
              content={image}
            />
            <meta
              key="twitter:image:alt"
              name="twitter:image:alt"
              content={title}
            />
          </>
        ) : null}
      </Head>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-8 pt-4 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <div className="flex flex-col gap-1">
            <p className="text-xl font-semibold text-[#fe7f6d] md:text-2xl">
              World Championship 2026
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Maia Challenges
            </h1>
            <p className="text-base text-white/70">
              Play key positions from the match against Maia at the level you
              choose.
            </p>
          </div>
          <p className="text-sm text-white/60">
            <span className="font-semibold text-white">{done}</span> of{' '}
            {items.length} completed
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ChallengeCard
              key={item.challenge.round}
              item={item}
              tally={tallies[challengeId(item.challenge.round)]}
              focused={item.challenge.round === focus}
              onShare={() => setSharing(item.challenge.round)}
            />
          ))}
        </div>
      </div>
      {sharing !== null ? (
        <ChallengeShareModal
          round={sharing}
          game={sharingTally?.best ?? sharingTally?.last ?? null}
          tallies={tallies}
          onClose={() => setSharing(null)}
        />
      ) : null}
    </>
  )
}
