import { useMemo } from 'react'
import { MAIA_MODELS } from 'src/constants/common'
import { describePosition } from './useDescriptionGenerator'
import { ratingProbability } from './useMoveRecommendations'
import { GameNode, MaiaEvaluation, StockfishEvaluation } from 'src/types'

export const useBoardDescription = (
  currentNode: GameNode | null,
  moveEvaluation: {
    maia?: MaiaEvaluation
    stockfish?: StockfishEvaluation
  } | null,
) => {
  return useMemo(() => {
    if (
      !currentNode ||
      !moveEvaluation?.stockfish ||
      !moveEvaluation?.maia ||
      moveEvaluation.stockfish.depth < 12
    ) {
      return { segments: [] }
    }

    const fen = currentNode.fen
    const whiteToMove = currentNode.turn === 'w'

    const stockfishEvals = moveEvaluation.stockfish.cp_vec
    const maiaEvals: Record<string, number[]> = {}
    const allMaiaAnalysis = currentNode.analysis.maia || {}

    Object.keys(moveEvaluation.maia.policy).forEach((move) => {
      maiaEvals[move] = new Array(MAIA_MODELS.length).fill(0)
    })

    MAIA_MODELS.forEach((model, index) => {
      const modelAnalysis = allMaiaAnalysis[model]
      if (modelAnalysis?.policy) {
        Object.entries(modelAnalysis.policy).forEach(([move, probability]) => {
          if (!maiaEvals[move]) {
            maiaEvals[move] = new Array(MAIA_MODELS.length).fill(0)
          }
          maiaEvals[move][index] = probability
        })
      }
    })
    // Ratings Maia has not answered for (phones skip those between every 200
    // points) are interpolated, as in the moves-by-rating chart.
    MAIA_MODELS.forEach((model, index) => {
      if (allMaiaAnalysis[model]?.policy) return
      for (const move of Object.keys(maiaEvals)) {
        maiaEvals[move][index] =
          ratingProbability(allMaiaAnalysis, index, move) ?? 0
      }
    })

    const description = describePosition(
      fen,
      stockfishEvals,
      maiaEvals,
      whiteToMove,
    )
    return description
  }, [
    currentNode?.fen,
    currentNode?.analysis.stockfish?.depth,
    currentNode?.analysis.maia,
    moveEvaluation?.stockfish?.depth,
    moveEvaluation?.maia?.policy,
  ])
}
