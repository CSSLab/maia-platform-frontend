export interface User {
  clientId: string
  displayName: string
  lichessId?: string
  // Whether this player's games are held by the server (the backend decides:
  // a share of players, see src/lib/serverGames.ts).
  serverGames?: boolean
}

// How sure the rating system (Glicko-2) is of a rating.
export interface RatingCertainty {
  // New to the mode, or away from it for months. Shown as "1650?".
  provisional: boolean
  // The three below are shown when the backend sends them.
  // Rating deviation now, grown by the time since the last rated result.
  deviation?: number
  volatility?: number
  // The last rated result in the mode.
  lastPlayed?: Date
}

export interface PlayerStats {
  regularRating: number
  regularWins: number
  regularDraws: number
  regularGames: number
  regularMax: number
  regularMin: number
  regularHours: number
  regularCertainty: RatingCertainty

  handRating: number
  handWins: number
  handDraws: number
  handGames: number
  handMax: number
  handMin: number
  handHours: number
  handCertainty: RatingCertainty

  brainRating: number
  brainWins: number
  brainDraws: number
  brainGames: number
  brainMax: number
  brainMin: number
  brainHours: number
  brainCertainty: RatingCertainty

  trainRating: number
  trainCorrect: number
  trainGames: number
  trainMax: number
  trainMin: number
  trainHours: number
  trainCertainty: RatingCertainty

  botNotRating: number
  botNotCorrect: number
  botNotWrong: number
  botNotGames: number
  botNotMax: number
  botNotMin: number
  botNotHours: number
  botNotCertainty: RatingCertainty

  /** When the account was created, epoch milliseconds; null if not known. */
  joinedAt?: number | null
  // When the player's last rated result in each mode was, epoch milliseconds;
  // null for a mode never played (and from a backend that doesn't send it).
  regularLastPlayed?: number | null
  handLastPlayed?: number | null
  brainLastPlayed?: number | null
  trainLastPlayed?: number | null
  botNotLastPlayed?: number | null
}
