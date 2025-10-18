import { Chess } from 'chess.ts'
import { GameNode } from 'src/types'

export const getCurrentPlayer = (currentNode: GameNode): 'white' | 'black' => {
  if (!currentNode) return 'white'
  const chess = new Chess(currentNode.fen)
  return chess.turn() === 'w' ? 'white' : 'black'
}

export const getAvailableMovesArray = (movesMap: Map<string, string[]>) => {
  return Array.from(movesMap.entries()).flatMap(([from, tos]) =>
    tos.map((to) => ({ from, to })),
  )
}

export const requiresPromotion = (
  playedMove: [string, string],
  availableMoves: { from: string; to: string }[],
): boolean => {
  const matching = availableMoves.filter((m) => {
    return m.from === playedMove[0] && m.to === playedMove[1]
  })
  return matching.length > 1
}
