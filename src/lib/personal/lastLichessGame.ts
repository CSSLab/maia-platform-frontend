import { readJson, writeJson } from './storage'
import { queueLichessRequest } from 'src/lib/lichessQueue'

/**
 * The visitor's most recent finished Lichess game (standard chess), for the
 * "Your last game" card. One request, shared by everything on the page and
 * kept for the browser session; asked again at most every RECHECK_MS, and
 * then only for games newer than the one kept (`since`), so a new game shows
 * up without fetching the old one again. Lichess serves one request at a time
 * per address and a 429 costs a minute, so after one it isn't asked again for
 * that long.
 */
export interface LastLichessGame {
  id: string
  pgn: string
  userColor: 'white' | 'black'
  userRating?: number
  opponentRating?: number
  /** bullet, blitz, rapid... */
  speed?: string
  result?: 'win' | 'loss' | 'draw'
  createdAt: number
  lastMoveAt: number
}

export const RECHECK_MS = 15 * 60 * 1000
const RATE_LIMIT_PAUSE_MS = 70 * 1000
const STANDARD_PERFS = 'ultraBullet,bullet,blitz,rapid,classical,correspondence'
const storageKey = (lichessId: string) =>
  `maia.lastLichessGame.v1:${lichessId.toLowerCase()}`

interface Kept {
  game: LastLichessGame | null
  checkedAt: number
}

let inFlight: {
  lichessId: string
  request: Promise<LastLichessGame | null>
} | null = null
let pausedUntil = 0

/* eslint-disable @typescript-eslint/no-explicit-any */
export const parseLichessGameJson = (
  data: any,
  lichessId: string,
): LastLichessGame | null => {
  if (!data || typeof data.id !== 'string' || typeof data.pgn !== 'string') {
    return null
  }
  if (data.variant && data.variant !== 'standard') return null
  const me = lichessId.toLowerCase()
  const white = data.players?.white
  const black = data.players?.black
  const userColor =
    white?.user?.id === me ? 'white' : black?.user?.id === me ? 'black' : null
  if (!userColor) return null
  const user = userColor === 'white' ? white : black
  const opponent = userColor === 'white' ? black : white
  const result = !data.winner
    ? data.status === 'draw' || data.status === 'stalemate'
      ? 'draw'
      : undefined
    : data.winner === userColor
      ? 'win'
      : 'loss'
  return {
    id: data.id,
    pgn: data.pgn,
    userColor,
    userRating: typeof user?.rating === 'number' ? user.rating : undefined,
    opponentRating:
      typeof opponent?.rating === 'number' ? opponent.rating : undefined,
    speed: typeof data.speed === 'string' ? data.speed : undefined,
    result,
    createdAt: Number(data.createdAt) || 0,
    lastMoveAt: Number(data.lastMoveAt) || Number(data.createdAt) || 0,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const requestNewestGame = async (
  lichessId: string,
  since?: number,
): Promise<LastLichessGame | null | 'unchanged'> => {
  const params = new URLSearchParams({
    max: '1',
    pgnInJson: 'true',
    perfType: STANDARD_PERFS,
    clocks: 'false',
    evals: 'false',
  })
  if (since) params.set('since', String(since))
  const { status, body } = await queueLichessRequest(async () => {
    const res = await fetch(
      `https://lichess.org/api/games/user/${encodeURIComponent(lichessId)}?${params}`,
      { headers: { Accept: 'application/x-ndjson' } },
    )
    return { status: res.status, body: res.ok ? await res.text() : '' }
  })
  if (status === 429) {
    pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS
    throw new Error('Lichess rate limit')
  }
  if (status !== 200) throw new Error(`Lichess games: HTTP ${status}`)
  const line = body.split(/\r?\n/).find((l) => l.trim())
  if (!line) return since ? 'unchanged' : null
  return parseLichessGameJson(JSON.parse(line), lichessId)
}

/**
 * The last game, from this session's copy when it was checked recently.
 * Resolves to null when the visitor has no finished standard game; rejects
 * when Lichess couldn't be asked and nothing is kept.
 */
export const fetchLastLichessGame = (
  lichessId: string,
  now = Date.now(),
): Promise<LastLichessGame | null> => {
  const key = storageKey(lichessId)
  const kept = readJson<Kept>('session', key)
  if (kept && (now - kept.checkedAt < RECHECK_MS || now < pausedUntil)) {
    return Promise.resolve(kept.game)
  }
  if (inFlight && inFlight.lichessId === lichessId) return inFlight.request
  if (now < pausedUntil) {
    return Promise.reject(new Error('Lichess rate limit'))
  }

  const request = requestNewestGame(
    lichessId,
    kept?.game ? kept.game.createdAt + 1 : undefined,
  )
    .then((found) => {
      const game = found === 'unchanged' ? (kept?.game ?? null) : found
      writeJson('session', key, { game, checkedAt: Date.now() } as Kept)
      return game
    })
    .catch((error) => {
      if (kept) return kept.game
      throw error
    })
    .finally(() => {
      inFlight = null
    })
  inFlight = { lichessId, request }
  return request
}

/**
 * The visitor's recent finished standard games (up to `max`), one request.
 * For "Practice your mistakes", which asks once a day; shares the pause
 * after a rate limit.
 */
export const fetchRecentLichessGames = async (
  lichessId: string,
  max = 10,
): Promise<LastLichessGame[]> => {
  if (Date.now() < pausedUntil) throw new Error('Lichess rate limit')
  const params = new URLSearchParams({
    max: String(max),
    pgnInJson: 'true',
    perfType: STANDARD_PERFS,
    clocks: 'false',
    evals: 'false',
  })
  const { status, body } = await queueLichessRequest(async () => {
    const res = await fetch(
      `https://lichess.org/api/games/user/${encodeURIComponent(lichessId)}?${params}`,
      { headers: { Accept: 'application/x-ndjson' } },
    )
    return { status: res.status, body: res.ok ? await res.text() : '' }
  })
  if (status === 429) {
    pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS
    throw new Error('Lichess rate limit')
  }
  if (status !== 200) throw new Error(`Lichess games: HTTP ${status}`)
  return body
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => parseLichessGameJson(JSON.parse(line), lichessId))
    .filter((game): game is LastLichessGame => !!game)
}
