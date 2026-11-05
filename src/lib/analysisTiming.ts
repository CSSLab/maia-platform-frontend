import { STOCKFISH_ENGINE } from 'src/constants/analysis'
import { hasRelaxedSimd } from 'src/lib/engine/relaxedSimd'
import {
  trackAnalysisEngineLoad,
  trackAnalysisEngineSteps,
  trackAnalysisPageEndedUnexpectedly,
} from 'src/lib/analytics'

// What visitors wait for on the analysis page, for PostHog. Nothing here reads
// the page, so it costs a few timestamps per engine update.
//
// - analysis_engine_load: the first position of a visit.
// - analysis_engine_steps: a summary of the positions moved to after it, sent
//   when the page is hidden or left, and every MAX_STEPS positions.
// - analysis_page_ended_unexpectedly: the last analysis page in this tab was
//   never left, as when a phone runs out of memory and reloads it.
//
// "d18" means the best line has reached depth 18, and "lines settled" that the
// lines on show have, which is what compares with a build before round 10.

const MAX_STEPS = 30
const ALIVE_KEY = 'maia.analysisPageAlive'

type Position = {
  fen: string
  kind: 'load' | 'step'
  start: number
  sinceNavigation: boolean
  first?: number
  d12?: number
  d18?: number
  lines?: number
  done?: number
  maiaFirst?: number
  maiaChartData?: number
  chart?: number
}

type Row = {
  d12?: number
  d18?: number
  lines?: number
  done?: number
  maiaFirst?: number
  chart?: number
}

let active = false
let isPhone = false
let loadTaken = false
let position: Position | null = null
let rows: Row[] = []
let leaving = false
let startedAt = 0

const median = (values: (number | undefined)[]) => {
  const known = values.filter((v): v is number => v !== undefined)
  if (known.length === 0) return null
  known.sort((a, b) => a - b)
  return known[Math.floor((known.length - 1) / 2)]
}

const count = (values: (number | undefined)[]) =>
  values.filter((v) => v !== undefined).length

const device = () => {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { effectiveType?: string }
  }
  return {
    engine: STOCKFISH_ENGINE,
    engine_build: hasRelaxedSimd() ? 'relaxed-simd' : 'plain',
    is_phone: isPhone,
    cores: nav.hardwareConcurrency ?? null,
    device_memory_gb: nav.deviceMemory ?? null,
    connection: nav.connection?.effectiveType ?? null,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  }
}

const relative = (p: Position, time?: number) =>
  time === undefined ? null : Math.round(time - p.start)

const flushSteps = () => {
  if (rows.length === 0) return
  const sent = rows
  rows = []
  const column = (key: keyof Row) => sent.map((row) => row[key])
  trackAnalysisEngineSteps({
    ...device(),
    steps: sent.length,
    maia_first_median_ms: median(column('maiaFirst')),
    chart_median_ms: median(column('chart')),
    d12_median_ms: median(column('d12')),
    d18_median_ms: median(column('d18')),
    lines_settled_median_ms: median(column('lines')),
    stockfish_done_median_ms: median(column('done')),
    d12_reached: count(column('d12')),
    d18_reached: count(column('d18')),
    lines_settled_reached: count(column('lines')),
    stockfish_done_reached: count(column('done')),
  })
}

// Ends the position on show, with what it reached. The page being hidden ends
// it too: timers and engines slow down there, so later times would mean nothing.
const closePosition = () => {
  const p = position
  position = null
  if (!p) return
  // Nothing ran: saved analysis, or the next move came at once.
  if (p.first === undefined && p.maiaFirst === undefined) return

  if (p.kind === 'load') {
    trackAnalysisEngineLoad({
      ...device(),
      arrival: p.sinceNavigation ? 'page_load' : 'in_app',
      position_shown_ms: p.sinceNavigation ? Math.round(p.start) : null,
      stockfish_ran: p.first !== undefined,
      maia_ran: p.maiaFirst !== undefined,
      maia_first_ms: relative(p, p.maiaFirst),
      maia_chart_data_ms: relative(p, p.maiaChartData),
      chart_ms: relative(p, p.chart),
      stockfish_first_ms: relative(p, p.first),
      d12_ms: relative(p, p.d12),
      d18_ms: relative(p, p.d18),
      lines_settled_ms: relative(p, p.lines),
      stockfish_done_ms: relative(p, p.done),
    })
    return
  }

  rows.push({
    d12: relative(p, p.d12) ?? undefined,
    d18: relative(p, p.d18) ?? undefined,
    lines: relative(p, p.lines) ?? undefined,
    done: relative(p, p.done) ?? undefined,
    maiaFirst: relative(p, p.maiaFirst) ?? undefined,
    chart: relative(p, p.chart) ?? undefined,
  })
  if (rows.length >= MAX_STEPS) flushSteps()
}

const markAlive = () => {
  // The page also becomes hidden after pagehide: that is not being alive.
  if (leaving) return
  try {
    sessionStorage.setItem(
      ALIVE_KEY,
      JSON.stringify({
        at: startedAt,
        visible: document.visibilityState === 'visible',
      }),
    )
  } catch {
    // Without session storage there is nothing to compare next time.
  }
}

const reportEarlierPage = () => {
  try {
    const earlier = sessionStorage.getItem(ALIVE_KEY)
    if (!earlier) return
    const { at, visible } = JSON.parse(earlier)
    trackAnalysisPageEndedUnexpectedly({
      ...device(),
      was_visible: !!visible,
      seconds_since_it_started: Math.round((Date.now() - at) / 1000),
    })
  } catch {
    // As above.
  }
}

const onVisibilityChange = () => {
  markAlive()
  if (document.visibilityState === 'hidden') {
    closePosition()
    flushSteps()
  }
}

const onPageHide = () => {
  leaving = true
  closePosition()
  flushSteps()
  try {
    sessionStorage.removeItem(ALIVE_KEY)
  } catch {
    // As above.
  }
}

// Back from the browser's back/forward cache.
const onPageShow = () => {
  leaving = false
  markAlive()
}

/** While a page with the analysis engines is mounted. Returns its cleanup. */
export const startAnalysisTiming = (options: { isPhone: boolean }) => {
  if (typeof window === 'undefined') return () => undefined
  active = true
  isPhone = options.isPhone
  loadTaken = false
  leaving = false
  startedAt = Date.now()
  reportEarlierPage()
  markAlive()
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('pageshow', onPageShow)
  return () => {
    active = false
    onPageHide()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('pageshow', onPageShow)
  }
}

const isFullPageLoad = () => {
  const navigation = performance.getEntriesByType?.('navigation')[0]
  return !!navigation && new URL(navigation.name).pathname === location.pathname
}

/** A position came on show. */
export const analysisPositionShown = (fen: string) => {
  if (!active || position?.fen === fen) return
  closePosition()
  const kind = loadTaken ? 'step' : 'load'
  loadTaken = true
  if (document.visibilityState !== 'visible') return
  position = {
    fen,
    kind,
    start: performance.now(),
    sinceNavigation: kind === 'load' && isFullPageLoad(),
  }
}

const current = (fen: string) => (position?.fen === fen ? position : null)

export const analysisStockfishUpdate = (
  fen: string,
  update: { depth: number; partial?: boolean; lines_done?: boolean },
) => {
  const p = current(fen)
  if (!p) return
  const now = performance.now()
  p.first ??= now
  if (update.depth >= 12) p.d12 ??= now
  if (update.depth >= 18) p.d18 ??= now
  if (update.lines_done) p.lines ??= now
  if (!update.partial) p.done ??= now
}

/** Stage 0 is the selected rating; stage 1 is what the chart is drawn from. */
export const analysisMaiaStage = (fen: string, stage: number) => {
  const p = current(fen)
  if (!p) return
  const now = performance.now()
  if (stage === 0) p.maiaFirst ??= now
  if (stage === 1) p.maiaChartData ??= now
}

export const analysisChartDrawn = (fen: string | undefined) => {
  const p = fen ? current(fen) : null
  if (p && p.maiaChartData !== undefined) p.chart ??= performance.now()
}
