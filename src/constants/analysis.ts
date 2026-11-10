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

// The build the analysis page runs, on PostHog's engine events.
export const STOCKFISH_ENGINE = 'stockfish-19-smallnet' as const
export const DEFAULT_MAIA_MODEL = 'maia_kdd_1500' as const
export const MAIA_MIN_RATING = 600 as const
export const MAIA_MAX_RATING = 2600 as const
export const MIN_STOCKFISH_DEPTH = 12 as const
export const LEARN_FROM_MISTAKES_DEPTH = 12 as const
// Stockfish's depth while browsing a game, set in the analysis settings.
// Deeper is slower and uses more power, as every legal move is searched.
export const MIN_LIVE_STOCKFISH_DEPTH = 12
export const MAX_LIVE_STOCKFISH_DEPTH = 25
export const DEFAULT_LIVE_STOCKFISH_DEPTH = 18
export const STOCKFISH_DEBUG_RERUN_EVENT = 'maia:stockfish-debug-rerun' as const
export const STOCKFISH_DEBUG_RERUN_KEY = 'maia.stockfishDebugRerunTs' as const

export const COLORS = {
  good: ['#238b45', '#41ab5d', '#74c476', '#90D289', '#AEDFA4'],
  ok: ['#ec7014', '#feb24c', '#fed976', '#ffeda0', '#ffffcc'].reverse(),
  blunder: ['#cb181d', '#ef3b2c', '#fb6a4a', '#fc9272', '#fcbba1'].reverse(),
}

// The tabs of the analysis page's left panel on desktops.
export const ANALYSIS_LEFT_PANEL_TABS = [
  { id: 'moves', name: 'Moves' },
  { id: 'select-game', name: 'Select Game' },
] as const

// The analysis page's game lists, as its game picker names them.
export type AnalysisGameListName =
  | 'tournament'
  | 'lichess'
  | 'play'
  | 'hb'
  | 'custom'
  | 'favorites'

// What the site's Analysis menu can open: one of the lists, or the box for
// pasting a PGN or FEN.
export type AnalysisMenuRequest = AnalysisGameListName | 'import'

export const ANALYSIS_MENU_ITEMS: readonly {
  request: AnalysisMenuRequest
  label: string
}[] = [
  { request: 'play', label: 'My games vs Maia' },
  { request: 'hb', label: 'My Hand and Brain games' },
  { request: 'lichess', label: 'My Lichess games' },
  { request: 'custom', label: 'My imported games' },
  { request: 'favorites', label: 'Favorites' },
  { request: 'tournament', label: 'World Championship games' },
  { request: 'import', label: 'Paste a PGN or FEN' },
]

export const isAnalysisMenuRequest = (
  value: unknown,
): value is AnalysisMenuRequest =>
  ANALYSIS_MENU_ITEMS.some((item) => item.request === value)

// On the analysis page the menu sends this event; from any other page it
// leaves the request here and opens the analysis page, which reads it.
export const OPEN_ANALYSIS_LIST_EVENT = 'maia:open-analysis-list' as const
export const OPEN_ANALYSIS_LIST_KEY = 'maia.openAnalysisList' as const
