import { Chess } from 'chess.ts'
import { OK_THRESHOLD, GOOD_THRESHOLD } from './constants'
import {
  BlunderInfo,
  BlunderMeterResult,
  MaiaEvaluation,
  StockfishEvaluation,
} from 'src/types'

/**
 * Converts HSL color values to RGB hex string
 */
const hslToHex = (h: number, s: number, l: number): string => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0,
    g = 0,
    b = 0

  if (0 <= h && h < 60) {
    r = c
    g = x
    b = 0
  } else if (60 <= h && h < 120) {
    r = x
    g = c
    b = 0
  } else if (120 <= h && h < 180) {
    r = 0
    g = c
    b = x
  } else if (180 <= h && h < 240) {
    r = 0
    g = x
    b = c
  } else if (240 <= h && h < 300) {
    r = x
    g = 0
    b = c
  } else if (300 <= h && h < 360) {
    r = c
    g = 0
    b = x
  }

  r = Math.round((r + m) * 255)
  g = Math.round((g + m) * 255)
  b = Math.round((b + m) * 255)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Smooth color mapping function based on winrate loss
 *
 * This function creates a smooth color gradient from green (best moves) to red (worst moves)
 * using a piecewise function that emphasizes contrast within each quality tier:
 * 1. Green region (0 to 5%): Deep green → light green with high contrast
 * 2. Yellow region (5% to 10%): Yellow → deep yellow with saturation progression
 * 3. Red region (>10%): Deep orange-red with darkening for severe blunders
 *
 * The mathematical function uses:
 * - Dramatic lightness and saturation changes for contrast within each tier
 * - HSL color space for natural color interpolation
 * - Quadratic easing for smooth transitions
 *
 * @param winrateLoss - The winrate loss value (typically negative, where 0 is best)
 * @returns RGB hex color string
 */
const getColorFromWinrateLoss = (winrateLoss: number): string => {
  // Convert winrate loss to positive percentage (0.05 = 5%)
  const loss = Math.abs(winrateLoss)

  // Define thresholds based on winrate percentages
  const greenThreshold = 0.05 // Green region (0 to 5% loss)
  const yellowThreshold = 0.1 // Yellow region (5% to 10% loss)
  const maxLoss = 0.3 // Maximum loss for scaling (30% loss)

  let hue: number
  let saturation: number
  let lightness: number

  if (loss <= greenThreshold) {
    // Green region: Bright green (0-1%) → Darker/duller green (4-5%) with enhanced contrast
    hue = 120 // Pure green hue
    const progress = loss / greenThreshold
    const easedProgress = progress * progress * progress // Cubic easing for more dramatic change

    // Best moves are bright and prominent, worse moves become darker/duller
    saturation = 0.85 - easedProgress * 0.4 // 85% → 45% saturation (less saturated as worse)
    lightness = 0.65 - easedProgress * 0.35 // 65% → 30% lightness (darker as worse)
  } else if (loss <= yellowThreshold) {
    // Yellow region: Yellow (5%) → Deep yellow (10%)
    hue = 50 // Orange-yellow hue for better distinction
    const progress =
      (loss - greenThreshold) / (yellowThreshold - greenThreshold)
    const easedProgress = progress * progress // Quadratic progression

    // Start light yellow and become deeper/more saturated
    saturation = 0.6 + easedProgress * 0.3 // 60% → 90% saturation
    lightness = 0.65 - easedProgress * 0.25 // 65% → 40% lightness (light → deep)
  } else {
    // Red region: Deep orange-red with progression to dark red (but not too dark)
    const progress = Math.min(
      (loss - yellowThreshold) / (maxLoss - yellowThreshold),
      1,
    )
    const easedProgress = 1 - Math.pow(1 - progress, 2) // Quadratic ease-out

    // Transition from orange-red to deep red (lighter minimum for visibility)
    hue = 20 - easedProgress * 15 // 20° → 5° (orange-red → deep red)
    saturation = 0.85 + easedProgress * 0.1 // 85% → 95% saturation
    lightness = 0.45 - easedProgress * 0.1 // 45% → 35% lightness (not as dark)
  }

  return hslToHex(hue, saturation, lightness)
}

type ColorSanMappingResult = {
  [move: string]: {
    san: string
    color: string
  }
}

export const generateColorSanMapping = (
  stockfish: StockfishEvaluation | undefined,
  fen: string,
): ColorSanMappingResult => {
  const mapping: ColorSanMappingResult = {}

  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })

  if (!stockfish) return mapping

  moves.forEach((m) => {
    const moveKey = `${m.from}${m.to}${m.promotion || ''}`
    // Use winrate_loss_vec if available, otherwise fall back to cp_relative_vec
    const winrateLoss = stockfish?.winrate_loss_vec?.[moveKey]
    const relativeEval = stockfish?.cp_relative_vec[moveKey]

    let color = '#FFF'

    if (winrateLoss !== undefined) {
      // Use smooth color function for winrate loss
      color = getColorFromWinrateLoss(winrateLoss)
    } else if (relativeEval !== undefined) {
      // Convert centipawn loss to approximate winrate loss for color mapping
      // This is a rough approximation: 100cp ≈ 0.1 winrate loss
      const approximateWinrateLoss = -relativeEval / 1000
      color = getColorFromWinrateLoss(approximateWinrateLoss)
    }

    mapping[moveKey] = {
      san: m.san,
      color,
    }
  })

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

      if (winrate_loss >= GOOD_THRESHOLD) {
        goodMoveProbability += probability
        goodMoveChanceInfo.push({ move, probability })
      } else if (winrate_loss >= OK_THRESHOLD) {
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
