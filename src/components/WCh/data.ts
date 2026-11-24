/*
 * Demo data for the World Championship prototypes.
 *
 * The game below is an illustrative Closed Ruy Lopez (a real theoretical
 * line), NOT a game Gukesh and Sindarov have played. Probabilities are
 * hand-set to look like the elite combiner's output; the aggregate numbers
 * (accuracy, clocks, repertoire, opening departures) come from the
 * strong-players brief of 2026-11-23.
 */
import { Chess } from 'chess.ts'

export type PlayerId = 'gukesh' | 'sindarov'

export interface Player {
  id: PlayerId
  name: string
  short: string
  country: string
  flag: string
  /** Identity colour (never blue: blue is the computer). */
  color: string
  colorSoft: string
}

export const PLAYERS: Record<PlayerId, Player> = {
  gukesh: {
    id: 'gukesh',
    name: 'Gukesh D',
    short: 'Gukesh',
    country: 'India',
    flag: '🇮🇳',
    color: '#f2b45a',
    colorSoft: 'rgba(242,180,90,0.16)',
  },
  sindarov: {
    id: 'sindarov',
    name: 'Javokhir Sindarov',
    short: 'Sindarov',
    country: 'Uzbekistan',
    flag: '🇺🇿',
    color: '#b9a3e8',
    colorSoft: 'rgba(185,163,232,0.16)',
  },
}

/** Maia is the human colour of the site, Stockfish the computer blue. */
export const PREDICTOR_COLORS = {
  maia: 'rgb(254 127 109)',
  generic: 'rgb(254 127 109 / 0.45)',
  allie: '#d9d4cf',
  stockfish: 'rgb(90 157 215)',
}

export type Mark = '!?' | '?!' | '?' | '??'

export const MARK_COLORS: Record<Mark, string> = {
  '!?': '#66bd63',
  '?!': '#fdae61',
  '?': '#f46d43',
  '??': '#d73027',
}

type Pred = [string, number][]

interface RawPly {
  san: string
  /** The mover's own model (Gukesh-Maia / Sindarov-Maia). */
  pred: Pred
  /** Generic Maia-3 at 2750. */
  gen: Pred
  /** Stockfish 20k-node best move. */
  sf: string
  /** Allie 2.1's top move, when it differs from Maia's. */
  allie?: string
  /** Seconds spent on the move. */
  t: number
  mark?: Mark
}

const RAW: RawPly[] = [
  {
    san: 'e4',
    pred: [
      ['e4', 0.57],
      ['d4', 0.26],
      ['Nf3', 0.09],
      ['c4', 0.05],
    ],
    gen: [
      ['e4', 0.49],
      ['d4', 0.38],
      ['Nf3', 0.07],
      ['c4', 0.04],
    ],
    sf: 'e4',
    t: 5,
  },
  {
    san: 'e5',
    pred: [
      ['e5', 0.54],
      ['c5', 0.35],
      ['e6', 0.05],
      ['c6', 0.04],
    ],
    gen: [
      ['e5', 0.41],
      ['c5', 0.38],
      ['e6', 0.1],
      ['c6', 0.07],
    ],
    sf: 'e5',
    t: 6,
  },
  {
    san: 'Nf3',
    pred: [
      ['Nf3', 0.94],
      ['Nc3', 0.03],
      ['Bc4', 0.02],
    ],
    gen: [
      ['Nf3', 0.9],
      ['Nc3', 0.04],
      ['Bc4', 0.03],
    ],
    sf: 'Nf3',
    t: 4,
  },
  {
    san: 'Nc6',
    pred: [
      ['Nc6', 0.88],
      ['Nf6', 0.1],
      ['d6', 0.01],
    ],
    gen: [
      ['Nc6', 0.79],
      ['Nf6', 0.17],
      ['d6', 0.03],
    ],
    sf: 'Nc6',
    t: 4,
  },
  {
    san: 'Bb5',
    pred: [
      ['Bb5', 0.58],
      ['Bc4', 0.34],
      ['d4', 0.05],
      ['Nc3', 0.02],
    ],
    gen: [
      ['Bb5', 0.55],
      ['Bc4', 0.32],
      ['d4', 0.09],
      ['Nc3', 0.03],
    ],
    sf: 'Bb5',
    t: 9,
  },
  {
    san: 'a6',
    pred: [
      ['a6', 0.6],
      ['Nf6', 0.36],
      ['Bc5', 0.03],
    ],
    gen: [
      ['a6', 0.62],
      ['Nf6', 0.31],
      ['Bc5', 0.04],
    ],
    sf: 'Nf6',
    t: 11,
  },
  {
    san: 'Ba4',
    pred: [
      ['Ba4', 0.89],
      ['Bxc6', 0.1],
    ],
    gen: [
      ['Ba4', 0.85],
      ['Bxc6', 0.14],
    ],
    sf: 'Ba4',
    t: 6,
  },
  {
    san: 'Nf6',
    pred: [
      ['Nf6', 0.94],
      ['d6', 0.03],
      ['b5', 0.02],
    ],
    gen: [
      ['Nf6', 0.9],
      ['d6', 0.05],
      ['b5', 0.03],
    ],
    sf: 'Nf6',
    t: 5,
  },
  {
    san: 'O-O',
    pred: [
      ['O-O', 0.82],
      ['d3', 0.14],
      ['Qe2', 0.02],
    ],
    gen: [
      ['O-O', 0.74],
      ['d3', 0.21],
      ['Qe2', 0.03],
    ],
    sf: 'O-O',
    t: 7,
  },
  {
    san: 'Be7',
    pred: [
      ['Be7', 0.71],
      ['b5', 0.14],
      ['Nxe4', 0.09],
      ['Bc5', 0.05],
    ],
    gen: [
      ['Be7', 0.66],
      ['b5', 0.15],
      ['Nxe4', 0.12],
      ['Bc5', 0.05],
    ],
    sf: 'Be7',
    t: 9,
  },
  {
    san: 'Re1',
    pred: [
      ['Re1', 0.79],
      ['d3', 0.12],
      ['Qe2', 0.05],
      ['Bxc6', 0.03],
    ],
    gen: [
      ['Re1', 0.76],
      ['d3', 0.15],
      ['Qe2', 0.05],
      ['Bxc6', 0.03],
    ],
    sf: 'Re1',
    t: 5,
  },
  {
    san: 'b5',
    pred: [
      ['b5', 0.9],
      ['d6', 0.07],
    ],
    gen: [
      ['b5', 0.88],
      ['d6', 0.09],
    ],
    sf: 'b5',
    t: 4,
  },
  { san: 'Bb3', pred: [['Bb3', 0.99]], gen: [['Bb3', 0.99]], sf: 'Bb3', t: 3 },
  {
    san: 'd6',
    pred: [
      ['O-O', 0.52],
      ['d6', 0.45],
    ],
    gen: [
      ['O-O', 0.5],
      ['d6', 0.47],
    ],
    sf: 'O-O',
    t: 8,
  },
  {
    san: 'c3',
    pred: [
      ['c3', 0.86],
      ['a4', 0.07],
      ['h3', 0.04],
    ],
    gen: [
      ['c3', 0.8],
      ['a4', 0.1],
      ['h3', 0.06],
    ],
    sf: 'c3',
    t: 12,
  },
  {
    san: 'O-O',
    pred: [
      ['O-O', 0.91],
      ['Na5', 0.04],
      ['Bg4', 0.03],
    ],
    gen: [
      ['O-O', 0.88],
      ['Na5', 0.05],
      ['Bg4', 0.05],
    ],
    sf: 'O-O',
    t: 6,
  },
  {
    san: 'h3',
    pred: [
      ['h3', 0.77],
      ['d4', 0.12],
      ['a4', 0.06],
      ['d3', 0.04],
    ],
    gen: [
      ['h3', 0.71],
      ['d4', 0.15],
      ['d3', 0.08],
      ['a4', 0.05],
    ],
    sf: 'h3',
    t: 15,
  },
  {
    san: 'Na5',
    pred: [
      ['Bb7', 0.38],
      ['Na5', 0.27],
      ['Nb8', 0.14],
      ['h6', 0.1],
      ['Re8', 0.06],
    ],
    gen: [
      ['Bb7', 0.33],
      ['Nb8', 0.24],
      ['Na5', 0.22],
      ['h6', 0.12],
    ],
    sf: 'Bb7',
    t: 21,
  },
  { san: 'Bc2', pred: [['Bc2', 0.98]], gen: [['Bc2', 0.98]], sf: 'Bc2', t: 9 },
  {
    san: 'c5',
    pred: [
      ['c5', 0.9],
      ['c6', 0.05],
    ],
    gen: [
      ['c5', 0.88],
      ['c6', 0.07],
    ],
    sf: 'c5',
    t: 7,
  },
  {
    san: 'd4',
    pred: [
      ['d4', 0.88],
      ['d3', 0.1],
    ],
    gen: [
      ['d4', 0.86],
      ['d3', 0.12],
    ],
    sf: 'd4',
    t: 34,
  },
  {
    san: 'Qc7',
    pred: [
      ['Nc6', 0.37],
      ['Qc7', 0.33],
      ['Nd7', 0.17],
      ['Bb7', 0.11],
    ],
    gen: [
      ['Qc7', 0.41],
      ['Nd7', 0.2],
      ['Nc6', 0.19],
      ['Bb7', 0.12],
    ],
    sf: 'Nd7',
    allie: 'Qc7',
    t: 19,
  },
  {
    san: 'Nbd2',
    pred: [
      ['d5', 0.41],
      ['Nbd2', 0.38],
      ['b3', 0.1],
      ['dxc5', 0.05],
    ],
    gen: [
      ['d5', 0.44],
      ['Nbd2', 0.33],
      ['b3', 0.12],
      ['dxc5', 0.06],
    ],
    sf: 'd5',
    allie: 'Nbd2',
    t: 142,
  },
  {
    san: 'cxd4',
    pred: [
      ['cxd4', 0.51],
      ['Bd7', 0.19],
      ['Nc6', 0.17],
      ['Re8', 0.07],
    ],
    gen: [
      ['cxd4', 0.44],
      ['Nc6', 0.25],
      ['Bd7', 0.17],
      ['Re8', 0.08],
    ],
    sf: 'cxd4',
    t: 48,
  },
  {
    san: 'cxd4',
    pred: [['cxd4', 0.99]],
    gen: [['cxd4', 0.99]],
    sf: 'cxd4',
    t: 6,
  },
  {
    san: 'Nc6',
    pred: [
      ['Nc6', 0.57],
      ['Bd7', 0.22],
      ['Bb7', 0.16],
    ],
    gen: [
      ['Bb7', 0.38],
      ['Nc6', 0.36],
      ['Bd7', 0.19],
    ],
    sf: 'Bb7',
    allie: 'Bb7',
    t: 37,
  },
  {
    san: 'Nb3',
    pred: [
      ['d5', 0.42],
      ['Nb3', 0.33],
      ['a3', 0.14],
      ['Nf1', 0.06],
    ],
    gen: [
      ['d5', 0.51],
      ['Nb3', 0.24],
      ['a3', 0.16],
      ['Nf1', 0.05],
    ],
    sf: 'd5',
    t: 388,
  },
  {
    san: 'a5',
    pred: [
      ['a5', 0.62],
      ['Bb7', 0.16],
      ['Nb4', 0.08],
      ['Bd7', 0.07],
    ],
    gen: [
      ['a5', 0.55],
      ['Bb7', 0.2],
      ['Nb4', 0.1],
      ['Bd7', 0.08],
    ],
    sf: 'a5',
    t: 71,
  },
  {
    san: 'Be3',
    pred: [
      ['Be3', 0.68],
      ['Bd2', 0.13],
      ['Bg5', 0.09],
      ['a4', 0.05],
    ],
    gen: [
      ['Be3', 0.6],
      ['Bd2', 0.18],
      ['Bg5', 0.11],
      ['a4', 0.06],
    ],
    sf: 'Be3',
    t: 204,
  },
  {
    san: 'a4',
    pred: [
      ['a4', 0.81],
      ['Bd7', 0.07],
      ['Nb4', 0.06],
    ],
    gen: [
      ['a4', 0.74],
      ['Bd7', 0.1],
      ['Nb4', 0.08],
    ],
    sf: 'a4',
    t: 33,
  },
  {
    san: 'Nbd2',
    pred: [
      ['Nbd2', 0.73],
      ['Nc1', 0.17],
      ['Bd3', 0.04],
    ],
    gen: [
      ['Nbd2', 0.69],
      ['Nc1', 0.22],
      ['Bd3', 0.05],
    ],
    sf: 'Nbd2',
    t: 96,
  },
  {
    san: 'Bd7',
    pred: [
      ['Nb4', 0.41],
      ['Bd7', 0.29],
      ['Bb7', 0.13],
      ['Re8', 0.09],
    ],
    gen: [
      ['Nb4', 0.38],
      ['Bd7', 0.27],
      ['Bb7', 0.16],
      ['Re8', 0.1],
    ],
    sf: 'Bd7',
    t: 140,
  },
  {
    san: 'Rc1',
    pred: [
      ['Rc1', 0.41],
      ['a3', 0.19],
      ['Bd3', 0.14],
      ['Qe2', 0.09],
    ],
    gen: [
      ['a3', 0.31],
      ['Rc1', 0.29],
      ['Bd3', 0.17],
      ['Qe2', 0.1],
    ],
    sf: 'a3',
    allie: 'a3',
    t: 611,
  },
  {
    san: 'Qb7',
    pred: [
      ['Qb7', 0.46],
      ['Rfc8', 0.21],
      ['Nb4', 0.18],
      ['Qb8', 0.08],
    ],
    gen: [
      ['Qb7', 0.39],
      ['Nb4', 0.26],
      ['Rfc8', 0.2],
      ['Qb8', 0.09],
    ],
    sf: 'Qb7',
    t: 85,
  },
  {
    san: 'Nf1',
    pred: [
      ['a3', 0.35],
      ['Nf1', 0.28],
      ['Bd3', 0.2],
      ['Qe2', 0.1],
    ],
    gen: [
      ['a3', 0.33],
      ['Bd3', 0.24],
      ['Nf1', 0.2],
      ['Qe2', 0.12],
    ],
    sf: 'a3',
    t: 302,
  },
  {
    san: 'Rfc8',
    pred: [
      ['Rfc8', 0.44],
      ['Nb4', 0.3],
      ['Rfe8', 0.11],
      ['Rac8', 0.07],
    ],
    gen: [
      ['Nb4', 0.36],
      ['Rfc8', 0.34],
      ['Rfe8', 0.12],
      ['Rac8', 0.08],
    ],
    sf: 'Nb4',
    t: 62,
  },
  {
    san: 'Ng3',
    pred: [
      ['Ng3', 0.58],
      ['a3', 0.17],
      ['Bd3', 0.12],
      ['Qd2', 0.07],
    ],
    gen: [
      ['Ng3', 0.52],
      ['a3', 0.21],
      ['Bd3', 0.13],
      ['Qd2', 0.08],
    ],
    sf: 'Ng3',
    t: 251,
  },
  {
    san: 'h6',
    pred: [
      ['Nb4', 0.36],
      ['h6', 0.25],
      ['g6', 0.16],
      ['Bf8', 0.12],
    ],
    gen: [
      ['Nb4', 0.41],
      ['Bf8', 0.18],
      ['h6', 0.17],
      ['g6', 0.12],
    ],
    sf: 'Bf8',
    t: 47,
    mark: '?!',
  },
  {
    san: 'a3',
    pred: [
      ['a3', 0.47],
      ['Qd2', 0.16],
      ['Bd3', 0.14],
      ['dxe5', 0.1],
    ],
    gen: [
      ['a3', 0.4],
      ['Qd2', 0.2],
      ['dxe5', 0.15],
      ['Bd3', 0.13],
    ],
    sf: 'Qd2',
    allie: 'Qd2',
    t: 167,
    mark: '!?',
  },
  {
    san: 'Bf8',
    pred: [
      ['Bf8', 0.42],
      ['Qb8', 0.2],
      ['Rab8', 0.13],
      ['exd4', 0.1],
    ],
    gen: [
      ['Bf8', 0.38],
      ['exd4', 0.2],
      ['Qb8', 0.16],
      ['Rab8', 0.12],
    ],
    sf: 'exd4',
    t: 54,
  },
]

/** The prediction for the move that has not been played yet (21. White). */
export const NEXT_PREDICTION = {
  pred: [
    ['Bd3', 0.31],
    ['Qd2', 0.24],
    ['Nh2', 0.12],
    ['dxe5', 0.11],
    ['Qe2', 0.09],
  ] as Pred,
  gen: [
    ['Qd2', 0.29],
    ['Bd3', 0.25],
    ['dxe5', 0.14],
    ['Qe2', 0.1],
    ['Nh2', 0.07],
  ] as Pred,
  sf: 'Qd2',
  allie: 'Qd2',
  onlyMove: false,
}

const keyframes: [number, number, number, number][] = [
  // ply, W, D, B (the human bar after that ply)
  [0, 0.25, 0.57, 0.18],
  [10, 0.26, 0.58, 0.16],
  [17, 0.27, 0.56, 0.17],
  [22, 0.24, 0.57, 0.19],
  [26, 0.28, 0.55, 0.17],
  [27, 0.28, 0.55, 0.17],
  [32, 0.27, 0.56, 0.17],
  [33, 0.3, 0.54, 0.16],
  [37, 0.3, 0.54, 0.16],
  [38, 0.34, 0.52, 0.14],
  [40, 0.33, 0.53, 0.14],
]

const interp = (ply: number) => {
  for (let i = 1; i < keyframes.length; i++) {
    const [p1, ...v1] = keyframes[i]
    const [p0, ...v0] = keyframes[i - 1]
    if (ply <= p1) {
      const f = (ply - p0) / (p1 - p0 || 1)
      return v0.map((v, j) => v + (v1[j] - v) * f) as [number, number, number]
    }
  }
  const last = keyframes[keyframes.length - 1]
  return [last[1], last[2], last[3]] as [number, number, number]
}

/** Stockfish eval from White's side, pawns. */
const evalAt = (ply: number) =>
  0.22 + 0.12 * Math.sin(ply / 4) + (ply > 30 ? 0.06 : 0)

export interface Ply {
  index: number
  /** 1-based move number. */
  moveNumber: number
  color: 'white' | 'black'
  mover: PlayerId
  san: string
  uci: string
  fenBefore: string
  fen: string
  pred: Pred
  gen: Pred
  sf: string
  allie: string
  /** Probability the mover's model gave the played move. */
  pPlayed: number
  pPlayedGeneric: number
  hit: boolean
  sfHit: boolean
  allieHit: boolean
  genHit: boolean
  think: number
  /** Clocks after the move, seconds. */
  clockWhite: number
  clockBlack: number
  bar: { W: number; D: number; B: number }
  eval: number
  mark?: Mark
}

export const BASE_SECONDS = 120 * 60
/** Seconds added per move; assumed to start at move 41 (to confirm). */
export const INCREMENT = 30
export const INCREMENT_FROM = 41

export const GAME_WHITE: PlayerId = 'gukesh'
export const GAME_BLACK: PlayerId = 'sindarov'

const buildPlies = (): Ply[] => {
  const chess = new Chess()
  let cw = BASE_SECONDS
  let cb = BASE_SECONDS
  return RAW.map((raw, index) => {
    const fenBefore = chess.fen()
    const move = chess.move(raw.san)
    if (!move) throw new Error(`Illegal demo move ${raw.san} at ${index}`)
    const color = index % 2 === 0 ? 'white' : 'black'
    const inc = Math.floor(index / 2) + 1 >= INCREMENT_FROM ? INCREMENT : 0
    if (color === 'white') cw = cw - raw.t + inc
    else cb = cb - raw.t + inc
    const find = (p: Pred, san: string) =>
      p.find(([s]) => s === san)?.[1] ?? 0.01
    const [W, D, B] = interp(index + 1)
    const allie = raw.allie ?? raw.pred[0][0]
    return {
      index,
      moveNumber: Math.floor(index / 2) + 1,
      color,
      mover: color === 'white' ? GAME_WHITE : GAME_BLACK,
      san: raw.san,
      uci: move.from + move.to,
      fenBefore,
      fen: chess.fen(),
      pred: raw.pred,
      gen: raw.gen,
      sf: raw.sf,
      allie,
      pPlayed: find(raw.pred, raw.san),
      pPlayedGeneric: find(raw.gen, raw.san),
      hit: raw.pred[0][0] === raw.san,
      sfHit: raw.sf === raw.san,
      allieHit: allie === raw.san,
      genHit: raw.gen[0][0] === raw.san,
      think: raw.t,
      clockWhite: cw,
      clockBlack: cb,
      bar: { W, D, B },
      eval: evalAt(index + 1),
      mark: raw.mark,
    }
  })
}

export const DEMO_PLIES: Ply[] = buildPlies()

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Converts a SAN in a position to [from, to] for drawing arrows. */
export const sanToSquares = (
  fen: string,
  san: string,
): [string, string] | null => {
  try {
    const c = new Chess(fen)
    const m = c.move(san)
    return m ? [m.from, m.to] : null
  } catch {
    return null
  }
}

export const scoreboard = (plies: Ply[], mover?: PlayerId) => {
  const ps = mover ? plies.filter((p) => p.mover === mover) : plies
  const n = ps.length || 1
  const ce = (x: number) => -Math.log(Math.max(x, 0.005))
  return {
    n: ps.length,
    maia: ps.filter((p) => p.hit).length,
    allie: ps.filter((p) => p.allieHit).length,
    stockfish: ps.filter((p) => p.sfHit).length,
    generic: ps.filter((p) => p.genHit).length,
    maiaCE: ps.reduce((s, p) => s + ce(p.pPlayed), 0) / n,
    genericCE: ps.reduce((s, p) => s + ce(p.pPlayedGeneric), 0) / n,
  }
}

export const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

export const fmtThink = (s: number) =>
  s < 60
    ? `${s}s`
    : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`

export const pct = (x: number, digits = 0) => {
  const v = x * 100
  if (v > 0 && v < 1) return '<1%'
  return `${v.toFixed(digits)}%`
}

/* ------------------------------------------------------------------ */
/* Opening tree (two colour assignments).                              */
/* ------------------------------------------------------------------ */

export interface TreeNode {
  san: string
  /** The mover's model. */
  p: number
  /** Generic 2750. */
  g: number
  note?: string
  children?: TreeNode[]
}

export const TREE_GUKESH_WHITE: TreeNode[] = [
  {
    san: 'e4',
    p: 0.57,
    g: 0.49,
    children: [
      {
        san: 'e5',
        p: 0.54,
        g: 0.41,
        children: [
          {
            san: 'Nf3',
            p: 0.94,
            g: 0.9,
            children: [
              {
                san: 'Nc6',
                p: 0.89,
                g: 0.79,
                children: [
                  {
                    san: 'Bb5',
                    p: 0.58,
                    g: 0.55,
                    children: [
                      {
                        san: 'a6',
                        p: 0.6,
                        g: 0.62,
                        note: 'Most likely 6-ply line: the Ruy Lopez, 3...a6',
                      },
                      {
                        san: 'Nf6',
                        p: 0.36,
                        g: 0.31,
                        children: [
                          {
                            san: 'd3',
                            p: 0.62,
                            g: 0.5,
                            children: [
                              {
                                san: 'Bc5',
                                p: 0.51,
                                g: 0.44,
                                children: [
                                  {
                                    san: 'Bxc6',
                                    p: 0.27,
                                    g: 0.45,
                                    note: 'Gukesh takes on c6 only 27% of the time, a generic 2750 45%',
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    san: 'Bc4',
                    p: 0.34,
                    g: 0.32,
                    children: [
                      {
                        san: 'Bc5',
                        p: 0.62,
                        g: 0.55,
                        children: [
                          {
                            san: 'O-O',
                            p: 0.21,
                            g: 0.13,
                            note: 'In the Italian, Gukesh castles early 21% vs 13% generic',
                          },
                          { san: 'c3', p: 0.48, g: 0.52 },
                        ],
                      },
                      { san: 'Nf6', p: 0.36, g: 0.42 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        san: 'c5',
        p: 0.35,
        g: 0.38,
        children: [
          {
            san: 'Nf3',
            p: 0.88,
            g: 0.84,
            children: [
              {
                san: 'd6',
                p: 0.37,
                g: 0.55,
                note: 'Sindarov plays 2...d6 far less than a generic 2750',
              },
              { san: 'Nc6', p: 0.32, g: 0.23 },
              { san: 'e6', p: 0.29, g: 0.2 },
            ],
          },
        ],
      },
      { san: 'e6', p: 0.05, g: 0.1 },
      { san: 'c6', p: 0.04, g: 0.07 },
    ],
  },
  {
    san: 'd4',
    p: 0.26,
    g: 0.38,
    children: [
      {
        san: 'Nf6',
        p: 0.69,
        g: 0.6,
        children: [
          { san: 'c4', p: 0.78, g: 0.81 },
          { san: 'Nf3', p: 0.19, g: 0.16 },
        ],
      },
      {
        san: 'd5',
        p: 0.27,
        g: 0.34,
        children: [
          { san: 'c4', p: 0.71, g: 0.8 },
          { san: 'Nf3', p: 0.15, g: 0.17 },
          {
            san: 'Bf4',
            p: 0.12,
            g: 0.01,
            note: 'The London: Gukesh 12%, a generic 2750 1%',
          },
        ],
      },
    ],
  },
  {
    san: 'Nf3',
    p: 0.09,
    g: 0.07,
    children: [
      {
        san: 'd5',
        p: 0.48,
        g: 0.45,
        children: [
          {
            san: 'g3',
            p: 0.41,
            g: 0.38,
            children: [
              {
                san: 'Bg4',
                p: 0.16,
                g: 0.05,
                note: 'Sindarov answers 2.g3 with 2...Bg4 three times as often',
              },
              { san: 'Nf6', p: 0.52, g: 0.6 },
            ],
          },
        ],
      },
    ],
  },
  { san: 'c4', p: 0.06, g: 0.05 },
]

export const TREE_SINDAROV_WHITE: TreeNode[] = [
  {
    san: 'e4',
    p: 0.6,
    g: 0.52,
    children: [
      {
        san: 'e5',
        p: 0.55,
        g: 0.44,
        children: [
          {
            san: 'Nf3',
            p: 0.95,
            g: 0.9,
            children: [
              {
                san: 'Nc6',
                p: 0.82,
                g: 0.78,
                note: 'Most likely 4-ply line, 27%',
                children: [
                  {
                    san: 'Bc4',
                    p: 0.44,
                    g: 0.33,
                    note: 'Sindarov goes Italian in 22% of his White games',
                  },
                  { san: 'Bb5', p: 0.46, g: 0.55 },
                ],
              },
              { san: 'Nf6', p: 0.16, g: 0.19 },
            ],
          },
        ],
      },
      { san: 'c5', p: 0.32, g: 0.36 },
      {
        san: 'c6',
        p: 0.07,
        g: 0.08,
        note: 'Gukesh keeps some Caro-Kann in reserve',
      },
    ],
  },
  {
    san: 'd4',
    p: 0.2,
    g: 0.33,
    children: [
      {
        san: 'Nf6',
        p: 0.7,
        g: 0.62,
        children: [
          {
            san: 'c4',
            p: 0.8,
            g: 0.8,
            children: [
              { san: 'e6', p: 0.52, g: 0.41 },
              { san: 'g6', p: 0.12, g: 0.22 },
            ],
          },
        ],
      },
      { san: 'd5', p: 0.26, g: 0.33 },
    ],
  },
  { san: 'Nf3', p: 0.12, g: 0.09 },
  { san: 'c4', p: 0.06, g: 0.05 },
]

/* ------------------------------------------------------------------ */
/* Player analytics (classical OTB, 2023-2026).                        */
/* ------------------------------------------------------------------ */

export const ANALYTICS = {
  gukesh: {
    thinkOpening: 27,
    thinkMiddle: 140,
    clockAt40: 0.14,
    shortBefore40: 0.6,
    blunderAll: 0.016,
    blunderUnder2: 0.046,
    gameLength: 47.9,
    queensOff20: 0.15,
    asWhite: [
      ['1.d4', 0.43],
      ['1.e4', 0.42],
      ['other', 0.15],
    ] as [string, number][],
    asBlack: [
      '1...Nf6 vs 1.d4 (QGD, Ragozin 12%)',
      '1...e5 vs 1.e4 (Italian, Berlin)',
      'some Caro-Kann',
    ],
    novelty: '13-14',
  },
  sindarov: {
    thinkOpening: 13,
    thinkMiddle: 84,
    clockAt40: 0.21,
    shortBefore40: 0.41,
    blunderAll: 0.013,
    blunderUnder2: 0.031,
    gameLength: 45.5,
    queensOff20: 0.2,
    asWhite: [
      ['1.e4', 0.76],
      ['1.d4', 0.14],
      ['other', 0.1],
    ] as [string, number][],
    asBlack: [
      "King's Indian vs 1.d4",
      '3...a6 Ruy Lopez vs 1.e4',
      '2...e6 Sicilian',
    ],
    novelty: '–',
  },
  peers: {
    thinkOpening: 17,
    thinkMiddle: 127,
    clockAt40: 0.16,
    shortBefore40: 0.44,
    blunderAll: 0.013,
    blunderUnder2: 0.036,
    gameLength: 45.1,
    queensOff20: 0.2,
  },
}

/**
 * Typical clock left (share of the 120-minute base) by move number, no
 * increment before move 41: median thinks for moves 1-10 and 11-20 from the
 * brief, and a steady spend over 21-40 that lands on the brief's "clock
 * left after move 40".
 */
export const clockCurve = (who: PlayerId | 'peers', move: number) => {
  const a = who === 'peers' ? ANALYTICS.peers : ANALYTICS[who]
  const used20 = 10 * a.thinkOpening + 10 * a.thinkMiddle
  const used40 = (1 - a.clockAt40) * BASE_SECONDS
  const late = (used40 - used20) / 20
  const m = Math.min(move, 40)
  const used =
    Math.min(m, 10) * a.thinkOpening +
    Math.max(0, Math.min(m, 20) - 10) * a.thinkMiddle +
    Math.max(0, m - 20) * late
  return 1 - used / BASE_SECONDS
}

/* ------------------------------------------------------------------ */
/* Benchmarks (held-out, 2600+).                                       */
/* ------------------------------------------------------------------ */

export const BENCHMARKS = [
  {
    name: 'Gukesh-/Sindarov-Maia',
    top1: 0.696,
    color: PREDICTOR_COLORS.maia,
    ours: true,
  },
  { name: 'Allie 2.1 + Stockfish', top1: 0.685, color: PREDICTOR_COLORS.allie },
  { name: 'Generic Maia-3', top1: 0.615, color: PREDICTOR_COLORS.generic },
  { name: 'Allie 2.1', top1: 0.622, color: PREDICTOR_COLORS.allie },
  {
    name: "Stockfish's best move",
    top1: 0.57,
    color: PREDICTOR_COLORS.stockfish,
  },
  { name: 'Maia-2', top1: 0.45, color: PREDICTOR_COLORS.generic },
]

/** Bot-vs-bot simulation of past form (experimental, needs sign-off). */
export const SIMULATION = {
  draw: 0.579,
  gukeshScore: [0.41, 0.45] as [number, number],
}

export const MATCH_GAMES_ASSUMED = 14
