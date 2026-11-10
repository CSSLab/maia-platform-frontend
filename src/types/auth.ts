export interface User {
  clientId: string
  displayName: string
  lichessId?: string
}

export interface PlayerStats {
  regularRating: number
  regularWins: number
  regularDraws: number
  regularGames: number
  regularMax: number
  regularMin: number
  regularHours: number

  handRating: number
  handWins: number
  handDraws: number
  handGames: number
  handMax: number
  handMin: number
  handHours: number

  brainRating: number
  brainWins: number
  brainDraws: number
  brainGames: number
  brainMax: number
  brainMin: number
  brainHours: number

  trainRating: number
  trainCorrect: number
  trainGames: number
  trainMax: number
  trainMin: number
  trainHours: number

  botNotRating: number
  botNotCorrect: number
  botNotWrong: number
  botNotGames: number
  botNotMax: number
  botNotMin: number
  botNotHours: number

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
