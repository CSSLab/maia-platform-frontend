import { Chess, PieceSymbol } from 'chess.ts'
import { cpToWinrate } from 'src/utils/stockfish'

type StockfishEvals = Record<string, number>
type MaiaEvals = Record<string, number[]>

type DescriptionSegment =
  | { type: 'text'; content: string }
  | { type: 'move'; san: string; uci: string }

/* ───────── helpers that enforce the literal type ───────── */

const textSeg = (content: string): DescriptionSegment => ({
  type: 'text',
  content,
})
const moveSeg = (san: string, uci: string): DescriptionSegment => ({
  type: 'move',
  san,
  uci,
})

/* ───────────── outcome phrases with verb ───────────── */

const OUTCOME = {
  overwhelming: {
    sing: [
      'gives an overwhelming winning advantage',
      'yields a crushing advantage',
      'secures a decisive winning advantage',
    ],
    plur: [
      'give an overwhelming winning advantage',
      'yield a crushing advantage',
      'secure a decisive winning advantage',
    ],
  },
  win: {
    sing: [
      'gives a winning advantage',
      'secures a clear win',
      'offers a position to win',
    ],
    plur: [
      'give a winning advantage',
      'secure a clear win',
      'offer a position to win',
    ],
  },
  advantage: {
    sing: ['offers an advantage', 'gives a tangible edge', 'creates pressure'],
    plur: ['offer an advantage', 'give a tangible edge', 'create pressure'],
  },
  balance: {
    sing: ['holds equality', 'maintains the balance', 'keeps the game level'],
    plur: ['hold equality', 'maintain the balance', 'keep the game level'],
  },
  hold: {
    sing: ['defends the position', 'holds a difficult position', 'clings on'],
    plur: ['defend the position', 'hold a difficult position', 'cling on'],
  },
  stay: {
    sing: [
      'keeps the game alive',
      'stays in the game',
      'preserves survival chances',
    ],
    plur: [
      'keep the game alive',
      'stay in the game',
      'preserve survival chances',
    ],
  },
} as const

/* ───────────── other phrase banks ───────────── */

const FINDABILITY = {
  hard: [
    'hard for human players to find',
    'very tough for humans to spot',
    'challenging for most players to see',
  ],
  skilled: [
    'findable for skilled players',
    'within reach for experienced players',
    'findable for strong players',
  ],
  straight: [
    'straightforward for players across skill levels to find',
    'easy for players of all strengths to spot',
    'obvious to most players',
  ],
} as const

const CAREFUL = [
  'Tread carefully',
  'Be alert',
  'Stay sharp',
  'Watch out',
] as const
const TEMPTING_INTRO = [
  'There',
  'Be careful, as there',
  'In this position there',
] as const
const TEMPT_ADJ = ['tempting', 'enticing', 'natural-looking'] as const
const TEMPT_NOUN = ['alternatives', 'ways to go wrong'] as const

/* ───────────────── constants & maths ───────────────── */

const EPS = 0.08
const BLUNDER_GAP = 0.1

const winRate = (p: number): number => 1 / (1 + Math.exp(-(p - 1) / 0.8))
const wdl = (p: number): { w: number; d: number } => {
  const w = winRate(p)
  const l = winRate(-p)
  return { w, d: 1 - w - l }
}

/* ───── deterministic PRNG (seeded by FEN) ───── */

const hash32 = (str: string): number => {
  let h = 0x811c9dc5
  // eslint-disable-next-line no-bitwise
  for (let i = 0; i < str.length; i += 1)
    // eslint-disable-next-line no-bitwise
    h = Math.imul(h ^ str.charCodeAt(i), 0x1000193)
  // eslint-disable-next-line no-bitwise
  return h >>> 0
}

const makeRng =
  (seed0: number): (() => number) =>
  () => {
    // eslint-disable-next-line no-param-reassign, no-bitwise
    seed0 = (seed0 * 1664525 + 1013904223) & 0xffffffff
    return seed0 / 0x100000000
  }

const makePicker =
  (rand: () => number) =>
  <T>(arr: readonly T[]): T =>
    arr[Math.floor(rand() * arr.length)] ?? arr[0]

/* ============================================================ */

export function describePosition(
  fen: string,
  sf: StockfishEvals,
  maia: MaiaEvals,
  whiteToMove: boolean,
): { segments: DescriptionSegment[] } {
  const pick = makePicker(makeRng(hash32(fen)))

  /* ---------- board ---------- */
  const chess = new Chess(fen)
  const legal = new Set<string>()
  chess.moves({ verbose: true }).forEach((m) => {
    legal.add(m.from + m.to + (m.promotion ?? ''))
  })

  const moves = Object.keys(sf).filter((m) => legal.has(m))
  if (moves.length === 0) {
    return { segments: [textSeg('No legal moves available.')] }
  }

  /* ---------- evals in pawns ---------- */
  const sideEval = Object.fromEntries(
    Object.entries(sf).map(([m, v]) => [m, whiteToMove ? v : -v]),
  )
  const seval: Record<string, number> = {}
  moves.forEach((m) => {
    seval[m] = sideEval[m] * 0.01
  })

  /* ---------- good-move set ---------- */
  const opt = moves.reduce((a, b) => (seval[a] > seval[b] ? a : b))
  const { w: wOpt, d: dOpt } = wdl(seval[opt])

  const good = moves.filter((m) => {
    const { w, d } = wdl(seval[m])
    return Math.abs(w - wOpt) <= EPS && Math.abs(d - dOpt) <= EPS
  })
  const nGood = good.length

  /* ---------- helpers ---------- */
  const toSan = (uci: string): string => {
    const mv = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
    })
    const san = mv?.san ?? uci
    chess.undo()
    return san
  }

  const sortedGood = [...good].sort((a, b) => seval[b] - seval[a])
  const bestMoveSan = toSan(opt)

  const optCloseSecond =
    sortedGood.length >= 2 &&
    (() => {
      const { w: w2, d: d2 } = wdl(seval[sortedGood[1]])
      return Math.abs(wOpt - w2) <= EPS / 2 && Math.abs(dOpt - d2) <= EPS / 2
    })()

  const goodSegs = sortedGood.slice(0, 3).map((uci) => moveSeg(toSan(uci), uci))
  const goodSegsNoOpt = sortedGood
    .filter((m) => m !== opt)
    .slice(0, 3)
    .map((uci) => moveSeg(toSan(uci), uci))

  /* ---------- outcome phrase ---------- */
  const avgGood = sortedGood.reduce((s, m) => s + seval[m], 0) / nGood
  const outCat =
    avgGood > 3
      ? 'overwhelming'
      : avgGood > 1.5
        ? 'win'
        : avgGood > 0.35
          ? 'advantage'
          : avgGood >= -0.35
            ? 'balance'
            : avgGood >= -1.5
              ? 'hold'
              : 'stay'

  const outcomePhrase =
    nGood === 1 ? pick(OUTCOME[outCat].sing) : pick(OUTCOME[outCat].plur)

  /* ---------- Maia stats ---------- */
  let setLv = 0
  let optLv = 0
  let temptLv = 0
  let maxTopProbNonOpt = 0
  const temptCnt: Record<string, number> = {}
  const aggProb: Record<string, number> = {}

  for (let lvl = 0; lvl < 9; lvl += 1) {
    const probs = moves
      .map((m) => [maia[m]?.[lvl] ?? 0, m] as [number, string])
      .sort((a, b) => b[0] - a[0])

    const [p1, m1] = probs[0]
    const [p2, m2] = probs[1] ?? [0, '']
    const [p3, m3] = probs[2] ?? [0, '']

    if (m1 !== opt) maxTopProbNonOpt = Math.max(maxTopProbNonOpt, p1)
    if (good.includes(m1)) setLv += 1
    if (m1 === opt) optLv += 1

    probs.slice(0, 4).forEach(([p, m]) => {
      aggProb[m] = (aggProb[m] ?? 0) + p
    })

    const nearTop = (pr: number): boolean => p1 - pr <= EPS
    const markTempt = (m: string): boolean => {
      temptCnt[m] = (temptCnt[m] ?? 0) + 1
      return true
    }

    const isNearBad =
      (m2 && !good.includes(m2) && nearTop(p2) && markTempt(m2)) ||
      (m3 && !good.includes(m3) && nearTop(p3) && markTempt(m3))

    if (isNearBad) temptLv += 1
  }

  /* ---------- tiers & phrasing ---------- */
  const tier = (k: number): 0 | 1 | 2 => (k <= 2 ? 0 : k <= 6 ? 1 : 2)
  const setT = tier(setLv)
  const optT = tier(optLv)
  const bestHarder = optT < setT && !optCloseSecond

  const phrSet =
    setT === 0
      ? pick(FINDABILITY.hard)
      : setT === 1
        ? pick(FINDABILITY.skilled)
        : pick(FINDABILITY.straight)

  let phrBest: string = pick(
    optT === 0
      ? FINDABILITY.hard
      : optT === 1
        ? FINDABILITY.skilled
        : FINDABILITY.straight,
  )
  if (optT === 1 && bestHarder) phrBest = `only ${phrBest}`

  /* ---------- blunders ---------- */
  const optWR = cpToWinrate(seval[opt] * 100)
  const isBlunder = (m: string): boolean =>
    optWR - cpToWinrate(seval[m] * 100) >= BLUNDER_GAP

  const topOverall = Object.entries(aggProb).sort((a, b) => b[1] - a[1])[0][0]
  const overallTopIsBlunder = isBlunder(topOverall)

  const topNonGood = Object.entries(aggProb)
    .filter(([m]) => !good.includes(m))
    .sort((a, b) => b[1] - a[1])[0]?.[0]

  const top4 = Object.entries(aggProb)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  let blunderMove: string | null = null
  if (topNonGood && isBlunder(topNonGood)) blunderMove = topNonGood
  else {
    for (const [m, p] of top4) {
      if (p > 0.15 && isBlunder(m)) {
        blunderMove = m
        break
      }
    }
  }

  /* ---------- treacherous? ---------- */
  const totalProb = Object.values(aggProb).reduce((s, p) => s + p, 0)
  const blMass = Object.entries(aggProb)
    .filter(([m]) => isBlunder(m))
    .reduce((s, [, p]) => s + p, 0)
  const treach = totalProb > 0 && blMass / totalProb > 0.4

  /* ---------- tail segments ---------- */
  const tail: DescriptionSegment[] = []
  const prefix = setT === 2 && !bestHarder ? ', however' : ''
  const temptAdj = pick(TEMPT_ADJ)
  const temptNoun = pick(TEMPT_NOUN)

  if (blunderMove && treach) {
    tail.push(
      textSeg(
        ` ${pick(CAREFUL)}${prefix}, this position is highly treacherous! ` +
          `It is easy to go astray with ${temptAdj} blunders like `,
      ),
      moveSeg(toSan(blunderMove), blunderMove),
      textSeg('.'),
    )
  } else if (blunderMove) {
    tail.push(
      textSeg(
        ` ${pick(CAREFUL)}${prefix}! There is a ${temptAdj} blunder in this ` +
          'position: ',
      ),
      moveSeg(toSan(blunderMove), blunderMove),
      textSeg('.'),
    )
  }

  /* ---- tempting-alternatives rule ---- */
  const alwaysWarn = setT < 2 && maxTopProbNonOpt > 0.1
  const showTempt = alwaysWarn || (setT === 2 && temptLv > 4)

  if (!blunderMove && showTempt) {
    let temptUci =
      Object.entries(temptCnt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    if (!temptUci) {
      temptUci =
        Object.entries(aggProb)
          .filter(([m]) => !good.includes(m))
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    }

    const intro = pick(TEMPTING_INTRO)
    if (temptUci) {
      tail.push(
        textSeg(
          ` ${intro}${prefix} are also ${temptAdj} ${temptNoun}, such as `,
        ),
        moveSeg(toSan(temptUci), temptUci),
        textSeg('.'),
      )
    } else {
      tail.push(
        textSeg(` ${intro}${prefix} are also ${temptAdj} ${temptNoun}.`),
      )
    }
  }

  /* ---------- concise main sentence ---------- */
  const main: DescriptionSegment[] = []
  const list = bestHarder ? goodSegsNoOpt : goodSegs
  const pron = nGood === 1 ? 'it is' : 'they are'

  if (nGood === 1) {
    main.push(textSeg('Only '), ...list)
  } else if (nGood === 2) {
    main.push(textSeg('Both '), list[0], textSeg(' and '), list[1])
  } else {
    main.push(list[0], textSeg(', '), list[1], textSeg(', and '), list[2])
  }

  if (bestHarder) {
    main.push(
      textSeg(` ${outcomePhrase}, and ${pron} ${phrSet}, but the best move (`),
      moveSeg(bestMoveSan, opt),
      textSeg(`) is ${phrBest}.`),
    )
  } else {
    main.push(textSeg(` ${outcomePhrase}, and ${pron} ${phrSet}.`))
  }

  /* ---------- assemble in required order ---------- */
  const segments = overallTopIsBlunder ? [...tail, ...main] : [...main, ...tail]
  return { segments }
}
