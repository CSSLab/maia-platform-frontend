import { act, render } from '@testing-library/react'
import { trackTourEnded, trackTourStarted } from 'src/lib/analytics'
import { TourProvider, useTour } from './TourContext'
import type { TourContextType } from './TourContext'

jest.mock('next/dynamic', () => () => () => null)
jest.mock('src/lib/analytics', () => ({
  trackTourStarted: jest.fn(),
  trackTourEnded: jest.fn(),
}))

const steps = [
  { id: 'a', title: 'A', description: 'a', targetId: 'a' },
  { id: 'b', title: 'B', description: 'b', targetId: 'b' },
  { id: 'c', title: 'C', description: 'c', targetId: 'c' },
]

const setup = () => {
  const tour = { current: null as TourContextType | null }
  const Probe = () => {
    tour.current = useTour()
    return null
  }
  render(
    <TourProvider>
      <Probe />
    </TourProvider>,
  )
  return tour
}

describe('tour events', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reports a tour started and skipped, at the step reached', () => {
    const tour = setup()
    act(() => tour.current!.startTour('play', steps, true))
    expect(trackTourStarted).toHaveBeenCalledWith('play', 3, true)
    act(() => tour.current!.nextStep())
    act(() => tour.current!.skipTour())
    act(() => tour.current!.endTour())
    expect((trackTourEnded as jest.Mock).mock.calls).toEqual([
      ['play', 'skipped', 2, 3],
    ])
  })

  it('reports a tour finished, and one left open when the page closes', () => {
    const tour = setup()
    act(() => tour.current!.startTour('play', steps, true))
    act(() => tour.current!.endTour())
    act(() => tour.current!.startTour('analysis', steps, true))
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect((trackTourEnded as jest.Mock).mock.calls).toEqual([
      ['play', 'finished', 1, 3],
      ['analysis', 'left', 1, 3],
    ])
  })
})
