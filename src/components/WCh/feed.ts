/*
 * The research side's World Championship feed, as the site's API serves it
 * (GET /api/v1/wch/v1/...). One file per position: ply N is the position
 * after N half-moves, with the players' own Maia models on it, Stockfish,
 * Maia's win chances and the blunder risk; its `played` is the move that
 * led to it, scored from the position before. Evals and bars are from
 * White's side; times in seconds.
 */
import { Chess } from 'chess.ts'

import { buildUrl } from 'src/api/utils'

import type { Mark, PlayerId } from './data'
import type { LiveGame, LiveMove } from './live'

export interface FeedMove {
  uci: string
  san: string
  /** The mover's own model (the "elite" column). */
  p_elite: number
  /** Maia at a typical 2750 (generic). */
  p_generic?: number | null
  /** The own model after its own search (~10 s later; pk_ready). */
  p_elite_pk?: number | null
  /** Stockfish, centipawns from White's side, after this move. */
  sf_cp?: number | null
}

export interface FeedPly {
  ply: number
  side: 'white' | 'black'
  fen: string
  clock_white_s?: number | null
  clock_black_s?: number | null
  think_s?: number | null
  moves: FeedMove[]
  /** Maia's chances from here: White, draw, Black. */
  wdl_maia?: [number, number, number] | null
  sf_eval_cp?: number | null
  sf_wp?: number | null
  maia_best?: string | null
  sf_best?: string | null
  /** The mover's chance of a blunder here (0-1). */
  blunder_risk?: number | null
  think_pred?: { median_s: number; p90_s: number } | null
  pk_ready?: boolean
  played?: {
    uci: string
    san: string
    p_elite: number
    rank_elite: number
    was_top: boolean
    p_generic?: number | null
    sf_best?: string | null
    sf_best_played?: boolean | null
  } | null
  /** The played move's probability at each rating. */
  p_by_rating?: Record<string, number> | null
  grade?: string | null
  called?: Record<
    string,
    { maia: number; stockfish: number; moves: number }
  > | null
  terminal?: unknown
  updated_utc?: string
}

export interface FeedManifest {
  game_id: string
  players?: { white?: string; black?: string }
  result?: string
  plies?: number
  updated_utc?: string
}

interface FeedAnswer {
  game_id: string
  manifest: FeedManifest | null
  plies: FeedPly[]
  last_ply: number
  cursor: string
}

/** The usual blunder risk (%) by phase (plies played: "0-19", "20-39", ...). */
export interface Pregame {
  version?: string
  players?: Record<
    string,
    {
      card?: { latest_rating?: number }
      usual_blunder_risk?: {
        by_phase?: Record<string, { usual_risk_pct: number }>
      }
    }
  >
}

const FEED_BASE =
  process.env.NEXT_PUBLIC_WCH_FEED_URL?.replace(/\/$/, '') ?? buildUrl('wch')

export class FeedMissing extends Error {}

export const fetchFeed = async (
  gameId: string,
  since: string | null,
  signal?: AbortSignal,
): Promise<FeedAnswer> => {
  const q = since ? `?${new URLSearchParams({ since })}` : ''
  const res = await fetch(
    `${FEED_BASE}/v1/live/${encodeURIComponent(gameId)}${q}`,
    { signal },
  )
  if (res.status === 404) throw new FeedMissing('No feed for this game')
  if (!res.ok) throw new Error(`The feed answered ${res.status}`)
  return res.json()
}

export const fetchPregame = async (
  name: string,
  signal?: AbortSignal,
): Promise<Pregame | null> => {
  const res = await fetch(
    `${FEED_BASE}/v1/pregame/${encodeURIComponent(name)}`,
    { signal },
  )
  if (!res.ok) return null
  return res.json()
}

/** The newest of each ply, without any above lastPly (a move taken back). */
export const mergePlies = (
  had: Map<number, FeedPly>,
  answer: Pick<FeedAnswer, 'plies' | 'last_ply'>,
) => {
  const out = new Map(had)
  answer.plies.forEach((p) => {
    if (typeof p?.ply === 'number' && typeof p.fen === 'string')
      out.set(p.ply, p)
  })
  Array.from(out.keys()).forEach((k) => {
    if (k > answer.last_ply) out.delete(k)
  })
  return out
}

/** The move list from the feed alone (when there's no broadcast to follow). */
export const feedGame = (
  gameId: string,
  manifest: FeedManifest | null,
  plies: Map<number, FeedPly>,
  ids: { white: PlayerId; black: PlayerId },
): LiveGame | null => {
  const start = plies.get(0)
  if (!start) return null
  const moves: LiveMove[] = []
  for (let n = 1; plies.has(n) && plies.has(n - 1); n++) {
    const before = plies.get(n - 1)!
    const after = plies.get(n)!
    const uci = after.played?.uci
    if (!uci) break
    let san = after.played?.san ?? uci
    try {
      const m = new Chess(before.fen).move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      } as never)
      if (!m) break
      san = m.san
    } catch {
      break
    }
    const color = before.side
    moves.push({
      index: n - 1,
      moveNumber: Math.floor((n - 1) / 2) + 1,
      color,
      san,
      uci,
      fenBefore: before.fen,
      fen: after.fen,
      clock:
        (color === 'white' ? after.clock_white_s : after.clock_black_s) ?? null,
      eval: null,
      think: after.think_s ?? 0,
    })
  }
  return {
    gameId,
    white: ids.white,
    black: ids.black,
    whiteName: manifest?.players?.white ?? '',
    blackName: manifest?.players?.black ?? '',
    // The manifest may carry the result early (a replay): it counts once
    // the last position is terminal.
    result:
      manifest?.result && plies.get(moves.length)?.terminal
        ? manifest.result
        : '*',
    timeControl: '40/7200:20/3600:900+30',
    moves,
  }
}

export const RATING_KEYS = ['1500', '1800', '2100', '2400', '2700']

/** Only ? and ?? for now: !? and ?! aren't priced at this level yet. */
export const feedMark = (grade: string | null | undefined): Mark | undefined =>
  grade === '?' || grade === '??' ? grade : undefined

/** The player's usual blunder risk (0-1) at `ply` half-moves played. */
export const usualRisk = (
  pregame: Pregame | null,
  id: PlayerId,
  ply: number,
): number | null => {
  const phases = pregame?.players?.[id]?.usual_blunder_risk?.by_phase
  if (!phases) return null
  for (const [range, v] of Object.entries(phases)) {
    const m = range.match(/^(\d+)(?:-(\d+)|\+)$/)
    if (!m) continue
    const lo = +m[1]
    const hi = m[2] ? +m[2] : Infinity
    if (ply >= lo && ply <= hi) return v.usual_risk_pct / 100
  }
  return null
}
