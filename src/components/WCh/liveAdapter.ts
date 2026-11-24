/*
 * The live game in the page's shape (LivePly / WchNext): the broadcast's
 * moves and clocks, with the research feed's numbers where it has the
 * position (the players' own models, Stockfish, Maia's chances, blunder
 * risk) and else Maia and Stockfish from useWchEngines (Maia at
 * LIVE_MAIA_ELO). No crowd yet (the guesses server doesn't exist).
 */
import { Chess } from 'chess.ts'

import type { PlayerId } from './data'
import { FeedPly, RATING_KEYS, feedMark } from './feed'
import type { Candidate, LivePly, WchNext } from './game1'
import type { LiveGame } from './live'
import type { FocusEval, PositionInfo } from './useWchEngines'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const SHOWN = 12

type Engines = {
  info: (fen: string) => PositionInfo | undefined
  focusEval: (fen: string) => FocusEval | null
}

type Feed = Map<number, FeedPly>

/** The feed's position `n`, if it is the same position (fen) as ours. */
const feedAt = (feed: Feed | undefined, n: number, fen: string) => {
  const f = feed?.get(n)
  return f &&
    f.fen.split(' ').slice(0, 4).join(' ') ===
      fen.split(' ').slice(0, 4).join(' ')
    ? f
    : undefined
}

const num = (v: number | null | undefined) =>
  typeof v === 'number' && Number.isFinite(v) ? v : NaN

/** The feed's moves: the own model (after its own search once in). */
const feedCandidates = (f: FeedPly, include?: string): Candidate[] => {
  const pk = !!f.pk_ready && f.moves.every((m) => m.p_elite_pk != null)
  const all = f.moves.map((m) => ({
    uci: m.uci,
    san: m.san,
    maia: (pk ? m.p_elite_pk : m.p_elite) ?? 0,
    crowd: 0,
    generic: num(m.p_generic),
    eval: num(m.sf_cp) / 100,
  }))
  all.sort((a, b) => b.maia - a.maia)
  let shown = all.slice(0, SHOWN)
  if (include && !shown.some((c) => c.uci === include)) {
    const extra = all.find((c) => c.uci === include)
    if (extra) shown = [...shown, extra]
  }
  return shown.map(({ uci: _uci, ...c }) => c)
}

const sanOf = (fen: string, uci: string) => {
  try {
    const m = new Chess(fen).move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    } as never)
    return m ? m.san : uci
  } catch {
    return uci
  }
}

/** White's-side pawns from a side-to-move score at `fen`. */
const whitePawns = (fen: string, cpStm: number | undefined) =>
  cpStm === undefined
    ? NaN
    : ((fen.split(' ')[1] === 'w' ? 1 : -1) * cpStm) / 100

/** Maia's top moves at `fen`, with Stockfish's eval of each when it's in. */
const candidatesAt = (
  fen: string,
  eng: Engines,
  include?: string,
): Candidate[] => {
  const policy = eng.info(fen)?.read?.policy
  if (!policy) return []
  const focus = eng.focusEval(fen)
  let ucis = Object.keys(policy).slice(0, SHOWN)
  if (include && !ucis.includes(include)) ucis = [...ucis, include]
  return ucis.map((uci) => ({
    san: sanOf(fen, uci),
    maia: policy[uci] ?? 0,
    crowd: 0,
    generic: NaN,
    eval: focus?.cpVec[uci] !== undefined ? focus.cpVec[uci] / 100 : NaN,
  }))
}

const bestSan = (fen: string, eng: Engines) => {
  const best = eng.focusEval(fen)?.best ?? eng.info(fen)?.best
  return best ? sanOf(fen, best) : ''
}

export const buildLive = (
  game: LiveGame | null,
  eng: Engines,
  ids: { white: PlayerId; black: PlayerId },
  startClock: number | null,
  feed?: Feed,
): { plies: LivePly[]; next: WchNext } => {
  const moves = game?.moves ?? []
  const clocks = { white: startClock ?? 0, black: startClock ?? 0 }
  const plies: LivePly[] = moves.map((m) => {
    if (m.clock !== null) clocks[m.color] = m.clock
    const fBefore = feedAt(feed, m.index, m.fenBefore)
    const fAfter = feedAt(feed, m.index + 1, m.fen)
    const scored = fAfter?.played?.uci === m.uci ? fAfter.played : null
    const policy = eng.info(m.fenBefore)?.read?.policy
    const order = policy ? Object.keys(policy) : []
    const after = eng.info(m.fen)
    const sfEval =
      fAfter?.sf_eval_cp != null
        ? fAfter.sf_eval_cp / 100
        : whitePawns(m.fen, after?.cpStm)
    const wdl = fAfter?.wdl_maia
    const byRating = fAfter?.p_by_rating
    return {
      index: m.index,
      moveNumber: m.moveNumber,
      color: m.color,
      mover: m.color === 'white' ? ids.white : ids.black,
      san: m.san,
      uci: m.uci,
      fenBefore: m.fenBefore,
      fen: m.fen,
      candidates: fBefore
        ? feedCandidates(fBefore, m.uci)
        : candidatesAt(m.fenBefore, eng, m.uci),
      sf: fBefore?.sf_best
        ? sanOf(m.fenBefore, fBefore.sf_best)
        : bestSan(m.fenBefore, eng),
      rank: scored ? scored.rank_elite : policy ? order.indexOf(m.uci) + 1 : 0,
      pPlayed: scored ? scored.p_elite : (policy?.[m.uci] ?? 0),
      crowdPlayed: 0,
      crowdTop: '',
      guesses: 0,
      eval: Number.isFinite(sfEval) ? sfEval : (m.eval ?? NaN),
      think: m.think,
      clockWhite: clocks.white,
      clockBlack: clocks.black,
      bar: wdl ? { W: wdl[0], D: wdl[1], B: wdl[2] } : after?.bar,
      mark: feedMark(fAfter?.grade),
      risk: fBefore?.blunder_risk ?? null,
      ...(byRating && RATING_KEYS.every((k) => k in byRating)
        ? { ratingShares: RATING_KEYS.map((k) => byRating[k]) }
        : {}),
    }
  })
  const last = moves[moves.length - 1]
  const fen = last ? last.fen : START_FEN
  const color = fen.split(' ')[1] === 'w' ? 'white' : 'black'
  const over = game && game.result !== '*' ? game.result : undefined
  const fNext = feedAt(feed, moves.length, fen)
  return {
    plies,
    next: {
      moveNumber: last ? last.moveNumber + (last.color === 'black' ? 1 : 0) : 1,
      color,
      mover: color === 'white' ? ids.white : ids.black,
      fen,
      sf: over
        ? ''
        : fNext?.sf_best
          ? sanOf(fen, fNext.sf_best)
          : bestSan(fen, eng),
      candidates: over
        ? []
        : fNext
          ? feedCandidates(fNext)
          : candidatesAt(fen, eng),
      risk: over ? null : (fNext?.blunder_risk ?? null),
      thinkPred: over ? null : (fNext?.think_pred ?? null),
      guessesSoFar: 0,
      thinkingFor: null,
      ...(over ? { over } : {}),
    },
  }
}
