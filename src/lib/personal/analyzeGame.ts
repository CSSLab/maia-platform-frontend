import { Chess } from 'chess.ts'
import { GameNode, GameTree, StockfishEngine } from 'src/types'
import type Maia from 'src/lib/engine/maia'
import { MAIA_MODELS, MAIA_RATINGS } from 'src/constants/common'
import { collectEngineAnalysisData } from 'src/lib/analysis'
import { storeGameAnalysisCache } from 'src/api/analysis'
import { MIN_DEPTH, isAnalysed, playerMoveNodes } from './keyMoments'

export interface AnalysisProgress {
  done: number
  total: number
}

const isSettled = (
  evaluation: { depth: number; partial?: boolean; model_optimal_cp: number },
  depth: number,
) =>
  !evaluation.partial &&
  (evaluation.depth >= depth || Math.abs(evaluation.model_optimal_cp) >= 10000)

/**
 * Stockfish's analysis of a position, to `depth`, added to the node as the
 * analysis page does. `forced`: moves searched to full depth whatever the
 * engine thinks of them (the move played, a practice answer).
 */
export const analysePosition = async (
  node: GameNode,
  stockfish: StockfishEngine,
  depth: number,
  forced: string[],
  signal?: AbortSignal,
) => {
  const chess = new Chess(node.fen)
  if (chess.gameOver()) return
  const stream = stockfish.streamEvaluations(
    node.fen,
    chess.moves().length,
    depth,
    { forcedCandidateMoves: forced },
  )
  if (!stream) throw new Error('Stockfish is not ready')
  for await (const evaluation of stream) {
    if (signal?.aborted) break
    node.addStockfishAnalysis(evaluation)
    if (isSettled(evaluation, depth)) break
  }
}

/**
 * Analyses the positions before each of `color`'s moves that aren't analysed
 * to `depth` yet (other positions don't decide the player's mistakes), the
 * move played searched in full. Resolves to whether all of them were done.
 */
export const analysePlayerMoves = async (
  tree: GameTree,
  color: 'white' | 'black',
  stockfish: StockfishEngine,
  options: {
    depth?: number
    signal?: AbortSignal
    onProgress?: (progress: AnalysisProgress) => void
  } = {},
): Promise<boolean> => {
  const depth = options.depth ?? MIN_DEPTH
  const nodes = playerMoveNodes(tree, color)
  const todo = nodes.filter((node) => !isAnalysed(node, depth))
  let done = nodes.length - todo.length
  options.onProgress?.({ done, total: nodes.length })
  for (const node of todo) {
    if (options.signal?.aborted) return false
    await analysePosition(
      node.parent as GameNode,
      stockfish,
      depth,
      [node.move as string],
      options.signal,
    )
    done += 1
    options.onProgress?.({ done, total: nodes.length })
  }
  return !options.signal?.aborted
}

/**
 * Maia's analysis of these positions at every rating, as the analysis page
 * stores it (only complete sets are saved).
 */
export const addMaiaAnalysis = async (nodes: GameNode[], maia: Maia) => {
  for (const node of nodes) {
    if (MAIA_MODELS.every((model) => node.analysis.maia?.[model])) continue
    const { result } = await maia.batchEvaluateMaia3(
      Array(MAIA_RATINGS.length).fill(node.fen),
      MAIA_RATINGS,
      MAIA_RATINGS,
    )
    const byModel: Record<string, (typeof result)[number]> = {}
    MAIA_MODELS.forEach((model, index) => {
      byModel[model] = result[index]
    })
    node.addMaiaAnalysis(byModel)
  }
}

/** Saves the game's analysis with the backend, as the analysis page does. */
export const saveGameAnalysis = async (gameId: string, tree: GameTree) => {
  const positions = collectEngineAnalysisData(tree)
  if (positions.length === 0) return
  await storeGameAnalysisCache(gameId, positions)
}
