import { Player } from './player'
import { BaseGame } from './common'
import { AvailableMoves } from './puzzle'

export interface MoveValueMapping {
  [move: string]: number
}

export interface AnalyzedGame extends BaseGame {
  availableMoves: AvailableMoves[]
  type: EvaluationType
  gameType: string
  blackPlayer: Player
  whitePlayer: Player
  termination?: Termination
}

export interface MaiaEvaluation {
  value: number
  policy: { [key: string]: number }
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
  mate_vec?: { [key: string]: number }
  is_checkmate?: boolean
}

export interface CachedEngineAnalysisEntry {
  ply: number
  fen: string
  maia?: { [rating: string]: MaiaEvaluation }
  stockfish?: {
    depth: number
    cp_vec: MoveValueMapping
  }
}

type EvaluationType =
  | 'tournament'
  | 'lichess'
  | 'play'
  | 'hand'
  | 'brain'
  | 'custom'
  | 'stream'

export interface WorldChampionshipGameListEntry {
  game_index: number
  event: string
  site: string
  date: string
  round: number
  white: string
  black: string
  result?: string
}

export interface MaiaGameListEntry {
  id: string
  type:
    | 'tournament'
    | 'lichess'
    | 'play'
    | 'hand'
    | 'brain'
    | 'custom'
    | 'stream'
  label: string
  result: string
  pgn?: string
}

export interface Termination {
  result: string
  winner: 'white' | 'black' | 'none' | undefined
  type?: 'rules' | 'resign' | 'time' | undefined
  condition?: string
}

export interface ColorSanMapping {
  [move: string]: {
    san: string
    color: string
  }
}

export interface DeepAnalysisConfig {
  targetDepth: number
}

export interface DeepAnalysisProgress {
  currentMoveIndex: number
  totalMoves: number
  currentMove: string
  isAnalyzing: boolean
  isComplete: boolean
  isCancelled: boolean
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

export interface MistakePosition {
  nodeId: string
  moveIndex: number
  fen: string
  playedMove: string
  san: string
  type: 'blunder' | 'inaccuracy'
  bestMove: string
  bestMoveSan: string
  playerColor: 'white' | 'black'
}

export interface LearnFromMistakesConfiguration {
  isActive: boolean
  showPlayerSelection: boolean
  selectedPlayerColor: 'white' | 'black' | null
  currentMistakeIndex: number
  mistakes: MistakePosition[]
  hasCompletedAnalysis: boolean
  showSolution: boolean
  currentAttempt: number
  maxAttempts: number
  originalPosition: string | null // FEN of the position where the player should make a move
}
