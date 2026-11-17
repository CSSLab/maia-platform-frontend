import { useMemo } from 'react'
import { Chess } from 'chess.ts'
import { MAIA_MODELS } from 'src/constants/common'
import { GameNode, MaiaEvaluation, StockfishEvaluation } from 'src/types'
import { getVerboseMoves, moveTier, sortStockfishMoves } from './utils'

/**
 * A rating's probability (0-1) of `move`: its own once Maia has answered for
 * it, otherwise interpolated between the nearest ratings below and above that
 * have answered (undefined when one side has none). On a desktop Maia
 * answers for every 400 points first, then every 200, then the rest; on a
 * phone for every 200 points only.
 */
export const ratingProbability = (
  maia: { [model: string]: MaiaEvaluation },
  index: number,
  move: string,
): number | undefined => {
  const has = (i: number) => !!maia[MAIA_MODELS[i]]?.policy
  const value = (i: number) => maia[MAIA_MODELS[i]]?.policy[move] || 0
  if (has(index)) return value(index)
  let below = index - 1
  while (below >= 0 && !has(below)) below--
  let above = index + 1
  while (above < MAIA_MODELS.length && !has(above)) above++
  if (below < 0 || above >= MAIA_MODELS.length) return
  const weight = (index - below) / (above - below)
  return (1 - weight) * value(below) + weight * value(above)
}

/** The most moves the moves-by-rating chart draws. */
export const MAX_CHART_MOVES = 6

/** A natural move: at least 15% of players play it at some rating. */
export const NATURAL_SHARE = 0.15

/** A likely blunder: at least 1 in 20 players play it at some rating. */
export const LIKELY_BLUNDER_SHARE = 0.05

/**
 * The moves the moves-by-rating chart draws: Stockfish's best move, the most
 * played move, and every other move at least 15% of players play at some
 * rating; at most six, those with the highest share at some rating first.
 * Where there is room and none of them is a blunder (Stockfish's red: loses
 * more than 10 points of win rate), also the most played blunder that at
 * least 1 in 20 players play at some rating. The same moves at every rating
 * in the Maia menu.
 *
 * On 10,000 positions of real games (a 23M Maia's moves at 700-2600,
 * interpolated to the chart's 21 ratings): 1 move 7%, 2 23%, 3 31%, 4 25%,
 * 5 11%, 6 3.3% (mean 3.2); a blunder drawn in 48% of positions, nearly all
 * of those where one reaches 5% somewhere (22% only through the blunder
 * rule). Where
 * the most played move has at least 70% at every rating: 1 move 53%, 2 43%,
 * 3 3.9%. With 20% and no blunder rule: mean 2.5, a blunder drawn in 20%.
 */
export const chartMoves = (
  maia: { [model: string]: MaiaEvaluation },
  stockfish: StockfishEvaluation | undefined,
) => {
  const peak = new Map<string, number>()
  for (const model of MAIA_MODELS)
    for (const [move, p] of Object.entries(maia[model]?.policy ?? {}))
      if (p > (peak.get(move) ?? 0)) peak.set(move, p)
  const byPeak = [...peak.keys()].sort((a, b) => peak.get(b)! - peak.get(a)!)
  const human = byPeak.filter(
    (move, i) => i === 0 || peak.get(move)! >= NATURAL_SHARE,
  )

  const best = stockfish
    ? sortStockfishMoves(stockfish, Object.keys(stockfish.cp_vec))[0]
    : undefined
  const moves = (
    best ? [best, ...human.filter((m) => m !== best)] : human
  ).slice(0, MAX_CHART_MOVES)

  const isBlunder = (move: string) => moveTier(stockfish, move) === 'blunder'
  if (moves.length < MAX_CHART_MOVES && !moves.some(isBlunder)) {
    const blunder = byPeak.find(
      (move) => isBlunder(move) && peak.get(move)! >= LIKELY_BLUNDER_SHARE,
    )
    if (blunder) moves.push(blunder)
  }
  return moves
}

/**
 * The moves-by-rating chart's data: for each rating, the probability (%) of
 * each of `chartMoves`. Drawn once every 400 points from 600 to 2600 have
 * their moves, the ratings in between interpolated until they arrive. On 157
 * positions of two games, interpolating from every 400 points was within 1.27
 * percentage points of the rating's own value for 90% of points (at most
 * 7.7), and from every 200 points within 0.45 (at most 2.3). Drawing before
 * that showed the missing ratings at 0%.
 */
export const buildMovesByRating = (
  maia: { [model: string]: MaiaEvaluation } | undefined,
  stockfish: StockfishEvaluation | undefined,
) => {
  if (!maia) return
  if (!MAIA_MODELS.every((model, i) => i % 4 !== 0 || maia[model]?.policy))
    return

  const moves = chartMoves(maia, stockfish)
  return MAIA_MODELS.map((rating, index) => {
    const entry: { [key: string]: number } = {
      rating: parseInt(rating.replace('maia_kdd_', '')),
    }
    for (const move of moves)
      entry[move] = (ratingProbability(maia, index, move) ?? 0) * 100
    return entry
  })
}

export const useMoveRecommendations = (
  currentNode: GameNode | null,
  moveEvaluation: {
    maia?: MaiaEvaluation
    stockfish?: StockfishEvaluation
  } | null,
) => {
  const recommendations = useMemo(() => {
    if (!moveEvaluation) return {}

    const isBlackTurn = currentNode?.turn === 'b'

    const result: {
      maia?: { move: string; prob: number }[]
      stockfish?: {
        move: string
        cp: number
        winrate?: number
        winrate_loss?: number
        cp_relative?: number
      }[]
      isBlackTurn?: boolean
    } = {
      isBlackTurn,
    }

    if (moveEvaluation?.maia) {
      const policy = moveEvaluation.maia.policy
      const maia = Object.entries(policy).map(([move, prob]) => ({
        move,
        prob,
      }))

      result.maia = maia
    }

    if (moveEvaluation?.stockfish) {
      const cp_vec = moveEvaluation.stockfish.cp_vec
      const cp_relative_vec = moveEvaluation.stockfish.cp_relative_vec || {}
      const winrate_vec = moveEvaluation.stockfish.winrate_vec || {}
      const winrate_loss_vec = moveEvaluation.stockfish.winrate_loss_vec || {}
      const sortedMoves = sortStockfishMoves(
        moveEvaluation.stockfish,
        Object.keys(cp_vec),
      )

      const stockfish = sortedMoves.map((move) => ({
        move,
        cp: cp_vec[move] || 0,
        winrate: winrate_vec[move] || 0,
        winrate_loss: winrate_loss_vec[move] || 0,
        cp_relative: cp_relative_vec[move] || 0,
      }))

      result.stockfish = stockfish
    }

    return result
  }, [moveEvaluation, currentNode])

  const movesByRating = useMemo(
    () =>
      currentNode
        ? buildMovesByRating(
            currentNode.analysis.maia,
            moveEvaluation?.stockfish,
          )
        : undefined,
    [moveEvaluation, currentNode],
  )

  const moveMap = useMemo(() => {
    if (!moveEvaluation?.maia || !moveEvaluation?.stockfish || !currentNode) {
      return
    }

    // Get ALL legal moves from the current position
    const legalMoves = getVerboseMoves(currentNode.fen)

    // Create a set of all legal moves in UCI format
    const allLegalMoves = new Set(
      legalMoves.map((move) => `${move.from}${move.to}${move.promotion || ''}`),
    )

    const data = []

    // Include all legal moves, not just top ones
    for (const move of allLegalMoves) {
      // Get Stockfish evaluation (default to worst possible if not evaluated)
      const cp =
        moveEvaluation.stockfish.cp_relative_vec[move] !== undefined
          ? Math.max(-3, moveEvaluation.stockfish.cp_relative_vec[move] / 100)
          : -3 // Cap at -3 to avoid extreme values

      // Get Maia probability (default to 0 if not in policy)
      const prob = (moveEvaluation.maia.policy[move] || 0) * 100

      // Calculate opacity based on position quality
      // Moves in bottom-left (worse SF, less likely Maia) should be more transparent
      // Normalize values: cp ranges from -3 to 0, prob ranges from 0 to ~100
      const normalizedCp = (cp + 3) / 3 // 0 to 1 (0 = worst, 1 = best)
      const normalizedProb = Math.min(prob / 50, 1) // 0 to 1 (capped at 50% for normalization)

      // Combine both factors for opacity (minimum 0.2 for visibility, maximum 0.75)
      const opacity = Math.max(
        0.6,
        Math.min(0.9, (normalizedCp + normalizedProb) / 2),
      )

      // Calculate importance score for sorting (higher = more important)
      // This combines normalized Stockfish evaluation and Maia probability
      const importance = normalizedCp + normalizedProb

      // Calculate dynamic size based on importance (bigger = more important)
      const size = 10

      // Get additional data for comprehensive tooltip
      const rawCp = moveEvaluation.stockfish.cp_vec[move] || 0
      const mate = moveEvaluation.stockfish.mate_vec?.[move]
      const winrate = moveEvaluation.stockfish.winrate_vec?.[move] || 0
      const rawMaiaProb = moveEvaluation.maia.policy[move] || 0

      data.push({
        move,
        x: cp,
        y: prob,
        z: 100,
        opacity,
        importance,
        size,
        rawCp,
        winrate,
        rawMaiaProb,
        relativeCp: moveEvaluation.stockfish.cp_relative_vec[move],
        mate,
      })
    }

    // Sort by importance (ascending) so more important moves are rendered last (on top)
    return data.sort((a, b) => a.importance - b.importance)
  }, [moveEvaluation, currentNode])

  return {
    recommendations,
    movesByRating,
    moveMap,
  }
}
