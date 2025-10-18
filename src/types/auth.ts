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
}
