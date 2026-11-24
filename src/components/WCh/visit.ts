/*
 * What a visit to the World Championship page came to, sent to PostHog once
 * when it ends (another page of the site, or the page closed): which tabs
 * were opened, how many earlier moves were looked at, guesses, and where the
 * predictions came from (the research feed, the pre-game tree, or the
 * browser's own Maia). One event a visit, not one a click; guesses are also
 * sent one by one (trackWchGuess).
 */
import { trackWchVisitEnded } from 'src/lib/analytics'
import { whenPageCloses } from 'src/lib/posthogClient'

export type WchSource = 'feed' | 'tree' | 'browser' | 'demo'

interface Visit {
  mode: 'live' | 'demo' | 'feed_replay'
  startedAt: number
  visibleSince: number | null
  visibleMs: number
  gameId: string | null
  gameStatus: string | null
  plies: number
  tabs: Set<string>
  movesViewed: Set<number>
  hovered: number
  guesses: number
  sources: Set<WchSource>
  layouts: Set<'wide' | 'narrow'>
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

export const endWchVisit = (how: 'navigated' | 'page_closed') => {
  const v = visit
  if (!v) return
  visit = null
  document.removeEventListener('visibilitychange', onVisibility)
  stopWatchingClose?.()
  stopWatchingClose = null
  const now = Date.now()
  trackWchVisitEnded({
    how,
    mode: v.mode,
    game_id: v.gameId,
    game_status: v.gameStatus,
    game_plies: v.plies,
    seconds: Math.round((now - v.startedAt) / 1000),
    seconds_visible: Math.round(
      (v.visibleMs + (v.visibleSince !== null ? now - v.visibleSince : 0)) /
        1000,
    ),
    tabs: Array.from(v.tabs).sort(),
    moves_viewed: v.movesViewed.size,
    moves_hovered: v.hovered,
    guesses: v.guesses,
    sources: Array.from(v.sources).sort(),
    layouts: Array.from(v.layouts).sort(),
  })
}

export const startWchVisit = (mode: Visit['mode']) => {
  if (typeof window === 'undefined') return
  endWchVisit('navigated')
  const now = Date.now()
  visit = {
    mode,
    startedAt: now,
    visibleSince: document.visibilityState === 'visible' ? now : null,
    visibleMs: 0,
    gameId: null,
    gameStatus: null,
    plies: 0,
    tabs: new Set(),
    movesViewed: new Set(),
    hovered: 0,
    guesses: 0,
    sources: new Set(),
    layouts: new Set(),
  }
  document.addEventListener('visibilitychange', onVisibility)
  stopWatchingClose = whenPageCloses(() => endWchVisit('page_closed'))
}

/** The game on show and how far it has got (the latest wins). */
export const noteWchGame = (
  gameId: string | null,
  status: string | null,
  plies: number,
) => {
  if (!visit) return
  visit.gameId = gameId
  visit.gameStatus = status
  visit.plies = plies
}

/** A pane tab shown (the first one, Win chances, counts once opened). */
export const noteWchTab = (tab: string) => visit?.tabs.add(tab)

/** An earlier move looked at (its index in the game). */
export const noteWchMove = (index: number) => visit?.movesViewed.add(index)

/** A predicted move hovered or tapped, to see it on the board. */
export const noteWchHover = () => {
  if (visit) visit.hovered += 1
}

export const noteWchGuess = () => {
  if (visit) visit.guesses += 1
}

/** Where the predictions on screen came from. */
export const noteWchSource = (source: WchSource) => visit?.sources.add(source)

export const noteWchLayout = (wide: boolean) =>
  visit?.layouts.add(wide ? 'wide' : 'narrow')
