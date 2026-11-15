/**
 * How often players blunder, by time control and rating: the "usual" mark on
 * each player's danger meter. From 1.2M positions of everyday Lichess games
 * (practical §86, P90 labels: the site's own definition of a blunder, a move
 * that loses more than 0.10 of the site's win rate, on the scale of its
 * Stockfish 19 small net). Rows are
 * [rating (band centre), next move, within 5 moves, within 10 moves,
 * a major blunder within 5, losing on time within 5], for the player to move.
 */
export const TYPICAL_DANGER_BY_LEVEL: Record<
  'bullet' | 'blitz' | 'rapid',
  [number, number, number, number, number, number][]
> = {
  bullet: [
    [1100, 0.119, 0.37, 0.482, 0.194, 0.063],
    [1300, 0.113, 0.364, 0.488, 0.181, 0.055],
    [1500, 0.108, 0.354, 0.486, 0.169, 0.048],
    [1700, 0.103, 0.344, 0.481, 0.161, 0.042],
    [1900, 0.098, 0.336, 0.477, 0.152, 0.035],
    [2100, 0.092, 0.32, 0.465, 0.139, 0.031],
    [2300, 0.087, 0.303, 0.448, 0.128, 0.026],
    [2500, 0.073, 0.279, 0.433, 0.109, 0.02],
  ],
  blitz: [
    [1100, 0.112, 0.361, 0.479, 0.182, 0.02],
    [1300, 0.105, 0.353, 0.478, 0.165, 0.018],
    [1500, 0.099, 0.338, 0.475, 0.147, 0.016],
    [1700, 0.093, 0.325, 0.466, 0.133, 0.016],
    [1900, 0.083, 0.3, 0.444, 0.115, 0.015],
    [2100, 0.072, 0.271, 0.411, 0.095, 0.015],
    [2300, 0.064, 0.244, 0.383, 0.078, 0.014],
    [2500, 0.053, 0.205, 0.327, 0.053, 0.012],
  ],
  rapid: [
    [1100, 0.119, 0.358, 0.463, 0.19, 0.011],
    [1300, 0.106, 0.341, 0.458, 0.167, 0.01],
    [1500, 0.098, 0.329, 0.452, 0.144, 0.01],
    [1700, 0.086, 0.304, 0.439, 0.121, 0.007],
    [1900, 0.074, 0.285, 0.423, 0.103, 0.008],
    [2100, 0.064, 0.247, 0.384, 0.086, 0.007],
  ],
}
