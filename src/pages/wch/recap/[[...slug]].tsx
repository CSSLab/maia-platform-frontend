import Head from 'next/head'
import type { GetStaticPaths, GetStaticProps } from 'next'

import { WchRecap } from 'src/components/WCh/RecapPage'
import {
  SITE,
  gameCard,
  gameTitle,
  momentCard,
  recapPath,
} from 'src/components/WCh/cards'
import type { Recap } from 'src/components/WCh/recap'
import { loadRecap } from 'src/lib/wchRecap'

interface Props {
  recap: Recap
  /** The key moment the address names (its ply index), if any. */
  focus: number | null
}

/*
 * /wch/recap: the latest finished game. /wch/recap/3: game 3.
 * /wch/recap/3/45: game 3, scrolled to its moment at ply 45, with that
 * moment's card as the link preview.
 */
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: 'blocking',
})

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const slug = (params?.slug as string[] | undefined) ?? []
  if (slug.length > 2 || slug.some((s) => !/^\d{1,3}$/.test(s)))
    return { notFound: true, revalidate: 60 }
  const n = slug[0] ? Number(slug[0]) : undefined
  const recap = await loadRecap(n)
  if (n && recap.game?.n !== n) return { notFound: true, revalidate: 60 }
  const focus = slug[1] ? Number(slug[1]) : null
  if (focus !== null && !recap.game?.moments.some((m) => m.index === focus))
    return { notFound: true, revalidate: 60 }
  return { props: { recap, focus }, revalidate: 60 }
}

export default function WchRecapPage({ recap, focus }: Props) {
  const g = recap.game
  const m = g?.moments.find((x) => x.index === focus) ?? null
  const title = g
    ? m
      ? `Game ${g.n}, ${m.label}: ${m.headline}`
      : `World Championship Game ${g.n} through Maia's eyes`
    : "The World Championship through Maia's eyes"
  const description = g
    ? m
      ? `${m.stat} ${m.statLabel}. ${m.detail}`
      : `${gameTitle(g)}. The key moments, the match so far, and the openings to drill, from each player's own Maia.`
    : 'Gukesh vs Sindarov through the eyes of Maia, the human-like chess AI.'
  const image = g ? (m ? momentCard(g, m, true) : gameCard(g, true)) : null
  const url = `${SITE}${g ? recapPath(g.n, m ?? undefined) : '/wch/recap'}`
  return (
    <>
      <Head>
        <title>{`${title} – Maia Chess`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        <meta property="og:site_name" content="Maia Chess" />
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
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Head>
      <WchRecap recap={recap} focus={focus} />
    </>
  )
}
