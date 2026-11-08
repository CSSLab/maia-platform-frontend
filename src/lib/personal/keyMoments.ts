import { Chess } from 'chess.ts'
import { GameNode, GameTree, MaiaEvaluation } from 'src/types'
import { MOVE_CLASSIFICATION_THRESHOLDS } from 'src/constants/analysis'
import { MAIA_MODELS, MAIA_RATINGS } from 'src/constants/common'

/**
 * The positions where a player lost the most winning chance with their own
 * move, by Stockfish's analysis of the position before it: a key moment is a
 * move the blunder meter would mark ?! (5% or more win-rate loss) or ??
 * (10% or more). Positions analysed below MIN_DEPTH don't count, as the
 * analysis page doesn't classify those either.
 */
export const MIN_DEPTH = 12
// The card shows a game's biggest few; practice draws from more of them.
export const MAX_MOMENTS = 3
export const MAX_KEPT_MISTAKES = 10

export interface KeyMoment {
  /** The mistake's index in the main line (its position is the one before). */
  moveIndex: number
  /** The position before the mistake. */
  fen: string
  playedMove: string
  playedSan: string
  bestMove: string
  bestSan: string
  /** The win chance the move lost, 0 to 1. */
  winrateLoss: number
  kind: 'blunder' | 'inaccuracy'
  /** "14." for White's 14th move, "14…" for Black's. */
  moveLabel: string
  /**
   * What players at the visitor's rating play here (Maia): the share who
   * find the best move, and who play the move played.
   */
  maia?: { rating: number; bestShare: number; playedShare: number }
}

const moverOf = (node: GameNode): 'white' | 'black' =>
  // A node's position has the other side to move.
  node.turn === 'w' ? 'black' : 'white'

const sanOf = (fen: string, uci: string) => {
  const chess = new Chess(fen)
  return chess.move(uci, { sloppy: true })?.san ?? null
}

export const moveLabelOf = (fen: string) => {
  const [, turn, , , , fullmove] = fen.split(' ')
  return `${fullmove ?? '?'}${turn === 'b' ? '…' : '.'}`
}

/** The main-line nodes whose move is `color`'s. */
export const playerMoveNodes = (tree: GameTree, color: 'white' | 'black') =>
  tree
    .getMainLine()
    .slice(1)
    .filter((node) => moverOf(node) === color && node.move && node.parent)

/** Whether the position before this move has been analysed deep enough. */
export const isAnalysed = (node: GameNode, depth = MIN_DEPTH) => {
  const stockfish = node.parent?.analysis.stockfish
  return (
    !!stockfish &&
    !stockfish.partial &&
    (stockfish.depth >= depth ||
      // Mate found: deeper searches don't change it.
      Math.abs(stockfish.model_optimal_cp) >= 10000)
  )
}

export const findKeyMoments = (
  tree: GameTree,
  color: 'white' | 'black',
  max = MAX_MOMENTS,
): KeyMoment[] => {
  const mainLine = tree.getMainLine()
  const moments: KeyMoment[] = []
  mainLine.forEach((node, index) => {
    if (index === 0 || moverOf(node) !== color || !node.move) return
    const parent = node.parent
    if (!parent || !isAnalysed(node)) return
    const stockfish = parent.analysis.stockfish
    const loss = stockfish?.winrate_loss_vec?.[node.move]
    if (!stockfish || loss === undefined) return
    const lost = Math.abs(loss)
    if (lost < MOVE_CLASSIFICATION_THRESHOLDS.INACCURACY_THRESHOLD) return
    if (!stockfish.model_move || stockfish.model_move === node.move) return
    const bestSan = sanOf(parent.fen, stockfish.model_move)
    if (!bestSan) return
    moments.push({
      moveIndex: index,
      fen: parent.fen,
      playedMove: node.move,
      playedSan: node.san ?? node.move,
      bestMove: stockfish.model_move,
      bestSan,
      winrateLoss: lost,
      kind:
        lost >= MOVE_CLASSIFICATION_THRESHOLDS.BLUNDER_THRESHOLD
          ? 'blunder'
          : 'inaccuracy',
      moveLabel: moveLabelOf(parent.fen),
    })
  })
  return moments
    .sort((a, b) => b.winrateLoss - a.winrateLoss)
    .slice(0, max)
    .sort((a, b) => a.moveIndex - b.moveIndex)
}

/** The Maia rating nearest to a player's (Maia covers 600 to 2600). */
export const nearestMaiaRating = (rating?: number) => {
  if (!rating || !Number.isFinite(rating)) return 1500
  return MAIA_RATINGS.reduce((best, r) =>
    Math.abs(r - rating) < Math.abs(best - rating) ? r : best,
  )
}

/** Adds what Maia says players at `rating` play, from the node's analysis. */
export const withMaiaShares = (
  moment: KeyMoment,
  maia: { [model: string]: MaiaEvaluation } | undefined,
  rating: number,
): KeyMoment => {
  const policy = maia?.[MAIA_MODELS[MAIA_RATINGS.indexOf(rating)]]?.policy
  if (!policy) return moment
  return {
    ...moment,
    maia: {
      rating,
      bestShare: policy[moment.bestMove] ?? 0,
      playedShare: policy[moment.playedMove] ?? 0,
    },
  }
}

/** A game's biggest mistakes, in the order they were played. */
export const topMoments = (moments: KeyMoment[], max = MAX_MOMENTS) =>
  [...moments]
    .sort((a, b) => b.winrateLoss - a.winrateLoss)
    .slice(0, max)
    .sort((a, b) => a.moveIndex - b.moveIndex)
