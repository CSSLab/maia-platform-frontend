import { trackWchVisitEnded } from 'src/lib/analytics'

import {
  endWchVisit,
  noteWchGame,
  noteWchGuess,
  noteWchHover,
  noteWchLayout,
  noteWchMove,
  noteWchSource,
  noteWchTab,
  startWchVisit,
} from './visit'

jest.mock('src/lib/analytics', () => ({ trackWchVisitEnded: jest.fn() }))
jest.mock('src/lib/posthogClient', () => ({ whenPageCloses: () => () => {} }))

describe('a visit to the World Championship page', () => {
  beforeEach(() => jest.mocked(trackWchVisitEnded).mockClear())

  it('is sent once, with what was used', () => {
    startWchVisit('live')
    noteWchGame('j7pdr7s2', 'live', 23)
    noteWchTab('chances')
    noteWchTab('risk')
    noteWchTab('risk')
    noteWchMove(4)
    noteWchMove(4)
    noteWchMove(9)
    noteWchHover()
    noteWchGuess()
    noteWchSource('tree')
    noteWchSource('feed')
    noteWchLayout(true)
    endWchVisit('navigated')
    endWchVisit('page_closed')
    expect(trackWchVisitEnded).toHaveBeenCalledTimes(1)
    expect(jest.mocked(trackWchVisitEnded).mock.calls[0][0]).toMatchObject({
      how: 'navigated',
      mode: 'live',
      game_id: 'j7pdr7s2',
      game_status: 'live',
      game_plies: 23,
      tabs: ['chances', 'risk'],
      moves_viewed: 2,
      moves_hovered: 1,
      guesses: 1,
      sources: ['feed', 'tree'],
      layouts: ['wide'],
    })
  })

  it('sends nothing outside a visit', () => {
    noteWchTab('risk')
    endWchVisit('page_closed')
    expect(trackWchVisitEnded).not.toHaveBeenCalled()
  })
})
