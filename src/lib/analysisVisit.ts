import { trackAnalysisVisitEnded } from 'src/lib/analytics'
import { whenPageCloses } from 'src/lib/posthogClient'

/** What a visit to the analysis page can use, reported as a list of names. */
export type AnalysisTool =
  | 'board_move'
  | 'maia_rating'
  | 'learn_mistakes'
  | 'export'
  | 'move_map'
  | 'moves_by_rating'
  | 'blunder_meter'
  | 'highlight'
  | 'game_list'
  | 'options'

// Panels are recognised by their ids when tapped or clicked anywhere inside.
const PANELS: [string, AnalysisTool][] = [
  ['analysis-move-map', 'move_map'],
  ['analysis-moves-by-rating', 'moves_by_rating'],
  ['analysis-blunder-meter', 'blunder_meter'],
  ['analysis-highlight', 'highlight'],
  ['analysis-game-list', 'game_list'],
  ['analysis-stockfish-depth', 'options'],
  ['analysis-stockfish-toggle', 'options'],
  ['analysis-top-move-badges-toggle', 'options'],
]
const PANEL_SELECTOR = PANELS.map(([id]) => `#${id}`).join(', ')

interface Visit {
  source: string
  gamePlies: number
  startedAt: number
  visibleSince: number | null
  visibleMs: number
  positions: Set<string>
  deepestPly: number
  tools: Set<AnalysisTool>
}

let visit: Visit | null = null
let stopWatchingClose: (() => void) | null = null

const onVisibility = () => {
  if (!visit) return
  if (document.visibilityState === 'hidden') {
    if (visit.visibleSince !== null) {
      visit.visibleMs += Date.now() - visit.visibleSince
      visit.visibleSince = null
    }
  } else if (visit.visibleSince === null) {
    visit.visibleSince = Date.now()
  }
}

const onPointerDown = (event: PointerEvent) => {
  const panel = (event.target as Element | null)?.closest?.(PANEL_SELECTOR)
  const tool = panel && PANELS.find(([id]) => id === panel.id)?.[1]
  if (tool) noteAnalysisTool(tool)
}

/**
 * What one visit to a game on the analysis page came to, reported once when
 * it ends: `next_game` for another game opened there, `navigated` for
 * another page of the site, `page_closed`. One event a visit, not one a
 * click.
 */
export const endAnalysisVisit = (
  how: 'next_game' | 'navigated' | 'page_closed',
) => {
  const v = visit
  if (!v) return
  visit = null
  document.removeEventListener('visibilitychange', onVisibility)
  document.removeEventListener('pointerdown', onPointerDown, true)
  stopWatchingClose?.()
  stopWatchingClose = null
  const now = Date.now()
  trackAnalysisVisitEnded({
    how,
    game_source: v.source,
    game_plies: v.gamePlies,
    seconds: Math.round((now - v.startedAt) / 1000),
    seconds_visible: Math.round(
      (v.visibleMs + (v.visibleSince !== null ? now - v.visibleSince : 0)) /
        1000,
    ),
    positions_viewed: v.positions.size,
    deepest_ply: v.deepestPly,
    tools: Array.from(v.tools).sort(),
  })
}

/** A game opened on the analysis page: ends the visit to the one before. */
export const startAnalysisVisit = (source: string, gamePlies: number) => {
  if (typeof window === 'undefined') return
  endAnalysisVisit('next_game')
  const now = Date.now()
  visit = {
    source,
    gamePlies,
    startedAt: now,
    visibleSince: document.visibilityState === 'visible' ? now : null,
    visibleMs: 0,
    positions: new Set(),
    deepestPly: 0,
    tools: new Set(),
  }
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('pointerdown', onPointerDown, true)
  stopWatchingClose = whenPageCloses(() => endAnalysisVisit('page_closed'))
}

/** A position shown, by its FEN and its ply (moves from the start). */
export const noteAnalysisPosition = (fen: string, ply: number) => {
  if (!visit) return
  visit.positions.add(fen)
  visit.deepestPly = Math.max(visit.deepestPly, ply)
}

/** A tool used during the visit. Nothing outside a visit to analysis. */
export const noteAnalysisTool = (tool: AnalysisTool) => {
  visit?.tools.add(tool)
}
