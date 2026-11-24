/*
 * A finished game from Maia's point of view, for the right panel between
 * games: how often each player's Maia called his move, the moves it least
 * expected, where its win chances swung, the most dangerous positions and the
 * longest thinks. Everything comes from the plies on the page (the research
 * feed's numbers when it's on).
 */
import type { LivePly } from './game1'

export type Side = 'white' | 'black'

export interface SideSummary {
  /** His moves with Maia's prediction known. */
  moves: number
  /** Of those, the ones Maia put first. */
  maiaTop: number
  /** His moves with Stockfish's best known, and the ones that were it. */
  sfMoves: number
  sfTop: number
}

export interface Swing {
  ply: LivePly
  /** The mover's chance of winning before and after his move (Maia's bar). */
  before: number
  after: number
  /** The change in the mover's expected score (win + half a draw). */
  delta: number
}

export interface Dangerous {
  ply: LivePly
  /** The chance he'd blunder in the position before this move. */
  risk: number
}

export interface GameSummary {
  sides: Record<Side, SideSummary>
  /** The moves Maia gave the least chance, least first. */
  surprises: LivePly[]
  /** The biggest swings in Maia's win chances, biggest first. */
  swings: Swing[]
  /** The positions where a blunder was likeliest, likeliest first. */
  dangerous: Dangerous[]
  /** The longest thinks, longest first. */
  thinks: LivePly[]
}

/** How many of each list (the panel has room for a few). */
const TOP = 3
/** A move Maia gave at least this much isn't a surprise. */
const SURPRISE_BELOW = 0.15
/** A swing smaller than this (expected score) isn't a turning point. */
const SWING_FROM = 0.05
/** Positions under this chance of a blunder aren't worth a mention. */
const RISK_FROM = 0.02
/** Thinks shorter than this (seconds) aren't worth a mention. */
const THINK_FROM = 120

const sideOf = (p: LivePly): Side => p.color

/** The mover's side of Maia's bar: his win chance and expected score. */
const forMover = (bar: NonNullable<LivePly['bar']>, side: Side) => {
  const win = side === 'white' ? bar.W : bar.B
  return { win, score: win + bar.D / 2 }
}

export const summarize = (plies: LivePly[]): GameSummary => {
  const sides: Record<Side, SideSummary> = {
    white: { moves: 0, maiaTop: 0, sfMoves: 0, sfTop: 0 },
    black: { moves: 0, maiaTop: 0, sfMoves: 0, sfTop: 0 },
  }
  for (const p of plies) {
    const s = sides[sideOf(p)]
    if (p.rank > 0) {
      s.moves += 1
      if (p.rank === 1) s.maiaTop += 1
    }
    if (p.sf) {
      s.sfMoves += 1
      if (p.sf === p.san) s.sfTop += 1
    }
  }

  const surprises = plies
    .filter((p) => p.rank > 0 && p.pPlayed < SURPRISE_BELOW)
    .sort((a, b) => a.pPlayed - b.pPlayed)
    .slice(0, TOP)

  const swings: Swing[] = []
  plies.forEach((p, i) => {
    const prev = plies[i - 1]?.bar
    if (!p.bar || !prev) return
    const b = forMover(prev, sideOf(p))
    const a = forMover(p.bar, sideOf(p))
    const delta = a.score - b.score
    if (Math.abs(delta) >= SWING_FROM)
      swings.push({ ply: p, before: b.win, after: a.win, delta })
  })
  swings.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const dangerous = plies
    .flatMap((p) =>
      p.risk != null && p.risk >= RISK_FROM ? [{ ply: p, risk: p.risk }] : [],
    )
    .sort((a, b) => b.risk - a.risk)
    .slice(0, TOP)

  const thinks = plies
    .filter((p) => p.think >= THINK_FROM)
    .sort((a, b) => b.think - a.think)
    .slice(0, TOP)

  return { sides, surprises, swings: swings.slice(0, TOP), dangerous, thinks }
}
