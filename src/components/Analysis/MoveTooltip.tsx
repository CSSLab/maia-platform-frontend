import React from 'react'
import { createPortal } from 'react-dom'
import { ColorSanMapping } from 'src/types'

interface MoveTooltipProps {
  move: string
  colorSanMapping: ColorSanMapping
  maiaProb?: number
  stockfishCp?: number
  stockfishWinrate?: number
  stockfishCpRelative?: number
  position?: { x: number; y: number }
  isVisible?: boolean
  onClickMove?: (move: string) => void
}

export const MoveTooltip: React.FC<MoveTooltipProps> = ({
  move,
  colorSanMapping,
  maiaProb,
  stockfishCp,
  stockfishWinrate,
  stockfishCpRelative,
  position,
  isVisible = true,
  onClickMove,
}) => {
  if (!isVisible || !position || typeof window === 'undefined') return null

  const san = colorSanMapping[move]?.san ?? move
  const color = colorSanMapping[move]?.color ?? '#fff'

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (onClickMove && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onClickMove(move)
    }
  }

  const tooltipContent = (
    <div
      className={`fixed z-50 flex w-auto min-w-[12rem] flex-col overflow-hidden rounded-md border border-white/10 text-white/90 ${onClickMove ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
      style={{
        left: position.x + 15,
        top: position.y - 10,
        transform:
          position.x > window.innerWidth - 250 ? 'translateX(-100%)' : 'none',
        background:
          'radial-gradient(ellipse 110% 90% at 20% 10%, rgba(239, 68, 68, 0.10) 0%, rgba(239, 68, 68, 0.06) 35%, transparent 75%), #171214',
      }}
      onClick={onClickMove ? () => onClickMove(move) : undefined}
      onKeyDown={onClickMove ? handleKeyDown : undefined}
      role={onClickMove ? 'button' : undefined}
      tabIndex={onClickMove ? 0 : undefined}
      aria-label={onClickMove ? `Make move ${san}` : undefined}
    >
      {/* Header */}
      <div className="flex w-full justify-between border-b border-white/10 bg-transparent px-3 py-1.5">
        <span style={{ color }} className="font-medium">
          {san}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col items-start justify-start gap-1 bg-transparent px-3 py-1.5 text-sm">
        {/* Maia Probability */}
        {maiaProb !== undefined && (
          <div className="flex w-full items-center justify-between gap-2 font-mono">
            <span className="font-medium text-human-2">Maia:</span>
            <span>{(Math.round(maiaProb * 1000) / 10).toFixed(1)}%</span>
          </div>
        )}

        {/* Stockfish Evaluation */}
        {stockfishCp !== undefined && (
          <div className="flex w-full items-center justify-between gap-2 font-mono">
            <span className="font-medium text-engine-2">SF Eval:</span>
            <span>
              {stockfishCp > 0 ? '+' : ''}
              {(stockfishCp / 100).toFixed(2)}
            </span>
          </div>
        )}

        {/* Stockfish Win Rate */}
        {stockfishWinrate !== undefined && (
          <div className="flex w-full items-center justify-between gap-2 font-mono">
            <span className="font-medium text-engine-2">SF Winrate:</span>
            <span>{(stockfishWinrate * 100).toFixed(1)}%</span>
          </div>
        )}

        {/* Stockfish CP Relative */}
        {stockfishCpRelative !== undefined && (
          <div className="flex w-full items-center justify-between gap-2 font-mono">
            <span className="font-medium text-engine-2">SF Eval Loss:</span>
            <span>{(stockfishCpRelative / 100).toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(tooltipContent, document.body)
}
