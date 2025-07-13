/**
 * Classification criteria documentation:
 *
 * 1. BLUNDER (??): More than 10% Stockfish winrate loss compared to best move
 * 2. INACCURACY (?!): More than 5% Stockfish winrate loss compared to best move
 * 3. EXCELLENT (!!): Less than 2% Stockfish winrate loss AND less than 10% Maia probability
 *
 * Note: All winrate loss comparisons are against the BEST POSSIBLE MOVE in the
 * same position, NOT the previous position.
 */

export const MOVE_CLASSIFICATION_THRESHOLDS = {
  BLUNDER_THRESHOLD: 0.1,
  INACCURACY_THRESHOLD: 0.05,
  EXCELLENT_WINRATE_THRESHOLD: 0.02,
  MAIA_UNLIKELY_THRESHOLD: 0.1,
} as const

export const MAIA_MODELS = [
  'maia_kdd_1100',
  'maia_kdd_1200',
  'maia_kdd_1300',
  'maia_kdd_1400',
  'maia_kdd_1500',
  'maia_kdd_1600',
  'maia_kdd_1700',
  'maia_kdd_1800',
  'maia_kdd_1900',
]

export const DEFAULT_MAIA_MODEL = 'maia_kdd_1500' as const
export const MIN_STOCKFISH_DEPTH = 13 as const
