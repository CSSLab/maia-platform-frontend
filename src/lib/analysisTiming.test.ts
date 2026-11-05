import {
  analysisChartDrawn,
  analysisMaiaStage,
  analysisPositionShown,
  analysisStockfishUpdate,
  startAnalysisTiming,
} from './analysisTiming'
import { capture } from 'src/lib/posthogClient'

jest.mock('src/lib/posthogClient', () => ({ capture: jest.fn() }))

const captured = capture as jest.Mock
const events = (name: string) =>
  captured.mock.calls.filter(([event]) => event === name).map(([, p]) => p)

const A = 'a'
const B = 'b'
const C = 'c'

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

const search = (fen: string) => {
  analysisStockfishUpdate(fen, { depth: 6, partial: true })
  analysisMaiaStage(fen, 0)
  analysisStockfishUpdate(fen, { depth: 18, partial: true })
  analysisMaiaStage(fen, 1)
  analysisChartDrawn(fen)
  analysisStockfishUpdate(fen, { depth: 18, partial: true, lines_done: true })
  analysisStockfishUpdate(fen, { depth: 18 })
}

describe('analysisTiming', () => {
  let now = 0
  let stop: () => void

  beforeEach(() => {
    now = 1000
    captured.mockClear()
    jest.spyOn(performance, 'now').mockImplementation(() => (now += 100))
    sessionStorage.clear()
    setVisibility('visible')
    stop = startAnalysisTiming({ isPhone: true })
  })

  afterEach(() => {
    stop()
    jest.restoreAllMocks()
  })

  it('reports the first position as a load, once it ends', () => {
    analysisPositionShown(A)
    search(A)
    expect(events('analysis_engine_load')).toHaveLength(0)
    analysisPositionShown(B)

    const [load] = events('analysis_engine_load')
    expect(load).toMatchObject({
      is_phone: true,
      engine: 'stockfish-19-smallnet',
      stockfish_first_ms: 100,
      maia_first_ms: 200,
      d12_ms: 300,
      d18_ms: 300,
      maia_chart_data_ms: 400,
      chart_ms: 500,
      lines_settled_ms: 600,
      stockfish_done_ms: 700,
      stockfish_ran: true,
      maia_ran: true,
    })
  })

  it('summarises later positions when the page is hidden', () => {
    analysisPositionShown(A)
    analysisPositionShown(B)
    search(B)
    analysisPositionShown(C)
    analysisStockfishUpdate(C, { depth: 12, partial: true })
    setVisibility('hidden')

    const [steps] = events('analysis_engine_steps')
    expect(steps).toMatchObject({
      steps: 2,
      d12_reached: 2,
      d18_reached: 1,
      lines_settled_reached: 1,
      stockfish_done_reached: 1,
      d18_median_ms: 300,
    })
  })

  it('takes nothing that arrives after the page is hidden', () => {
    analysisPositionShown(A)
    analysisStockfishUpdate(A, { depth: 6, partial: true })
    setVisibility('hidden')
    analysisStockfishUpdate(A, { depth: 18 })

    const [load] = events('analysis_engine_load')
    expect(load.d18_ms).toBeNull()
    expect(load.stockfish_done_ms).toBeNull()
  })

  it('leaves out a position where neither engine ran', () => {
    analysisPositionShown(A)
    analysisPositionShown(B)
    analysisPositionShown(C)
    setVisibility('hidden')
    expect(events('analysis_engine_load')).toHaveLength(0)
    expect(events('analysis_engine_steps')).toHaveLength(0)
  })

  it('ignores updates from a position no longer on show', () => {
    analysisPositionShown(A)
    analysisPositionShown(B)
    analysisStockfishUpdate(A, { depth: 18 })
    setVisibility('hidden')
    expect(events('analysis_engine_steps')).toHaveLength(0)
  })

  it('reports nothing unexpected when a page was left normally', () => {
    window.dispatchEvent(new Event('pagehide'))
    stop()
    stop = startAnalysisTiming({ isPhone: true })
    expect(events('analysis_page_ended_unexpectedly')).toHaveLength(0)
  })

  it('reports nothing when the page is hidden after being left, as on a reload', () => {
    window.dispatchEvent(new Event('pagehide'))
    setVisibility('hidden')
    expect(sessionStorage.getItem('maia.analysisPageAlive')).toBeNull()
    setVisibility('visible')
    stop()
    stop = startAnalysisTiming({ isPhone: true })
    expect(events('analysis_page_ended_unexpectedly')).toHaveLength(0)
  })

  it('marks the page alive again on coming back from the back/forward cache', () => {
    window.dispatchEvent(new Event('pagehide'))
    expect(sessionStorage.getItem('maia.analysisPageAlive')).toBeNull()
    window.dispatchEvent(new Event('pageshow'))
    expect(sessionStorage.getItem('maia.analysisPageAlive')).not.toBeNull()
  })

  it('reports an earlier page that was never left', () => {
    // A page that dies runs no pagehide, and leaves its mark behind.
    const mark = sessionStorage.getItem('maia.analysisPageAlive') as string
    stop()
    sessionStorage.setItem('maia.analysisPageAlive', mark)
    stop = startAnalysisTiming({ isPhone: true })

    const [ended] = events('analysis_page_ended_unexpectedly')
    expect(ended).toMatchObject({ was_visible: true })
  })

  it('tells a page lost in the background from one lost on screen', () => {
    setVisibility('hidden')
    const mark = sessionStorage.getItem('maia.analysisPageAlive') as string
    stop()
    sessionStorage.setItem('maia.analysisPageAlive', mark)
    setVisibility('visible')
    stop = startAnalysisTiming({ isPhone: true })

    const [ended] = events('analysis_page_ended_unexpectedly')
    expect(ended).toMatchObject({ was_visible: false })
  })

  it('does nothing when no analysis page is mounted', () => {
    stop()
    analysisPositionShown(A)
    search(A)
    analysisPositionShown(B)
    expect(events('analysis_engine_load')).toHaveLength(0)
    stop = startAnalysisTiming({ isPhone: true })
  })
})
