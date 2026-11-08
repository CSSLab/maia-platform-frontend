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
  /** A move answered (UCI), shown on the board while it's checked. */
  played?: string
  /** `played` was right: it stays, marked with a check. */
  solved?: boolean
}

// Where a square is on the board, in eighths from the top left.
const squareAt = (square: string, color: 'white' | 'black') => {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  return color === 'white'
    ? { left: file, top: 7 - rank }
    : { left: 7 - file, top: rank }
}

/** A position to find a move in, from the side to move. */
export const PracticeBoard = ({
  fen,
  color,
  active,
  onMove,
  shapes,
  resetKey,
  played,
  solved,
}: Props) => {
  const node = useMemo(() => {
    const tree = new GameTree(fen)
    if (!played) return tree.getRoot()
    return tree.addMoveToMainLine(played) ?? tree.getRoot()
  }, [fen, resetKey, played])
  const check = played && solved ? squareAt(played.slice(2, 4), color) : null

  const availableMoves = useMemo(() => {
    const moves = new Map<string, string[]>()
    if (!active) return moves
    for (const move of new Chess(fen).moves({ verbose: true })) {
      moves.set(move.from, [...(moves.get(move.from) ?? []), move.to])
    }
    return moves
  }, [fen, active])

  return (
    <div className="relative aspect-square w-full">
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
      {check && (
        <div
          className="pointer-events-none absolute z-[40] h-[12.5%] w-[12.5%]"
          style={{ left: `${check.left * 12.5}%`, top: `${check.top * 12.5}%` }}
          data-testid="practice-solved"
        >
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-md ring-2 ring-white/80">
            <span className="material-symbols-outlined !text-base font-bold text-white">
              check
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
