/**
 * Utility functions for handling chess ratings
 */

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
