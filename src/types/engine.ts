import Maia from 'src/lib/engine/maia'
import { StockfishEvaluation } from './analysis'

export type MaiaStatus =
  | 'loading'
  | 'no-cache'
  | 'downloading'
  | 'ready'
  | 'error'

export type StockfishStatus = 'loading' | 'ready' | 'error'
export type StockfishMoveMapStrategy =
  | 'multipv-all'
  | 'staged-root-probe'
  | 'searchmoves-all'

export interface StockfishStreamOptions {
  moveMapStrategy?: StockfishMoveMapStrategy
  maiaCandidateMoves?: string[]
  forcedCandidateMoves?: string[]
  maiaPolicy?: { [move: string]: number }
  kSf?: number
}

export interface MaiaEngine {
  maia?: Maia
  status: MaiaStatus
  progress: number
  downloadModel: () => Promise<void>
}

export interface StockfishEngine {
  error: string | null
  status: StockfishStatus
  isReady: () => boolean
  stopEvaluation: () => void
  streamEvaluations: (
    fen: string,
    moveCount: number,
    depth?: number,
    options?: StockfishStreamOptions,
  ) => AsyncIterable<StockfishEvaluation> | null
}
