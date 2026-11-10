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
  /**
   * Read again when the analysis reaches the phases that use Maia's moves,
   * so a policy that arrives during the search is used without restarting it.
   */
  getMaiaCandidates?: () => Pick<
    StockfishStreamOptions,
    'maiaCandidateMoves' | 'maiaPolicy'
  >
}

export interface MaiaEngine {
  maia?: Maia
  status: MaiaStatus
  progress: number
  /** Whether the model downloaded. */
  downloadModel: () => Promise<boolean>
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
