/**
 * Utility functions for handling chess ratings
 */

import { RatedMode, RatingCertainty } from 'src/types'

/**
 * Validates if a rating value is reasonable for chess
 * Chess ratings typically range from around 400 to 3000+
 * Maia models range from 600-2600, but players can have ratings outside this range
 *
 * @param rating - The rating value to validate
 * @returns true if the rating is valid, false otherwise
 */
export const isValidRating = (rating: unknown): rating is number => {
  if (typeof rating !== 'number') {
    return false
  }

  if (!Number.isFinite(rating)) {
    return false
  }

  // Chess ratings should be positive and within a reasonable range
  // Most chess rating systems have ratings between 0-4000, but typically 400-3000
  return rating > 0 && rating <= 4000
}

/**
 * Safely updates a rating, only if the new rating is valid
 *
 * @param newRating - The new rating value to potentially update to
 * @param updateFunction - The function to call with the new rating if valid
 * @returns true if the rating was updated, false if it was invalid and ignored
 */
export const safeUpdateRating = (
  newRating: unknown,
  updateFunction: (rating: number) => void,
): boolean => {
  if (isValidRating(newRating)) {
    updateFunction(newRating)
    return true
  }

  // Log invalid rating attempts for debugging
  console.warn('Attempted to update rating with invalid value:', newRating)
  return false
}

const DAY_MS = 24 * 60 * 60 * 1000

const positiveNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined

// The backend's times are UTC, written without a zone ("2026-11-01 18:22:36").
const parseUtcTime = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' || !value) return undefined
  const iso = value.replace(' ', 'T')
  const date = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * How certain a player's rating in `mode` is, from a get_player_stats
 * response. Today the backend sends only <mode>_provisional; the deviation,
 * volatility and time of the last rated result are read when present.
 */
export const parseRatingCertainty = (
  data: Record<string, unknown>,
  mode: RatedMode,
): RatingCertainty => ({
  provisional: data[`${mode}_provisional`] === true,
  deviation: positiveNumber(data[`${mode}_elo_deviation`]),
  volatility: positiveNumber(data[`${mode}_elo_volatility`]),
  lastPlayed: parseUtcTime(data[`${mode}_last_played`]),
})

export const daysSince = (date: Date, now: Date = new Date()): number =>
  Math.max(0, (now.getTime() - date.getTime()) / DAY_MS)

export type LeaderboardEligibility =
  // In the board's top ten.
  | { state: 'listed'; position: number }
  // Qualifies, but ten players are rated higher.
  | { state: 'eligible' }
  | { state: 'provisional' }
  // Settled, but no rated result within the board's window.
  | { state: 'inactive' }
  // Settled; whether they played within the window isn't known.
  | { state: 'settled' }

/**
 * Where a Lichess-linked player stands for a mode's leaderboard. The backend
 * lists players whose rating isn't provisional and who played the mode within
 * `windowDays` (maia_api/ratings.py).
 */
export const leaderboardEligibility = ({
  certainty,
  position,
  windowDays,
  now,
}: {
  certainty: RatingCertainty
  position?: number
  windowDays?: number
  now?: Date
}): LeaderboardEligibility => {
  if (position !== undefined) return { state: 'listed', position }
  if (certainty.provisional) return { state: 'provisional' }
  if (certainty.lastPlayed && windowDays !== undefined) {
    return daysSince(certainty.lastPlayed, now) <= windowDays
      ? { state: 'eligible' }
      : { state: 'inactive' }
  }
  return { state: 'settled' }
}
