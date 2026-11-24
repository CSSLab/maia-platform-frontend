/*
 * Game 1 as the page will see it: Sindarov (White) vs Gukesh (Black), the
 * pairing on the Lichess broadcast (round xLgOJ6cb). The moves are still the
 * illustrative Closed Ruy Lopez from data.ts; crowd guesses and evals are
 * made up for the prototype.
 */
import { Chess } from 'chess.ts'
import {
  BASE_SECONDS,
  DEMO_PLIES,
  NEXT_PREDICTION,
  Mark,
  PlayerId,
} from './data'

export interface FidePlayer {
  id: PlayerId
  name: string
  title: string
  rating: number
  fideId: number
  fed: 'IND' | 'UZB'
  /** Lichess's FIDE player photo (credit: Dominik Töpfer / Lichess). */
  photo: string
}

// From https://lichess.org/api/fide/player/{id} (2026-11-23).
export const FIDE: Record<PlayerId, FidePlayer> = {
  sindarov: {
    id: 'sindarov',
    name: 'Javokhir Sindarov',
    title: 'GM',
    rating: 2782,
    fideId: 14205483,
    fed: 'UZB',
    photo:
      'https://image.lichess.org/display?fmt=webp&h=100&op=thumbnail&path=4C67mDv4iClZ.webp&w=100&sig=76a6adc8dd84347897a147fb22b73e8bda234bdf',
  },
  gukesh: {
    id: 'gukesh',
    name: 'Gukesh D',
    title: 'GM',
    rating: 2710,
    fideId: 46616543,
    fed: 'IND',
    photo:
      'https://image.lichess.org/display?fmt=webp&h=100&op=thumbnail&path=BMgtsjYW0uMf.webp&w=100&sig=6a2bc6e5d516008d09ed443d9deefa6e476a92eb',
  },
}

export const WHITE: PlayerId = 'sindarov'
export const BLACK: PlayerId = 'gukesh'

/** A small deterministic hash in [0, 1). */
const h = (s: string) => {
  let x = 2166136261
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i)
    x = Math.imul(x, 16777619)
  }
  return ((x >>> 0) % 10000) / 10000
}

export interface Candidate {
  san: string
  /** The mover's model. */
  maia: number
  /** Share of visitors' guesses. */
  crowd: number
  /** Generic Maia-3 at 2750: what a typical 2750 plays here. */
  generic: number
  /** Stockfish eval after the move, pawns, White's side. */
  eval: number
}

export interface LivePly {
  index: number
  moveNumber: number
  color: 'white' | 'black'
  mover: PlayerId
  san: string
  uci: string
  fenBefore: string
  fen: string
  candidates: Candidate[]
  sf: string
  /** 1-based rank of the played move in the mover's model (0: not in its top 5). */
  rank: number
  pPlayed: number
  crowdPlayed: number
  crowdTop: string
  guesses: number
  eval: number
  think: number
  clockWhite: number
  clockBlack: number
  /** Maia's chances after the move (unknown until computed, live). */
  bar?: { W: number; D: number; B: number }
  mark?: Mark
  /** Live feed: the mover's chance of a blunder before this move (0-1). */
  risk?: number | null
  /** Live feed: the move's probability at each of RATING_KEYS. */
  ratingShares?: number[]
}

const crowdSplit = (
  key: string,
  gen: [string, number][],
  sf: string,
  sans: string[],
) => {
  // Visitors lean towards the engine's move and the "obvious" one.
  const raw = sans.map((s) => {
    const g = gen.find(([x]) => x === s)?.[1] ?? 0.02
    return 0.6 * Math.pow(g, 0.8) + (s === sf ? 0.22 : 0) + 0.06 * h(key + s)
  })
  const z = raw.reduce((a, b) => a + b, 0) * 1.08 // ~7% guess something else
  return raw.map((v) => v / z)
}

const CANDIDATES_SHOWN = 12

const candidatesFor = (
  key: string,
  pred: [string, number][],
  gen: [string, number][],
  sf: string,
  evalBest: number,
  color: 'white' | 'black',
  fen: string,
): Candidate[] => {
  // Maia's listed moves, then other legal moves with the leftover mass
  // (illustrative), so the panel shows a fuller distribution.
  const listed = [...pred].sort((a, b) => b[1] - a[1])
  const rest = Math.max(0.03, 1 - listed.reduce((a, [, p]) => a + p, 0))
  const legal = new Chess(fen)
    .moves({ verbose: true })
    .filter((m) => !listed.find(([s]) => s === m.san) && m.piece !== 'k')
    .sort((a, b) => h(key + a.san) - h(key + b.san))
    .slice(0, Math.max(0, CANDIDATES_SHOWN - listed.length))
  const weights = [0.38, 0.24, 0.16, 0.1, 0.07, 0.05]
  const floor = listed[listed.length - 1][1]
  const extra = legal.map(
    (m, i) =>
      [m.san, Math.min(floor * 0.9, rest * (weights[i] ?? 0.03))] as [
        string,
        number,
      ],
  )
  const all = [...listed, ...extra]
  const sans = all.map(([s]) => s)
  const crowd = crowdSplit(key, gen, sf, sans)
  return all.map(([san, maia], i) => {
    const isExtra = i >= listed.length
    const loss =
      san === sf
        ? 0
        : isExtra
          ? 0.35 + 0.9 * h(key + san + 'e')
          : 0.06 + 0.32 * h(key + san + 'e')
    const ev = color === 'white' ? evalBest - loss : evalBest + loss
    const generic =
      gen.find(([g]) => g === san)?.[1] ??
      maia * (0.7 + 0.8 * h(key + san + 'g'))
    return {
      san,
      maia,
      generic,
      crowd: isExtra ? crowd[i] * 0.4 : crowd[i],
      eval: Math.round(ev * 100) / 100,
    }
  })
}

const evalAfter = (i: number) =>
  Math.round(
    (0.24 + 0.1 * Math.sin(i / 5) + 0.12 * (h(`ev${i}`) - 0.5)) * 100,
  ) / 100

const build = (): LivePly[] => {
  let cw = BASE_SECONDS
  let cb = BASE_SECONDS
  return DEMO_PLIES.map((p, i) => {
    const color = p.color
    const mover = color === 'white' ? WHITE : BLACK
    // Give the long thinks to Black (Gukesh), as in his real games.
    const think = DEMO_PLIES[i % 2 === 0 ? i + 1 : i - 1]?.think ?? p.think
    if (color === 'white') cw -= think
    else cb -= think
    const best = evalAfter(i)
    const candidates = candidatesFor(
      `p${i}`,
      p.pred,
      p.gen,
      p.sf,
      best,
      color,
      p.fenBefore,
    )
    const played = candidates.find((c) => c.san === p.san)
    const rankIdx = p.pred.findIndex(([s]) => s === p.san)
    const crowdTop = [...candidates].sort((a, b) => b.crowd - a.crowd)[0].san
    return {
      index: i,
      moveNumber: p.moveNumber,
      color,
      mover,
      san: p.san,
      uci: p.uci,
      fenBefore: p.fenBefore,
      fen: p.fen,
      candidates,
      sf: p.sf,
      rank: rankIdx + 1,
      pPlayed: p.pPlayed,
      crowdPlayed: played?.crowd ?? 0.02,
      crowdTop,
      guesses: 900 + Math.round(1800 * h(`g${i}`)) + i * 40,
      eval: played?.eval ?? best,
      think,
      clockWhite: cw,
      clockBlack: cb,
      bar: p.bar,
      mark: p.mark,
    }
  })
}

export const GAME1: LivePly[] = build()

const last = GAME1[GAME1.length - 1]

/** The move nobody has played yet: 21. White. */
/** The move to come (or, with `over`, the end of the game). */
export interface WchNext {
  moveNumber: number
  color: 'white' | 'black'
  mover: PlayerId
  fen: string
  /** Stockfish's best move (SAN), '' while unknown. */
  sf: string
  candidates: Candidate[]
  guessesSoFar: number
  /** Seconds the mover has been thinking, null if unknown. */
  thinkingFor: number | null
  /** The result, once the game is over. */
  over?: string
  /** Live feed: the mover's chance of a blunder here (0-1). */
  risk?: number | null
  /** Live feed: how long the mover usually takes here (seconds). */
  thinkPred?: { median_s: number; p90_s: number } | null
}

export const NEXT: WchNext = {
  moveNumber: last.moveNumber + 1,
  color: 'white',
  mover: WHITE,
  fen: last.fen,
  sf: NEXT_PREDICTION.sf,
  candidates: candidatesFor(
    'next',
    NEXT_PREDICTION.pred,
    NEXT_PREDICTION.gen,
    NEXT_PREDICTION.sf,
    last.eval + 0.04,
    'white',
    last.fen,
  ),
  guessesSoFar: 1284,
  thinkingFor: 372,
}

export const fmtEval = (e: number) =>
  Number.isFinite(e)
    ? `${e > 0 ? '+' : e < 0 ? '−' : ''}${Math.abs(e).toFixed(2)}`
    : '…'

export const tally = (plies: LivePly[]) => ({
  n: plies.length,
  maia: plies.filter((p) => p.rank === 1).length,
  crowd: plies.filter((p) => p.crowdTop === p.san).length,
  stockfish: plies.filter((p) => p.sf === p.san).length,
})

/** Stockfish's view of the candidates: best first for the side to move. */
export const sfLines = (cands: Candidate[], color: 'white' | 'black') =>
  [...cands]
    .sort((a, b) => (color === 'white' ? b.eval - a.eval : a.eval - b.eval))
    .slice(0, 4)

/**
 * Blunder risk over the next few moves relative to the player's usual rate
 * (0 = usual, 1 = twice usual or more): illustrative, driven by the clock.
 */
export const riskAt = (p: LivePly, side: 'white' | 'black') => {
  const left = (side === 'white' ? p.clockWhite : p.clockBlack) / 60
  const perMove = left / Math.max(1, 40 - p.moveNumber)
  const clock = Math.max(0, Math.min(1, (3 - perMove) / 2.5))
  // Tense stretches of the demo game (made up).
  const spike =
    side === 'black' && p.index >= 35 && p.index <= 38
      ? 0.55
      : side === 'white' && p.index >= 31 && p.index <= 33
        ? 0.3
        : 0
  return Math.max(clock, spike)
}

export const RATING_BANDS = [1100, 1500, 1900, 2300, 2750]

/** Share of players at each rating who pick each candidate (illustrative). */
export const byRating = (cands: Candidate[]) =>
  cands.slice(0, 4).map((c) => ({
    san: c.san,
    shares: RATING_BANDS.map((_, k) => {
      const t = k / (RATING_BANDS.length - 1)
      return (1 - t) * c.crowd + t * c.maia
    }),
  }))

/** Best guessers so far this game (made-up handles for the prototype). */
export const TOP_GUESSERS = [
  { name: 'knightowl_42', right: 31, of: 40 },
  { name: 'e4_enjoyer', right: 29, of: 38 },
  { name: 'quietmoves', right: 28, of: 40 },
]

/**
 * Chance of a blunder in the player's next five moves, and the usual
 * chance for them (from their per-move blunder rate: Sindarov 1.3%,
 * Gukesh 1.6%). Illustrative: scaled by the clock and tense stretches.
 */
export const blunderRisk = (p: LivePly, side: 'white' | 'black') => {
  const id = side === 'white' ? WHITE : BLACK
  const perMove = id === 'gukesh' ? 0.016 : 0.013
  const usual = 1 - Math.pow(1 - perMove, 5)
  const wobble = 0.96 + 0.08 * h(`r${side}${p.index}`)
  const risk = usual * (1 + 1.6 * riskAt(p, side)) * wobble
  return { risk, usual }
}

/**
 * Maia's prediction given how long the player has been thinking
 * (concept, not a trained model): P(move | still thinking after t) is
 * proportional to P(move) * P(think > t | move), with quick, obvious moves
 * (the ones Maia rates highest) less likely to still be coming.
 */
export const afterThinking = (cands: Candidate[], seconds: number) => {
  const top = Math.max(...cands.map((c) => c.maia))
  const w = cands.map((c) => {
    const tau = 600 / Math.sqrt(c.maia / top)
    return c.maia * Math.exp(-seconds / tau)
  })
  const z = w.reduce((a, b) => a + b, 0)
  return cands.map((c, i) => ({ ...c, maia: w[i] / z, before: c.maia }))
}
