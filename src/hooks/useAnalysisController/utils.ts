import { Chess } from 'chess.ts'
import { COLORS, MOVE_CLASSIFICATION_THRESHOLDS } from 'src/constants/analysis'
import {
  BlunderInfo,
  BlunderMeterResult,
  MaiaEvaluation,
  StockfishEvaluation,
} from 'src/types'

type ColorSanMappingResult = {
  [move: string]: {
    san: string
    color: string
  }
}

const getStockfishMoveOrderingScore = (
  stockfish: StockfishEvaluation,
  move: string,
): number => {
  const winrateLoss = stockfish.winrate_loss_vec?.[move]
  if (winrateLoss !== undefined) {
    return winrateLoss
  }

  const relativeEval = stockfish.cp_relative_vec?.[move]
  if (relativeEval !== undefined) {
    return relativeEval
  }

  const cp = stockfish.cp_vec?.[move]
  if (cp !== undefined) {
    return cp
  }

  return Number.NEGATIVE_INFINITY
}

export const sortStockfishMoves = (
  stockfish: StockfishEvaluation,
  moves: string[],
): string[] =>
  [...moves].sort((a, b) => {
    const scoreDiff =
      getStockfishMoveOrderingScore(stockfish, b) -
      getStockfishMoveOrderingScore(stockfish, a)

    if (scoreDiff !== 0) {
      return scoreDiff
    }

    const cpDiff =
      (stockfish.cp_vec?.[b] ?? Number.NEGATIVE_INFINITY) -
      (stockfish.cp_vec?.[a] ?? Number.NEGATIVE_INFINITY)
    if (cpDiff !== 0) {
      return cpDiff
    }

    return a.localeCompare(b)
  })

// Unified function to calculate color for a single move
export const calculateMoveColor = (
  stockfish: StockfishEvaluation | undefined,
  moveKey: string,
): string => {
  if (!stockfish) return '#FFF'

  // Use winrate_loss_vec if available, otherwise fall back to cp_relative_vec
  const winrateLoss = stockfish?.winrate_loss_vec?.[moveKey]
  const relativeEval = stockfish?.cp_relative_vec[moveKey]

  if (winrateLoss !== undefined) {
    if (winrateLoss >= -MOVE_CLASSIFICATION_THRESHOLDS.INACCURACY_THRESHOLD) {
      return COLORS.good[0]
    } else if (
      winrateLoss >= -MOVE_CLASSIFICATION_THRESHOLDS.BLUNDER_THRESHOLD
    ) {
      return COLORS.ok[0]
    } else {
      return COLORS.blunder[0]
    }
  } else if (relativeEval !== undefined) {
    if (relativeEval >= -50) {
      return COLORS.good[0]
    } else if (relativeEval >= -150) {
      return COLORS.ok[0]
    } else {
      return COLORS.blunder[0]
    }
  }

  return '#FFF'
}

export const generateColorSanMapping = (
  stockfish: StockfishEvaluation | undefined,
  fen: string,
): ColorSanMappingResult => {
  const mapping: ColorSanMappingResult = {}

  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  const moveKeys = moves.map((m) => `${m.from}${m.to}${m.promotion || ''}`)
  moves.forEach((m) => {
    const moveKey = `${m.from}${m.to}${m.promotion || ''}`
    mapping[moveKey] = {
      san: m.san,
      color: '#FFF',
    }
  })

  if (!stockfish) return mapping

  moves.forEach((m) => {
    const moveKey = `${m.from}${m.to}${m.promotion || ''}`
    const color = calculateMoveColor(stockfish, moveKey)

    mapping[moveKey] = {
      san: m.san,
      color,
    }
  })

  if (stockfish) {
    if (
      stockfish.winrate_loss_vec &&
      Object.keys(stockfish.winrate_loss_vec).length > 0
    ) {
      const goodMoves = sortStockfishMoves(
        stockfish,
        moveKeys.filter((move) => {
          const winrateLoss = stockfish.winrate_loss_vec?.[move]
          return (
            winrateLoss !== undefined &&
            winrateLoss >= -MOVE_CLASSIFICATION_THRESHOLDS.INACCURACY_THRESHOLD
          )
        }),
      )
      const okMoves = sortStockfishMoves(
        stockfish,
        moveKeys.filter((move) => {
          const winrateLoss = stockfish.winrate_loss_vec?.[move]
          return (
            winrateLoss !== undefined &&
            winrateLoss >= -MOVE_CLASSIFICATION_THRESHOLDS.BLUNDER_THRESHOLD &&
            winrateLoss < -MOVE_CLASSIFICATION_THRESHOLDS.INACCURACY_THRESHOLD
          )
        }),
      )
      const blunderMoves = sortStockfishMoves(
        stockfish,
        moveKeys.filter((move) => {
          const winrateLoss = stockfish.winrate_loss_vec?.[move]
          return (
            winrateLoss !== undefined &&
            winrateLoss < -MOVE_CLASSIFICATION_THRESHOLDS.BLUNDER_THRESHOLD
          )
        }),
      )

      goodMoves.forEach((move, i) => {
        mapping[move].color = COLORS.good[Math.min(i, COLORS.good.length - 1)]
      })

      okMoves.forEach((move, i) => {
        mapping[move].color = COLORS.ok[Math.min(i, COLORS.ok.length - 1)]
      })

      blunderMoves.forEach((move, i) => {
        mapping[move].color =
          COLORS.blunder[Math.min(i, COLORS.blunder.length - 1)]
      })
    } else {
      const goodMoves = sortStockfishMoves(
        stockfish,
        moveKeys.filter((move) => stockfish.cp_relative_vec[move] >= -50),
      )
      const okMoves = sortStockfishMoves(
        stockfish,
        moveKeys.filter((move) => {
          return (
            stockfish.cp_relative_vec[move] >= -150 &&
            stockfish.cp_relative_vec[move] < -50
          )
        }),
      )
      const blunderMoves = sortStockfishMoves(
        stockfish,
        moveKeys.filter((move) => stockfish.cp_relative_vec[move] < -150),
      )

      goodMoves.forEach((move, i) => {
        mapping[move].color = COLORS.good[Math.min(i, COLORS.good.length - 1)]
      })

      okMoves.forEach((move, i) => {
        mapping[move].color = COLORS.ok[Math.min(i, COLORS.ok.length - 1)]
      })

      blunderMoves.forEach((move, i) => {
        mapping[move].color =
          COLORS.blunder[Math.min(i, COLORS.blunder.length - 1)]
      })
    }
  }

  return mapping
}

export const calculateBlunderMeter = (
  maia: MaiaEvaluation | undefined,
  stockfish: StockfishEvaluation | undefined,
): BlunderMeterResult => {
  if (!maia || !stockfish) {
    return {
      blunderMoves: { probability: 0, moves: [] },
      okMoves: { probability: 0, moves: [] },
      goodMoves: { probability: 0, moves: [] },
    }
  }

  const blunderMoveChanceInfo: BlunderInfo[] = []
  const okMoveChanceInfo: BlunderInfo[] = []
  const goodMoveChanceInfo: BlunderInfo[] = []

  let blunderMoveProbability = 0
  let okMoveProbability = 0
  let goodMoveProbability = 0

  if (stockfish.winrate_loss_vec) {
    for (const [move, prob] of Object.entries(maia.policy)) {
      const winrate_loss = stockfish.winrate_loss_vec[move]
      if (winrate_loss === undefined) continue
      const probability = prob * 100

      if (
        winrate_loss >= -MOVE_CLASSIFICATION_THRESHOLDS.INACCURACY_THRESHOLD
      ) {
        goodMoveProbability += probability
        goodMoveChanceInfo.push({ move, probability })
      } else if (
        winrate_loss >= -MOVE_CLASSIFICATION_THRESHOLDS.BLUNDER_THRESHOLD
      ) {
        okMoveProbability += probability
        okMoveChanceInfo.push({ move, probability })
      } else {
        blunderMoveProbability += probability
        blunderMoveChanceInfo.push({ move, probability })
      }
    }
  } else {
    for (const [move, prob] of Object.entries(maia.policy)) {
      const loss = stockfish.cp_relative_vec[move]
      if (loss === undefined) continue
      const probability = prob * 100

      if (loss >= -50) {
        goodMoveProbability += probability
        goodMoveChanceInfo.push({ move, probability })
      } else if (loss >= -150) {
        okMoveProbability += probability
        okMoveChanceInfo.push({ move, probability })
      } else {
        blunderMoveProbability += probability
        blunderMoveChanceInfo.push({ move, probability })
      }
    }
  }
  const rawPercentages = [
    { key: 'good', value: goodMoveProbability },
    { key: 'ok', value: okMoveProbability },
    { key: 'blunder', value: blunderMoveProbability },
  ]

  const flooredPercentages = rawPercentages.map((p) => ({
    ...p,
    floored: Math.floor(p.value),
    fractional: p.value - Math.floor(p.value),
  }))

  const totalFloored = flooredPercentages.reduce((sum, p) => sum + p.floored, 0)
  const remainingPoints = Math.max(0, Math.min(100 - totalFloored, 100))

  const sortedByFractional = [...flooredPercentages].sort(
    (a, b) => b.fractional - a.fractional,
  )

  for (let i = 0; i < remainingPoints && i < sortedByFractional.length; i++) {
    if (sortedByFractional[i]) {
      sortedByFractional[i].floored += 1
    }
  }

  const adjustedGood = sortedByFractional.find(
    (p) => p && p.key === 'good',
  ) || {
    floored: 0,
  }
  const adjustedOk = sortedByFractional.find((p) => p && p.key === 'ok') || {
    floored: 0,
  }
  const adjustedBlunder = sortedByFractional.find(
    (p) => p && p.key === 'blunder',
  ) || { floored: 0 }

  return {
    blunderMoves: {
      probability: adjustedBlunder.floored,
      moves: blunderMoveChanceInfo,
    },
    okMoves: {
      probability: adjustedOk.floored,
      moves: okMoveChanceInfo,
    },
    goodMoves: {
      probability: adjustedGood.floored,
      moves: goodMoveChanceInfo,
    },
  }
}
