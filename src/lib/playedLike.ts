import calibration from './playedLikeCalibration.json'

/**
 * "Played like ~X": a rating estimate for one player from the moves of one
 * game, with the moves that moved it most.
 *
 * The estimate is a posterior over rating r from Maia's probability of each
 * move the player made, at the 21 analysis levels (600..2600):
 *
 *   log post(r) = log prior(r)
 *               + beta * sum_t a_t * log[(1 - eps) * p_t(m(r)) + eps / nLegal_t]
 *   m(r)        = 1600 + slope * (r - 1600 - delta)  (slope * slope_lo below 1200)
 *
 * - m(r) is the Maia level that plays like a Lichess blitz rating r: the
 *   browser model's levels sit about 110 points below Lichess-2022 ratings;
 * - beta < 1 tempers for moves within a game not being independent;
 * - eps is a lapse rate (fits to ~0: one move cannot outweigh a game);
 * - a_t re-weights opening moves, decided positions, time scrambles (x1/3)
 *   and instant moves;
 * - the prior is weak, N(1660, 600), so the range is honest at every rating;
 *   the population's own distribution would pull players far from the middle
 *   toward it (a typical game by a 2400 would read ~2150). Each move's
 *   "players who play this average ~X" uses the population prior, since it is
 *   a claim about the population.
 *
 * Parameters were fitted in maia3-private (code/played_like, branch
 * claude/played-like) on Lichess blitz games scored with the same ONNX model
 * the browser runs, Maia queried with elo_self = elo_oppo = level as the
 * analysis page caches it. The score is a sum over moves, so each move's
 * contribution (how far the estimate moves without it) is exact.
 * playedLike.parity.json checks this port against the Python reference.
 */

export const PLAYED_LIKE_LEVELS: number[] = calibration.levels

/** Rating grid the posterior lives on. */
const GRID: number[] = []
for (
  let r = calibration.grid.lo;
  r <= calibration.grid.hi;
  r += calibration.grid.step
) {
  GRID.push(r)
}
/** Lichess blitz rating distribution: for "players who play this move average ~X". */
const POPULATION_PRIOR: number[] = calibration.prior.log_p
const KNEE: number = calibration.knee

export type PlayedLikeVariant = keyof typeof calibration.variants

interface VariantParams {
  beta: number
  eps: number
  delta: number
  slope: number
  slope_lo: number
  u_book?: number
  u_decided?: number
  u_scramble?: number
  u_fast?: number
}

/** The Maia level that plays like a player rated r (clamped to the levels). */
const levelOf = (r: number, v: VariantParams): number => {
  const mKnee = 1600 + v.slope * (KNEE - 1600 - v.delta)
  const m =
    r < KNEE
      ? mKnee + v.slope * v.slope_lo * (r - KNEE)
      : 1600 + v.slope * (r - 1600 - v.delta)
  const lo = PLAYED_LIKE_LEVELS[0]
  const hi = PLAYED_LIKE_LEVELS[PLAYED_LIKE_LEVELS.length - 1]
  return Math.min(hi, Math.max(lo, m))
}

export interface PlayedLikeMove {
  /** Index of the move in the game (0 = White's first move). */
  ply: number
  /** The move's number (1 for 1. e4 and 1... e5). */
  moveNumber: number
  san: string
  uci: string
  /** Maia's probability of the move played, at each of PLAYED_LIKE_LEVELS. */
  probs: number[]
  /** Number of legal moves in the position. */
  nLegal: number
  /** Stockfish's eval before the move, for the side to move, in centipawns (mates +-10000). */
  cpBefore?: number | null
  /** Seconds on the mover's clock before the move. */
  clockBefore?: number | null
  /** Seconds the mover spent on the move. */
  spent?: number | null
}

export interface PlayedLikeContribution {
  ply: number
  moveNumber: number
  san: string
  /** How far this move moved the estimate (estimate with it minus without it), in rating points. */
  shift: number
  /**
   * The average rating of players who play this move here, by Maia and the
   * population prior (this move alone).
   */
  typical: number
  /** Maia's probability of the move at each of PLAYED_LIKE_LEVELS. */
  probs: number[]
  /** Whether the move counted for less (opening, decided position, scramble, instant move). */
  downWeighted: boolean
}

export interface PlayedLikeEstimate {
  /** Posterior mean, in rating points. */
  mean: number
  /** The mean rounded to the nearest 50 for display. */
  rounded: number
  median: number
  /** 80% interval. */
  lo80: number
  hi80: number
  sd: number
  nMoves: number
  variant: PlayedLikeVariant
  /** At the top or bottom of the range Maia's levels cover. */
  atCeiling: boolean
  atFloor: boolean
  /** Interval wider than LOW_CONFIDENCE_WIDTH. */
  lowConfidence: boolean
  /** The posterior on a 10-point grid (for a small chart). */
  curve: { rating: number; p: number }[]
  /** Every move's contribution, largest |shift| first. */
  contributions: PlayedLikeContribution[]
}

export const PLAYED_LIKE_MIN_MOVES: number = calibration.min_moves
/** 80% intervals wider than this are shown as low confidence. */
export const LOW_CONFIDENCE_WIDTH = 900

const T = calibration.thresholds

/** Which fitted variant the available inputs support. */
export const variantFor = (moves: PlayedLikeMove[]): PlayedLikeVariant => {
  const hasClock = moves.every((m) => m.clockBefore != null && m.spent != null)
  const hasSf = moves.every((m) => m.cpBefore != null)
  if (hasClock && hasSf) return 'full'
  if (hasSf) return 'sf'
  return 'book'
}

const moveLogLik = (m: PlayedLikeMove, eps: number): number[] =>
  m.probs.map((p) => Math.log((1 - eps) * Math.max(p, 0) + eps / m.nLegal))

const moveWeight = (
  m: PlayedLikeMove,
  v: VariantParams,
  variant: PlayedLikeVariant,
): { w: number; down: boolean } => {
  let w = v.beta
  let down = false
  const apply = (cond: boolean, u: number | undefined) => {
    if (cond && u) {
      w *= Math.exp(u)
      if (u < 0) down = true
    }
  }
  apply(m.moveNumber <= T.book_moves, v.u_book)
  if (variant === 'full' || variant === 'sf') {
    apply(Math.abs(m.cpBefore ?? 0) >= T.decided_cp, v.u_decided)
  }
  if (variant === 'full') {
    apply((m.clockBefore ?? Infinity) < T.scramble_s, v.u_scramble)
    apply((m.spent ?? Infinity) <= T.fast_s, v.u_fast)
  }
  return { w, down }
}

/** Interpolation weights from the 21 levels onto the rating grid, per variant. */
const interpCache = new Map<PlayedLikeVariant, { j: number; t: number }[]>()
const interpFor = (variant: PlayedLikeVariant, v: VariantParams) => {
  let w = interpCache.get(variant)
  if (!w) {
    w = GRID.map((r) => {
      const m = levelOf(r, v)
      const j = Math.min(
        Math.floor((m - PLAYED_LIKE_LEVELS[0]) / 100),
        PLAYED_LIKE_LEVELS.length - 2,
      )
      return { j, t: (m - PLAYED_LIKE_LEVELS[j]) / 100 }
    })
    interpCache.set(variant, w)
  }
  return w
}

const gaussianPrior = (mean: number, sd: number): number[] =>
  GRID.map((r) => -0.5 * ((r - mean) / sd) ** 2)

const normalize = (logp: number[]): number[] => {
  const mx = Math.max(...logp)
  const p = logp.map((x) => Math.exp(x - mx))
  const s = p.reduce((a, b) => a + b, 0)
  return p.map((x) => x / s)
}

const meanOf = (post: number[]): number =>
  post.reduce((a, p, i) => a + p * GRID[i], 0)

const quantile = (post: number[], q: number): number => {
  let c = 0
  for (let i = 0; i < post.length; i++) {
    c += post[i]
    if (c >= q) return GRID[i]
  }
  return GRID[GRID.length - 1]
}

const posteriorOf = (
  sum: number[],
  prior: number[],
  interp: { j: number; t: number }[],
): number[] =>
  normalize(
    interp.map(({ j, t }, i) => sum[j] * (1 - t) + sum[j + 1] * t + prior[i]),
  )

/**
 * The estimate for one player from their moves, or null with fewer than
 * PLAYED_LIKE_MIN_MOVES moves.
 */
export const estimatePlayedLike = (
  moves: PlayedLikeMove[],
  options: {
    variant?: PlayedLikeVariant
    /**
     * The prior for the estimate. Default: the weak prior in the calibration
     * (honest ranges at every rating). 'population' gives the best guess of the
     * player's rating instead, but pulls players far from the middle toward
     * it (a typical game by a 2400 reads ~2150).
     */
    prior?: { mean: number; sd: number } | 'population'
  } = {},
): PlayedLikeEstimate | null => {
  const usable = moves.filter(
    (m) => m.probs.length === PLAYED_LIKE_LEVELS.length && m.nLegal > 0,
  )
  if (usable.length < PLAYED_LIKE_MIN_MOVES) return null
  const variant = options.variant ?? variantFor(usable)
  const v = calibration.variants[variant] as VariantParams
  const priorParams = options.prior ?? calibration.headline_prior
  const prior =
    options.prior === 'population'
      ? POPULATION_PRIOR
      : gaussianPrior(
          (priorParams as { mean: number; sd: number }).mean,
          (priorParams as { mean: number; sd: number }).sd,
        )
  const interp = interpFor(variant, v)

  const L = usable.map((m) => moveLogLik(m, v.eps))
  const W = usable.map((m) => moveWeight(m, v, variant))
  const wL = L.map((l, t) => l.map((x) => x * W[t].w))
  const sum = PLAYED_LIKE_LEVELS.map((_, j) =>
    wL.reduce((a, row) => a + row[j], 0),
  )
  const post = posteriorOf(sum, prior, interp)
  const mean = meanOf(post)
  const sd = Math.sqrt(
    Math.max(post.reduce((a, p, i) => a + p * GRID[i] ** 2, 0) - mean ** 2, 0),
  )
  const lo80 = quantile(post, 0.1)
  const hi80 = quantile(post, 0.9)
  const median = quantile(post, 0.5)

  const contributions: PlayedLikeContribution[] = usable.map((m, t) => {
    const without = sum.map((x, j) => x - wL[t][j])
    const single = posteriorOf(L[t], POPULATION_PRIOR, interp)
    return {
      ply: m.ply,
      moveNumber: m.moveNumber,
      san: m.san,
      shift: mean - meanOf(posteriorOf(without, prior, interp)),
      typical: meanOf(single),
      probs: m.probs,
      downWeighted: W[t].down,
    }
  })
  contributions.sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))

  // ratings beyond which Maia's levels say nothing more
  const top =
    GRID.find(
      (r) => levelOf(r, v) >= PLAYED_LIKE_LEVELS[PLAYED_LIKE_LEVELS.length - 1],
    ) ?? GRID[GRID.length - 1]
  const bottom =
    [...GRID].reverse().find((r) => levelOf(r, v) <= PLAYED_LIKE_LEVELS[0]) ??
    GRID[0]
  return {
    mean,
    rounded: Math.round(mean / 50) * 50,
    median,
    lo80,
    hi80,
    sd,
    nMoves: usable.length,
    variant,
    atCeiling: median >= top - 50,
    atFloor: median <= bottom + 50,
    lowConfidence: hi80 - lo80 > LOW_CONFIDENCE_WIDTH,
    curve: GRID.map((rating, i) => ({ rating, p: post[i] })),
    contributions,
  }
}

/** Maia's probability of `uci` at each level, from a position's Maia evaluations keyed maia_kdd_<level>. */
export const probsByLevel = (
  maia: { [model: string]: { policy: { [move: string]: number } } } | undefined,
  uci: string,
): { probs: number[]; nLegal: number } | null => {
  if (!maia) return null
  const probs: number[] = []
  let nLegal = 0
  for (const level of PLAYED_LIKE_LEVELS) {
    const policy = maia[`maia_kdd_${level}`]?.policy
    if (!policy) return null
    probs.push(policy[uci] ?? 0)
    nLegal = Math.max(nLegal, Object.keys(policy).length)
  }
  return { probs, nLegal }
}

/**
 * Clock inputs from a game's clocks (clocksAfter[i] = seconds left for the
 * mover after move i, as in a PGN's [%clk]) and its increment.
 */
export const clockInputs = (
  clocksAfter: (number | null | undefined)[],
  ply: number,
  baseSeconds: number,
  incrementSeconds: number,
): { clockBefore: number | null; spent: number | null } => {
  const after = clocksAfter[ply]
  const before = ply >= 2 ? clocksAfter[ply - 2] : baseSeconds
  if (after == null || before == null) return { clockBefore: null, spent: null }
  return {
    clockBefore: before,
    spent: Math.max(0, before - after + incrementSeconds),
  }
}

/**
 * A short line about a move's contribution, e.g. "Players who play 23. Nxe5
 * here average ~2050".
 */
export const describeContribution = (
  c: PlayedLikeContribution,
  color: 'white' | 'black',
): string => {
  const label =
    color === 'white'
      ? `${c.moveNumber}. ${c.san}`
      : `${c.moveNumber}... ${c.san}`
  return `Players who play ${label} here average ~${Math.round(c.typical / 50) * 50}`
}
