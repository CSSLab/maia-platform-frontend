import {
  HumanBarFormResponse,
  HumanBarGameInfo,
  HumanBarRequest,
  HumanBarResponse,
} from 'src/types'

/** /v1/bars can take up to about a minute on old games of active players. */
export const HUMAN_BAR_REQUEST_TIMEOUT_MS = 180000

/**
 * Base URL of the human-bar server, without a trailing slash. Set
 * NEXT_PUBLIC_HUMAN_BAR_URL; development builds fall back to the local mock
 * (src/pages/api/human-bar-mock). Null means the feature is off.
 */
export const getHumanBarBaseUrl = (): string | null => {
  const configured = process.env.NEXT_PUBLIC_HUMAN_BAR_URL
  if (configured) return configured.replace(/\/+$/, '')
  if (process.env.NODE_ENV !== 'production') return '/api/human-bar-mock'
  return null
}

/**
 * Tells the server a game is coming (POST /v1/prepare) so it can start its
 * slow lookups while the browser computes the evals. Fire and forget.
 */
export const prepareHumanBars = (game: HumanBarGameInfo): void => {
  const baseUrl = getHumanBarBaseUrl()
  if (!baseUrl) return
  fetch(`${baseUrl}/v1/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game }),
  }).catch(() => undefined)
}

/**
 * Waits for the server to finish fetching the players' recent games (POST
 * /v1/form; it answers within about two minutes): the players' form its
 * bars use from then on, and whether it is still waiting.
 */
export const waitForHumanBarForm = async (
  game: HumanBarGameInfo,
): Promise<HumanBarFormResponse> => {
  const baseUrl = getHumanBarBaseUrl()
  if (!baseUrl) throw new Error('The human-bar server is not configured')
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    HUMAN_BAR_REQUEST_TIMEOUT_MS,
  )
  try {
    const res = await fetch(`${baseUrl}/v1/form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Human-bar server error ${res.status}`)
    return (await res.json()) as HumanBarFormResponse
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

export const fetchHumanBars = async (
  body: HumanBarRequest,
): Promise<HumanBarResponse> => {
  const baseUrl = getHumanBarBaseUrl()
  if (!baseUrl) throw new Error('The human-bar server is not configured')

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    HUMAN_BAR_REQUEST_TIMEOUT_MS,
  )
  try {
    const res = await fetch(`${baseUrl}/v1/bars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      let reason = detail.slice(0, 200)
      try {
        reason = (JSON.parse(detail) as { error?: string }).error ?? reason
      } catch {
        // not JSON: keep the text
      }
      throw new HumanBarServerError(
        `Human-bar server error ${res.status}${reason ? `: ${reason}` : ''}`,
        res.status,
      )
    }
    const data = (await res.json()) as HumanBarResponse
    if (!data || !Array.isArray(data.plies)) {
      throw new Error('Unexpected response from the human-bar server')
    }
    return data
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
