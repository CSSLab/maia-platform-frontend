import {
  MOVE_CLASSIFICATION_THRESHOLDS,
  MAIA_MODELS,
} from 'src/constants/moveClassification'

export const COLORS = {
  good: ['#238b45', '#41ab5d', '#74c476', '#90D289', '#AEDFA4'],
  ok: ['#ec7014', '#feb24c', '#fed976', '#ffeda0', '#ffffcc'].reverse(),
  blunder: ['#cb181d', '#ef3b2c', '#fb6a4a', '#fc9272', '#fcbba1'].reverse(),
}

// Re-export for backward compatibility
export { MAIA_MODELS }

// Import thresholds from unified constants
export const BLUNDER_THRESHOLD =
  MOVE_CLASSIFICATION_THRESHOLDS.BLUNDER_THRESHOLD
export const INACCURACY_THRESHOLD =
  MOVE_CLASSIFICATION_THRESHOLDS.INACCURACY_THRESHOLD
export const GOOD_THRESHOLD = -INACCURACY_THRESHOLD // -0.05 (less than 5% winrate loss)
export const OK_THRESHOLD = -BLUNDER_THRESHOLD // -0.1 (between 5% and 10% winrate loss)
