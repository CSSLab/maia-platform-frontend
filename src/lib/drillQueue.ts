import { OpeningSelection } from 'src/types/openings'

// The drills queued in the setup dialog, kept for the browser tab so that a
// refresh doesn't lose them (sessionStorage: they don't come back days later
// the way saved drills do).
const DRILL_QUEUE_KEY = 'maia-drill-queue'

export const loadDrillQueue = (): OpeningSelection[] => {
  try {
    const stored = window.sessionStorage.getItem(DRILL_QUEUE_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? (parsed as OpeningSelection[]) : []
  } catch {
    return []
  }
}

export const saveDrillQueue = (selections: OpeningSelection[]) => {
  try {
    if (selections.length) {
      window.sessionStorage.setItem(DRILL_QUEUE_KEY, JSON.stringify(selections))
    } else {
      window.sessionStorage.removeItem(DRILL_QUEUE_KEY)
    }
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
}
