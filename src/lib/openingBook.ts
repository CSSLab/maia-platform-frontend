import { OpeningBook } from 'src/types'

/**
 * Maia's moves at a rating blended with the opening book's games there, the
 * book's counts weighing against Maia as a prior worth `K` games:
 *   p(move) = (games with the move + K * Maia(move)) / (games + K)
 * A rating with many games shows how its players actually play; one with few
 * stays close to Maia. Sorted by probability, as Maia's moves are. Maia's
 * policy unchanged when the book has no games at that rating.
 */
export const blendWithBook = (
  policy: Record<string, number>,
  book: OpeningBook,
  rating: number,
): Record<string, number> => {
  const i = book.ratings.indexOf(rating)
  const games = i < 0 ? 0 : book.games[i]
  if (!(games > 0)) return policy
  const blended: Record<string, number> = {}
  for (const move of new Set([
    ...Object.keys(policy),
    ...Object.keys(book.moves),
  ])) {
    blended[move] =
      ((book.moves[move]?.[i] ?? 0) + book.K * (policy[move] ?? 0)) /
      (games + book.K)
  }
  return Object.fromEntries(
    Object.entries(blended).sort(([, a], [, b]) => b - a),
  )
}
