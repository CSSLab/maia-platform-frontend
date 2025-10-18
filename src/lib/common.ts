import { GameTree, RawMove } from 'src/types'

export function buildGameTreeFromMoveList(moves: any[], initialFen: string) {
  const tree = new GameTree(initialFen)
  let currentNode = tree.getRoot()

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]

    if (move.lastMove) {
      const [from, to, promotion] = move.lastMove
      const uci = from && to ? `${from}${to}${promotion ?? ''}` : ''

      currentNode = tree
        .getLastMainlineNode()
        .addChild(move.board, uci, move.san || '', true)
    }
  }

  return tree
}

export function buildMovesListFromGameStates(
  gameStates: {
    fen: string
    last_move: [string, string]
    last_move_san: string
    check: boolean
    clock: number
    evaluations: {
      [prop: string]: number
    }
  }[],
): RawMove[] {
  const moves = gameStates.map((gameState) => {
    const { last_move: lastMove, fen, check, last_move_san: san } = gameState

    return {
      board: fen,
      lastMove,
      san,
      check,
    } as RawMove
  })

  return moves
}
