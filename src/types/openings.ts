import { GameTree, GameNode } from '.'

export interface Opening {
  id: string
  name: string
  description: string
  fen: string
  pgn: string
  variations: OpeningVariation[]
  isCustom?: boolean
  setupFen?: string
  categoryType?: 'opening' | 'endgame' | 'custom'
}

export interface OpeningVariation {
  id: string
  name: string
  fen: string
  pgn: string
  isCustom?: boolean
  setupFen?: string
}

export interface OpeningSelection {
  opening: Opening
  variation: OpeningVariation | null
  playerColor: 'white' | 'black'
  maiaVersion: string
  targetMoveNumber: number
  id: string
}

export interface DrillConfiguration {
  selections: OpeningSelection[]
}

export interface OpeningDrillState {
  configuration: DrillConfiguration
  completedDrills: CompletedDrill[]
  currentDrill: OpeningSelection | null
  remainingDrills: OpeningSelection[]
  currentDrillIndex: number
  totalDrills: number
  analysisEnabled: boolean
}

export interface OpeningDrillGame {
  id: string
  selection: OpeningSelection
  moves: string[]
  tree: GameTree
  currentFen: string
  toPlay: 'white' | 'black'
  openingEndNode?: GameNode | null
  playerMoveCount: number
}

// Enhanced move analysis for detailed feedback
export interface MoveAnalysis {
  move: string
  san: string
  fen: string // Position after the move (for UI display)
  fenBeforeMove?: string // Position before the move (for Maia analysis)
  moveNumber: number
  isPlayerMove: boolean
  evaluation: number
  classification: 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
  evaluationLoss: number
  bestMove?: string
  bestEvaluation?: number
  stockfishBestMove?: string
  maiaBestMove?: string
}

// Rating comparison data
export interface RatingComparison {
  rating: number
  probability: number
  moveMatch: boolean
  logLikelihood: number // Raw log likelihood score
  likelihoodProbability: number // Normalized probability based on log likelihood
  averageMoveProb: number // Average probability of player's moves for this rating
}

// Enhanced rating prediction with single confident result
export interface RatingPrediction {
  predictedRating: number // Single weighted average rating prediction
  standardDeviation: number // Uncertainty in rating prediction
  sampleSize: number // Number of moves analyzed
  ratingDistribution: RatingComparison[] // Full distribution for visualization
}

// Enhanced evaluation chart data
export interface EvaluationPoint {
  moveNumber: number
  evaluation: number
  isPlayerMove: boolean
  moveClassification:
    | 'excellent'
    | 'good'
    | 'inaccuracy'
    | 'mistake'
    | 'blunder'
}

export interface CompletedDrill {
  selection: OpeningSelection
  finalNode: GameNode
  playerMoves: string[]
  allMoves: string[]
  totalMoves: number
  blunders: string[]
  goodMoves: string[]
  finalEvaluation: number
  completedAt: Date
  // Enhanced analysis data
  moveAnalyses?: MoveAnalysis[]
  accuracyPercentage?: number
  averageEvaluationLoss?: number
}

export interface DrillPerformanceData {
  drill: CompletedDrill
  evaluationChart: EvaluationPoint[]
  accuracy: number
  blunderCount: number
  goodMoveCount: number
  inaccuracyCount: number
  mistakeCount: number
  excellentMoveCount: number
  feedback: string[]
  // Enhanced feedback data
  moveAnalyses: MoveAnalysis[]
  ratingComparison: RatingComparison[]
  ratingPrediction: RatingPrediction // New single confident rating prediction
  bestPlayerMoves: MoveAnalysis[]
  worstPlayerMoves: MoveAnalysis[]
  averageEvaluationLoss: number
  openingKnowledge: number // 0-100 score for opening theory knowledge
}

export interface OverallPerformanceData {
  totalDrills: number
  completedDrills: CompletedDrill[]
  overallAccuracy: number
  totalBlunders: number
  totalGoodMoves: number
  bestPerformance: CompletedDrill | null
  worstPerformance: CompletedDrill | null
  averageEvaluation: number
}
