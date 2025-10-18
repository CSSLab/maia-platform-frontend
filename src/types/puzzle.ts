import {
  Termination,
  Player,
  RawMove,
  MoveValueMapping,
  GameTree,
  BaseGame,
} from '.'

export interface AvailableMoves {
  [uci: string]: RawMove
}

export interface PuzzleGame extends BaseGame {
  puzzle_elo: number
  gameType: string
  blackPlayer: Player
  whitePlayer: Player
  termination?: Termination
  stockfishEvaluation: MoveValueMapping
  maiaEvaluation: MoveValueMapping
  availableMoves: AvailableMoves
  targetIndex: number
  result?: boolean
  tree: GameTree
}

export type Status =
  | 'default'
  | 'loading'
  | 'forfeit'
  | 'correct'
  | 'incorrect'
  | 'archived'
