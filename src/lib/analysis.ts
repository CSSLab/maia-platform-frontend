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
  '-10.0': 0.16874792794783955,
  '-9.9': 0.16985049833887045,
  '-9.8': 0.17055738720598324,
  '-9.7': 0.17047675058336964,
  '-9.6': 0.17062880930380164,
  '-9.5': 0.17173295708238823,
  '-9.4': 0.1741832515174232,
  '-9.3': 0.17496583875894223,
  '-9.2': 0.17823840614328434,
  '-9.1': 0.17891311823785128,
  '-9.0': 0.18001756037367211,
  '-8.9': 0.18238828856575562,
  '-8.8': 0.18541818422621015,
  '-8.7': 0.18732127851231173,
  '-8.6': 0.188595528612019,
  '-8.5': 0.19166809721845357,
  '-8.4': 0.18989033973470404,
  '-8.3': 0.19357848980722225,
  '-8.2': 0.195212660943061,
  '-8.1': 0.1985674406526584,
  '-8.0': 0.20401430566976098,
  '-7.9': 0.2053494594581885,
  '-7.8': 0.2095001157139551,
  '-7.7': 0.2127603864858716,
  '-7.6': 0.21607609694057794,
  '-7.5': 0.21973060624595708,
  '-7.4': 0.2228248514176221,
  '-7.3': 0.22299885811455433,
  '-7.2': 0.22159517034121434,
  '-7.1': 0.2253474128373214,
  '-7.0': 0.22700275966883976,
  '-6.9': 0.2277978270416834,
  '-6.8': 0.23198254537369023,
  '-6.7': 0.23592594616253237,
  '-6.6': 0.24197398088661215,
  '-6.5': 0.24743721350483228,
  '-6.4': 0.2504634951693775,
  '-6.3': 0.25389828445048646,
  '-6.2': 0.2553693799097443,
  '-6.1': 0.2574747677153313,
  '-6.0': 0.26099610941165985,
  '-5.9': 0.26359484469524885,
  '-5.8': 0.26692516804140987,
  '-5.7': 0.269205898445802,
  '-5.6': 0.2716602975482676,
  '-5.5': 0.2762577909143481,
  '-5.4': 0.27686670371314326,
  '-5.3': 0.2811527494908349,
  '-5.2': 0.2842962444080047,
  '-5.1': 0.28868260131133583,
  '-5.0': 0.2914459750278813,
  '-4.9': 0.29552500948265914,
  '-4.8': 0.29889111624248266,
  '-4.7': 0.30275330907688625,
  '-4.6': 0.30483684697544633,
  '-4.5': 0.3087308954422261,
  '-4.4': 0.3119607377503364,
  '-4.3': 0.3149431542506458,
  '-4.2': 0.31853131804955126,
  '-4.1': 0.320778152372042,
  '-4.0': 0.32500585429582063,
  '-3.9': 0.3287550205647155,
  '-3.8': 0.3302152905962328,
  '-3.7': 0.3337414440782651,
  '-3.6': 0.3371096329087784,
  '-3.5': 0.3408372806176929,
  '-3.4': 0.3430467389812629,
  '-3.3': 0.345358794898586,
  '-3.2': 0.3488968896485116,
  '-3.1': 0.35237319918137733,
  '-3.0': 0.354602162593592,
  '-2.9': 0.35921288506416393,
  '-2.8': 0.3620978187487768,
  '-2.7': 0.36570889434391574,
  '-2.6': 0.36896483582772577,
  '-2.5': 0.3738375709360098,
  '-2.4': 0.37755946149735364,
  '-2.3': 0.38083501393471353,
  '-2.2': 0.3841356210618174,
  '-2.1': 0.38833097169521236,
  '-2.0': 0.3913569664390527,
  '-1.9': 0.39637664590926824,
  '-1.8': 0.4006706381318188,
  '-1.7': 0.40568723118901173,
  '-1.6': 0.4112309032143989,
  '-1.5': 0.4171285506703859,
  '-1.4': 0.422533096069275,
  '-1.3': 0.4301262113278628,
  '-1.2': 0.4371930420830884,
  '-1.1': 0.44297556987180564,
  '-1.0': 0.4456913220302985,
  '-0.9': 0.4524847690277852,
  '-0.8': 0.4589667426852546,
  '-0.7': 0.46660356893847554,
  '-0.6': 0.47734553584312966,
  '-0.5': 0.4838742651753062,
  '-0.4': 0.4949662422107537,
  '-0.3': 0.5052075551297714,
  '-0.2': 0.5134173311516534,
  '-0.1': 0.5243603487770374,
  '0.0': 0.526949638981131,
  '0.1': 0.5295389291852245,
  '0.2': 0.5664296189371014,
  '0.3': 0.5748717155242605,
  '0.4': 0.5869360163496304,
  '0.5': 0.5921709270831235,
  '0.6': 0.6012651707026009,
  '0.7': 0.6088638279243903,
  '0.8': 0.6153816495064385,
  '0.9': 0.6213113677421394,
  '1.0': 0.6271095095579187,
  '1.1': 0.632804166473034,
  '1.2': 0.6381911052846212,
  '1.3': 0.6442037744916549,
  '1.4': 0.649365491330027,
  '1.5': 0.6541269394628821,
  '1.6': 0.6593775707102116,
  '1.7': 0.6642844357446305,
  '1.8': 0.6680323879474359,
  '1.9': 0.6719097160994534,
  '2.0': 0.6748374005101319,
  '2.1': 0.6783363422342483,
  '2.2': 0.6801467867275195,
  '2.3': 0.684829276628467,
  '2.4': 0.6867513620895516,
  '2.5': 0.6905527274606579,
  '2.6': 0.6926332976777145,
  '2.7': 0.6952680187678887,
  '2.8': 0.7001656575385784,
  '2.9': 0.7010142788018504,
  '3.0': 0.7047537668053925,
  '3.1': 0.7073295468984271,
  '3.2': 0.7106392738949507,
  '3.3': 0.7116862871579852,
  '3.4': 0.7149981105354425,
  '3.5': 0.7168150290640533,
  '3.6': 0.7181645290803663,
  '3.7': 0.7215706104143079,
  '3.8': 0.7257548871790502,
  '3.9': 0.7266799478667236,
  '4.0': 0.7312566255649167,
  '4.1': 0.7338343990993276,
  '4.2': 0.7363492332937249,
  '4.3': 0.7374945601492073,
  '4.4': 0.7413387385114591,
  '4.5': 0.7466896678519318,
  '4.6': 0.7461156227069248,
  '4.7': 0.7500348334958896,
  '4.8': 0.7525591569082364,
  '4.9': 0.7567349424376287,
  '5.0': 0.7596581998583797,
  '5.1': 0.7621623413577621,
  '5.2': 0.7644432506942895,
  '5.3': 0.7668438338565464,
  '5.4': 0.7697341715213551,
  '5.5': 0.7718264040129471,
  '5.6': 0.774903252738822,
  '5.7': 0.777338112750803,
  '5.8': 0.7782543748612702,
  '5.9': 0.7815446531238023,
  '6.0': 0.7817240741095305,
  '6.1': 0.7843444714897749,
  '6.2': 0.7879064312243436,
  '6.3': 0.7894336918448414,
  '6.4': 0.7906807160826923,
  '6.5': 0.7958175057898639,
  '6.6': 0.799001778895725,
  '6.7': 0.8059773285734155,
  '6.8': 0.8073085278260186,
  '6.9': 0.8079169497726442,
  '7.0': 0.8094553564231399,
  '7.1': 0.812049156586624,
  '7.2': 0.8080964608399982,
  '7.3': 0.8089371589128438,
  '7.4': 0.811884066397279,
  '7.5': 0.8139355726992591,
  '7.6': 0.8176447870147248,
  '7.7': 0.8205118056812014,
  '7.8': 0.8239310183322626,
  '7.9': 0.8246215704824976,
  '8.0': 0.8282444028473858,
  '8.1': 0.8307566922119521,
  '8.2': 0.8299970989266028,
  '8.3': 0.8329910434137715,
  '8.4': 0.8348790035853562,
  '8.5': 0.8354299179013772,
  '8.6': 0.838042734118834,
  '8.7': 0.8386288753155167,
  '8.8': 0.8403357337021318,
  '8.9': 0.8438203836486884,
  '9.0': 0.8438217313242881,
  '9.1': 0.8451134380453753,
  '9.2': 0.8456384082100551,
  '9.3': 0.844182520663178,
  '9.4': 0.8463847100484717,
  '9.5': 0.8479706716538067,
  '9.6': 0.8511321531494442,
  '9.7': 0.8506127153603494,
  '9.8': 0.8490128260556276,
  '9.9': 0.8522167487684729,
  '10.0': 0.8518353443061348,
}

export const cpToWinrate = (cp: number | string, allowNaN = false): number => {
  try {
    const numCp = (typeof cp === 'string' ? parseFloat(cp) : cp) / 100

    const clampedCp = Math.max(-10.0, Math.min(10.0, numCp))
    const roundedCp = Math.round(clampedCp * 10) / 10

    const key = roundedCp.toFixed(1)
    if (key in cpLookup) {
      return cpLookup[key]
    }

    if (roundedCp < -10.0) return cpLookup['-10.0']
    if (roundedCp > 10.0) return cpLookup['10.0']

    return allowNaN ? Number.NaN : 0.5
  } catch (error) {
    if (allowNaN) {
      return Number.NaN
    }
    throw error
  }
}
