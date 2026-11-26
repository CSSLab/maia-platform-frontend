import Head from 'next/head'
import type { GetStaticPaths, GetStaticProps } from 'next'

import { WchChallenge } from 'src/components/WCh/ChallengePage'
import {
  CHALLENGE_LEVEL,
  CHALLENGE_LEVELS,
  SITE,
  challengeCard,
  challengePath,
} from 'src/components/WCh/cards'
import {
  PositionStats,
  loadPositionStats,
  winShare,
} from 'src/components/WCh/challenge'
import type { RecapGame, RecapMoment } from 'src/components/WCh/recap'
import { surname } from 'src/components/WCh/recap'
import { loadRecap } from 'src/lib/wchRecap'

interface Props {
  game: RecapGame
  moment: RecapMoment
  level: number
  stats: PositionStats | null
}

/*
 * /wch/challenge/3/45: can you beat Maia (1900) from game 3's key moment at
 * ply 45? /wch/challenge/3/45/1500: at another level.
 */
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: 'blocking',
})

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const slug = (params?.slug as string[] | undefined) ?? []
  if (
    slug.length < 2 ||
    slug.length > 3 ||
    slug.some((s) => !/^\d{1,4}$/.test(s))
  )
    return { notFound: true, revalidate: 60 }
  const [n, index] = slug.map(Number)
  const level = slug[2] ? Number(slug[2]) : CHALLENGE_LEVEL
  if (!CHALLENGE_LEVELS.includes(level))
    return { notFound: true, revalidate: 60 }
  const recap = await loadRecap(n)
  const game = recap.game?.n === n ? recap.game : null
  const moment = game?.moments.find((m) => m.index === index)
  if (!game || !moment) return { notFound: true, revalidate: 60 }
  const stats = await loadPositionStats(moment.fenBefore, level, moment.color)
  // Only what the page needs (the whole recap is much bigger).
  return {
    props: { game: { ...game, moments: [moment] }, moment, level, stats },
    revalidate: 60,
  }
}

export default function WchChallengePage({
  game,
  moment: m,
  level,
  stats,
}: Props) {
  const share = stats ? winShare(stats) : null
  const title = `Can you beat Maia ${level} from here? World Championship Game ${game.n}`
  const description = share
    ? `${Math.round(share.win * 100)}% of ${stats?.attempts} games against Maia ${level} from this position were won by the human. You are ${surname(m.mover)}, to play move ${Math.floor(m.index / 2) + 1}.`
    : `You are ${surname(m.mover)}, to play move ${Math.floor(m.index / 2) + 1} of game ${game.n}. Play it out against Maia ${level}, an AI that plays like a ${level}-rated human.`
  const image = challengeCard(
    game,
    m,
    level,
    share
      ? {
          stat: `${Math.round(share.win * 100)}%`,
          statLabel: `of ${stats?.attempts} tries beat Maia ${level}`,
        }
      : null,
    true,
  )
  const url = `${SITE}${challengePath(game.n, m, level)}`
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
        <meta key="og:image" property="og:image" content={image} />
        <meta key="og:image:url" property="og:image:url" content={image} />
        <meta
          key="og:image:secure_url"
          property="og:image:secure_url"
          content={image}
        />
        <meta key="og:image:alt" property="og:image:alt" content={title} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
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
      </Head>
      <WchChallenge game={game} moment={m} level={level} stats={stats} />
    </>
  )
}
