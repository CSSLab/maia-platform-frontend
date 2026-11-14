import {
  HumanBarCachedResponse,
  HumanBarProfile,
  HumanBarRequest,
  HumanBarResponse,
} from 'src/types'

/** The bars of a few positions take well under a second; allow for a busy server. */
export const HUMAN_BAR_REQUEST_TIMEOUT_MS = 60000
/** How long a player's Lichess profile may take before the bars go on without the players' form. */
export const LICHESS_PROFILE_TIMEOUT_MS = 5000

/**
 * Base URL of the human bars, without a trailing slash: the Maia backend's
 * /api/v1/human-bars (the site reaches it through its own /api), set in
 * NEXT_PUBLIC_HUMAN_BAR_URL; development builds fall back to the local mock
 * (src/pages/api/human-bar-mock). Null means the feature is off.
 */
export const getHumanBarBaseUrl = (): string | null => {
  const configured = process.env.NEXT_PUBLIC_HUMAN_BAR_URL
  if (configured) return configured.replace(/\/+$/, '')
  if (process.env.NODE_ENV !== 'production') return '/api/human-bar-mock'
  return null
}

const LICHESS_USERNAME = /^[A-Za-z0-9_-]{1,30}$/

/**
 * A player's form as the bars need it, from their Lichess profile: their
 * rated games in each time class and when their account was created. The
 * browser asks Lichess itself (one request, from the visitor's own address)
 * and sends these few fields; the server never calls Lichess. An account
 * Lichess does not know (closed) is `{ unknown: true }`; null when the
 * profile could not be fetched (the bars then use heads without form).
 */
export const fetchLichessProfile = async (
  username: string,
): Promise<HumanBarProfile | null> => {
  if (!LICHESS_USERNAME.test(username)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LICHESS_PROFILE_TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}`,
      { headers: { Accept: 'application/json' }, signal: controller.signal },
    )
    if (res.status === 404) return { unknown: true }
    if (!res.ok) return null
    const user = (await res.json()) as {
      createdAt?: number
      disabled?: boolean
      perfs?: Record<string, { games?: number } | undefined>
    }
    if (user.disabled) return { unknown: true }
    if (typeof user.createdAt !== 'number') return null
    const games = (perf: string) => Number(user.perfs?.[perf]?.games ?? 0)
    return {
      games: {
        bullet: games('bullet'),
        blitz: games('blitz'),
        rapid: games('rapid'),
        classical: games('classical'),
      },
      created_ms: user.createdAt,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * An error answer from /v1/bars. A 4xx other than 429 means the server
 * refuses these inputs (400: a game it cannot read; 409: a Maia file or
 * engine its bars are not trained on), so asking again will not help.
 */
export class HumanBarServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'HumanBarServerError'
  }

  get refused(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 429
  }
}

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const baseUrl = getHumanBarBaseUrl()
  if (!baseUrl) throw new Error('The human bars are not configured')

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    HUMAN_BAR_REQUEST_TIMEOUT_MS,
  )
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      let reason = detail.slice(0, 200)
      try {
        const parsed = JSON.parse(detail) as { detail?: string; error?: string }
        reason = parsed.detail ?? parsed.error ?? reason
      } catch {
        // not JSON: keep the text
      }
      throw new HumanBarServerError(
        `Human-bar server error ${res.status}${reason ? `: ${reason}` : ''}`,
        res.status,
      )
    }
    return (await res.json()) as T
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `The human-bar server did not answer within ${HUMAN_BAR_REQUEST_TIMEOUT_MS / 1000} s`,
      )
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export const fetchHumanBars = async (
  body: HumanBarRequest,
): Promise<HumanBarResponse> => {
  const data = await post<HumanBarResponse>('/v1/bars', body)
  if (!data || !Array.isArray(data.plies)) {
    throw new Error('Unexpected response from the human-bar server')
  }
  return data
}

/**
 * What earlier visits computed for this game with these players' form (the
 * server keeps each game's bars for a week, per form): its plies can be shown
 * at once. Empty when there is nothing, or the cache cannot be reached.
 */
export const fetchCachedHumanBars = async (
  body: Pick<HumanBarRequest, 'game' | 'engine' | 'maia_model'>,
): Promise<HumanBarCachedResponse | null> => {
  try {
    const data = await post<HumanBarCachedResponse>('/v1/cached', body)
    return data && Array.isArray(data.plies) ? data : null
  } catch {
    return null
  }
}
