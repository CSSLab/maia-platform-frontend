import Link from 'next/link'
import { useContext } from 'react'

import { NewsItem } from 'src/types'
import { AuthContext } from 'src/contexts/AuthContext'
import { trackHomepageNewsClicked } from 'src/lib/analytics'
import { formatNewsDate, isExternalLink } from 'src/lib/news/format'

interface Props {
  news: NewsItem[]
  className?: string
}

const ROW_CLASS = 'flex items-baseline gap-3 px-4 py-2'
const LINK_CLASS = `group ${ROW_CLASS} transition-colors duration-300 hover:bg-white/[0.04]`

const Headline = ({ item }: { item: NewsItem }) => {
  const { user } = useContext(AuthContext)

  const body = (
    <>
      <time
        dateTime={item.date}
        className="w-[5.5rem] shrink-0 whitespace-nowrap text-xs tabular-nums text-white/50"
      >
        {formatNewsDate(item.date)}
      </time>
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-white/90 transition-colors duration-300 group-hover:text-white">
        {item.title}
      </span>
    </>
  )

  if (!item.href) {
    return <div className={ROW_CLASS}>{body}</div>
  }

  const onClick = () =>
    trackHomepageNewsClicked(item.title, item.href as string, !!user?.lichessId)

  if (isExternalLink(item.href)) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        onClick={onClick}
        className={LINK_CLASS}
      >
        {body}
      </a>
    )
  }

  return (
    <Link href={item.href} onClick={onClick} className={LINK_CLASS}>
      {body}
    </Link>
  )
}

/**
 * The homepage's news box: the headlines, in the order given, in a list that
 * scrolls inside the box. It stands under the introduction, as tall as its
 * place there (the caller gives it a height); on phones it comes after the
 * feature cards, a few headlines tall.
 */
export const HomeNews = ({ news, className = '' }: Props) => {
  if (news.length === 0) return null

  return (
    <section
      aria-labelledby="home-news-title"
      className={`relative overflow-hidden rounded-lg border border-glass-border text-left backdrop-blur-md ${className}`}
    >
      {/* Under the introduction the box takes its height from its place, not
          from its list, so the list is laid over the box and scrolls within
          it. */}
      <div className="flex flex-col md:absolute md:inset-0">
        <div className="flex items-baseline justify-between px-4 pb-1.5 pt-3">
          <h2
            id="home-news-title"
            className="text-xs font-medium uppercase tracking-wider text-white/60"
          >
            News
          </h2>
          <Link
            href="/blog"
            className="text-xs text-white/50 transition-colors duration-300 hover:text-white/90"
          >
            Blog
          </Link>
        </div>
        {/* The last 1.5rem fade out, to show the list goes on; the list ends
            with as much room, so its last headline scrolls clear of the fade. */}
        <ul className="max-h-36 min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto pb-5 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)] [scrollbar-color:rgb(255_255_255/0.18)_transparent] [scrollbar-width:thin] md:max-h-none">
          {news.map((item, index) => (
            <li key={`${item.date}-${index}`}>
              <Headline item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
