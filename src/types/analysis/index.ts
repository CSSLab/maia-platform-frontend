import { Game } from '../base'
import { AvailableMoves } from '../training'

type EvaluationType =
  | 'tournament'
  | 'pgn'
  | 'play'
  | 'hand'
  | 'brain'
  | 'custom-pgn'
  | 'custom-fen'

type StockfishEvaluations<T extends EvaluationType> = T extends 'tournament'
  ? MoveMap[]
  : (StockfishEvaluation | undefined)[]

export interface AnalysisTournamentGame {
  game_index: number
  event: string
  site: string
  date: string
  round: number
  white: string
  black: string
  result?: string
}

export interface AnalysisWebGame {
  id: string
  type:
    | 'tournament'
    | 'pgn'
    | 'play'
    | 'hand'
    | 'brain'
    | 'custom-pgn'
    | 'custom-fen'
  label: string
  result: string
  pgn?: string
}

export interface AnalyzedGame extends Game {
  maiaEvaluations: { [rating: string]: MaiaEvaluation }[]
  stockfishEvaluations: StockfishEvaluations<EvaluationType>
  availableMoves: AvailableMoves[]
  type: EvaluationType
  pgn?: string
}

export interface CustomAnalysisInput {
  type: 'custom-pgn' | 'custom-fen'
  data: string // PGN string or FEN string
  name?: string
}

export interface Termination {
  result: string
  winner: 'white' | 'black' | 'none' | undefined
  type?: 'rules' | 'resign' | 'time' | undefined
  condition?: string
}

export interface MoveMap {
  [move: string]: number
}

export interface PositionEvaluation {
  trickiness: number
  performance: number
}

export interface MaiaEvaluation {
  policy: { [key: string]: number }
  value: number
}

export interface StockfishEvaluation {
  sent: boolean
  depth: number
  model_move: string
  model_optimal_cp: number
  cp_vec: { [key: string]: number }
  cp_relative_vec: { [key: string]: number }
  winrate_vec?: { [key: string]: number }
  winrate_loss_vec?: { [key: string]: number }
}

export interface ColorSanMapping {
  [move: string]: {
    san: string
    color: string
  }
}

export interface BlunderInfo {
  move: string
  probability: number
}

export interface BlunderMeterResult {
  blunderMoves: {
    probability: number
    moves: BlunderInfo[]
  }
  okMoves: {
    probability: number
    moves: BlunderInfo[]
  }
  goodMoves: {
    probability: number
    moves: BlunderInfo[]
  }
}

export type MaiaStatus =
  | 'loading'
  | 'no-cache'
  | 'downloading'
  | 'ready'
  | 'error'

export type StockfishStatus = 'loading' | 'ready' | 'error'
