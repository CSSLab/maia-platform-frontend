import { Chess } from 'chess.ts'
import { StockfishEvaluation, MaiaEvaluation } from 'src/types/analysis'
import { getBookMoves } from 'src/api'
import { MAIA_MODELS } from 'src/hooks/useAnalysisController/constants'

export interface AnalysisEngines {
  stockfish: {
    streamEvaluations: (
      fen: string,
      moveCount: number,
    ) => AsyncIterable<StockfishEvaluation> | null
    isReady: () => boolean
  }
  maia: {
    batchEvaluate: (
      fens: string[],
      ratingLevels: number[],
      thresholds: number[],
    ) => Promise<{ result: MaiaEvaluation[]; time: number }>
    status: string
    isReady: () => boolean
  }
}

export interface AnalysisOptions {
  stockfishDepth?: number
  stockfishTimeout?: number
  maiaRating?: number
  maiaThreshold?: number
  includeAllMaiaRatings?: boolean
  includeOpeningBook?: boolean
}

export interface AnalysisResult {
  fen: string
  stockfish: StockfishEvaluation | null
  maia: MaiaEvaluation | null
  maiaAllRatings?: { [key: string]: MaiaEvaluation }
  timestamp: number
}

/**
 * Analyzes a single position with Stockfish to get deep evaluation
 */
export async function analyzePositionWithStockfish(
  fen: string,
  engines: AnalysisEngines,
  options: AnalysisOptions = {},
): Promise<StockfishEvaluation | null> {
  const { stockfishDepth = 15, stockfishTimeout = 5000 } = options

  return new Promise((resolve) => {
    const chess = new Chess(fen)
    const moveCount = chess.moves().length

    if (moveCount === 0 || !engines.stockfish.isReady()) {
      resolve(null)
      return
    }

    const evaluationStream = engines.stockfish.streamEvaluations(fen, moveCount)
    if (!evaluationStream) {
      resolve(null)
      return
    }

    let bestEvaluation: StockfishEvaluation | null = null
    const timeout = setTimeout(() => {
      resolve(bestEvaluation)
    }, stockfishTimeout)

    ;(async () => {
      try {
        for await (const evaluation of evaluationStream) {
          bestEvaluation = evaluation
          if (evaluation.depth >= stockfishDepth) {
            clearTimeout(timeout)
            resolve(evaluation)
            break
          }
        }
      } catch (error) {
        console.error('Error in Stockfish position analysis:', error)
        clearTimeout(timeout)
        resolve(bestEvaluation)
      }
    })()
  })
}

/**
 * Analyzes a position with Maia at a specific rating level
 */
export async function analyzePositionWithMaia(
  fen: string,
  engines: AnalysisEngines,
  options: AnalysisOptions = {},
): Promise<MaiaEvaluation | null> {
  const {
    maiaRating = 1500,
    maiaThreshold,
    includeAllMaiaRatings = false,
  } = options

  // Wait for Maia to be ready
  if (!engines.maia.isReady()) {
    let retries = 0
    const maxRetries = 30 // 3 seconds with 100ms intervals

    while (retries < maxRetries && !engines.maia.isReady()) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      retries++
    }

    if (!engines.maia.isReady()) {
      console.warn('Maia not ready after waiting, skipping analysis')
      return null
    }
  }

  try {
    if (includeAllMaiaRatings) {
      // Analyze at all rating levels (for analysis controller)
      const { result } = await engines.maia.batchEvaluate(
        Array(9).fill(fen),
        [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
        [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
      )

      // Return the evaluation for the specific rating
      const ratingIndex = [
        1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900,
      ].indexOf(maiaRating)
      return ratingIndex >= 0 ? result[ratingIndex] : result[4] // Default to 1500 if not found
    } else {
      // Analyze at single rating level (for background analysis)
      const threshold = maiaThreshold || maiaRating
      const { result } = await engines.maia.batchEvaluate(
        [fen],
        [maiaRating],
        [threshold],
      )
      return result.length > 0 ? result[0] : null
    }
  } catch (error) {
    console.warn('Maia analysis failed:', error)
    return null
  }
}

/**
 * Gets all Maia evaluations for all rating levels (used by analysis controller)
 */
export async function analyzePositionWithAllMaiaRatings(
  fen: string,
  engines: AnalysisEngines,
  moveNumber = 1,
): Promise<{ [key: string]: MaiaEvaluation } | null> {
  // Wait for Maia to be ready
  if (!engines.maia.isReady()) {
    let retries = 0
    const maxRetries = 30 // 3 seconds with 100ms intervals

    while (retries < maxRetries && !engines.maia.isReady()) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      retries++
    }

    if (!engines.maia.isReady()) {
      console.warn('Maia not ready after waiting, skipping analysis')
      return null
    }
  }

  try {
    const chess = new Chess(fen)

    // Get Maia evaluations for all ratings
    const { result: maiaEval } = await engines.maia.batchEvaluate(
      Array(9).fill(fen),
      [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
      [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
    )

    const analysis: { [key: string]: MaiaEvaluation } = {}

    // Include opening book moves for early positions
    if (moveNumber <= 5) {
      try {
        const bookMoves = await getBookMoves(fen)

        MAIA_MODELS.forEach((model, index) => {
          const policySource = Object.keys(bookMoves[model] || {}).length
            ? bookMoves[model]
            : maiaEval[index].policy

          const sortedPolicy = Object.entries(policySource).sort(
            ([, a], [, b]) => (b as number) - (a as number),
          )

          analysis[model] = {
            value: maiaEval[index].value,
            policy: Object.fromEntries(
              sortedPolicy,
            ) as MaiaEvaluation['policy'],
          }
        })
      } catch (error) {
        console.warn('Failed to get opening book moves:', error)
        // Fallback to pure Maia analysis
        MAIA_MODELS.forEach((model, index) => {
          analysis[model] = maiaEval[index]
        })
      }
    } else {
      // Use pure Maia analysis for later positions
      MAIA_MODELS.forEach((model, index) => {
        analysis[model] = maiaEval[index]
      })
    }

    return analysis
  } catch (error) {
    console.warn('Maia analysis failed:', error)
    return null
  }
}

/**
 * Analyzes a single position with both Stockfish and Maia
 */
export async function analyzePosition(
  fen: string,
  engines: AnalysisEngines,
  options: AnalysisOptions = {},
  cache?: Map<string, AnalysisResult>,
): Promise<AnalysisResult> {
  // Check cache first
  if (cache?.has(fen)) {
    const cached = cache.get(fen)
    if (cached) {
      return cached
    }
  }

  const result: AnalysisResult = {
    fen,
    stockfish: null,
    maia: null,
    timestamp: Date.now(),
  }

  // Run both analyses in parallel
  const [stockfishEval, maiaEval] = await Promise.all([
    analyzePositionWithStockfish(fen, engines, options),
    analyzePositionWithMaia(fen, engines, options),
  ])

  result.stockfish = stockfishEval
  result.maia = maiaEval

  // Cache the result
  cache?.set(fen, result)

  return result
}

/**
 * Analyzes multiple positions in batch
 */
export async function analyzeBatch(
  fens: string[],
  engines: AnalysisEngines,
  options: AnalysisOptions = {},
  cache?: Map<string, AnalysisResult>,
  onProgress?: (completed: number, total: number) => void,
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = []
  let completed = 0

  for (const fen of fens) {
    const result = await analyzePosition(fen, engines, options, cache)
    results.push(result)
    completed++
    onProgress?.(completed, fens.length)
  }

  return results
}

/**
 * Utility to extract Maia rating number from model string
 */
export function extractMaiaRating(maiaModel: string): number {
  const match = maiaModel.match(/(\d{4})/)
  return match ? parseInt(match[1]) : 1500
}

/**
 * Utility to get the current user's Maia model from localStorage
 */
export function getCurrentMaiaModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('currentMaiaModel')
    if (stored && MAIA_MODELS.includes(stored)) {
      return stored
    }
  }
  return MAIA_MODELS[0] // Default to first model
}

/**
 * Creates a properly wrapped engine interface that handles initialization states
 */
export function createEngineWrapper(
  stockfishEngine: {
    streamEvaluations: (
      fen: string,
      moveCount: number,
    ) => AsyncIterable<StockfishEvaluation> | null
    isReady: () => boolean
  },
  maiaEngine: {
    batchEvaluate: (
      fens: string[],
      ratingLevels: number[],
      thresholds: number[],
    ) => Promise<{ result: MaiaEvaluation[]; time: number }>
  },
  getStatus: () => string,
): AnalysisEngines {
  return {
    stockfish: stockfishEngine,
    maia: {
      get status() {
        return getStatus()
      },
      isReady: () => getStatus() === 'ready',
      batchEvaluate: async (
        fens: string[],
        ratingLevels: number[],
        thresholds: number[],
      ) => {
        // Wait for Maia to be ready with retry logic (similar to useEngineAnalysis)
        let retries = 0
        const maxRetries = 30 // 3 seconds with 100ms intervals

        while (retries < maxRetries && getStatus() !== 'ready') {
          await new Promise((resolve) => setTimeout(resolve, 100))
          retries++
        }

        if (getStatus() !== 'ready') {
          throw new Error(
            `Maia engine not ready after waiting. Current status: ${getStatus()}`,
          )
        }

        try {
          return await maiaEngine.batchEvaluate(fens, ratingLevels, thresholds)
        } catch (error) {
          console.error('Maia batchEvaluate failed:', error)
          throw new Error(
            `Maia analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          )
        }
      },
    },
  }
}
