import Maia from 'src/lib/engine/maia'
import { StockfishEvaluation } from './analysis'

export type MaiaStatus =
  | 'loading'
  | 'no-cache'
  | 'downloading'
  | 'ready'
  | 'error'

export type StockfishStatus = 'loading' | 'ready' | 'error'

export interface MaiaEngine {
  maia?: Maia
  status: MaiaStatus
  progress: number
  downloadModel: () => void
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
  ) => AsyncIterable<StockfishEvaluation> | null
}
