import { Player } from './player'
import { BaseGame } from './common'
import { AvailableMoves } from './puzzle'

export interface MoveValueMapping {
  [move: string]: number
}

export interface AnalyzedGame extends BaseGame {
  availableMoves: AvailableMoves[]
  type: EvaluationType
  /**
   * A world championship game's number within its match (the second part of
   * its address, /analysis/<match>/<number>). The games of a match all carry
   * the match's `id`, so this is what tells one from another.
   */
  gameIndex?: string
  gameType: string
  blackPlayer: Player
  whitePlayer: Player
  termination?: Termination
  /**
   * For a stored game (play, hand, brain or custom): false when it is someone
   * else's, opened by its link. Its analysis can be viewed but isn't saved.
   */
  isOwner?: boolean
  /**
   * When the game was started, in epoch milliseconds: a stored game's
   * `created_time` (a custom game: when it was imported), a Lichess game's
   * PGN date. Absent or null when it isn't known.
   */
  createdAt?: number | null
  /** When it ended; only stored games that finished since the backend kept it. */
  endedAt?: number | null
  /** Source PGN as imported (Lichess games), with [%clk] comments if any. */
  pgn?: string
}

export interface MaiaEvaluation {
  value: number
  policy: { [key: string]: number }
}

export interface StockfishMoveDiagnostic {
  cp: number
  depth: number
  mateIn?: number
  phase?: 'multipv' | 'screen' | 'deep' | 'ground-truth'
  selectedBy?: 'sf-top' | 'maia-95' | 'both'
  maiaProb?: number
}

export interface StockfishDiagnostics {
  positionId: string
  fen: string
  strategy: 'multipv-all' | 'staged-root-probe' | 'searchmoves-all'
  targetDepth: number
  legalMoveCount: number
  totalTimeMs: number
  phaseTimesMs?: { [phase: string]: number }
  moveCounts?: {
    screened?: number
    deepened?: number
    finalAtTargetDepth?: number
  }
  moves?: { [move: string]: StockfishMoveDiagnostic }
}

export interface StockfishEvaluation {
  sent: boolean
  depth: number
  model_move: string
  model_optimal_cp: number
  cp_vec: { [key: string]: number }
  cp_relative_vec: { [key: string]: number }
  root_move_depth_vec?: { [key: string]: number }
  diagnostics?: StockfishDiagnostics
  winrate_vec?: { [key: string]: number }
  winrate_loss_vec?: { [key: string]: number }
  mate_vec?: { [key: string]: number }
  is_checkmate?: boolean
  /** From the shared analysis cache, which does not say which engine made it. */
  from_cache?: boolean
  /**
   * Set while the search goes on: `depth` is that of the deepest line so far,
   * and the position is not done even if it has reached the target depth.
   */
  partial?: boolean
  /** The lines on show have reached the target depth. */
  lines_done?: boolean
}

export interface CachedEngineAnalysisEntry {
  ply: number
  fen: string
  maia?: { [rating: string]: MaiaEvaluation }
  stockfish?: {
    depth: number
    cp_vec: MoveValueMapping
    mate_vec?: MoveValueMapping
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
  /** When the game was started (a custom game: imported), epoch milliseconds. */
  createdAt?: number | null
  /** When it ended, where that is known. */
  endedAt?: number | null
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
