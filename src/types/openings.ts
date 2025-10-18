import { GameTree, GameNode } from '.'

export type DrillCategoryType = 'opening' | 'endgame' | 'custom'

export type EndgameTrait =
  | 'multi_pawns_each'
  | 'no_pawns'
  | 'one_pawn_each'
  | 'one_pawn_total'

export interface EndgamePositionDetail {
  fen: string
  trait: EndgameTrait
  traitLabel: string
  categoryName: string
  categorySlug: string
  subcategoryName?: string
  subcategorySlug?: string
  index: number
}

export interface EndgameSelectionMeta {
  categoryName: string
  categorySlug: string
  subcategoryName?: string
  subcategorySlug?: string
  trait: EndgameTrait
  traitLabel: string
  positionIndex: number
  groupId: string
  groupLabel: string
}

export interface Opening {
  id: string
  name: string
  description: string
  fen: string
  pgn: string
  variations: OpeningVariation[]
  isCustom?: boolean
  setupFen?: string
  categoryType?: DrillCategoryType
  endgameMeta?: {
    categorySlug: string
    categoryName: string
    traits: Partial<Record<EndgameTrait, string[]>>
    motifs: Array<{
      subcategorySlug: string
      subcategoryName: string
      traits: Partial<Record<EndgameTrait, string[]>>
    }>
  }
}

export interface OpeningVariation {
  id: string
  name: string
  fen: string
  pgn: string
  isCustom?: boolean
  setupFen?: string
  endgameMeta?: {
    categorySlug: string
    categoryName: string
    subcategorySlug: string
    subcategoryName: string
    traits: Partial<Record<EndgameTrait, string[]>>
  }
}

export interface OpeningSelection {
  opening: Opening
  variation: OpeningVariation | null
  playerColor: 'white' | 'black'
  maiaVersion: string
  targetMoveNumber: number | null
  id: string
  endgameMeta?: EndgameSelectionMeta
  endgameTraits?: EndgameTrait[]
  endgamePositions?: EndgamePositionDetail[]
  endgameScope?: 'category' | 'motif'
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
