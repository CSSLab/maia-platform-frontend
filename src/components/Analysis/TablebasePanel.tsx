import { useContext, useEffect, useState } from 'react'

import { WindowSizeContext } from 'src/contexts'
import {
  formatTablebaseMove,
  formatTablebaseSummary,
  tablebaseOutlook,
  TablebaseCategory,
  TablebaseResult,
} from 'src/lib/tablebase'

/** Enough to show the winning tries without crowding the panel. */
const MAX_MOVES_SHOWN = 4

const OUTLOOK_CLASSES = {
  good: 'text-green-400',
  neutral: 'text-primary/80',
  bad: 'text-red-400',
} as const

const outlookClass = (category: TablebaseCategory) =>
  OUTLOOK_CLASSES[tablebaseOutlook(category)]

interface Props {
  result: TablebaseResult
  hover: (move?: string) => void
  makeMove: (move: string) => void
  simplified?: boolean
}

/**
 * The tablebase's verdict on the current position and its best moves,
 * under the Maia and Stockfish columns. It sits beside Stockfish rather
 * than re-ranking or recolouring its moves: the move colours and the
 * mistake/blunder annotations across the page all come from Stockfish's
 * evals, and changing them in this one panel would make it disagree with the
 * move list and the blunder meter. With an exact answer one line below,
 * a reader can see when Stockfish's number is misleading.
 */
export const TablebasePanel: React.FC<Props> = ({
  result,
  hover,
  makeMove,
  simplified = false,
}) => {
  const { isMobile } = useContext(WindowSizeContext)
  // On phones a first tap shows the move's arrow and a second plays it, as
  // with the engine and Maia moves above.
  const [pendingMove, setPendingMove] = useState<string | null>(null)

  useEffect(() => {
    setPendingMove(null)
  }, [result.fen])

  const moves = result.moves.slice(0, MAX_MOVES_SHOWN)
  const textSize = simplified ? 'text-xs' : 'text-xs md:text-xxs xl:text-xs'

  return (
    <div
      className="flex w-full flex-col gap-1 border-b border-glass-border px-2 py-1.5"
      data-testid="tablebase-panel"
    >
      <div className={`flex items-center gap-1.5 ${textSize}`}>
        <span
          className="material-symbols-outlined !text-sm leading-none text-secondary"
          aria-hidden
        >
          database
        </span>
        <span className="font-semibold text-secondary">Tablebase</span>
        <span className={`font-bold ${outlookClass(result.category)}`}>
          {formatTablebaseSummary(result)}
        </span>
      </div>
      {moves.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {moves.map((move) => (
            <button
              key={move.uci}
              type="button"
              title={`${move.san}: ${formatTablebaseMove(move)} (tablebase)`}
              className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono ${textSize} transition-colors hover:bg-glass-stronger ${
                pendingMove === move.uci
                  ? 'border-white/40 bg-glass-stronger'
                  : 'border-glass-border bg-glass'
              }`}
              onMouseEnter={() => {
                if (!isMobile) hover(move.uci)
              }}
              onMouseLeave={() => {
                if (!isMobile) hover()
              }}
              onClick={() => {
                if (isMobile && pendingMove !== move.uci) {
                  setPendingMove(move.uci)
                  hover(move.uci)
                  return
                }
                setPendingMove(null)
                hover()
                makeMove(move.uci)
              }}
            >
              <span className="text-primary">{move.san}</span>
              <span className={outlookClass(move.category)}>
                {formatTablebaseMove(move)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
