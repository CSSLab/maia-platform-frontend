import { useEffect, useRef, useState } from 'react'

import {
  FeedManifest,
  FeedMissing,
  FeedPly,
  Pregame,
  fetchFeed,
  fetchPregame,
  mergePlies,
} from './feed'

/** Between polls while the game is on (the research side asks for 2-5 s). */
const POLL_MS = 3000
/** While the feed isn't there (not live yet, or not for this game). */
const MISSING_MS = 60000
const ERROR_MS = 15000

export interface FeedState {
  /** 'off': no feed for this game (the page uses the browser's engines). */
  status: 'loading' | 'off' | 'on'
  manifest: FeedManifest | null
  plies: Map<number, FeedPly>
  pregame: Pregame | null
}

/**
 * The research side's feed for one game: every ply once, then every few
 * seconds what changed (a new ply, or one rewritten with the own search).
 * Also the pre-game bundle (its name is the game id, or `pregameName`).
 */
export const useWchFeed = (opts: {
  gameId: string | null
  pregameName?: string | null
  /** Stop polling (the game is over and every ply is in). */
  done?: boolean
}): FeedState => {
  const { gameId, pregameName, done } = opts
  const [state, setState] = useState<FeedState>({
    status: 'loading',
    manifest: null,
    plies: new Map(),
    pregame: null,
  })

  const doneRef = useRef(done)
  doneRef.current = done

  useEffect(() => {
    setState({
      status: 'loading',
      manifest: null,
      plies: new Map(),
      pregame: null,
    })
    if (!gameId) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const controller = new AbortController()
    let cursor: string | null = null
    let plies = new Map<number, FeedPly>()

    const poll = async () => {
      let wait = POLL_MS
      try {
        const answer = await fetchFeed(gameId, cursor, controller.signal)
        if (stopped) return
        cursor = answer.cursor
        plies = mergePlies(plies, answer)
        const snapshot = plies
        setState((s) => ({
          ...s,
          status: 'on',
          manifest: answer.manifest ?? s.manifest,
          plies:
            answer.plies.length || snapshot.size !== s.plies.size
              ? snapshot
              : s.plies,
        }))
        if (doneRef.current) return
      } catch (e) {
        if (stopped || controller.signal.aborted) return
        // Without plies yet, any failure means the browser's engines take
        // over; a feed that comes back later takes over again.
        setState((s) => ({ ...s, status: s.plies.size ? s.status : 'off' }))
        wait = e instanceof FeedMissing ? MISSING_MS : ERROR_MS
      }
      if (!stopped) timer = setTimeout(poll, wait)
    }
    void poll()

    const names = [gameId, pregameName].filter(Boolean) as string[]
    void (async () => {
      for (const name of names) {
        try {
          const pregame = await fetchPregame(name, controller.signal)
          if (pregame && !stopped) {
            setState((s) => ({ ...s, pregame }))
            return
          }
        } catch {
          // Try the next name.
        }
      }
    })()

    return () => {
      stopped = true
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [gameId, pregameName])

  return state
}
