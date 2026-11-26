/*
 * The recap's data, read on the server from the research feed (the page is
 * rebuilt at most once a minute, so visitors never call the feed for it).
 */
import type { Pregame } from 'src/components/WCh/feed'
import {
  FeedGameInput,
  RECAP_GAMES,
  Recap,
  buildRecap,
} from 'src/components/WCh/recap'

const FEED =
  process.env.WCH_FEED_SERVER_URL?.replace(/\/$/, '') ??
  'https://dock2.csslab.ca/api/v1/wch'

const get = async <T>(path: string): Promise<T | null> => {
  try {
    const res = await fetch(`${FEED}${path}`, {
      headers: { 'user-agent': 'maiachess-recap' },
      signal: AbortSignal.timeout(15000),
    })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

export const loadRecap = async (focus?: number): Promise<Recap> => {
  const [pregame, ...games] = await Promise.all([
    get<Pregame>('/v1/pregame/gukesh_sindarov_g1'),
    ...RECAP_GAMES.map((g) =>
      get<Omit<FeedGameInput, 'n' | 'id'>>(
        `/v1/live/${encodeURIComponent(g.id)}`,
      ),
    ),
  ])
  const inputs: FeedGameInput[] = []
  RECAP_GAMES.forEach((g, i) => {
    const a = games[i]
    if (a?.plies) inputs.push({ ...a, n: g.n, id: g.id })
  })
  return buildRecap(inputs, pregame, focus)
}
