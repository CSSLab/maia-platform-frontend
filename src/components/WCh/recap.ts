/*
 * The match from Maia's point of view, for the recap page (/wch/recap) and
 * its share cards: each finished game's key moments, the match so far, the
 * openings, and what the players' own models expect next. Built on the
 * server from the research feed (one reader for everyone, cached), so the
 * page and the cards need no engine in the browser.
 */
import { Chess } from 'chess.ts'

import type { PlayerId } from './data'
import {
  FeedManifest,
  FeedPly,
  Pregame,
  RATING_KEYS,
  TreeNode,
  feedGame,
  mergePlies,
} from './feed'
import type { LivePly } from './game1'
import { buildLive } from './liveAdapter'
import { summarize } from './summary'

/** The match games, by number, and their feed ids (the Lichess game ids). */
export const RECAP_GAMES: { n: number; id: string }[] = [
  { n: 1, id: 'j7pdr7s2' },
  { n: 2, id: 'p6HX9bPF' },
  { n: 3, id: 'RD8sbYw1' },
]

/** The match length. */
export const MATCH_GAMES = 14

export const surname = (id: PlayerId) =>
  id === 'gukesh' ? 'Gukesh' : 'Sindarov'

const moveLabel = (n: number, color: 'white' | 'black') =>
  `${n}${color === 'white' ? '.' : '…'}`

const pct = (x: number) =>
  x < 0.01 ? '<1%' : x > 0.99 ? '>99%' : `${Math.round(x * 100)}%`

export type MomentKind = 'champion' | 'surprise' | 'swing' | 'risk' | 'think'

export interface RecapMoment {
  kind: MomentKind
  /** The ply's index (0: White's first move). */
  index: number
  label: string
  san: string
  uci: string
  mover: PlayerId
  color: 'white' | 'black'
  fenBefore: string
  fen: string
  /** A short heading, the number and what it means, and one line more. */
  headline: string
  stat: string
  statLabel: string
  detail: string
  /** The played move's chance at each of RATING_KEYS, when known. */
  ratings: number[] | null
}

export interface SideStats {
  id: PlayerId
  /** His moves his own model put first, and Stockfish's best he played. */
  maia: number
  stockfish: number
  moves: number
}

export interface RecapGame {
  n: number
  id: string
  white: PlayerId
  black: PlayerId
  result: string
  /** Moves (full moves) played. */
  moves: number
  sides: [SideStats, SideStats]
  /** The riskiest position: who was to move, the chance, and the move. */
  peakRisk: { who: PlayerId; risk: number; label: string } | null
  /** The longest think. */
  longestThink: { who: PlayerId; seconds: number; label: string } | null
  /** The first moves, in SAN with numbers. */
  opening: string
  /** The position after the opening, for the drill. */
  openingFen: string
  /** How many moves stayed on the lines White's model expected. */
  inTree: number
  /** The PGN of the whole game (moves only). */
  pgn: string
  moments: RecapMoment[]
}

export interface LookaheadLine {
  /** The line in SAN with numbers, and its chance under the two models. */
  san: string
  p: number
}

export interface Lookahead {
  n: number
  white: PlayerId
  black: PlayerId
  /** White's first move in his own model. */
  firstMoves: { san: string; p: number }[]
  /** The likeliest lines, from both players' own models. */
  lines: LookaheadLine[]
  /** What White opened with in this match so far, by game. */
  played: { n: number; first: string }[]
}

export interface Recap {
  /** The game the page is about (the latest finished one, or the one asked). */
  game: RecapGame | null
  /** Every finished game, first first. */
  games: RecapGame[]
  /** The match score so far, from Gukesh's side and Sindarov's. */
  score: Record<PlayerId, number>
  /** A game still being played. */
  live: { n: number; id: string; moves: number } | null
  lookahead: Lookahead | null
  updated: string
}

export interface FeedGameInput {
  n: number
  id: string
  manifest: FeedManifest | null
  plies: FeedPly[]
  last_ply: number
}

const idOf = (name: string | undefined): PlayerId =>
  /gukesh/i.test(name ?? '') ? 'gukesh' : 'sindarov'

const NO_ENGINES = {
  info: () => undefined,
  focusEval: () => null,
}

const FINISHED = /^(1-0|0-1|1\/2-1\/2)$/

/** The plies of a feed game in the page's shape. */
const pliesOf = (
  g: FeedGameInput,
  ids: { white: PlayerId; black: PlayerId },
) => {
  const feed = mergePlies(new Map(), g)
  const game = feedGame(g.id, g.manifest, feed, ids)
  return buildLive(game, NO_ENGINES, ids, 7200, feed).plies
}

/** A ply's chance at each rating, if the feed has all five. */
const ratingsOf = (feed: Map<number, FeedPly>, p: LivePly) => {
  const r = feed.get(p.index + 1)?.p_by_rating
  return r && RATING_KEYS.every((k) => typeof r[k] === 'number')
    ? RATING_KEYS.map((k) => r[k])
    : null
}

const momentOf = (
  p: LivePly,
  kind: MomentKind,
  parts: Pick<RecapMoment, 'headline' | 'stat' | 'statLabel' | 'detail'>,
  ratings: number[] | null,
): RecapMoment => ({
  kind,
  index: p.index,
  label: `${moveLabel(p.moveNumber, p.color)}${p.san}`,
  san: p.san,
  uci: p.uci,
  mover: p.mover,
  color: p.color,
  fenBefore: p.fenBefore,
  fen: p.fen,
  ratings,
  ...parts,
})

/**
 * Up to four moments worth a card, one per ply, in game order: the move
 * whose chance climbs most with rating (a champion's move), the move his
 * own model least expected, the biggest swing in the human win chances,
 * the riskiest position, and the longest think.
 */
export const pickMoments = (
  plies: LivePly[],
  feed: Map<number, FeedPly>,
): RecapMoment[] => {
  const s = summarize(plies)
  const out: RecapMoment[] = []
  const taken = new Set<number>()
  const add = (m: RecapMoment | null) => {
    if (m && !taken.has(m.index) && out.length < 4) {
      taken.add(m.index)
      out.push(m)
    }
  }

  // The champion's move: rare at 1500, common at 2700.
  const champion = plies
    .map((p) => ({ p, r: ratingsOf(feed, p) }))
    .filter(
      (x): x is { p: LivePly; r: number[] } =>
        !!x.r && x.r[4] >= 0.15 && x.r[4] >= 2 * x.r[0],
    )
    .sort((a, b) => b.r[4] / b.r[0] - a.r[4] / a.r[0])[0]
  if (champion) {
    const { p, r } = champion
    add(
      momentOf(
        p,
        'champion',
        {
          headline: 'A move that comes with rating',
          stat: pct(r[4]),
          statLabel: `of 2700-rated players play ${p.san} here`,
          detail: `At 1500 it's ${pct(r[0])}. The stronger the player, the likelier the move.`,
        },
        r,
      ),
    )
  }

  const surprise = s.surprises[0]
  if (surprise)
    add(
      momentOf(
        surprise,
        'surprise',
        {
          headline: `The move Maia${surname(surprise.mover)} didn't expect`,
          stat: pct(surprise.pPlayed),
          statLabel: `the chance his own model gave ${surprise.san}`,
          detail: surprise.sf
            ? surprise.sf === surprise.san
              ? 'Stockfish agreed with him: it was its top move.'
              : `Stockfish preferred ${surprise.sf}.`
            : 'His model, trained on his own games, had other moves first.',
        },
        ratingsOf(feed, surprise),
      ),
    )

  const swing = s.swings[0]
  if (swing) {
    const up = swing.delta > 0
    add(
      momentOf(
        swing.ply,
        'swing',
        {
          headline: up ? 'The turning point' : 'Where it slipped',
          stat: `${pct(swing.before)} → ${pct(swing.after)}`,
          statLabel: `${surname(swing.ply.mover)}'s human win chance`,
          detail: `How often players like these would win from here, before and after ${swing.ply.san}.`,
        },
        ratingsOf(feed, swing.ply),
      ),
    )
  }

  const risk = s.dangerous[0]
  if (risk)
    add(
      momentOf(
        risk.ply,
        'risk',
        {
          headline: 'The most dangerous position',
          stat: pct(risk.risk),
          statLabel: `the chance ${surname(risk.ply.mover)} would blunder here`,
          detail: `He played ${risk.ply.san}${
            risk.ply.mark === '??' || risk.ply.mark === '?'
              ? ', and it cost him.'
              : ' and kept his footing.'
          }`,
        },
        ratingsOf(feed, risk.ply),
      ),
    )

  const think = s.thinks[0]
  if (think && think.think >= 600)
    add(
      momentOf(
        think,
        'think',
        {
          headline: 'The longest think',
          stat: `${Math.round(think.think / 60)} min`,
          statLabel: `${surname(think.mover)} on ${think.san}`,
          detail:
            think.rank === 1
              ? `His own model's first choice all along.`
              : think.rank > 0
                ? `His own model had it ${ordinal(think.rank)}.`
                : 'A move outside his own model’s top choices.',
        },
        ratingsOf(feed, think),
      ),
    )

  return out.sort((a, b) => a.index - b.index)
}

const ordinal = (n: number) =>
  n === 2 ? 'second' : n === 3 ? 'third' : n === 4 ? 'fourth' : `#${n}`

/** "1.e4 e5 2.Nf3 Nc6" for the first `plies` plies. */
const sanLine = (plies: { san: string }[], first = 0, startWhite = true) =>
  plies
    .map((p, i) => {
      const k = first + i
      const white = startWhite ? k % 2 === 0 : k % 2 === 1
      const n = Math.floor(k / 2) + 1
      return white ? `${n}.${p.san}` : i === 0 ? `${n}…${p.san}` : p.san
    })
    .join(' ')

const OPENING_PLIES = 12

/** One finished game. */
export const buildGame = (
  g: FeedGameInput,
  pregame: Pregame | null,
): RecapGame | null => {
  const result = g.manifest?.result ?? '*'
  if (!FINISHED.test(result)) return null
  const white = idOf(g.manifest?.players?.white)
  const black: PlayerId = white === 'gukesh' ? 'sindarov' : 'gukesh'
  const ids = { white, black }
  const feed = mergePlies(new Map(), g)
  const plies = pliesOf(g, ids)
  if (!plies.length) return null

  const called = [...g.plies]
    .sort((a, b) => b.ply - a.ply)
    .find((p) => p.called)?.called
  const side = (id: PlayerId, color: 'white' | 'black'): SideStats => {
    const c = called?.[surname(id)]
    if (c) return { id, maia: c.maia, stockfish: c.stockfish, moves: c.moves }
    const mine = plies.filter((p) => p.color === color)
    return {
      id,
      maia: mine.filter((p) => p.rank === 1).length,
      stockfish: mine.filter((p) => p.sf && p.sf === p.san).length,
      moves: mine.length,
    }
  }

  const s = summarize(plies)
  const risk = s.dangerous[0]
  const think = s.thinks[0] ?? [...plies].sort((a, b) => b.think - a.think)[0]

  // How far the game followed White's model's expected lines.
  const tree = Object.values(pregame?.trees ?? {}).find(
    (t) => t.white === white,
  )
  const lines = new Set((tree?.nodes ?? []).map((n) => n.line.join(' ')))
  let inTree = 0
  while (
    inTree < plies.length &&
    lines.has(
      plies
        .slice(0, inTree + 1)
        .map((p) => p.uci)
        .join(' '),
    )
  )
    inTree += 1

  const open = plies.slice(0, Math.min(OPENING_PLIES, plies.length))
  return {
    n: g.n,
    id: g.id,
    white,
    black,
    result,
    moves: plies[plies.length - 1].moveNumber,
    sides: [side(white, 'white'), side(black, 'black')],
    peakRisk: risk
      ? {
          who: risk.ply.mover,
          risk: risk.risk,
          label: `${moveLabel(risk.ply.moveNumber, risk.ply.color)}${risk.ply.san}`,
        }
      : null,
    longestThink: think
      ? {
          who: think.mover,
          seconds: think.think,
          label: `${moveLabel(think.moveNumber, think.color)}${think.san}`,
        }
      : null,
    opening: sanLine(open),
    openingFen: open[open.length - 1].fen,
    inTree: Math.ceil(inTree / 2),
    pgn: sanLine(plies),
    moments: pickMoments(plies, feed),
  }
}

/** The likeliest few lines down a tree, by the product of the models' chances. */
export const treeLines = (
  nodes: TreeNode[],
  depth = 6,
  count = 3,
): LookaheadLine[] => {
  const byLine = new Map(nodes.map((n) => [n.line.join(' '), n]))
  let frontier: { line: string[]; san: string[]; p: number }[] = [
    { line: [], san: [], p: 1 },
  ]
  for (let d = 0; d < depth; d++) {
    const next: typeof frontier = []
    for (const f of frontier) {
      const node = byLine.get(f.line.join(' '))
      if (!node) {
        next.push(f)
        continue
      }
      ;[...node.moves]
        .sort((a, b) => b.p_bot - a.p_bot)
        .slice(0, 3)
        .forEach((m) =>
          next.push({
            line: [...f.line, m.uci],
            san: [...f.san, m.san],
            p: f.p * m.p_bot,
          }),
        )
    }
    frontier = next.sort((a, b) => b.p - a.p).slice(0, 12)
  }
  return frontier.slice(0, count).map((f) => ({
    san: sanLine(f.san.map((san) => ({ san }))),
    p: f.p,
  }))
}

const lookaheadFor = (
  n: number,
  white: PlayerId,
  games: RecapGame[],
  pregame: Pregame | null,
): Lookahead | null => {
  const tree = Object.values(pregame?.trees ?? {}).find(
    (t) => t.white === white,
  )
  const root = tree?.nodes?.find((x) => x.line.length === 0)
  if (!tree?.nodes?.length || !root) return null
  return {
    n,
    white,
    black: white === 'gukesh' ? 'sindarov' : 'gukesh',
    firstMoves: [...root.moves]
      .sort((a, b) => b.p_bot - a.p_bot)
      .slice(0, 4)
      .map((m) => ({ san: m.san, p: m.p_bot })),
    lines: treeLines(tree.nodes),
    played: games
      .filter((g) => g.white === white)
      .map((g) => ({
        n: g.n,
        first: g.opening.split(' ').slice(0, 4).join(' '),
      })),
  }
}

/** Points from a result, for each player. */
const points = (g: RecapGame): Record<PlayerId, number> => {
  const [w, b] =
    g.result === '1-0' ? [1, 0] : g.result === '0-1' ? [0, 1] : [0.5, 0.5]
  return { [g.white]: w, [g.black]: b } as Record<PlayerId, number>
}

/**
 * The recap from the feed's games (in match order) and the pre-game bundle.
 * `focus`: the game the page is about; else the latest finished.
 */
export const buildRecap = (
  inputs: FeedGameInput[],
  pregame: Pregame | null,
  focus?: number,
  now = new Date().toISOString(),
): Recap => {
  const games: RecapGame[] = []
  let live: Recap['live'] = null
  for (const g of [...inputs].sort((a, b) => a.n - b.n)) {
    const built = buildGame(g, pregame)
    if (built) games.push(built)
    else if (g.plies.length)
      live = { n: g.n, id: g.id, moves: Math.ceil(g.last_ply / 2) }
  }
  const score = { gukesh: 0, sindarov: 0 } as Record<PlayerId, number>
  games.forEach((g) => {
    const p = points(g)
    score.gukesh += p.gukesh
    score.sindarov += p.sindarov
  })
  const game =
    (focus ? games.find((g) => g.n === focus) : games[games.length - 1]) ?? null
  // The players alternate colours: the next game's White is the last
  // game's Black.
  const last = inputs.length ? [...inputs].sort((a, b) => b.n - a.n)[0] : null
  const lastWhite = last ? idOf(last.manifest?.players?.white) : null
  const nextN = (last?.n ?? 0) + (live ? 0 : 1)
  const nextWhite: PlayerId | null = live
    ? lastWhite
    : lastWhite === 'gukesh'
      ? 'sindarov'
      : lastWhite
        ? 'gukesh'
        : null
  return {
    game,
    games,
    score,
    live,
    lookahead:
      nextWhite && nextN <= MATCH_GAMES
        ? lookaheadFor(nextN, nextWhite, games, pregame)
        : null,
    updated: now,
  }
}

/** Whether a position's FEN is legal (for links built from feed positions). */
export const legalFen = (fen: string) => {
  try {
    return new Chess().load(fen)
  } catch {
    return false
  }
}
