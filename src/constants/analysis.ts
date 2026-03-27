/**
 * Classification criteria documentation:
 *
 * 1. BLUNDER (??): More than 10% Stockfish winrate loss compared to best move
 * 2. INACCURACY (?!): More than 5% Stockfish winrate loss compared to best move
 * 3. EXCELLENT (!!): At least 10% higher Stockfish winrate than weighted average AND less than 10% Maia probability
 *
 * Note: Blunder and inaccuracy winrate loss comparisons are against the BEST POSSIBLE MOVE.
 * Excellent moves are compared against the weighted average winrate (using Maia probabilities as weights).
 */

export const MOVE_CLASSIFICATION_THRESHOLDS = {
  BLUNDER_THRESHOLD: 0.1,
  INACCURACY_THRESHOLD: 0.05,
  EXCELLENT_WINRATE_ADVANTAGE_THRESHOLD: 0.05,
  MAIA_UNLIKELY_THRESHOLD: 0.1,
  GOOD_THRESHOLD: -0.05,
} as const

export const DEFAULT_MAIA_MODEL = 'maia_kdd_1500' as const
export const MAIA_MIN_RATING = 600 as const
export const MAIA_MAX_RATING = 2600 as const
export const MIN_STOCKFISH_DEPTH = 12 as const
export const LEARN_FROM_MISTAKES_DEPTH = 12 as const
export const STOCKFISH_DEBUG_RERUN_EVENT = 'maia:stockfish-debug-rerun' as const
export const STOCKFISH_DEBUG_RERUN_KEY = 'maia.stockfishDebugRerunTs' as const

export const COLORS = {
  good: ['#238b45', '#41ab5d', '#74c476', '#90D289', '#AEDFA4'],
  ok: ['#ec7014', '#feb24c', '#fed976', '#ffeda0', '#ffffcc'].reverse(),
  blunder: ['#cb181d', '#ef3b2c', '#fb6a4a', '#fc9272', '#fcbba1'].reverse(),
}
