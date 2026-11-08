import { Chess } from 'chess.ts'
import type { DrawShape } from 'chessground/draw'
import type { Key } from 'chessground/types'
import { useMemo } from 'react'

import { GameBoard } from 'src/components/Board/GameBoard'
import { GameTree } from 'src/types'

interface Props {
  fen: string
  color: 'white' | 'black'
  /** Takes moves while true. */
  active: boolean
  onMove: (uci: string) => void
  shapes?: DrawShape[]
  /** Changing it puts the position back (after a wrong answer). */
  resetKey: number
}

/** A position to find a move in, from the side to move. */
export const PracticeBoard = ({
  fen,
  color,
  active,
  onMove,
  shapes,
  resetKey,
}: Props) => {
  const node = useMemo(() => new GameTree(fen).getRoot(), [fen, resetKey])

  const availableMoves = useMemo(() => {
    const moves = new Map<string, string[]>()
    if (!active) return moves
    for (const move of new Chess(fen).moves({ verbose: true })) {
      moves.set(move.from, [...(moves.get(move.from) ?? []), move.to])
    }
    return moves
  }, [fen, active])

  return (
    <div className="aspect-square w-full">
      <GameBoard
        key={`${fen}-${resetKey}`}
        game={{ id: `practice-${resetKey}`, tree: new GameTree(fen) }}
        currentNode={node}
        orientation={color}
        availableMoves={availableMoves}
        movableColor={color}
        shapes={shapes}
        onPlayerMakeMove={([from, to]) => {
          const chess = new Chess(fen)
          // A pawn reaching the last rank becomes a queen.
          const move =
            chess.move({ from: from as Key, to: to as Key, promotion: 'q' }) ??
            chess.move({ from: from as Key, to: to as Key })
          if (move) onMove(`${move.from}${move.to}${move.promotion ?? ''}`)
        }}
      />
    </div>
  )
}
