/*
 * How people do in a position challenge: every finished game started from
 * the position, against that Maia, as that side (the backend counts them;
 * the results stay hidden until enough people have tried).
 */
import { buildUrl } from 'src/api/utils'

export interface PositionStats {
  attempts: number
  players: number
  reveal_after: number
  results: { wins: number; draws: number; losses: number } | null
}

const isStats = (v: unknown): v is PositionStats => {
  const s = v as PositionStats
  return (
    !!s &&
    typeof s.attempts === 'number' &&
    typeof s.players === 'number' &&
    typeof s.reveal_after === 'number' &&
    (s.results === null ||
      (typeof s.results?.wins === 'number' &&
        typeof s.results?.draws === 'number' &&
        typeof s.results?.losses === 'number'))
  )
}

export const maiaName = (level: number) => `maia_kdd_${level}`

const query = (fen: string, level: number, color: 'white' | 'black') =>
  new URLSearchParams({
    fen,
    maia_name: maiaName(level),
    player_color: color,
  }).toString()

/** From the browser, through the site's API proxy. */
export const fetchPositionStats = async (
  fen: string,
  level: number,
  color: 'white' | 'black',
  signal?: AbortSignal,
): Promise<PositionStats | null> => {
  const res = await fetch(
    buildUrl(`play/position_stats?${query(fen, level, color)}`),
    { signal, cache: 'no-store' },
  )
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  return isStats(data) ? data : null
}

const API =
  process.env.MAIA_API_SERVER_URL?.replace(/\/$/, '') ??
  'https://dock2.csslab.ca/api/v1'

/** On the server (for the link preview), straight to the API. */
export const loadPositionStats = async (
  fen: string,
  level: number,
  color: 'white' | 'black',
): Promise<PositionStats | null> => {
  try {
    const res = await fetch(
      `${API}/play/position_stats?${query(fen, level, color)}`,
      {
        headers: { 'user-agent': 'maiachess-challenge' },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    return isStats(data) ? data : null
  } catch {
    return null
  }
}

/** "31%" of players beat Maia, and how many that is. */
export const winShare = (s: PositionStats) =>
  s.results && s.attempts
    ? {
        win: s.results.wins / s.attempts,
        draw: s.results.draws / s.attempts,
        loss: s.results.losses / s.attempts,
      }
    : null
