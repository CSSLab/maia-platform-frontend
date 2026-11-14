import { trackAnalysisVisitEnded } from 'src/lib/analytics'
import {
  endAnalysisVisit,
  noteAnalysisPosition,
  noteAnalysisTool,
  startAnalysisVisit,
} from './analysisVisit'

jest.mock('src/lib/analytics', () => ({ trackAnalysisVisitEnded: jest.fn() }))
jest.mock('src/lib/looksAutomated', () => ({ looksAutomated: () => true }))

describe('analysis visits', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })
  afterEach(() => jest.useRealTimers())

  it('sums up a visit once, when the next game opens', () => {
    startAnalysisVisit('lichess', 80)
    noteAnalysisPosition('a', 0)
    noteAnalysisPosition('b', 12)
    noteAnalysisPosition('a', 0)
    noteAnalysisTool('board_move')
    noteAnalysisTool('board_move')
    const panel = document.createElement('div')
    panel.id = 'analysis-move-map'
    const inner = document.createElement('span')
    panel.appendChild(inner)
    document.body.appendChild(panel)
    inner.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    jest.advanceTimersByTime(30_000)

    startAnalysisVisit('play', 40)
    expect(trackAnalysisVisitEnded).toHaveBeenCalledTimes(1)
    expect(trackAnalysisVisitEnded).toHaveBeenCalledWith({
      how: 'next_game',
      game_source: 'lichess',
      game_plies: 80,
      seconds: 30,
      seconds_visible: 30,
      positions_viewed: 2,
      deepest_ply: 12,
      tools: ['board_move', 'move_map'],
    })

    window.dispatchEvent(new Event('pagehide'))
    endAnalysisVisit('navigated')
    expect(trackAnalysisVisitEnded).toHaveBeenCalledTimes(2)
    expect(
      (trackAnalysisVisitEnded as jest.Mock).mock.calls[1][0],
    ).toMatchObject({ how: 'page_closed', game_source: 'play', tools: [] })
  })

  it('notes nothing outside a visit', () => {
    noteAnalysisTool('export')
    endAnalysisVisit('navigated')
    expect(trackAnalysisVisitEnded).not.toHaveBeenCalled()
  })
})
