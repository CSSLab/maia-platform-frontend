import {
  readPuzzleClock,
  resetPuzzleClocks,
  startPuzzleClock,
} from './puzzleClock'

let now = 0
let visibility: DocumentVisibilityState = 'visible'

const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  resetPuzzleClocks()
  now = 1000
  visibility = 'visible'
  jest.spyOn(performance, 'now').mockImplementation(() => now)
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('puzzleClock', () => {
  it('times a puzzle from when it is shown, to a tenth of a second', () => {
    startPuzzleClock('a')
    now += 12_345
    expect(readPuzzleClock('a')).toEqual({ seconds: 12.3, hiddenSeconds: 0 })
  })

  it('counts the time the page was hidden', () => {
    startPuzzleClock('a')
    now += 2000
    setVisibility('hidden')
    now += 5000
    setVisibility('visible')
    now += 1000
    expect(readPuzzleClock('a')).toEqual({ seconds: 8, hiddenSeconds: 5 })
  })

  it('counts a page still hidden when the puzzle is answered', () => {
    startPuzzleClock('a')
    setVisibility('hidden')
    now += 3000
    expect(readPuzzleClock('a')).toEqual({ seconds: 3, hiddenSeconds: 3 })
  })

  it('leaves out time hidden before the puzzle was shown', () => {
    startPuzzleClock('a')
    setVisibility('hidden')
    now += 4000
    setVisibility('visible')
    startPuzzleClock('b')
    now += 1000
    expect(readPuzzleClock('b')).toEqual({ seconds: 1, hiddenSeconds: 0 })
    expect(readPuzzleClock('a')).toEqual({ seconds: 5, hiddenSeconds: 4 })
  })

  it('keeps the first start when a puzzle is shown again', () => {
    startPuzzleClock('a')
    now += 3000
    startPuzzleClock('a')
    now += 1000
    expect(readPuzzleClock('a')?.seconds).toBe(4)
  })

  it('has no time for a puzzle it never started', () => {
    expect(readPuzzleClock('missing')).toBeNull()
  })
})
