import { Chess } from 'chess.ts'
import { GameTree, StockfishEngine } from 'src/types'
import { retrieveGameAnalysisCache } from 'src/api/analysis'
import { applyEngineAnalysisData } from 'src/lib/analysis'
import { parseLichessPgn } from 'src/lib/lichess'
import { analysePosition } from './analyzeGame'
import { findKeyMoments } from './keyMoments'
import { fetchRecentLichessGames } from './lastLichessGame'
import { GameMoments, loadGameMoments, saveGameMoments } from './momentStore'
import { localDay, readJson, writeJson } from './storage'

/**
 * A practice answer is correct when Stockfish rates it within this much win
 * chance (0 to 1) of its best move in the position: 2 points. That is under
 * half the 5 points from which the blunder meter marks a move ?!, so a move
 * counted correct is never one it would flag, while moves Stockfish rates
 * about equal to the best (often several in a position) count too.
 */
export const PRACTICE_CORRECT_MARGIN = 0.02
// Deeper than the depth the mistakes were found at (12), for the answer.
export const PRACTICE_DEPTH = 14

export interface Grade {
  correct: boolean
  /** The win chance the answer gives up against the best move, 0 to 1. */
  loss: number
}

/**
 * Grades `answer` in `fen` against Stockfish's best move there: the answer
 * (and the best move found when the mistake was) searched in full.
 */
export const gradeAnswer = async (
  fen: string,
  answer: string,
  knownBest: string,
  stockfish: StockfishEngine,
  signal?: AbortSignal,
): Promise<Grade> => {
  if (answer === knownBest) return { correct: true, loss: 0 }
  const chess = new Chess(fen)
  if (chess.move(answer, { sloppy: true }) && chess.inCheckmate()) {
    return { correct: true, loss: 0 }
  }
  const tree = new GameTree(fen)
  const root = tree.getRoot()
  await analysePosition(
    root,
    stockfish,
    PRACTICE_DEPTH,
    [answer, knownBest],
    signal,
  )
  const loss = Math.abs(
    root.analysis.stockfish?.winrate_loss_vec?.[answer] ?? Infinity,
  )
  return { correct: loss <= PRACTICE_CORRECT_MARGIN, loss }
}

const CHECKED_KEY = (lichessId: string) =>
  `maia.practiceEarlierGames.v1:${lichessId.toLowerCase()}`
const MAX_EARLIER_GAMES = 10

/**
 * Mistakes from the visitor's earlier Lichess games that have analysis saved
 * with the backend (from the analysis page, or this site's cards), without
 * analysing anything here: their recent games are asked for once a day, and
 * each game's saved analysis once. Adds what it finds to this browser's
 * moments. Resolves to how many games it added.
 */
export const gatherEarlierGames = async (lichessId: string) => {
  const today = localDay()
  const checked = readJson<{ day: string; ids: string[] }>(
    'local',
    CHECKED_KEY(lichessId),
  )
  if (checked?.day === today) return 0
  const ids = new Set(checked?.ids ?? [])
  const games = await fetchRecentLichessGames(lichessId, MAX_EARLIER_GAMES)
  let added = 0
  for (const game of games) {
    if (ids.has(game.id) || loadGameMoments(game.id)) continue
    ids.add(game.id)
    const parsed = parseLichessPgn(game.id, game.pgn)
    if (!parsed) continue
    const stored = await retrieveGameAnalysisCache(game.id).catch(() => null)
    if (!stored?.positions?.length) continue
    applyEngineAnalysisData(parsed.tree, stored.positions)
    const moments = findKeyMoments(parsed.tree, game.userColor)
    if (!moments.length) continue
    const entry: GameMoments = {
      gameId: game.id,
      gameType: 'lichess',
      color: game.userColor,
      moments,
      usedMaia: false,
      opponentRating: game.opponentRating,
      savedAt: game.lastMoveAt || Date.now(),
    }
    saveGameMoments(entry)
    added += 1
  }
  writeJson('local', CHECKED_KEY(lichessId), {
    day: today,
    ids: Array.from(ids).slice(-100),
  })
  return added
}
