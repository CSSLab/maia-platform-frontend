import {
  daysSince,
  leaderboardEligibility,
  parseRatingCertainty,
} from './ratingUtils'

describe('parseRatingCertainty', () => {
  it('reads the flag the backend sends today', () => {
    expect(
      parseRatingCertainty(
        { play_provisional: false, hand_provisional: true },
        'hand',
      ),
    ).toEqual({
      provisional: true,
      deviation: undefined,
      volatility: undefined,
      lastPlayed: undefined,
    })
  })

  it('treats a response without the flag as settled', () => {
    expect(parseRatingCertainty({}, 'play').provisional).toBe(false)
  })

  it('reads the deviation, volatility and last result when present', () => {
    const certainty = parseRatingCertainty(
      {
        puzzles_provisional: false,
        puzzles_elo_deviation: 71.4,
        puzzles_elo_volatility: 0.0601,
        puzzles_last_played: '2026-11-01 18:22:36.715000',
      },
      'puzzles',
    )
    expect(certainty.deviation).toBe(71.4)
    expect(certainty.volatility).toBe(0.0601)
    expect(certainty.lastPlayed?.toISOString()).toBe('2026-11-01T18:22:36.715Z')
  })

  it('keeps the zone of a time that has one', () => {
    expect(
      parseRatingCertainty(
        { turing_last_played: '2026-11-01T18:22:36+00:00' },
        'turing',
      ).lastPlayed?.toISOString(),
    ).toBe('2026-11-01T18:22:36.000Z')
  })

  it('ignores values that are not usable', () => {
    const certainty = parseRatingCertainty(
      {
        brain_elo_deviation: null,
        brain_elo_volatility: 'high',
        brain_last_played: 'never',
      },
      'brain',
    )
    expect(certainty.deviation).toBeUndefined()
    expect(certainty.volatility).toBeUndefined()
    expect(certainty.lastPlayed).toBeUndefined()
  })
})

describe('leaderboardEligibility', () => {
  const now = new Date('2026-11-10T00:00:00Z')
  const playedDaysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  it('is listed when the player is on the board', () => {
    expect(
      leaderboardEligibility({
        certainty: { provisional: false },
        position: 3,
      }),
    ).toEqual({ state: 'listed', position: 3 })
  })

  it('is not eligible while the rating is provisional', () => {
    expect(
      leaderboardEligibility({
        certainty: { provisional: true, lastPlayed: playedDaysAgo(1) },
        windowDays: 7,
        now,
      }),
    ).toEqual({ state: 'provisional' })
  })

  it('is eligible with a settled rating and a result within the window', () => {
    expect(
      leaderboardEligibility({
        certainty: { provisional: false, lastPlayed: playedDaysAgo(7) },
        windowDays: 7,
        now,
      }),
    ).toEqual({ state: 'eligible' })
  })

  it('is inactive with a settled rating and no result within the window', () => {
    expect(
      leaderboardEligibility({
        certainty: { provisional: false, lastPlayed: playedDaysAgo(8) },
        windowDays: 7,
        now,
      }),
    ).toEqual({ state: 'inactive' })
  })

  it('says only that the rating is settled when activity is unknown', () => {
    expect(
      leaderboardEligibility({
        certainty: { provisional: false },
        windowDays: 7,
        now,
      }),
    ).toEqual({ state: 'settled' })
    expect(
      leaderboardEligibility({
        certainty: { provisional: false, lastPlayed: playedDaysAgo(1) },
        now,
      }),
    ).toEqual({ state: 'settled' })
  })
})

describe('daysSince', () => {
  it('never goes negative for a time ahead of this clock', () => {
    expect(
      daysSince(
        new Date('2026-11-10T00:05:00Z'),
        new Date('2026-11-10T00:00:00Z'),
      ),
    ).toBe(0)
  })
})
