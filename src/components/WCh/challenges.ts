/*
 * The Maia Challenge for each round: a position from the game (or a what-if
 * from it), the side you play, and the question.
 */
import { Chess } from 'chess.ts'

import type { PlayerId } from './data'

export interface Challenge {
  round: number
  /** How many plies of the game come before the position. */
  plies: number
  /** Moves played instead, after those (a what-if), in SAN. */
  then?: string[]
  you: PlayerId
  title: string
  setup: string
  /** What passes: a win (the default), or a draw or better (holding it). */
  pass?: 'win' | 'draw'
}

export const WCH_CHALLENGES: Challenge[] = [
  {
    round: 1,
    plies: 54,
    you: 'sindarov',
    title: 'Sindarov has an active position. Can you press and win?',
    setup:
      "The position is objectively level but it's a tense moment in the first World Championship game and there are chances for both sides. Can you win it against a Maia level of your choice?",
  },
  {
    round: 2,
    plies: 32,
    then: ['a5'],
    you: 'sindarov',
    title: 'Can you win if White plays on?',
    setup:
      "In Game 2, the players repeated moves and it was drawn early. If your opponent had played on with 17. a5 instead, it would be anyone's game. How would you do?",
  },
  {
    round: 3,
    plies: 59,
    you: 'gukesh',
    pass: 'draw',
    title: 'Can you hold it?',
    setup:
      "Sindarov has just surprised Gukesh with the active 29. f4. You're a pawn up after 30.Rf3, but you could be in danger with imprecise play. Try to play this one out.",
  },
]

export interface ChallengePosition {
  fen: string
  color: 'white' | 'black'
  /** The move that led here, for the board ("f2f3"). */
  lastMove: string | null
}

/**
 * The challenge's position from the game's moves ("1.e4 e5 2.Nf3 ..."), or
 * null if they don't reach it.
 */
export const challengePosition = (
  c: Challenge,
  pgn: string,
): ChallengePosition | null => {
  const sans = pgn
    .split(/\s+/)
    .map((t) => t.replace(/^\d+(\.|…)/, ''))
    .filter(Boolean)
  if (sans.length < c.plies) return null
  const chess = new Chess()
  let last: string | null = null
  for (const san of [...sans.slice(0, c.plies), ...(c.then ?? [])]) {
    const m = chess.move(san)
    if (!m) return null
    last = `${m.from}${m.to}`
  }
  return {
    fen: chess.fen(),
    color: chess.turn() === 'w' ? 'white' : 'black',
    lastMove: last,
  }
}

/** The id a challenge's games are recorded under. */
export const challengeId = (round: number) => `wch-r${round}`

/** The challenge for a recorded id ("wch-r3"), if it is one. */
export const challengeFor = (id: string | undefined) => {
  const round = Number(id?.match(/^wch-r(\d+)$/)?.[1])
  return WCH_CHALLENGES.find((c) => c.round === round) ?? null
}

/** Whether a result passes the challenge. */
export const passes = (c: Challenge, outcome: 'win' | 'draw' | 'loss') =>
  outcome === 'win' || (outcome === 'draw' && c.pass === 'draw')
