import { fetchPuzzleData } from './train'

describe('fetchPuzzleData', () => {
  afterEach(() => {
    delete window.__puzzle
  })

  it("takes the puzzle the page's HTML asked for, once", async () => {
    window.__puzzle = Promise.resolve({ puzzle_elo: 1500 })
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ puzzle_elo: 1700 }),
    }) as unknown as typeof fetch

    expect(await fetchPuzzleData()).toEqual({ puzzle_elo: 1500 })
    expect(global.fetch).not.toHaveBeenCalled()
    // The next puzzle is a new request.
    expect(await fetchPuzzleData()).toEqual({ puzzle_elo: 1700 })
  })

  it('asks again when that request failed (a first visit, without the cookie)', async () => {
    window.__puzzle = Promise.reject(new Error('401'))
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ puzzle_elo: 1700 }),
    }) as unknown as typeof fetch

    expect(await fetchPuzzleData()).toEqual({ puzzle_elo: 1700 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
