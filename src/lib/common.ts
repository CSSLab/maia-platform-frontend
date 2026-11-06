import { Chess, PieceSymbol } from 'chess.ts'
import { GameTree, RawMove } from 'src/types'

const PROMOTION_PIECES: PieceSymbol[] = ['q', 'r', 'b', 'n']

/**
 * The backend's `last_move` is only [from, to], so a promotion's piece is
 * missing. Recover it from the SAN ("h8=R") or, failing that, from which
 * promotion produces the stored position.
 */
const inferPromotion = (
  previousFen: string,
  from: string,
  to: string,
  resultingFen: string,
  san?: string,
): string => {
  if (to[1] !== '8' && to[1] !== '1') return ''

  const fromSan = san?.match(/=([QRBN])/i)?.[1]
  if (fromSan) return fromSan.toLowerCase()

  const placement = (fen: string) => fen.split(' ')[0]
  for (const piece of PROMOTION_PIECES) {
    const chess = new Chess(previousFen)
    const result = chess.move({ from, to, promotion: piece })
    if (!result?.promotion) return ''
    if (placement(chess.fen()) === placement(resultingFen)) return piece
  }
  return ''
}

export function buildGameTreeFromMoveList(moves: any[], initialFen: string) {
  const tree = new GameTree(initialFen)
  let currentNode = tree.getRoot()

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]

    if (move.lastMove) {
      const [from, to, givenPromotion] = move.lastMove
      const promotion =
        givenPromotion ??
        (from && to
          ? inferPromotion(
              tree.getLastMainlineNode().fen,
              from,
              to,
              move.board,
              move.san,
            )
          : '')
      const uci = from && to ? `${from}${to}${promotion}` : ''

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
