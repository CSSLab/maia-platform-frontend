/*
 * The live game in the page's shape (LivePly / WchNext): the broadcast's
 * moves and clocks, with Maia and Stockfish from useWchEngines where they
 * are in. No crowd yet (the guesses server doesn't exist), no player models
 * (Maia at LIVE_MAIA_ELO instead).
 */
import { Chess } from 'chess.ts'

import type { PlayerId } from './data'
import type { Candidate, LivePly, WchNext } from './game1'
import type { LiveGame } from './live'
import type { FocusEval, PositionInfo } from './useWchEngines'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const SHOWN = 12

type Engines = {
  info: (fen: string) => PositionInfo | undefined
  focusEval: (fen: string) => FocusEval | null
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
): { plies: LivePly[]; next: WchNext } => {
  const moves = game?.moves ?? []
  const clocks = { white: startClock ?? 0, black: startClock ?? 0 }
  const plies: LivePly[] = moves.map((m) => {
    if (m.clock !== null) clocks[m.color] = m.clock
    const policy = eng.info(m.fenBefore)?.read?.policy
    const order = policy ? Object.keys(policy) : []
    const after = eng.info(m.fen)
    const sfEval = whitePawns(m.fen, after?.cpStm)
    return {
      index: m.index,
      moveNumber: m.moveNumber,
      color: m.color,
      mover: m.color === 'white' ? ids.white : ids.black,
      san: m.san,
      uci: m.uci,
      fenBefore: m.fenBefore,
      fen: m.fen,
      candidates: candidatesAt(m.fenBefore, eng, m.uci),
      sf: bestSan(m.fenBefore, eng),
      rank: policy ? order.indexOf(m.uci) + 1 : 0,
      pPlayed: policy?.[m.uci] ?? 0,
      crowdPlayed: 0,
      crowdTop: '',
      guesses: 0,
      eval: Number.isFinite(sfEval) ? sfEval : (m.eval ?? NaN),
      think: m.think,
      clockWhite: clocks.white,
      clockBlack: clocks.black,
      bar: after?.bar,
    }
  })
  const last = moves[moves.length - 1]
  const fen = last ? last.fen : START_FEN
  const color = fen.split(' ')[1] === 'w' ? 'white' : 'black'
  const over = game && game.result !== '*' ? game.result : undefined
  return {
    plies,
    next: {
      moveNumber: last ? last.moveNumber + (last.color === 'black' ? 1 : 0) : 1,
      color,
      mover: color === 'white' ? ids.white : ids.black,
      fen,
      sf: over ? '' : bestSan(fen, eng),
      candidates: over ? [] : candidatesAt(fen, eng),
      guessesSoFar: 0,
      thinkingFor: null,
      ...(over ? { over } : {}),
    },
  }
}
