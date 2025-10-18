import { BaseGame } from './common'
import { Termination, Color, Player } from '.'

export interface TuringGame extends BaseGame {
  termination: Termination
  result?: TuringSubmissionResult
}

export interface TuringSubmissionResult {
  bot: Color
  blackPlayer: Player
  whitePlayer: Player
  correct: boolean
  gameType: string
  timeControl: string
  turingElo: number
  ratingDiff: number
}
