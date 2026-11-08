import { fetchMaiaGameList } from 'src/api/analysis'
import { fetchPlayerStats } from 'src/api/profile'
import { buildUrl } from 'src/api/utils'
import { PlayerStats } from 'src/types'
import { localDay, previousDay } from './storage'

/**
 * The "Your progress" strip's data: Maia ratings per mode (auth/
 * get_player_stats) and games played in the last 7 days (the first page of
 * each game list, analysis/user/list). A rating trend needs a rating history
 * the backend doesn't serve yet: it stays off (RATING_TREND_ENABLED) until
 * it does, and nothing is made up in its place.
 */
export const RATING_TREND_ENABLED =
  process.env.NEXT_PUBLIC_RATING_TREND === 'true'

// The size of a game list page (analysis/user/list).
const LIST_PAGE_SIZE = 25

export interface ModeRating {
  mode: 'play' | 'hand' | 'brain' | 'puzzles' | 'bot_or_not'
  label: string
  rating: number
  games: number
}

export interface DayGames {
  /** The local day, YYYY-MM-DD. */
  day: string
  games: number
}

export interface Progress {
  ratings: ModeRating[]
  /** Games against Maia (all modes) in the last 7 days, today included. */
  gamesThisWeek: number
  /** The same games by day, the oldest first, today last. */
  days: DayGames[]
  /** At least that many: a full page of games was all from this week. */
  gamesThisWeekAtLeast: boolean
}

export const ratingsFromStats = (stats: PlayerStats): ModeRating[] =>
  (
    [
      ['play', 'vs Maia', stats.regularRating, stats.regularGames],
      ['hand', 'Hand', stats.handRating, stats.handGames],
      ['brain', 'Brain', stats.brainRating, stats.brainGames],
      ['puzzles', 'Puzzles', stats.trainRating, stats.trainGames],
      ['bot_or_not', 'Bot or Not', stats.botNotRating, stats.botNotGames],
    ] as const
  )
    // A mode never played has only the starting rating.
    .filter(([, , rating, games]) => Number.isFinite(rating) && games > 0)
    .map(([mode, label, rating, games]) => ({
      mode,
      label,
      rating: Math.round(rating),
      games,
    }))

let statsRequest: { at: number; request: Promise<PlayerStats> } | null = null

/** The visitor's stats, one request for the page's cards in a minute. */
const sharedPlayerStats = () => {
  if (!statsRequest || Date.now() - statsRequest.at > 60_000) {
    const request = fetchPlayerStats()
    request.catch(() => {
      statsRequest = null
    })
    statsRequest = { at: Date.now(), request }
  }
  return statsRequest.request
}

export const fetchProgress = async (now = Date.now()): Promise<Progress> => {
  const [stats, ...lists] = await Promise.all([
    sharedPlayerStats(),
    ...(['play', 'hand', 'brain'] as const).map((type) =>
      fetchMaiaGameList(type, 1).catch(() => ({ games: [] })),
    ),
  ])
  // The last 7 local days, today included.
  const dayKeys = [localDay(now)]
  while (dayKeys.length < 7) dayKeys.unshift(previousDay(dayKeys[0]))
  const perDay = new Map(dayKeys.map((day) => [day, 0]))
  let gamesThisWeek = 0
  let gamesThisWeekAtLeast = false
  for (const list of lists) {
    const games: { created_time?: string }[] = Array.isArray(list?.games)
      ? list.games
      : []
    let recent = 0
    for (const game of games) {
      const time = Date.parse(game.created_time ?? '')
      if (!Number.isFinite(time)) continue
      const day = localDay(time)
      if (!perDay.has(day)) continue
      perDay.set(day, (perDay.get(day) ?? 0) + 1)
      recent += 1
    }
    gamesThisWeek += recent
    if (recent === LIST_PAGE_SIZE) gamesThisWeekAtLeast = true
  }
  return {
    ratings: ratingsFromStats(stats),
    gamesThisWeek,
    days: dayKeys.map((day) => ({ day, games: perDay.get(day) ?? 0 })),
    gamesThisWeekAtLeast,
  }
}

export interface RatingPoint {
  /** ISO date. */
  date: string
  rating: number
}

/**
 * A mode's rating history, from an endpoint the backend doesn't have yet
 * (auth/get_rating_history/<mode>, proposed). Only asked when
 * RATING_TREND_ENABLED; resolves to null when it isn't served.
 */
export const fetchRatingHistory = async (
  mode: ModeRating['mode'],
): Promise<RatingPoint[] | null> => {
  if (!RATING_TREND_ENABLED) return null
  const res = await fetch(buildUrl(`auth/get_rating_history/${mode}`))
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  return Array.isArray(data?.points) ? (data.points as RatingPoint[]) : null
}
