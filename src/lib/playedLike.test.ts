import {
  PLAYED_LIKE_LEVELS,
  PLAYED_LIKE_MIN_MOVES,
  PlayedLikeMove,
  clockInputs,
  describeContribution,
  estimatePlayedLike,
  probsByLevel,
  variantFor,
} from './playedLike'
import parity from './playedLike.parity.json'

/** Probability of the move at each level, rising (good move) or falling (blunder) with rating. */
const curve = (f: (r: number) => number) => PLAYED_LIKE_LEVELS.map(f)
const good = curve((r) => 0.1 + 0.5 * ((r - 600) / 2000))
const blunder = curve((r) => 0.2 * Math.exp(-(r - 600) / 400))
const flat = curve(() => 0.3)

const move = (
  ply: number,
  probs: number[],
  extra: Partial<PlayedLikeMove> = {},
): PlayedLikeMove => ({
  ply,
  moveNumber: Math.floor(ply / 2) + 1,
  san: `m${ply}`,
  uci: 'e2e4',
  probs,
  nLegal: 30,
  ...extra,
})

const game = (probs: number[][]) => probs.map((p, i) => move(20 + 2 * i, p))

describe('estimatePlayedLike', () => {
  it('needs enough moves', () => {
    expect(
      estimatePlayedLike(game(Array(PLAYED_LIKE_MIN_MOVES - 1).fill(flat))),
    ).toBeNull()
  })

  it('rates a game of strong moves above one of blunders', () => {
    const strong = estimatePlayedLike(game(Array(30).fill(good)))!
    const weak = estimatePlayedLike(game(Array(30).fill(blunder)))!
    expect(strong.mean).toBeGreaterThan(weak.mean + 300)
    expect(strong.lo80).toBeLessThanOrEqual(strong.median)
    expect(strong.median).toBeLessThanOrEqual(strong.hi80)
  })

  it('leaves the prior alone for uninformative moves', () => {
    const e = estimatePlayedLike(game(Array(20).fill(flat)))!
    // flat likelihood -> posterior = prior (truncated to 600..2600)
    expect(Math.abs(e.mean - 1660)).toBeLessThan(30)
    expect(Math.abs(e.contributions[0].shift)).toBeLessThan(1)
  })

  it('ranks the blunder first and says it pulled the estimate down', () => {
    const moves = [...Array(25).fill(flat), blunder]
    const e = estimatePlayedLike(game(moves))!
    expect(e.contributions[0].san).toBe(`m${20 + 2 * 25}`)
    expect(e.contributions[0].shift).toBeLessThan(0)
    expect(e.contributions[0].typical).toBeLessThan(1660)
  })

  it('posterior sums to one', () => {
    const e = estimatePlayedLike(game(Array(12).fill(good)))!
    expect(e.curve.reduce((a, c) => a + c.p, 0)).toBeCloseTo(1, 6)
    expect(e.rounded % 50).toBe(0)
  })

  it('caps the pull of one move with the lapse rate', () => {
    const zero = curve(() => 0)
    const e = estimatePlayedLike(game([...Array(20).fill(good), zero]))!
    expect(Number.isFinite(e.mean)).toBe(true)
  })
})

describe('variantFor', () => {
  it('uses what the inputs support', () => {
    const base = game(Array(10).fill(flat))
    expect(variantFor(base)).toBe('book')
    expect(variantFor(base.map((m) => ({ ...m, cpBefore: 20 })))).toBe('sf')
    expect(
      variantFor(
        base.map((m) => ({ ...m, cpBefore: 20, clockBefore: 100, spent: 3 })),
      ),
    ).toBe('full')
  })
})

describe('helpers', () => {
  it('reads probabilities by level from Maia evaluations', () => {
    const maia: { [k: string]: { policy: { [m: string]: number } } } = {}
    PLAYED_LIKE_LEVELS.forEach((l, i) => {
      maia[`maia_kdd_${l}`] = { policy: { e2e4: i / 100, d2d4: 0.5 } }
    })
    const r = probsByLevel(maia, 'e2e4')!
    expect(r.probs[3]).toBeCloseTo(0.03)
    expect(r.nLegal).toBe(2)
    expect(probsByLevel(maia, 'g1f3')!.probs[0]).toBe(0)
    expect(probsByLevel(undefined, 'e2e4')).toBeNull()
  })

  it('derives clock before and time spent from clocks after each move', () => {
    const clocks = [180, 179, 175, 170]
    expect(clockInputs(clocks, 0, 180, 2)).toEqual({
      clockBefore: 180,
      spent: 2,
    })
    expect(clockInputs(clocks, 2, 180, 2)).toEqual({
      clockBefore: 180,
      spent: 7,
    })
    expect(clockInputs([180, null], 1, 180, 0)).toEqual({
      clockBefore: null,
      spent: null,
    })
  })

  it('describes a contribution', () => {
    const e = estimatePlayedLike(game([...Array(20).fill(flat), blunder]))!
    expect(describeContribution(e.contributions[0], 'white')).toMatch(
      /^Players who play \d+\. m\d+ here average ~\d+$/,
    )
  })
})

describe('parity with the Python reference (maia3-private code/played_like)', () => {
  type Case = (typeof parity.cases)[number]
  const variants = ['book', 'sf', 'full'] as const
  parity.cases.forEach((c: Case, i: number) => {
    variants.forEach((variant) => {
      it(`case ${i} (${c.moves.length} moves), ${variant}`, () => {
        const exp = c.expected[variant]
        const e = estimatePlayedLike(c.moves as PlayedLikeMove[], { variant })!
        expect(e.mean).toBeCloseTo(exp.mean, 1)
        expect(Math.abs(e.median - exp.median)).toBeLessThanOrEqual(10)
        expect(Math.abs(e.lo80 - exp.lo80)).toBeLessThanOrEqual(10)
        expect(Math.abs(e.hi80 - exp.hi80)).toBeLessThanOrEqual(10)
        const top = e.contributions[0]
        expect(top.ply).toBe(exp.top_ply)
        expect(top.shift).toBeCloseTo(exp.top_shift, 1)
        expect(top.typical).toBeCloseTo(exp.top_typical, 1)
      })
    })
  })
})
