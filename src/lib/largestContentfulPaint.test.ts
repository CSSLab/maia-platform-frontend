import { capture } from 'src/lib/posthogClient'
import { reportLargestContentfulPaint } from './largestContentfulPaint'

jest.mock('src/lib/posthogClient', () => ({ capture: jest.fn() }))

const paint = (startTime: number) =>
  ({
    startTime,
    toJSON: () => ({ entryType: 'largest-contentful-paint', startTime }),
  }) as unknown as LargestContentfulPaint

// Entries reach the observer's callback, or wait for takeRecords().
let observed: (entries: LargestContentfulPaint[]) => void
let waiting: LargestContentfulPaint[] = []
class FakeObserver {
  static supportedEntryTypes = ['largest-contentful-paint']
  constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
    observed = (entries) => callback({ getEntries: () => entries })
  }
  observe() {}
  disconnect() {}
  takeRecords() {
    return waiting.splice(0)
  }
}

let visibility: DocumentVisibilityState = 'visible'
const hide = (timeStamp: number) => {
  visibility = 'hidden'
  const event = new Event('visibilitychange')
  Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  document.dispatchEvent(event)
}

beforeAll(() => {
  Object.defineProperty(window, 'PerformanceObserver', { value: FakeObserver })
  Object.defineProperty(document, 'visibilityState', {
    get: () => visibility,
  })
})

beforeEach(() => {
  jest.useFakeTimers()
  jest.mocked(capture).mockClear()
  visibility = 'visible'
  waiting = []
})

afterEach(() => jest.useRealTimers())

const sent = () =>
  jest.mocked(capture).mock.calls.map(([event, properties]) => ({
    event,
    value: properties?.$web_vitals_LCP_value,
    rating: (properties?.$web_vitals_LCP_event as { rating: string }).rating,
    pathname: properties?.$pathname,
  }))

describe('reportLargestContentfulPaint', () => {
  it('sends the last paint once the first click has been handled', () => {
    reportLargestContentfulPaint()
    observed([paint(800), paint(2700)])
    waiting = [paint(3100)]
    window.dispatchEvent(new MouseEvent('click'))
    // The click opens another page within the app.
    history.pushState({}, '', '/play/maia')
    expect(capture).not.toHaveBeenCalled()
    jest.runAllTimers()
    history.replaceState({}, '', '/')
    expect(sent()).toEqual([
      {
        event: '$web_vitals',
        value: 3100,
        rating: 'needs-improvement',
        pathname: '/',
      },
    ])
  })

  it('sends it once, not again when the page is hidden', () => {
    reportLargestContentfulPaint()
    observed([paint(1200)])
    window.dispatchEvent(new KeyboardEvent('keydown'))
    jest.runAllTimers()
    hide(5000)
    window.dispatchEvent(new MouseEvent('click'))
    jest.runAllTimers()
    expect(sent()).toEqual([
      { event: '$web_vitals', value: 1200, rating: 'good', pathname: '/' },
    ])
  })

  it('sends it when the page is hidden, without paints from after', () => {
    reportLargestContentfulPaint()
    observed([paint(4500)])
    waiting = [paint(6000)]
    hide(5000)
    expect(sent()).toEqual([
      { event: '$web_vitals', value: 4500, rating: 'poor', pathname: '/' },
    ])
  })

  it('sends nothing for a page that has not painted', () => {
    reportLargestContentfulPaint()
    hide(5000)
    expect(capture).not.toHaveBeenCalled()
  })

  it('sends nothing for a page that was opened in the background', () => {
    visibility = 'hidden'
    reportLargestContentfulPaint()
    observed([paint(900)])
    hide(5000)
    expect(capture).not.toHaveBeenCalled()
  })
})
