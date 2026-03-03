import { cpToWinrate } from 'src/lib'
import { Chess, PieceSymbol } from 'chess.ts'

type StockfishEvals = Record<string, number>
type MaiaEvals = Record<string, number[]>
type MaiaPolicy = Record<string, number>

type DescriptionSegment =
  | { type: 'text'; content: string }
  | { type: 'move'; san: string; uci: string }

type OutcomeBucket = 'winning' | 'advantage' | 'balanced' | 'defensive' | 'lost'

type Candidate = {
  caseId:
    | 'only-found'
    | 'only-missed'
    | 'tempting-miss'
    | 'treacherous'
    | 'hidden-resource'
    | 'narrow-choice'
    | 'real-flexibility'
    | 'winning-conversion'
    | 'losing-defense'
    | 'neutral'
  score: number
  confidence: number
  moves: string[]
  segments: DescriptionSegment[]
}

type CrossCandidate = {
  caseId:
    | 'persistent-trap'
    | 'trap-fades'
    | 'shift-stronger'
    | 'shift-preference'
    | 'only-move-visibility'
  score: number
  moves: string[]
  segments: DescriptionSegment[]
}

const textSeg = (content: string): DescriptionSegment => ({
  type: 'text',
  content,
})
const moveSeg = (san: string, uci: string): DescriptionSegment => ({
  type: 'move',
  san,
  uci,
})

// Thresholds are expressed on a bounded win-probability-like scale derived from cp.
const T_EQUIV = 0.01
const T_SMALL = 0.03
const T_GOOD = 0.04
const T_MEANINGFUL = 0.06
const T_BIG = 0.1
const T_SEVERE = 0.2
const T_ONLY_GAP = 0.12
const T_DECISIVE_WIN = 0.93
const T_DECISIVE_LOSS = 0.07
const T_WIN_KEEP = 0.9
const T_TEMPTING = 0.2
const T_HIDDEN = 0.15
const T_TREACHEROUS = 0.45
const P_SALIENCE = 0.03
const MAX_TEXT_PRIMARY = 190
const MAX_TEXT_TOTAL = 260
const EQ_CP_CAP = 0.4
const GOOD_CP_CAP = 0.75
const GOOD_CP_CAP_EXTREME = 1.0

const ONLY_MOVE_WORDS = [
  'basically forced',
  'the one clear move',
  'the move you have to find',
] as const
const NARROW_WORDS = [
  'It mostly comes down to',
  'This is a two-move decision:',
  'There are two clean choices here:',
] as const
const NATURAL_WORDS = [
  'looks natural',
  'is the natural move',
  'is easy to reach for',
  'is the obvious try',
] as const
const STRONGER_WORDS = [
  'is stronger',
  'is more accurate',
  'holds up better',
] as const
const FLEX_WORDS = [
  'There is real flexibility here:',
  'This is a flexible position:',
  'You have real choice here:',
] as const
const WINNING_WORDS = [
  'You are already winning;',
  'The position is already winning;',
  'You do not need anything fancy here;',
] as const
const LOSING_WORDS = [
  'It is a tough position:',
  'You are in survival mode here:',
  'This is a difficult defense:',
] as const
const KEEP_STATE_SING: Record<OutcomeBucket, readonly string[]> = {
  winning: ['keeps the win in hand', 'keeps the winning edge'],
  advantage: ['keeps the advantage', 'keeps the edge'],
  balanced: ['holds equality', 'keeps the balance'],
  defensive: ['keeps defensive chances alive', 'keeps up the resistance'],
  lost: ['keeps practical chances alive', 'keeps hope alive'],
}
const KEEP_STATE_PLUR: Record<OutcomeBucket, readonly string[]> = {
  winning: ['keep the win in hand', 'keep the winning edge'],
  advantage: ['keep the advantage', 'keep the edge'],
  balanced: ['hold equality', 'keep the balance'],
  defensive: ['keep defensive chances alive', 'keep up the resistance'],
  lost: ['keep practical chances alive', 'keep hope alive'],
}
const KEEP_STATE_MORE_CLEANLY: Record<OutcomeBucket, readonly string[]> = {
  winning: ['keeps the win more cleanly', 'converts more cleanly'],
  advantage: [
    'keeps the edge more cleanly',
    'holds the advantage more cleanly',
  ],
  balanced: ['keeps the balance more cleanly', 'holds equality more cleanly'],
  defensive: [
    'keeps better defensive chances',
    'keeps up the resistance more reliably',
  ],
  lost: ['keeps more practical chances alive', 'keeps hope alive longer'],
}

const hash32 = (s: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i += 1)
    h = Math.imul(h ^ s.charCodeAt(i), 0x1000193)
  return h >>> 0
}
const makeRng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff
  return seed / 0x100000000
}
const makePicker =
  (rnd: () => number) =>
  <T>(arr: readonly T[]): T =>
    arr[Math.floor(rnd() * arr.length)] ?? arr[0]

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x))
const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0)
const avg = (values: number[]) =>
  values.length ? sum(values) / values.length : 0

const topEntries = (
  obj: Record<string, number>,
  n: number,
): Array<[string, number]> =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)

const effectiveMoves = (p: number[]): number => {
  const denom = p.reduce((acc, x) => acc + x * x, 0)
  return denom > 0 ? 1 / denom : 0
}

const segmentTextLength = (segments: DescriptionSegment[]) =>
  segments.reduce(
    (acc, seg) =>
      acc + (seg.type === 'text' ? seg.content.length : seg.san.length),
    0,
  )

const normalizeMap = (obj: Record<string, number>, keys: string[]) => {
  const total = sum(keys.map((k) => Math.max(0, obj[k] ?? 0)))
  const out: Record<string, number> = {}
  keys.forEach((k) => {
    out[k] = total > 0 ? Math.max(0, obj[k] ?? 0) / total : 0
  })
  return out
}

const pickStateBucket = (bestExpected: number): OutcomeBucket => {
  if (bestExpected >= T_DECISIVE_WIN) return 'winning'
  if (bestExpected >= 0.62) return 'advantage'
  if (bestExpected >= 0.38) return 'balanced'
  if (bestExpected >= T_DECISIVE_LOSS) return 'defensive'
  return 'lost'
}

const bestBy = <T>(items: T[], scoreFn: (item: T) => number): T | null => {
  let best: T | null = null
  let bestScore = -Infinity
  items.forEach((item) => {
    const s = scoreFn(item)
    if (s > bestScore) {
      best = item
      bestScore = s
    }
  })
  return best
}

export function describePosition(
  fen: string,
  sf: StockfishEvals,
  maia: MaiaEvals,
  whiteToMove: boolean,
  selectedMaiaPolicy?: MaiaPolicy,
  selectedMaiaIndex?: number,
): { segments: DescriptionSegment[] } {
  const pick = makePicker(makeRng(hash32(fen)))

  const chess = new Chess(fen)
  const legal = new Set<string>()
  chess
    .moves({ verbose: true })
    .forEach((m) => legal.add(m.from + m.to + (m.promotion ?? '')))

  const moves = Object.keys(sf).filter((m) => legal.has(m))
  if (!moves.length) return { segments: [textSeg('No legal moves available.')] }

  const sevalPawns: Record<string, number> = {}
  moves.forEach((m) => {
    const cp = whiteToMove ? sf[m] : -sf[m]
    sevalPawns[m] = cp * 0.01
  })

  const toExpected = (pawns: number) => cpToWinrate(pawns * 100)
  const expected: Record<string, number> = {}
  moves.forEach((m) => {
    expected[m] = toExpected(sevalPawns[m])
  })

  const sortedByExpected = [...moves].sort((a, b) => expected[b] - expected[a])
  const mBest = sortedByExpected[0]
  const mSecond = sortedByExpected[1] ?? ''
  const eBest = expected[mBest]
  const eSecond = mSecond ? expected[mSecond] : 0
  const gap2 = eBest - eSecond
  const gap2Cp = mSecond ? sevalPawns[mBest] - sevalPawns[mSecond] : 99
  const bucket = pickStateBucket(eBest)
  const keepStateSing = pick(KEEP_STATE_SING[bucket])
  const keepStatePlur = pick(KEEP_STATE_PLUR[bucket])
  const keepStateMoreCleanly = pick(KEEP_STATE_MORE_CLEANLY[bucket])
  const decisive = bucket === 'winning' || bucket === 'lost'
  const defensiveBucket = bucket === 'defensive' || bucket === 'lost'

  const deltaE: Record<string, number> = {}
  const deltaCp: Record<string, number> = {}
  moves.forEach((m) => {
    deltaE[m] = Math.max(0, eBest - expected[m])
    deltaCp[m] = Math.max(0, sevalPawns[mBest] - sevalPawns[m])
  })

  const eqSet = moves.filter(
    (m) => deltaE[m] <= T_EQUIV && deltaCp[m] <= EQ_CP_CAP,
  )
  const goodCpCap = decisive ? GOOD_CP_CAP_EXTREME : GOOD_CP_CAP
  const goodSet = moves.filter(
    (m) => deltaE[m] <= T_GOOD && deltaCp[m] <= goodCpCap,
  )
  const goodSetSafe = goodSet.length ? goodSet : [mBest]

  const onlyMove =
    eqSet.length === 1 &&
    (gap2 >= T_ONLY_GAP || gap2Cp >= (defensiveBucket ? 1.8 : 1.0)) &&
    !(bucket === 'winning' && eSecond >= T_WIN_KEEP)
  const nearlyOnlyMove =
    !onlyMove &&
    eqSet.length === 1 &&
    (gap2 >= T_MEANINGFUL || gap2Cp >= 0.7) &&
    !(bucket === 'winning' && eSecond >= T_WIN_KEEP)

  const toSan = (uci: string) => {
    const mv = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
    })
    const san = mv?.san ?? uci
    chess.undo()
    return san
  }
  const sanCache: Record<string, string> = {}
  const toMoveSeg = (uci: string): DescriptionSegment => {
    if (!sanCache[uci]) sanCache[uci] = toSan(uci)
    return moveSeg(sanCache[uci], uci)
  }
  const appendMoveList = (segments: DescriptionSegment[], ucis: string[]) => {
    if (!ucis.length) return
    if (ucis.length === 1) {
      segments.push(toMoveSeg(ucis[0]))
      return
    }
    if (ucis.length === 2) {
      segments.push(toMoveSeg(ucis[0]), textSeg(' and '), toMoveSeg(ucis[1]))
      return
    }
    segments.push(
      toMoveSeg(ucis[0]),
      textSeg(', '),
      toMoveSeg(ucis[1]),
      textSeg(', and '),
      toMoveSeg(ucis[2]),
    )
  }

  const selectedRaw: Record<string, number> = {}
  moves.forEach((m) => {
    selectedRaw[m] = selectedMaiaPolicy?.[m] ?? maia[m]?.[4] ?? 0
  })
  const pSel = normalizeMap(selectedRaw, moves)
  const selTop = topEntries(pSel, 6)
  const mHuman = selTop[0]?.[0] ?? mBest
  const p1 = selTop[0]?.[1] ?? 0
  const nEff = effectiveMoves(moves.map((m) => pSel[m]))
  const pBest = pSel[mBest] ?? 0
  const dHuman = deltaE[mHuman] ?? 0
  const selectedBlunderMass = moves
    .filter((m) => deltaE[m] >= T_BIG)
    .reduce((acc, m) => acc + (pSel[m] ?? 0), 0)
  const selectedSevereMass = moves
    .filter((m) => deltaE[m] >= T_SEVERE)
    .reduce((acc, m) => acc + (pSel[m] ?? 0), 0)
  const selectedMistakeMass = moves
    .filter((m) => deltaE[m] >= T_MEANINGFUL)
    .reduce((acc, m) => acc + (pSel[m] ?? 0), 0)
  const trapHeavy =
    selectedBlunderMass >= T_TREACHEROUS ||
    (selectedMistakeMass >= 0.75 && selectedSevereMass >= 0.2)
  const mistakeHeavy =
    selectedBlunderMass >= 0.3 ||
    (selectedMistakeMass >= 0.55 && selectedSevereMass >= 0.15)
  const quietPosition =
    !onlyMove &&
    !nearlyOnlyMove &&
    gap2 <= T_SMALL &&
    selectedMistakeMass < 0.22 &&
    selectedBlunderMass < 0.08
  const selectedAligned = mHuman === mBest

  const salientSet = new Set<string>([
    ...topEntries(pSel, 6).map(([m]) => m),
    ...sortedByExpected.slice(0, 6),
    ...moves.filter((m) => pSel[m] >= P_SALIENCE),
  ])
  const salientMoves = [...salientSet]

  const levelNorms: Record<string, number>[] = []
  for (let i = 0; i < 9; i += 1) {
    const raw: Record<string, number> = {}
    moves.forEach((m) => {
      raw[m] = maia[m]?.[i] ?? 0
    })
    levelNorms.push(normalizeMap(raw, moves))
  }

  const selectedIndex =
    selectedMaiaIndex !== undefined &&
    selectedMaiaIndex >= 0 &&
    selectedMaiaIndex < 9
      ? selectedMaiaIndex
      : 4
  const lowBand = [...Array(9).keys()].filter((i) => i <= selectedIndex - 2)
  const highBand = [...Array(9).keys()].filter((i) => i >= selectedIndex + 2)
  const lowBandUse = lowBand.length
    ? lowBand
    : [...Array(9).keys()].filter((i) => i < selectedIndex).slice(-3)
  const highBandUse = highBand.length
    ? highBand
    : [...Array(9).keys()].filter((i) => i > selectedIndex).slice(0, 3)

  const pLow: Record<string, number> = {}
  const pHigh: Record<string, number> = {}
  const shift: Record<string, number> = {}
  const levelBlunderMass = levelNorms.map((norm) =>
    moves
      .filter((m) => deltaE[m] >= T_BIG)
      .reduce((acc, m) => acc + norm[m], 0),
  )
  salientMoves.forEach((m) => {
    pLow[m] = avg(lowBandUse.map((i) => levelNorms[i]?.[m] ?? 0))
    pHigh[m] = avg(highBandUse.map((i) => levelNorms[i]?.[m] ?? 0))
    shift[m] = pHigh[m] - pLow[m]
  })

  const mTopTempting = bestBy(
    salientMoves.filter(
      (m) => m !== mBest && pSel[m] >= 0.08 && deltaE[m] >= T_MEANINGFUL,
    ),
    (m) => pSel[m] * clamp(deltaE[m] / 0.2, 0.4, 1.2),
  )
  const mTopTrap = bestBy(
    salientMoves.filter((m) => pSel[m] >= T_TEMPTING && deltaE[m] >= T_BIG),
    (m) => pSel[m] * deltaE[m],
  )
  const mTopSevere = bestBy(
    salientMoves.filter((m) => pSel[m] >= 0.12 && deltaE[m] >= T_SEVERE),
    (m) => pSel[m] * deltaE[m],
  )

  const hiddenResource =
    pBest <= T_HIDDEN && (gap2 >= T_MEANINGFUL || dHuman >= T_BIG) ? mBest : ''

  const twoBestComparable =
    eqSet.length >= 2
      ? [...eqSet].sort((a, b) => (pSel[b] ?? 0) - (pSel[a] ?? 0)).slice(0, 2)
      : []
  const flexibleGoodMoves =
    goodSetSafe.length >= 3
      ? [...goodSetSafe]
          .sort((a, b) => (pSel[b] ?? 0) - (pSel[a] ?? 0))
          .slice(0, 3)
      : []

  const tinyGap = dHuman <= T_EQUIV
  const smallGap = dHuman > T_EQUIV && dHuman <= T_SMALL

  const candidates: Candidate[] = []
  const pushCandidate = (c: Candidate | null) => {
    if (c) candidates.push(c)
  }

  const makeOnlyMoveCandidate = (): Candidate | null => {
    if (!onlyMove && !nearlyOnlyMove) return null
    const forceWord = onlyMove ? pick(ONLY_MOVE_WORDS) : 'one clear choice'
    const humanMiss = mHuman !== mBest && (pSel[mHuman] ?? 0) >= 0.12
    const humanFinds = mHuman === mBest && pBest >= 0.6
    const segments: DescriptionSegment[] = []

    if (humanMiss) {
      segments.push(
        textSeg(
          humanMiss && onlyMove
            ? 'Easy to drift with '
            : 'The natural try is often ',
        ),
        toMoveSeg(mHuman),
        textSeg(`, but `),
        toMoveSeg(mBest),
        textSeg(
          onlyMove
            ? ` is ${forceWord} and ${keepStateSing}.`
            : ` is the ${forceWord} that ${keepStateSing}.`,
        ),
      )
      return {
        caseId: 'only-missed',
        score: 10,
        confidence: clamp((gap2 / T_ONLY_GAP + (1 - pBest)) / 2, 0, 1),
        moves: [mHuman, mBest],
        segments,
      }
    }

    segments.push(
      toMoveSeg(mBest),
      textSeg(
        onlyMove
          ? ` is ${forceWord} here${humanFinds ? ' and it is the move that jumps out.' : `; it is the only move that ${keepStateSing}.`}`
          : ` is the ${forceWord} here and ${keepStateSing}.`,
      ),
    )
    return {
      caseId: 'only-found',
      score: humanFinds ? 8.6 : 8.1,
      confidence: clamp((gap2 / T_ONLY_GAP + pBest) / 2, 0, 1),
      moves: [mBest],
      segments,
    }
  }

  const makeTemptingMissCandidate = (): Candidate | null => {
    const badMove = mTopSevere ?? mTopTrap ?? mTopTempting
    if (!badMove) return null
    if (badMove === mBest) return null

    const pBad = pSel[badMove] ?? 0
    const badIsTopChoice = badMove === mHuman
    const badIsNearTop = p1 > 0 && pBad >= p1 - 0.06

    // Do not build the main sentence around a secondary move if the selected-level
    // top choice already matches the best move. That creates misleading "X looks
    // natural, but Y is better" copy when Y is actually the clear human favorite.
    if (mHuman === mBest && !badIsNearTop) return null
    if (!badIsTopChoice && !badIsNearTop) return null

    const severe = deltaE[badMove] >= T_SEVERE
    const big = deltaE[badMove] >= T_BIG
    const segments: DescriptionSegment[] = []
    const useNaturalFraming = badIsTopChoice

    if (severe) {
      if (useNaturalFraming) {
        segments.push(
          toMoveSeg(badMove),
          textSeg(` ${pick(NATURAL_WORDS)}, but it loses big; `),
          toMoveSeg(mBest),
          textSeg(
            bucket === 'lost'
              ? ' is the best practical try.'
              : bucket === 'winning'
                ? ' is the move that keeps the win simple.'
                : ` is the critical move.`,
          ),
        )
      } else {
        segments.push(
          textSeg('Watch out for '),
          toMoveSeg(badMove),
          textSeg('; '),
          toMoveSeg(mBest),
          textSeg(
            bucket === 'lost'
              ? ' is the best practical try.'
              : bucket === 'winning'
                ? ' keeps the win simple.'
                : ' is the critical move.',
          ),
        )
      }
    } else if (big) {
      if (useNaturalFraming) {
        segments.push(
          toMoveSeg(badMove),
          textSeg(` ${pick(NATURAL_WORDS)}, but it gives up too much; `),
          toMoveSeg(mBest),
          textSeg(` ${keepStateSing}.`),
        )
      } else {
        segments.push(
          textSeg('Watch out for '),
          toMoveSeg(badMove),
          textSeg('; '),
          toMoveSeg(mBest),
          textSeg(` ${keepStateMoreCleanly}.`),
        )
      }
    } else {
      if (!useNaturalFraming && mHuman === mBest) return null
      if (useNaturalFraming) {
        segments.push(
          toMoveSeg(badMove),
          textSeg(` ${pick(NATURAL_WORDS)}, but `),
          toMoveSeg(mBest),
          textSeg(` ${pick(STRONGER_WORDS)}.`),
        )
      } else {
        segments.push(
          textSeg('A tempting alternative is '),
          toMoveSeg(badMove),
          textSeg(', but '),
          toMoveSeg(mBest),
          textSeg(` ${pick(STRONGER_WORDS)}.`),
        )
      }
    }

    return {
      caseId: 'tempting-miss',
      score: 9.4 + clamp((deltaE[badMove] - T_BIG) * 2, 0, 1),
      confidence: clamp(0.4 + pSel[badMove] + deltaE[badMove], 0, 1),
      moves: [badMove, mBest],
      segments,
    }
  }

  const makeTreacherousCandidate = (): Candidate | null => {
    if (onlyMove || nearlyOnlyMove) return null
    if (!trapHeavy) return null

    const safeMoves = (goodSetSafe.length ? goodSetSafe : [mBest])
      .slice()
      .sort((a, b) => (pSel[b] ?? 0) - (pSel[a] ?? 0))
      .slice(0, 2)
    const trapMove = mTopSevere ?? mTopTrap ?? ''
    const segments: DescriptionSegment[] = []

    if (trapMove && (pSel[trapMove] ?? 0) >= 0.12) {
      if (deltaE[trapMove] >= T_SEVERE) {
        segments.push(
          textSeg('Very easy to go wrong here: '),
          toMoveSeg(trapMove),
          textSeg(' can lose quickly, while '),
          toMoveSeg(mBest),
          textSeg(
            bucket === 'lost'
              ? ' is the best practical try.'
              : ` is the move that ${keepStateSing}.`,
          ),
        )
      } else {
        segments.push(
          textSeg('This is a treacherous position: '),
          toMoveSeg(trapMove),
          textSeg(' is tempting, but '),
          toMoveSeg(mBest),
          textSeg(` ${keepStateSing}.`),
        )
      }
    } else if (safeMoves.length >= 2) {
      segments.push(
        textSeg('This is a treacherous position: '),
        toMoveSeg(safeMoves[0]),
        textSeg(' and '),
        toMoveSeg(safeMoves[1]),
        textSeg(' are the safe options; most other moves give up too much.'),
      )
    } else {
      segments.push(
        textSeg('Very easy to go wrong here: '),
        toMoveSeg(mBest),
        textSeg(
          bucket === 'lost'
            ? ' is the best practical try, and most alternatives lose faster.'
            : ` is the move that ${keepStateSing}; most alternatives give up too much.`,
        ),
      )
    }

    return {
      caseId: 'treacherous',
      score:
        9.8 +
        clamp((selectedBlunderMass - T_TREACHEROUS) / 0.35, 0, 1.5) +
        clamp(selectedSevereMass / 0.4, 0, 1),
      confidence: clamp(
        0.5 + selectedBlunderMass + selectedSevereMass / 2,
        0,
        1,
      ),
      moves:
        trapMove && (pSel[trapMove] ?? 0) >= 0.12
          ? [trapMove, mBest]
          : safeMoves.length >= 2
            ? safeMoves
            : [mBest],
      segments,
    }
  }

  const makeHiddenResourceCandidate = (): Candidate | null => {
    if (!hiddenResource) return null
    if (onlyMove || nearlyOnlyMove) return null
    if (trapHeavy) return null
    if (bucket === 'winning' && eSecond >= T_WIN_KEEP) return null
    const segments: DescriptionSegment[] = []
    if (mHuman !== mBest && pSel[mHuman] >= 0.1) {
      segments.push(
        textSeg('The key resource is '),
        toMoveSeg(mBest),
        textSeg('; '),
        toMoveSeg(mHuman),
        textSeg(' is more natural at this level.'),
      )
    } else {
      segments.push(
        toMoveSeg(mBest),
        textSeg(
          ' is the hidden point here; it does more than the usual moves.',
        ),
      )
    }
    return {
      caseId: 'hidden-resource',
      score: 8.8,
      confidence: clamp((1 - pBest) * 0.8 + gap2, 0, 1),
      moves: mHuman !== mBest ? [mBest, mHuman] : [mBest],
      segments,
    }
  }

  const makeNarrowChoiceCandidate = (): Candidate | null => {
    if (trapHeavy) return null
    if (onlyMove || nearlyOnlyMove) return null
    if (gap2 >= T_ONLY_GAP) return null
    if (eqSet.length !== 2 || twoBestComparable.length < 2) return null
    const [a, b] = twoBestComparable
    if ((pSel[a] ?? 0) + (pSel[b] ?? 0) < 0.28 && !quietPosition) return null
    const segments: DescriptionSegment[] = []
    if (tinyGap || smallGap) {
      segments.push(
        textSeg(pick(NARROW_WORDS) + ' '),
        toMoveSeg(a),
        textSeg(' and '),
        toMoveSeg(b),
        textSeg(`; both ${keepStatePlur}.`),
      )
    } else if (
      mHuman !== mBest &&
      deltaE[mHuman] >= T_MEANINGFUL &&
      goodSetSafe.includes(mHuman)
    ) {
      segments.push(
        toMoveSeg(mHuman),
        textSeg(` ${pick(NATURAL_WORDS)}, but `),
        toMoveSeg(mBest),
        textSeg(` ${pick(STRONGER_WORDS)} - both still work.`),
      )
    } else {
      segments.push(
        textSeg('There are a couple of good options here: '),
        toMoveSeg(a),
        textSeg(' and '),
        toMoveSeg(b),
        textSeg('.'),
      )
    }
    return {
      caseId: 'narrow-choice',
      score: 7.3,
      confidence: clamp(0.5 + (pSel[a] + pSel[b]) / 2, 0, 1),
      moves: [a, b],
      segments,
    }
  }

  const makeFlexibilityCandidate = (): Candidate | null => {
    if (mistakeHeavy || trapHeavy) return null
    if (onlyMove || nearlyOnlyMove) return null
    if (bucket === 'winning' || bucket === 'lost') return null
    if (goodSetSafe.length < 3) return null
    if (eqSet.length < 3 && gap2 > T_SMALL) return null
    if (nEff < 2.2 && p1 > 0.55) return null
    const list = flexibleGoodMoves.length
      ? flexibleGoodMoves
      : goodSetSafe.slice(0, 3)
    const segments: DescriptionSegment[] = []
    const flexIntro =
      bucket === 'defensive'
        ? 'There are a few workable defenses here:'
        : pick(FLEX_WORDS)
    if (list.length >= 3) {
      segments.push(textSeg(flexIntro + ' '))
      appendMoveList(segments, list)
      segments.push(textSeg(` are all playable and ${keepStatePlur}.`))
    } else {
      segments.push(
        textSeg('Several moves are playable here; '),
        toMoveSeg(mHuman),
        textSeg(' is a natural starting point.'),
      )
    }
    return {
      caseId: 'real-flexibility',
      score: 6.8,
      confidence: clamp(0.4 + Math.min(1, nEff / 4), 0, 1),
      moves: list,
      segments,
    }
  }

  const makeWinningConversionCandidate = (): Candidate | null => {
    if (bucket !== 'winning') return null
    if (trapHeavy) return null
    if (selectedBlunderMass >= 0.25 && pBest < 0.5) return null
    const manyWinningMoves =
      goodSetSafe.filter((m) => expected[m] >= T_WIN_KEEP).length >= 2 ||
      goodSetSafe.length >= 3
    if (!manyWinningMoves) return null
    const segments: DescriptionSegment[] = []
    segments.push(
      textSeg(pick(WINNING_WORDS) + ' '),
      toMoveSeg(mBest),
      textSeg(' is a simple way to convert.'),
    )
    return {
      caseId: 'winning-conversion',
      score: 6.5,
      confidence: 0.8,
      moves: [mBest],
      segments,
    }
  }

  const makeLosingDefenseCandidate = (): Candidate | null => {
    if (bucket !== 'lost') return null
    const segments: DescriptionSegment[] = []
    if (onlyMove || nearlyOnlyMove || gap2Cp >= 1.5 || gap2 >= T_BIG) {
      segments.push(
        textSeg('Most moves lose quickly; '),
        toMoveSeg(mBest),
        textSeg(' is the best practical try.'),
      )
    } else if (goodSetSafe.length >= 2 && nEff >= 1.8) {
      segments.push(
        textSeg('There are a few defensive tries here; '),
        toMoveSeg(mBest),
        textSeg(' is the toughest one.'),
      )
    } else {
      segments.push(
        textSeg(pick(LOSING_WORDS) + ' '),
        toMoveSeg(mBest),
        textSeg(' gives the most resistance.'),
      )
    }
    return {
      caseId: 'losing-defense',
      score: 8.2,
      confidence: clamp(0.6 + gap2 + pBest / 2, 0, 1),
      moves: [mBest],
      segments,
    }
  }

  const makeNeutralCandidate = (): Candidate => {
    const segments: DescriptionSegment[] = []
    if (trapHeavy) {
      segments.push(
        textSeg('This is easy to mishandle; '),
        toMoveSeg(mBest),
        textSeg(
          bucket === 'lost'
            ? ' is the best practical try.'
            : ` is the move that ${keepStateSing}.`,
        ),
      )
    } else if (quietPosition && selectedAligned) {
      segments.push(
        textSeg('Nothing is forcing right away; '),
        toMoveSeg(mBest),
        textSeg(' is a natural move and the main options are close.'),
      )
    } else if (selectedAligned && pBest >= 0.55 && dHuman <= T_SMALL) {
      segments.push(
        textSeg('This is fairly straightforward: '),
        toMoveSeg(mBest),
        textSeg(' is the natural move here.'),
      )
    } else if (tinyGap && mHuman !== mBest) {
      segments.push(
        toMoveSeg(mHuman),
        textSeg(' is a natural choice, and '),
        toMoveSeg(mBest),
        textSeg(' is basically equivalent.'),
      )
    } else if (mHuman !== mBest && dHuman >= T_SMALL) {
      segments.push(
        toMoveSeg(mHuman),
        textSeg(' is the natural alternative, but '),
        toMoveSeg(mBest),
        textSeg(' keeps a little more.'),
      )
    } else if (!decisive && goodSetSafe.length >= 3) {
      segments.push(
        textSeg('Several sensible moves work here; '),
        toMoveSeg(mBest),
        textSeg(' is a clean starting point.'),
      )
    } else {
      segments.push(
        textSeg('Nothing is forcing right away; '),
        toMoveSeg(mBest),
        textSeg(' is a solid move.'),
      )
    }
    return {
      caseId: 'neutral',
      score: 1,
      confidence: 0.3,
      moves: [mBest],
      segments,
    }
  }

  pushCandidate(makeOnlyMoveCandidate())
  pushCandidate(makeTreacherousCandidate())
  pushCandidate(makeTemptingMissCandidate())
  pushCandidate(makeHiddenResourceCandidate())
  pushCandidate(makeLosingDefenseCandidate())
  pushCandidate(makeNarrowChoiceCandidate())
  pushCandidate(makeWinningConversionCandidate())
  pushCandidate(makeFlexibilityCandidate())

  const scoredCandidates = candidates
    .map((c) => {
      const primaryMove = c.moves[0] ?? mBest
      const severity = clamp((deltaE[primaryMove] ?? gap2) / 0.25, 0, 1)
      const likelihood = Math.sqrt(Math.max(0, pSel[primaryMove] ?? pBest))
      const forcing = clamp(gap2 / 0.15, 0, 1)
      const brevity = clamp(1 - 0.15 * Math.max(0, c.moves.length - 1), 0.6, 1)
      const redundancyPenalty =
        c.caseId === 'neutral'
          ? 0.7
          : c.caseId === 'winning-conversion'
            ? 0.25
            : 0
      const saliencePenalty =
        trapHeavy &&
        (c.caseId === 'narrow-choice' ||
          c.caseId === 'real-flexibility' ||
          c.caseId === 'winning-conversion')
          ? 2.5
          : mistakeHeavy && c.caseId === 'real-flexibility'
            ? 1.2
            : 0
      const themeAdjustment =
        (onlyMove || nearlyOnlyMove) &&
        (c.caseId === 'narrow-choice' || c.caseId === 'real-flexibility')
          ? -2.2
          : trapHeavy &&
              (c.caseId === 'treacherous' ||
                c.caseId === 'tempting-miss' ||
                (bucket === 'lost' && c.caseId === 'losing-defense'))
            ? 1.3
            : quietPosition &&
                (c.caseId === 'narrow-choice' ||
                  c.caseId === 'real-flexibility' ||
                  c.caseId === 'neutral')
              ? 0.9
              : selectedAligned && pBest >= 0.6 && c.caseId === 'tempting-miss'
                ? -0.8
                : 0
      const total =
        c.score +
        1.8 * severity +
        1.2 * likelihood +
        1.1 * forcing +
        0.7 * brevity -
        redundancyPenalty +
        saliencePenalty * -1 +
        themeAdjustment +
        c.confidence

      return { ...c, total }
    })
    .sort((a, b) => b.total - a.total)

  const primary = scoredCandidates[0] ?? makeNeutralCandidate()

  const crossCandidates: CrossCandidate[] = []
  const pushCross = (c: CrossCandidate | null) => {
    if (c) crossCandidates.push(c)
  }

  const lowIdxs = lowBandUse
  const highIdxs = highBandUse
  const lowBlunderMass = avg(lowIdxs.map((i) => levelBlunderMass[i] ?? 0))
  const highBlunderMass = avg(highIdxs.map((i) => levelBlunderMass[i] ?? 0))
  const mShiftUp = bestBy(
    salientMoves.filter((m) => (pHigh[m] ?? 0) >= 0.08),
    (m) => shift[m] ?? -Infinity,
  )
  const mShiftDown = bestBy(
    salientMoves.filter((m) => (pLow[m] ?? 0) >= 0.08),
    (m) => -(shift[m] ?? Infinity),
  )

  const makeTrapCross = (): CrossCandidate | null => {
    const trapMove =
      bestBy(
        salientMoves.filter(
          (m) =>
            deltaE[m] >= T_BIG && Math.max(pLow[m] ?? 0, pHigh[m] ?? 0) >= 0.12,
        ),
        (m) => Math.max(pLow[m] ?? 0, pHigh[m] ?? 0) * deltaE[m],
      ) ?? ''
    if (!trapMove) return null

    if (
      Math.min(pLow[trapMove] ?? 0, pHigh[trapMove] ?? 0) >= 0.12 &&
      lowBlunderMass >= 0.12 &&
      highBlunderMass >= 0.1
    ) {
      return {
        caseId: 'persistent-trap',
        score: 9.2,
        moves: [trapMove],
        segments: [
          textSeg('Even stronger players are still tempted by '),
          toMoveSeg(trapMove),
          textSeg('.'),
        ],
      }
    }

    if (
      (pLow[trapMove] ?? 0) - (pHigh[trapMove] ?? 0) >= 0.18 &&
      (pLow[trapMove] ?? 0) >= 0.2
    ) {
      return {
        caseId: 'trap-fades',
        score: 8.7,
        moves: [trapMove],
        segments: [
          toMoveSeg(trapMove),
          textSeg(' shows up much more at lower levels.'),
        ],
      }
    }

    return null
  }

  const makeOnlyMoveVisibilityCross = (): CrossCandidate | null => {
    if (!onlyMove) return null
    if (!highIdxs.length || !lowIdxs.length) return null
    const pBestLow = avg(lowIdxs.map((i) => levelNorms[i]?.[mBest] ?? 0))
    const pBestHigh = avg(highIdxs.map((i) => levelNorms[i]?.[mBest] ?? 0))

    if (pBestHigh < 0.12 && pBestLow < 0.12) {
      return {
        caseId: 'only-move-visibility',
        score: 8.9,
        moves: [mBest],
        segments: [
          textSeg('Even stronger players rarely find '),
          toMoveSeg(mBest),
          textSeg('.'),
        ],
      }
    }

    if (pBestHigh - pBestLow >= 0.18 && pBestHigh >= 0.25) {
      return {
        caseId: 'only-move-visibility',
        score: 8.2,
        moves: [mBest],
        segments: [
          textSeg('Stronger players find '),
          toMoveSeg(mBest),
          textSeg(' much more often.'),
        ],
      }
    }

    return null
  }

  const makeShiftCross = (): CrossCandidate | null => {
    if (!mShiftUp || !mShiftDown || mShiftUp === mShiftDown) return null
    const upShift = shift[mShiftUp] ?? 0
    const downShift = -(shift[mShiftDown] ?? 0)
    if (upShift < 0.18 || downShift < 0.18) return null
    if ((pHigh[mShiftUp] ?? 0) < 0.12 || (pLow[mShiftDown] ?? 0) < 0.12)
      return null

    const improvement = (deltaE[mShiftDown] ?? 0) - (deltaE[mShiftUp] ?? 0)
    if (improvement >= T_MEANINGFUL) {
      return {
        caseId: 'shift-stronger',
        score: 8.8,
        moves: [mShiftDown, mShiftUp],
        segments: [
          textSeg('As skill rises, players move away from '),
          toMoveSeg(mShiftDown),
          textSeg(' and toward '),
          toMoveSeg(mShiftUp),
          textSeg('.'),
        ],
      }
    }

    if (
      (deltaE[mShiftDown] ?? 0) <= T_EQUIV &&
      (deltaE[mShiftUp] ?? 0) <= T_EQUIV
    ) {
      return {
        caseId: 'shift-preference',
        score: 7.2,
        moves: [mShiftDown, mShiftUp],
        segments: [
          textSeg('At higher levels there is more preference for '),
          toMoveSeg(mShiftUp),
          textSeg(', though '),
          toMoveSeg(mShiftDown),
          textSeg(' is also fine.'),
        ],
      }
    }

    return null
  }

  // Cross-rating comments are intentionally rare and only used if strong.
  if (scoredCandidates.length && primary.caseId !== 'neutral') {
    pushCross(makeTrapCross())
    pushCross(makeOnlyMoveVisibilityCross())
    pushCross(makeShiftCross())
  }

  const seenMoves = new Set(primary.moves)
  const cross = crossCandidates
    .sort((a, b) => b.score - a.score)
    .find((c) => {
      if (
        primary.caseId === 'treacherous' &&
        c.caseId !== 'persistent-trap' &&
        c.caseId !== 'trap-fades'
      ) {
        return false
      }
      if (
        (primary.caseId === 'real-flexibility' ||
          primary.caseId === 'narrow-choice') &&
        (c.caseId === 'persistent-trap' || c.caseId === 'trap-fades')
      ) {
        return false
      }
      return c.moves.some((m) => !seenMoves.has(m)) || c.score >= 8.9
    })

  let segments = primary.segments
  if (cross && segmentTextLength(primary.segments) <= MAX_TEXT_PRIMARY) {
    const combined = [...primary.segments, textSeg(' '), ...cross.segments]
    if (segmentTextLength(combined) <= MAX_TEXT_TOTAL) {
      segments = combined
    }
  }

  // Final grammar guardrails for the known concatenation mistakes.
  const joined = segments
    .map((s) => (s.type === 'text' ? s.content : s.san))
    .join('')
    .toLowerCase()
  if (
    joined.includes('keeps keep') ||
    joined.includes('keeps hold ') ||
    joined.includes('stays a common trap')
  ) {
    return { segments: makeNeutralCandidate().segments }
  }

  return { segments }
}
