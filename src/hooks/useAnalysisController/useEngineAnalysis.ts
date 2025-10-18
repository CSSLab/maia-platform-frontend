import { Chess } from 'chess.ts'
import { fetchOpeningBookMoves } from 'src/api'
import { useEffect, useContext } from 'react'
import { MAIA_MODELS } from 'src/constants/common'
import { GameNode, MaiaEvaluation } from 'src/types'
import { MaiaEngineContext, StockfishEngineContext } from 'src/contexts'

export const useEngineAnalysis = (
  currentNode: GameNode | null,
  inProgressAnalyses: Set<string>,
  currentMaiaModel: string,
  setAnalysisState: React.Dispatch<React.SetStateAction<number>>,
  targetDepth = 18,
) => {
  const maia = useContext(MaiaEngineContext)
  const stockfish = useContext(StockfishEngineContext)

  async function inferenceMaiaModel(board: Chess): Promise<{
    [key: string]: MaiaEvaluation
  }> {
    if (!maia.maia) {
      throw new Error('Maia engine not initialized')
    }

    const { result } = await maia.maia.batchEvaluate(
      Array(9).fill(board.fen()),
      [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
      [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
    )

    const maiaEvaluations: { [key: string]: MaiaEvaluation } = {}
    MAIA_MODELS.forEach((model, index) => {
      maiaEvaluations[model] = result[index]
    })

    return maiaEvaluations
  }

  async function fetchOpeningBook(board: Chess) {
    const bookMoves = await fetchOpeningBookMoves(board.fen())

    return bookMoves
  }

  useEffect(() => {
    if (!currentNode) return

    const board = new Chess(currentNode.fen)
    const nodeFen = currentNode.fen

    const attemptMaiaAnalysis = async () => {
      if (
        !currentNode ||
        (currentNode.analysis.maia &&
          Object.keys(currentNode.analysis.maia).length > 0) ||
        inProgressAnalyses.has(nodeFen)
      )
        return

      // Add retry logic for Maia initialization
      let retries = 0
      const maxRetries = 30 // 3 seconds with 100ms intervals

      while (retries < maxRetries && maia.status !== 'ready') {
        await new Promise((resolve) => setTimeout(resolve, 100))
        retries++
      }

      if (maia.status !== 'ready') {
        console.warn('Maia not ready after waiting, skipping analysis')
        return
      }

      inProgressAnalyses.add(nodeFen)

      try {
        if (currentNode.moveNumber <= 5) {
          const [openingBookMoves, maiaEvaluations] = await Promise.all([
            fetchOpeningBook(board),
            inferenceMaiaModel(board),
          ])

          const analysis: { [key: string]: MaiaEvaluation } = {}
          for (const model of MAIA_MODELS) {
            const policySource = Object.keys(openingBookMoves[model] || {})
              .length
              ? openingBookMoves[model]
              : maiaEvaluations[model].policy

            const sortedPolicy = Object.entries(policySource).sort(
              ([, a], [, b]) => (b as number) - (a as number),
            )

            analysis[model] = {
              value: maiaEvaluations[model].value,
              policy: Object.fromEntries(
                sortedPolicy,
              ) as MaiaEvaluation['policy'],
            }
          }

          currentNode.addMaiaAnalysis(analysis, currentMaiaModel)
          setAnalysisState((state) => state + 1)
          return
        } else {
          const maiaEvaluations = await inferenceMaiaModel(board)
          currentNode.addMaiaAnalysis(maiaEvaluations, currentMaiaModel)
          setAnalysisState((state) => state + 1)
        }
      } finally {
        inProgressAnalyses.delete(nodeFen)
      }
    }

    // Delay Maia analysis to prevent rapid fire when moving quickly
    const timeoutId = setTimeout(() => {
      attemptMaiaAnalysis()
    }, 100)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [
    maia.status,
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
      currentNode.analysis.stockfish?.depth >= targetDepth
    )
      return

    let cancelled = false

    // Add retry logic for Stockfish initialization
    const attemptStockfishAnalysis = async () => {
      // Wait up to 3 seconds for Stockfish to be ready
      let retries = 0
      const maxRetries = 30 // 3 seconds with 100ms intervals

      while (retries < maxRetries && !stockfish.isReady() && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        retries++
      }

      if (cancelled || !stockfish.isReady()) {
        if (!cancelled) {
          console.warn('Stockfish not ready after waiting, skipping analysis')
        }
        return
      }

      const chess = new Chess(currentNode.fen)
      const evaluationStream = stockfish.streamEvaluations(
        chess.fen(),
        chess.moves().length,
        targetDepth,
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

    // Delay Stockfish analysis to prevent rapid fire when moving quickly
    const timeoutId = setTimeout(() => {
      if (cancelled) return
      attemptStockfishAnalysis()
    }, 100)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [currentNode, stockfish, currentMaiaModel, setAnalysisState, targetDepth])
}
