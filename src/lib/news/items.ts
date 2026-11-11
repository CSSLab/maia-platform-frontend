import { NewsItem } from 'src/types'

// The headlines of the homepage's news box, shown in this order: put the most
// important first. To announce something, add a line here; a blog post gets a
// line too, with its page as `href`.
//
// `href` is optional: a page of the site ("/blog/practice-mode") or a full URL.
export const NEWS_ITEMS: NewsItem[] = [
  {
    date: '2026-11-11',
    title: 'A big update to Maia Chess: what\u2019s new across the site',
    href: '/blog/2026-november-update',
  },
  {
    date: '2026-11-11',
    title: 'Practice mode: play Maia with takebacks and extra time',
    href: '/blog/practice-mode',
  },
  {
    date: '2026-11-11',
    title: 'A faster analysis page, with Stockfish 19',
    href: '/blog/faster-analysis',
  },
  {
    date: '2026-11-11',
    title: 'An improved rating system',
    href: '/blog/rating-system',
  },
  {
    date: '2025-07-10',
    title: 'Introducing Maia Platform v1',
    href: '/blog/platform-v1',
  },
  {
    date: '2024-10-18',
    title: 'Beta Testing Maia Chess v0',
    href: '/blog/platform-v0',
  },
  {
    date: '2020-08-24',
    title: 'Introducing Maia: a Human-Like Chess Engine',
    href: '/blog/maia-v1',
  },
]
