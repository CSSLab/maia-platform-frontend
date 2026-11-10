import { Chess } from 'chess.ts'
import {
  GameTree,
  GameNode,
  RawMove,
  MistakePosition,
  MoveValueMapping,
  StockfishEvaluation,
  CachedEngineAnalysisEntry,
} from 'src/types'

export function convertBackendEvalToStockfishEval(
  possibleMoves: MoveValueMapping,
  turn: 'w' | 'b',
): StockfishEvaluation {
  const cp_vec: { [key: string]: number } = {}
  const cp_relative_vec: { [key: string]: number } = {}
  let model_optimal_cp = -Infinity
  let model_move = ''
  const mate_vec: { [key: string]: number } = {}

  // Detect mate values and convert them
  for (const move in possibleMoves) {
    const cp = possibleMoves[move]

    // Detect mate patterns (±10000 indicates mate)
    let mateIn: number | undefined = undefined
    if (Math.abs(cp) >= 10000) {
      // Estimate mate in moves based on how close to 10000 it is
      // The closer to 10000, the faster the mate
      const mateDistance = Math.abs(10000 - Math.abs(cp))
      mateIn =
        cp > 0
          ? Math.max(1, Math.floor(mateDistance / 100) + 1)
          : -Math.max(1, Math.floor(mateDistance / 100) + 1)
      mate_vec[move] = mateIn
    }

    cp_vec[move] = cp
    if (cp > model_optimal_cp) {
      model_optimal_cp = cp
      model_move = move
    }
  }

  for (const move in cp_vec) {
    const cp = possibleMoves[move]
    cp_relative_vec[move] = cp - model_optimal_cp
  }

  const cp_vec_sorted = Object.fromEntries(
    Object.entries(cp_vec).sort(([, a], [, b]) => b - a),
  )

  const cp_relative_vec_sorted = Object.fromEntries(
    Object.entries(cp_relative_vec).sort(([, a], [, b]) => b - a),
  )

  const winrate_vec: { [key: string]: number } = {}
  let max_winrate = -Infinity

  for (const move in cp_vec_sorted) {
    const cp = cp_vec_sorted[move]
    // For mate positions, set winrate to 1.0 or 0.0
    const isMate = Math.abs(cp) >= 10000
    const winrate = isMate ? (cp > 0 ? 1.0 : 0.0) : cpToWinrate(cp, false)
    winrate_vec[move] = winrate

    if (winrate_vec[move] > max_winrate) {
      max_winrate = winrate_vec[move]
    }
  }

  const winrate_loss_vec: { [key: string]: number } = {}
  for (const move in winrate_vec) {
    winrate_loss_vec[move] = winrate_vec[move] - max_winrate
  }

  const winrate_vec_sorted = Object.fromEntries(
    Object.entries(winrate_vec).sort(([, a], [, b]) => b - a),
  )

  const winrate_loss_vec_sorted = Object.fromEntries(
    Object.entries(winrate_loss_vec).sort(([, a], [, b]) => b - a),
  )

  if (turn === 'b') {
    model_optimal_cp *= -1
    for (const move in cp_vec_sorted) {
      cp_vec_sorted[move] *= -1
    }
    for (const move in mate_vec) {
      mate_vec[move] *= -1
    }
  }

  const mate_vec_sorted =
    Object.keys(mate_vec).length > 0
      ? Object.fromEntries(
          Object.keys(cp_vec_sorted)
            .filter((move) => mate_vec[move] !== undefined)
            .map((move) => [move, mate_vec[move]]),
        )
      : undefined

  // We can't easily detect checkmate from backend data without FEN,
  // so we'll leave is_checkmate as undefined for backend evaluations
  return {
    sent: true,
    depth: 20,
    model_move: model_move,
    model_optimal_cp: model_optimal_cp,
    cp_vec: cp_vec_sorted,
    cp_relative_vec: cp_relative_vec_sorted,
    winrate_vec: winrate_vec_sorted,
    winrate_loss_vec: winrate_loss_vec_sorted,
    mate_vec: mate_vec_sorted,
    is_checkmate: undefined,
  }
}

export function insertBackendStockfishEvalToGameTree(
  tree: GameTree,
  moves: RawMove[],
  stockfishEvaluations: MoveValueMapping[],
) {
  let currentNode: GameNode | null = tree.getRoot()

  for (let i = 0; i < moves.length; i++) {
    if (!currentNode) {
      break
    }

    const stockfishEval = stockfishEvaluations[i]
      ? convertBackendEvalToStockfishEval(
          stockfishEvaluations[i],
          moves[i].board.split(' ')[1] as 'w' | 'b',
        )
      : undefined

    if (stockfishEval) {
      currentNode.addStockfishAnalysis(stockfishEval)
    }
    currentNode = currentNode?.mainChild
  }
}

export const collectEngineAnalysisData = (
  gameTree: GameTree,
): CachedEngineAnalysisEntry[] => {
  const positions: CachedEngineAnalysisEntry[] = []
  const mainLine = gameTree.getMainLine()

  mainLine.forEach((node, index) => {
    if (!node.analysis.maia && !node.analysis.stockfish) {
      return
    }

    const position: CachedEngineAnalysisEntry = {
      ply: index,
      fen: node.fen,
    }

    if (node.analysis.maia) {
      position.maia = node.analysis.maia
    }

    if (node.analysis.stockfish) {
      position.stockfish = {
        depth: node.analysis.stockfish.depth,
        cp_vec: node.analysis.stockfish.cp_vec,
        mate_vec: node.analysis.stockfish.mate_vec,
      }
    }

    positions.push(position)
  })

  return positions
}

const reconstructCachedStockfishAnalysis = (
  cpVec: { [move: string]: number },
  depth: number,
  fen: string,
  mateVec?: { [move: string]: number },
) => {
  const board = new Chess(fen)
  const isBlackTurn = board.turn() === 'b'

  let bestCp = isBlackTurn ? Infinity : -Infinity
  let bestMove = ''

  for (const move in cpVec) {
    const cp = cpVec[move]
    if (isBlackTurn) {
      if (cp < bestCp) {
        bestCp = cp
        bestMove = move
      }
    } else {
      if (cp > bestCp) {
        bestCp = cp
        bestMove = move
      }
    }
  }

  const cp_relative_vec: { [move: string]: number } = {}
  for (const move in cpVec) {
    const cp = cpVec[move]
    cp_relative_vec[move] = isBlackTurn ? bestCp - cp : cp - bestCp
  }

  const winrate_vec: { [move: string]: number } = {}
  for (const move in cpVec) {
    const cp = cpVec[move]
    const winrate = cpToWinrate(cp * (isBlackTurn ? -1 : 1), false)
    winrate_vec[move] = winrate
  }

  let bestWinrate = -Infinity
  for (const move in winrate_vec) {
    const wr = winrate_vec[move]
    if (wr > bestWinrate) {
      bestWinrate = wr
    }
  }

  const winrate_loss_vec: { [move: string]: number } = {}
  for (const move in winrate_vec) {
    winrate_loss_vec[move] = winrate_vec[move] - bestWinrate
  }

  const sortedEntries = Object.entries(winrate_vec).sort(
    ([, a], [, b]) => b - a,
  )

  const sortedWinrateVec = Object.fromEntries(sortedEntries)
  const sortedWinrateLossVec = Object.fromEntries(
    sortedEntries.map(([move]) => [move, winrate_loss_vec[move]]),
  )

  return {
    sent: true,
    depth,
    model_move: bestMove,
    model_optimal_cp: bestCp,
    cp_vec: cpVec,
    cp_relative_vec,
    winrate_vec: sortedWinrateVec,
    winrate_loss_vec: sortedWinrateLossVec,
    mate_vec: mateVec,
  }
}

export const applyEngineAnalysisData = (
  gameTree: GameTree,
  analysisData: CachedEngineAnalysisEntry[],
): void => {
  const mainLine = gameTree.getMainLine()

  analysisData.forEach((positionData) => {
    const { ply, maia, stockfish } = positionData

    if (ply >= 0 && ply < mainLine.length) {
      const node = mainLine[ply]

      if (node.fen === positionData.fen) {
        if (maia) {
          node.addMaiaAnalysis(maia)
        }

        if (stockfish) {
          const stockfishEval = reconstructCachedStockfishAnalysis(
            stockfish.cp_vec,
            stockfish.depth,
            node.fen,
            stockfish.mate_vec,
          )

          if (
            !node.analysis.stockfish ||
            node.analysis.stockfish.depth < stockfish.depth
          ) {
            node.addStockfishAnalysis(stockfishEval)
          }
        }
      }
    }
  })
}

export const generateAnalysisCacheKey = (
  analysisData: CachedEngineAnalysisEntry[],
): string => {
  const keyData = analysisData.map((pos) => ({
    ply: pos.ply,
    fen: pos.fen,
    hasStockfish: !!pos.stockfish,
    stockfishDepth: pos.stockfish?.depth || 0,
    hasMaia: !!pos.maia,
    maiaModels: pos.maia ? Object.keys(pos.maia).sort() : [],
  }))

  return JSON.stringify(keyData)
}

export function extractPlayerMistakes(
  gameTree: GameTree,
  playerColor: 'white' | 'black',
): MistakePosition[] {
  const mainLine = gameTree.getMainLine()
  const mistakes: MistakePosition[] = []

  for (let i = 1; i < mainLine.length; i++) {
    const node = mainLine[i]
    const isPlayerMove = node.turn === (playerColor === 'white' ? 'b' : 'w')

    if (
      isPlayerMove &&
      (node.blunder || node.inaccuracy) &&
      node.move &&
      node.san
    ) {
      const parentNode = node.parent
      if (!parentNode) continue

      const stockfishEval = parentNode.analysis.stockfish
      if (!stockfishEval || !stockfishEval.model_move) continue

      const chess = new Chess(parentNode.fen)
      const bestMoveResult = chess.move(stockfishEval.model_move, {
        sloppy: true,
      })
      if (!bestMoveResult) continue

      mistakes.push({
        nodeId: `move-${i}`,
        moveIndex: i,
        fen: parentNode.fen,
        playedMove: node.move,
        san: node.san,
        type: node.blunder ? 'blunder' : 'inaccuracy',
        bestMove: stockfishEval.model_move,
        bestMoveSan: bestMoveResult.san,
        playerColor,
      })
    }
  }

  return mistakes
}

export function getBestMoveForPosition(node: GameNode): {
  move: string
  san: string
} | null {
  const stockfishEval = node.analysis.stockfish
  if (!stockfishEval || !stockfishEval.model_move) {
    return null
  }

  const chess = new Chess(node.fen)
  const moveResult = chess.move(stockfishEval.model_move, { sloppy: true })

  if (!moveResult) {
    return null
  }

  return {
    move: stockfishEval.model_move,
    san: moveResult.san,
  }
}

export function isBestMove(node: GameNode, moveUci: string): boolean {
  const bestMove = getBestMoveForPosition(node)
  return bestMove ? bestMove.move === moveUci : false
}

export const cpLookup: Record<string, number> = {
  '-10.0': 0.169027,
  '-9.9': 0.169615,
  '-9.8': 0.170127,
  '-9.7': 0.170812,
  '-9.6': 0.171694,
  '-9.5': 0.17279,
  '-9.4': 0.174102,
  '-9.3': 0.175605,
  '-9.2': 0.177273,
  '-9.1': 0.179091,
  '-9.0': 0.180987,
  '-8.9': 0.182915,
  '-8.8': 0.184838,
  '-8.7': 0.186695,
  '-8.6': 0.188491,
  '-8.5': 0.190232,
  '-8.4': 0.192085,
  '-8.3': 0.194233,
  '-8.2': 0.196698,
  '-8.1': 0.199508,
  '-8.0': 0.202669,
  '-7.9': 0.206015,
  '-7.8': 0.209427,
  '-7.7': 0.212738,
  '-7.6': 0.21571,
  '-7.5': 0.218239,
  '-7.4': 0.220391,
  '-7.3': 0.22225,
  '-7.2': 0.223864,
  '-7.1': 0.22545,
  '-7.0': 0.227423,
  '-6.9': 0.230135,
  '-6.8': 0.233548,
  '-6.7': 0.237376,
  '-6.6': 0.241443,
  '-6.5': 0.245492,
  '-6.4': 0.249239,
  '-6.3': 0.252591,
  '-6.2': 0.255566,
  '-6.1': 0.258311,
  '-6.0': 0.260979,
  '-5.9': 0.263692,
  '-5.8': 0.266537,
  '-5.7': 0.269398,
  '-5.6': 0.272247,
  '-5.5': 0.275167,
  '-5.4': 0.278241,
  '-5.3': 0.281449,
  '-5.2': 0.284771,
  '-5.1': 0.288211,
  '-5.0': 0.29177,
  '-4.9': 0.295276,
  '-4.8': 0.298701,
  '-4.7': 0.302064,
  '-4.6': 0.305381,
  '-4.5': 0.308626,
  '-4.4': 0.311808,
  '-4.3': 0.315021,
  '-4.2': 0.318286,
  '-4.1': 0.321486,
  '-4.0': 0.324617,
  '-3.9': 0.327755,
  '-3.8': 0.330924,
  '-3.7': 0.334034,
  '-3.6': 0.33702,
  '-3.5': 0.339992,
  '-3.4': 0.343028,
  '-3.3': 0.346046,
  '-3.2': 0.349082,
  '-3.1': 0.352207,
  '-3.0': 0.355469,
  '-2.9': 0.358842,
  '-2.8': 0.362344,
  '-2.7': 0.365978,
  '-2.6': 0.369675,
  '-2.5': 0.373361,
  '-2.4': 0.377075,
  '-2.3': 0.380806,
  '-2.2': 0.384567,
  '-2.1': 0.3884,
  '-2.0': 0.392429,
  '-1.9': 0.396756,
  '-1.8': 0.401419,
  '-1.7': 0.40643,
  '-1.6': 0.411854,
  '-1.5': 0.417668,
  '-1.4': 0.423703,
  '-1.3': 0.429697,
  '-1.2': 0.435622,
  '-1.1': 0.44157,
  '-1.0': 0.447671,
  '-0.9': 0.454063,
  '-0.8': 0.460912,
  '-0.7': 0.468495,
  '-0.6': 0.476866,
  '-0.5': 0.485788,
  '-0.4': 0.495066,
  '-0.3': 0.504569,
  '-0.2': 0.515055,
  '-0.1': 0.527259,
  '0.0': 0.539177,
  '0.1': 0.550862,
  '0.2': 0.562709,
  '0.3': 0.574687,
  '0.4': 0.584243,
  '0.5': 0.592467,
  '0.6': 0.600274,
  '0.7': 0.607572,
  '0.8': 0.614349,
  '0.9': 0.620765,
  '1.0': 0.626833,
  '1.1': 0.632615,
  '1.2': 0.638199,
  '1.3': 0.643635,
  '1.4': 0.648925,
  '1.5': 0.654003,
  '1.6': 0.658792,
  '1.7': 0.663246,
  '1.8': 0.667361,
  '1.9': 0.671125,
  '2.0': 0.674604,
  '2.1': 0.677867,
  '2.2': 0.681003,
  '2.3': 0.684023,
  '2.4': 0.687004,
  '2.5': 0.690018,
  '2.6': 0.693001,
  '2.7': 0.695909,
  '2.8': 0.698803,
  '2.9': 0.70169,
  '3.0': 0.704491,
  '3.1': 0.707166,
  '3.2': 0.709695,
  '3.3': 0.712124,
  '3.4': 0.714496,
  '3.5': 0.716921,
  '3.6': 0.719419,
  '3.7': 0.722059,
  '3.8': 0.724834,
  '3.9': 0.727701,
  '4.0': 0.730514,
  '4.1': 0.733293,
  '4.2': 0.736143,
  '4.3': 0.738967,
  '4.4': 0.741685,
  '4.5': 0.744433,
  '4.6': 0.747352,
  '4.7': 0.750344,
  '4.8': 0.753255,
  '4.9': 0.756102,
  '5.0': 0.758987,
  '5.1': 0.7618,
  '5.2': 0.764479,
  '5.3': 0.76705,
  '5.4': 0.769554,
  '5.5': 0.771989,
  '5.6': 0.774346,
  '5.7': 0.776559,
  '5.8': 0.778666,
  '5.9': 0.780761,
  '6.0': 0.78284,
  '6.1': 0.784938,
  '6.2': 0.787238,
  '6.3': 0.789898,
  '6.4': 0.793022,
  '6.5': 0.796334,
  '6.6': 0.799572,
  '6.7': 0.802667,
  '6.8': 0.805434,
  '6.9': 0.807435,
  '7.0': 0.808643,
  '7.1': 0.809427,
  '7.2': 0.810281,
  '7.3': 0.811421,
  '7.4': 0.812938,
  '7.5': 0.814961,
  '7.6': 0.817454,
  '7.7': 0.820154,
  '7.8': 0.822807,
  '7.9': 0.825223,
  '8.0': 0.827366,
  '8.1': 0.829315,
  '8.2': 0.831118,
  '8.3': 0.832804,
  '8.4': 0.834355,
  '8.5': 0.835916,
  '8.6': 0.837593,
  '8.7': 0.839237,
  '8.8': 0.840791,
  '8.9': 0.84219,
  '9.0': 0.843336,
  '9.1': 0.844304,
  '9.2': 0.845199,
  '9.3': 0.846138,
  '9.4': 0.847095,
  '9.5': 0.847994,
  '9.6': 0.848954,
  '9.7': 0.849956,
  '9.8': 0.850761,
  '9.9': 0.851281,
  '10.0': 0.851931,
}

// cpLookup as an array indexed by (pawns + 10) * 10, for interpolation.
const cpLookupBins: number[] = Array.from(
  { length: 201 },
  (_, i) => cpLookup[((i - 100) / 10).toFixed(1)],
)

export const cpToWinrate = (cp: number | string, allowNaN = false): number => {
  try {
    const numCp = (typeof cp === 'string' ? parseFloat(cp) : cp) / 100

    if (Number.isNaN(numCp)) {
      return allowNaN ? Number.NaN : 0.5
    }

    // Linearly interpolate between the 0.1-pawn bins so the curve is
    // continuous: a 1cp difference must not jump a whole bin step.
    const clampedCp = Math.max(-10.0, Math.min(10.0, numCp))
    const pos = (clampedCp + 10) * 10
    const i = Math.min(199, Math.floor(pos))
    const t = pos - i
    return cpLookupBins[i] + (cpLookupBins[i + 1] - cpLookupBins[i]) * t
  } catch (error) {
    if (allowNaN) {
      return Number.NaN
    }
    throw error
  }
}
