export interface User {
  clientId: string
  displayName: string
  lichessId?: string
  /**
   * When the backend made the account cookie (Unix seconds). For a guest, when
   * the account was made; for a Lichess account, when it last signed in here.
   */
  cookieCreatedAt?: number
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
}
