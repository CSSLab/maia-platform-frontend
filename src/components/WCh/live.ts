/*
 * The World Championship game from the Lichess broadcast: the round's PGN
 * parsed into moves with each mover's clock and Lichess's eval (when the
 * broadcast carries them).
 */
import { Chess } from 'chess.ts'

import type { PlayerId } from './data'

/** The FIDE World Championship 2026 broadcast on Lichess. */
export const WCH_TOUR_ID = 'qfkdt8mn'
export const FIDE_IDS: Record<PlayerId, number> = {
  sindarov: 14205483,
  gukesh: 46616543,
}

/** Seconds added per move from move 41 (FIDE regulations for the match). */
const INCREMENT_FROM_MOVE = 41
const INCREMENT_SECONDS = 30

export interface LiveMove {
  index: number
  moveNumber: number
  color: 'white' | 'black'
  san: string
  uci: string
  fenBefore: string
  fen: string
  /** The mover's clock after the move, seconds (null if not broadcast). */
  clock: number | null
  /** Lichess's eval after the move, pawns from White's side (null if none). */
  eval: number | null
  /** Seconds the mover spent, from the clocks (0 if unknown). */
  think: number
}

export interface LiveGame {
  gameId: string | null
  white: PlayerId | null
  black: PlayerId | null
  whiteName: string
  blackName: string
  /** "1-0", "0-1", "1/2-1/2" or "*". */
  result: string
  timeControl: string | null
  moves: LiveMove[]
}

const header = (pgn: string, key: string) =>
  pgn.match(new RegExp(`\\[${key}\\s+"([^"]*)"\\]`))?.[1] ?? null

const playerOf = (fideId: string | null, name: string | null) => {
  for (const [id, fide] of Object.entries(FIDE_IDS) as [PlayerId, number][])
    if (fideId === String(fide)) return id
  const n = (name ?? '').toLowerCase()
  if (n.includes('sindarov')) return 'sindarov'
  if (n.includes('gukesh')) return 'gukesh'
  return null
}

const parseClock = (comment: string) => {
  const m = comment.match(/\[%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\]/)
  return m ? +m[1] * 3600 + +m[2] * 60 + Math.floor(+m[3]) : null
}

const parseEval = (comment: string) => {
  const m = comment.match(/\[%eval\s+(#?)(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  if (m[1] === '#') return +m[2] > 0 ? 10 : -10
  return +m[2]
}

/** One game's PGN into a LiveGame. */
export const parseLiveGame = (pgn: string): LiveGame | null => {
  const chess = new Chess()
  // An empty game ("*" and no moves) loads too.
  if (!chess.loadPgn(pgn)) return null
  const comments = new Map(
    chess.getComments().map(({ fen, comment }) => [fen, comment]),
  )
  const replay = new Chess()
  const moves: LiveMove[] = []
  // The clocks at the start, from the time control ("40/7200:..." or
  // "900+10"); unknown without one (the first thinks are then 0).
  const base = (pgn.match(/\[TimeControl\s+"(?:\d+\/)?(\d+)/) ?? [])[1]
  const start = base ? +base : null
  const lastClock: Record<'white' | 'black', number | null> = {
    white: start,
    black: start,
  }
  chess.history().forEach((san, index) => {
    const fenBefore = replay.fen()
    const color = replay.turn() === 'w' ? 'white' : 'black'
    const moveNumber = Math.floor(index / 2) + 1
    const m = replay.move(san)
    if (!m) return
    const fen = replay.fen()
    const comment = comments.get(fen) ?? ''
    const clock = parseClock(comment)
    let think = 0
    if (clock !== null) {
      const before = lastClock[color]
      if (before !== null) {
        const inc = moveNumber >= INCREMENT_FROM_MOVE ? INCREMENT_SECONDS : 0
        // A jump up is time added at a control: the think is then unknown.
        think = Math.max(0, before - clock + inc)
      }
      lastClock[color] = clock
    }
    moves.push({
      index,
      moveNumber,
      color,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      fenBefore,
      fen,
      clock,
      eval: parseEval(comment),
      think,
    })
  })
  const whiteName = header(pgn, 'White') ?? 'White'
  const blackName = header(pgn, 'Black') ?? 'Black'
  const gameUrl = header(pgn, 'GameURL')
  return {
    gameId: gameUrl ? (gameUrl.split('/').pop() ?? null) : null,
    white: playerOf(header(pgn, 'WhiteFideId'), whiteName),
    black: playerOf(header(pgn, 'BlackFideId'), blackName),
    whiteName,
    blackName,
    result: header(pgn, 'Result') ?? '*',
    timeControl: header(pgn, 'TimeControl'),
    moves,
  }
}

/** Splits a round's PGN into its games. */
export const splitGames = (pgn: string) =>
  pgn
    .split(/\n\s*\n(?=\[Event )/)
    .map((g) => g.trim())
    .filter((g) => g.startsWith('[Event'))

/**
 * Whether a game's PGN is the one the page follows: the given Lichess game
 * id, else the game between the two players.
 */
export const isOurGame = (pgn: string, gameId?: string | null) => {
  if (gameId) return (header(pgn, 'GameURL') ?? '').endsWith(`/${gameId}`)
  const w = playerOf(header(pgn, 'WhiteFideId'), header(pgn, 'White'))
  const b = playerOf(header(pgn, 'BlackFideId'), header(pgn, 'Black'))
  return !!w && !!b && w !== b
}

/**
 * The base time in seconds, from the PGN standard ("40/7200:...") or the
 * broadcast's own wording, in minutes ("120'/40m + 30'/end, ...").
 */
export const baseSeconds = (tc: string | null): number | null => {
  if (!tc) return null
  const min = tc.match(/^\s*(\d+)\s*(?:'|min)/)?.[1]
  if (min) return +min * 60
  const sec = tc.match(/^(?:\d+\/)?(\d+)/)?.[1]
  return sec ? +sec : null
}

/** "40/7200:20/3600:900+30" -> "7200+30" (the bars' time-control input). */
export const barTimeControl = (tc: string | null) => {
  const base = baseSeconds(tc)
  if (base === null) return null
  const inc =
    tc?.match(/\+(\d+)$/)?.[1] ??
    tc?.match(/(\d+)\s*(?:s|"|sec)?\s*\/\s*move/)?.[1] ??
    '0'
  return `${base}+${inc}`
}
