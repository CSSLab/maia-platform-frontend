import { fetchMaiaGameList } from 'src/api/analysis'
import { fetchPlayerStats } from 'src/api/profile'
import { fetchProgress, fetchRatingHistory } from './progress'

jest.mock('src/api/analysis', () => ({ fetchMaiaGameList: jest.fn() }))
jest.mock('src/api/profile', () => ({ fetchPlayerStats: jest.fn() }))

const NOW = Date.parse('2026-11-08T12:00:00Z')
const daysAgo = (days: number) => new Date(NOW - days * 86400_000).toISOString()

describe('fetchProgress', () => {
  it('gives the modes played, and games in the last 7 days', async () => {
    ;(fetchPlayerStats as jest.Mock).mockResolvedValue({
      regularRating: 1523.4,
      regularGames: 12,
      handRating: 1500,
      handGames: 0,
      brainRating: 1410,
      brainGames: 2,
      trainRating: 1700,
      trainGames: 30,
      botNotRating: 1500,
      botNotGames: 0,
    })
    ;(fetchMaiaGameList as jest.Mock).mockImplementation(async (type) =>
      type === 'play'
        ? {
            games: [{ created_time: daysAgo(1) }, { created_time: daysAgo(9) }],
          }
        : type === 'brain'
          ? {
              games: [
                { created_time: daysAgo(6) },
                { created_time: daysAgo(7.5) },
              ],
            }
          : { games: [] },
    )
    const progress = await fetchProgress(NOW)
    expect(progress.ratings.map((r) => [r.mode, r.rating])).toEqual([
      ['play', 1523],
      ['brain', 1410],
      ['puzzles', 1700],
    ])
    expect(progress.gamesThisWeek).toBe(2)
    expect(progress.gamesThisWeekAtLeast).toBe(false)
    // By day, the oldest first: 6 days ago and yesterday.
    expect(progress.days.map((d) => d.games)).toEqual([1, 0, 0, 0, 0, 1, 0])
  })
})

describe('fetchRatingHistory', () => {
  it('asks nothing while the trend is off', async () => {
    global.fetch = jest.fn()
    expect(await fetchRatingHistory('play')).toBe(null)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
