import { useEffect, useRef, useState } from 'react'

import {
  getBroadcastRoundPGN,
  getBroadcastRoundThinkTimes,
  getLichessBroadcastById,
  streamBroadcastRound,
} from 'src/api/broadcasts'

import type { BroadcastRound } from 'src/types'

import {
  LiveGame,
  WCH_TOUR_ID,
  isOurGame,
  parseLiveGame,
  splitGames,
} from './live'

export type LiveStatus = 'loading' | 'waiting' | 'live' | 'finished' | 'error'

export interface LiveState {
  status: LiveStatus
  game: LiveGame | null
  roundName: string | null
  /** When the round starts, epoch ms (if Lichess says). */
  startsAt: number | null
  /**
   * When the last move was made, epoch ms: from Lichess's think time when
   * the page opens, then when the stream brings each move.
   */
  lastMoveAt: number | null
  error: string | null
}

/** After the stream ends or fails mid-game, how long before reconnecting. */
const RECONNECT_MS = 20000
const RATE_LIMITED_MS = 60000
const MAX_BACKOFF_MS = 300000
/** An upcoming game is shown (rather than the last one) this long before. */
const SOON_MS = 3 * 3600 * 1000

/** Lichess may write castling as the king taking its rook (e1h1). */
const castleUci: Record<string, string> = {
  e1h1: 'e1g1',
  e1a1: 'e1c1',
  e8h8: 'e8g8',
  e8a8: 'e8c8',
}
export const sameUci = (a: string, b: string) =>
  (castleUci[a] ?? a).slice(0, 4) === (castleUci[b] ?? b).slice(0, 4)

/**
 * The match's game from the Lichess broadcast, kept up to date: the round
 * is the one given (`round`), else the round on now, else the next one, else
 * the last. One PGN fetch, then the round's stream (one connection per page,
 * reconnecting while the game goes on).
 */
export const useWchLive = (opts: {
  enabled: boolean
  round?: string | null
  game?: string | null
}): LiveState => {
  const { enabled, round, game } = opts
  const [state, setState] = useState<LiveState>({
    status: 'loading',
    game: null,
    roundName: null,
    startsAt: null,
    lastMoveAt: null,
    error: null,
  })
  const movesSeen = useRef(-1)
  const lastGame = useRef<LiveGame | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const controller = new AbortController()
    let retry: ReturnType<typeof setTimeout> | null = null

    const apply = (pgn: string) => {
      const ours = splitGames(pgn).find((g) => isOurGame(g, game))
      if (!ours) return false
      const parsed = parseLiveGame(ours)
      if (!parsed || cancelled) return false
      const grew = parsed.moves.length > movesSeen.current
      movesSeen.current = parsed.moves.length
      lastGame.current = parsed
      setState((s) => ({
        ...s,
        game: parsed,
        status:
          parsed.result !== '*'
            ? 'finished'
            : parsed.moves.length
              ? 'live'
              : 'waiting',
        lastMoveAt:
          grew && parsed.moves.length ? Date.now() : (s.lastMoveAt ?? null),
        error: null,
      }))
      return parsed.result !== '*'
    }

    // Waits between attempts: doubling from RECONNECT_MS up to 5 minutes,
    // and at least a minute after Lichess says 429 (too many requests).
    let failures = 0
    const backoff = (error?: unknown) => {
      const limited = error instanceof Error && /\b429\b/.test(error.message)
      const ms = Math.min(
        MAX_BACKOFF_MS,
        Math.max(limited ? RATE_LIMITED_MS : 0, RECONNECT_MS * 2 ** failures),
      )
      failures += 1
      return ms
    }

    // Once, when the page opens: how long he's been thinking already (the
    // page only sees moves made from now on). Kept only if Lichess's last
    // move is still the one on the board.
    let askedThinkTime = false
    const fetchThinkTime = async (roundId: string) => {
      askedThinkTime = true
      const g = lastGame.current
      const last = g?.moves[g.moves.length - 1]
      if (!g?.gameId || !last || g.result !== '*') return
      try {
        const asked = Date.now()
        const id = g.gameId
        const t = (await getBroadcastRoundThinkTimes(roundId))[id]
        const now = lastGame.current
        if (
          cancelled ||
          !t ||
          !sameUci(t.lastMove, last.uci) ||
          now?.moves.length !== g.moves.length
        )
          return
        setState((s) => ({ ...s, lastMoveAt: asked - t.thinkTime * 1000 }))
      } catch {
        // Without it, the clock counts from when the page opened.
      }
    }

    const follow = async (roundId: string) => {
      let finished = false
      try {
        finished = apply(await getBroadcastRoundPGN(roundId))
        failures = 0
        if (!finished && !askedThinkTime) fetchThinkTime(roundId)
      } catch (e) {
        if (cancelled) return
        setState((s) => ({
          ...s,
          status: s.game ? s.status : 'error',
          error: e instanceof Error ? e.message : String(e),
        }))
        retry = setTimeout(() => follow(roundId), backoff(e))
        return
      }
      if (finished || cancelled) return
      let streamError: unknown
      let heard = false
      try {
        await streamBroadcastRound(
          roundId,
          (pgn) => {
            heard = true
            if (apply(pgn)) controller.abort()
          },
          () => undefined,
          controller.signal,
        )
      } catch (e) {
        streamError = e
      }
      if (heard) failures = 0
      if (!cancelled && !controller.signal.aborted)
        retry = setTimeout(() => follow(roundId), backoff(streamError))
    }

    const start = async () => {
      let roundId = round ?? null
      let roundName: string | null = null
      let startsAt: number | null = null
      if (!roundId) {
        const tour = await getLichessBroadcastById(WCH_TOUR_ID)
        // Lichess also sends `finished` (not in the site's type).
        const rounds = (tour?.rounds ?? []) as (BroadcastRound & {
          finished?: boolean
        })[]
        // The game on now; else the next one if it starts within 3 hours;
        // else the last one played (to review); else the first to come.
        const now = Date.now()
        const upcoming = rounds.filter((r) => !r.finished && !r.ongoing)
        const pick =
          rounds.find((r) => r.ongoing) ??
          upcoming.find((r) => (r.startsAt ?? 0) - now < SOON_MS) ??
          [...rounds].reverse().find((r) => r.finished) ??
          upcoming[0] ??
          rounds[0]
        roundId = pick?.id ?? null
        roundName = pick?.name ?? null
        startsAt = pick?.startsAt ?? null
      }
      if (cancelled) return
      if (!roundId) {
        setState((s) => ({
          ...s,
          status: s.game ? s.status : 'error',
          error: 'Lichess has no round for the match right now',
        }))
        retry = setTimeout(start, backoff())
        return
      }
      setState((s) => ({ ...s, roundName, startsAt }))
      follow(roundId)
    }

    start()
    return () => {
      cancelled = true
      controller.abort()
      if (retry) clearTimeout(retry)
    }
  }, [enabled, round, game])

  return state
}
