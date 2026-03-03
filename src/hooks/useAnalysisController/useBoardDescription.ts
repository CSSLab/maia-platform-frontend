import { useMemo } from 'react'
import { MAIA_MODELS } from 'src/constants/common'
import { describePosition } from './useDescriptionGenerator'
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
    const selectedMaiaEvaluation = moveEvaluation.maia

    const stockfishEvals = moveEvaluation.stockfish.cp_vec
    const maiaEvals: Record<string, number[]> = {}
    const allMaiaAnalysis = currentNode.analysis.maia || {}

    Object.keys(selectedMaiaEvaluation.policy).forEach((move) => {
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

    let selectedMaiaIndex = MAIA_MODELS.findIndex((model) => {
      const modelAnalysis = allMaiaAnalysis[model]
      return (
        modelAnalysis === selectedMaiaEvaluation ||
        modelAnalysis?.policy === selectedMaiaEvaluation.policy
      )
    })

    if (selectedMaiaIndex < 0) {
      let bestIndex = -1
      let bestScore = -Infinity
      MAIA_MODELS.forEach((model, index) => {
        const policy = allMaiaAnalysis[model]?.policy
        if (!policy) return

        const sharedMoves = Object.keys(selectedMaiaEvaluation.policy).filter(
          (move) => policy[move] !== undefined,
        )
        if (!sharedMoves.length) return

        const score = sharedMoves.reduce(
          (acc, move) =>
            acc -
            Math.abs((policy[move] ?? 0) - selectedMaiaEvaluation.policy[move]),
          0,
        )
        if (score > bestScore) {
          bestScore = score
          bestIndex = index
        }
      })
      selectedMaiaIndex = bestIndex
    }

    const description = describePosition(
      fen,
      stockfishEvals,
      maiaEvals,
      whiteToMove,
      selectedMaiaEvaluation.policy,
      selectedMaiaIndex >= 0 ? selectedMaiaIndex : undefined,
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
