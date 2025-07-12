import { Chess } from 'chess.ts'
import { useEffect } from 'react'
import { getBookMoves } from 'src/api'
import { GameNode, MaiaEvaluation, StockfishEvaluation } from 'src/types'
import { MAIA_MODELS } from './constants'

type BatchEvaluateResult = {
  result: MaiaEvaluation[]
  time: number
}

type EngineHooks = {
  maia: {
    batchEvaluate: (
      fens: string[],
      ratingLevels: number[],
      thresholds: number[],
    ) => Promise<BatchEvaluateResult>
  }
  streamEvaluations: (
    fen: string,
    moveCount: number,
  ) => AsyncIterable<StockfishEvaluation> | null
  stopEvaluation: () => void
}

export const useEngineAnalysis = (
  currentNode: GameNode | null,
  inProgressAnalyses: Set<string>,
  maiaStatus: string,
  maia: { batchEvaluate: EngineHooks['maia']['batchEvaluate'] },
  streamEvaluations: EngineHooks['streamEvaluations'],
  stopEvaluation: EngineHooks['stopEvaluation'],
  isStockfishReady: () => boolean,
  currentMaiaModel: string,
  setAnalysisState: React.Dispatch<React.SetStateAction<number>>,
) => {
  async function analyze(board: Chess): Promise<{
    [key: string]: MaiaEvaluation
  }> {
    const { result } = await maia.batchEvaluate(
      Array(9).fill(board.fen()),
      [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
      [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
    )

    const maiaEval: { [key: string]: MaiaEvaluation } = {}
    MAIA_MODELS.forEach((model, index) => {
      maiaEval[model] = result[index]
    })

    return maiaEval
  }

  async function openingBook(board: Chess) {
    const bookMoves = await getBookMoves(board.fen())

    return bookMoves
  }

  useEffect(() => {
    if (!currentNode) return

    const board = new Chess(currentNode.fen)
    const nodeFen = currentNode.fen

    const attemptMaiaAnalysis = async () => {
      if (
        !currentNode ||
        currentNode.analysis.maia ||
        inProgressAnalyses.has(nodeFen)
      )
        return

      // Add retry logic for Maia initialization
      let retries = 0
      const maxRetries = 30 // 3 seconds with 100ms intervals

      while (retries < maxRetries && maiaStatus !== 'ready') {
        await new Promise((resolve) => setTimeout(resolve, 100))
        retries++
      }

      if (maiaStatus !== 'ready') {
        console.warn('Maia not ready after waiting, skipping analysis')
        return
      }

      inProgressAnalyses.add(nodeFen)

      try {
        if (currentNode.moveNumber <= 5) {
          const [bookMoves, maiaEval] = await Promise.all([
            openingBook(board),
            analyze(board),
          ])

          const analysis: { [key: string]: MaiaEvaluation } = {}
          for (const model of MAIA_MODELS) {
            const policySource = Object.keys(bookMoves[model] || {}).length
              ? bookMoves[model]
              : maiaEval[model].policy

            const sortedPolicy = Object.entries(policySource).sort(
              ([, a], [, b]) => (b as number) - (a as number),
            )

            analysis[model] = {
              value: maiaEval[model].value,
              policy: Object.fromEntries(
                sortedPolicy,
              ) as MaiaEvaluation['policy'],
            }
          }

          currentNode.addMaiaAnalysis(analysis, currentMaiaModel)
          setAnalysisState((state) => state + 1)
          return
        } else {
          const maiaEval = await analyze(board)
          currentNode.addMaiaAnalysis(maiaEval, currentMaiaModel)
          setAnalysisState((state) => state + 1)
        }
      } finally {
        inProgressAnalyses.delete(nodeFen)
      }
    }

    const timeoutId = setTimeout(() => {
      attemptMaiaAnalysis()
    }, 100)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [
    maiaStatus,
    currentNode,
    currentMaiaModel,
    inProgressAnalyses,
    maia,
    setAnalysisState,
  ])

  useEffect(() => {
    if (!currentNode) return
    if (
      currentNode.analysis.stockfish &&
      currentNode.analysis.stockfish?.depth >= 18
    )
      return

    let cancelled = false

    // Delay Stockfish analysis to prevent rapid fire when moving quickly
    const timeoutId = setTimeout(() => {
      if (cancelled) return
      attemptStockfishAnalysis()
    }, 100)

    // Add retry logic for Stockfish initialization
    const attemptStockfishAnalysis = async () => {
      // Wait up to 3 seconds for Stockfish to be ready
      let retries = 0
      const maxRetries = 30 // 3 seconds with 100ms intervals

      while (retries < maxRetries && !isStockfishReady() && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        retries++
      }

      if (cancelled || !isStockfishReady()) {
        if (!cancelled) {
          console.warn('Stockfish not ready after waiting, skipping analysis')
        }
        return
      }

      const chess = new Chess(currentNode.fen)
      const evaluationStream = streamEvaluations(
        chess.fen(),
        chess.moves().length,
      )

      if (evaluationStream && !cancelled) {
        const nodeForAnalysis = currentNode // Capture the node reference
        try {
          for await (const evaluation of evaluationStream) {
            if (
              cancelled ||
              !nodeForAnalysis ||
              nodeForAnalysis !== currentNode
            ) {
              break
            }
            nodeForAnalysis.addStockfishAnalysis(evaluation, currentMaiaModel)
            setAnalysisState((state) => state + 1)
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Stockfish evaluation error:', error)
          }
        }
      }
    }

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [
    currentNode,
    streamEvaluations,
    stopEvaluation,
    isStockfishReady,
    currentMaiaModel,
    setAnalysisState,
  ])
}
