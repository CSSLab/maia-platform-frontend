import { fetchPlayerStats } from './profile'

// A reply of the production backend before it sent times with a zone, and
// before it sent when each mode was last played.
const OLD_REPLY = {
  puzzles_played: 12,
  puzzles_correct: 7,
  puzzles_elo: 1510,
  turing_guesses_correct: 3,
  turing_guesses_wrong: 1,
  turing_elo: 1520,
  play_elo: 1600,
  hand_elo: 1461,
  brain_elo: 1500,
  play_elo_max: 1650,
  play_elo_min: 1500,
  play_games_played: 143,
  play_won: 100,
  play_drawn: 2,
  display_name: 'alice',
  created_at: '2026-11-01 18:22:36.715000',
}

let fetchMock: jest.Mock

const replyWith = (body: object) =>
  fetchMock.mockReturnValueOnce(
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) }),
  )

beforeEach(() => {
  fetchMock = jest.fn()
  globalThis.fetch = fetchMock
})

describe('fetchPlayerStats', () => {
  it('asks for the named player, or the signed-in one', async () => {
    replyWith(OLD_REPLY)
    await fetchPlayerStats('alice')
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/auth/get_player_stats/alice',
    )

    replyWith(OLD_REPLY)
    await fetchPlayerStats()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/auth/get_player_stats')
  })

  it('reads the zone-less account time as UTC, and no last-played times', async () => {
    replyWith(OLD_REPLY)
    const stats = await fetchPlayerStats('alice')

    expect(stats.regularRating).toBe(1600)
    expect(stats.botNotGames).toBe(4)
    expect(stats.joinedAt).toBe(Date.UTC(2026, 10, 1, 18, 22, 36, 715))
    expect(stats.regularLastPlayed).toBeNull()
    expect(stats.handLastPlayed).toBeNull()
    expect(stats.brainLastPlayed).toBeNull()
    expect(stats.trainLastPlayed).toBeNull()
    expect(stats.botNotLastPlayed).toBeNull()
  })

  it('reads the times a newer backend sends, each of which may be null', async () => {
    replyWith({
      ...OLD_REPLY,
      created_at: '2026-11-01T18:22:36.715Z',
      play_last_played: '2026-11-09T15:24:42.915Z',
      hand_last_played: '2026-10-01T00:00:00Z',
      brain_last_played: null,
      puzzles_last_played: '2026-11-10T07:00:00.000000Z',
      turing_last_played: '',
    })
    const stats = await fetchPlayerStats('alice')

    expect(stats.joinedAt).toBe(Date.UTC(2026, 10, 1, 18, 22, 36, 715))
    expect(stats.regularLastPlayed).toBe(Date.UTC(2026, 10, 9, 15, 24, 42, 915))
    expect(stats.handLastPlayed).toBe(Date.UTC(2026, 9, 1))
    expect(stats.brainLastPlayed).toBeNull()
    expect(stats.trainLastPlayed).toBe(Date.UTC(2026, 10, 10, 7))
    expect(stats.botNotLastPlayed).toBeNull()
  })

  it('takes an empty or missing account time as not known', async () => {
    replyWith({ ...OLD_REPLY, created_at: '' })
    expect((await fetchPlayerStats('alice')).joinedAt).toBeNull()

    const { created_at: _, ...withoutTime } = OLD_REPLY
    replyWith(withoutTime)
    expect((await fetchPlayerStats('alice')).joinedAt).toBeNull()
  })
})
