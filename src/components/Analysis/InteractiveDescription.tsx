import React, { useState } from 'react'
import { MoveTooltip } from './MoveTooltip'
import { ColorSanMapping, MaiaEvaluation, StockfishEvaluation } from 'src/types'

type DescriptionSegment =
  | { type: 'text'; content: string }
  | { type: 'move'; san: string; uci: string }

interface Props {
  description: { segments: DescriptionSegment[] }
  colorSanMapping: ColorSanMapping
  moveEvaluation: {
    maia?: MaiaEvaluation
    stockfish?: StockfishEvaluation
  }
  hover: (move?: string) => void
  makeMove: (move: string) => void
}

export const InteractiveDescription: React.FC<Props> = ({
  description,
  colorSanMapping,
  moveEvaluation,
  hover,
  makeMove,
}) => {
  const [tooltipData, setTooltipData] = useState<{
    move: string
    position: { x: number; y: number }
  } | null>(null)

  const handleMouseEnter = (move: string, event: React.MouseEvent) => {
    hover(move)
    setTooltipData({
      move,
      position: { x: event.clientX, y: event.clientY },
    })
  }

  const handleMouseLeave = () => {
    hover()
    setTooltipData(null)
  }

  const renderSegments = () => {
    if (
      !description ||
      !description.segments ||
      !Array.isArray(description.segments)
    ) {
      return null
    }

    return description.segments.map((segment, index) => {
      if (!segment) {
        return null
      }

      if (segment.type === 'text') {
        return <span key={index}>{segment.content}</span>
      } else {
        return (
          <button
            key={index}
            className="cursor-pointer text-primary hover:underline"
            style={{
              color: colorSanMapping[segment.uci]?.color ?? '#fff',
            }}
            onMouseEnter={(e) => handleMouseEnter(segment.uci, e)}
            onMouseLeave={handleMouseLeave}
            onClick={() => makeMove(segment.uci)}
          >
            {segment.san}
          </button>
        )
      }
    })
  }

  return (
    <div className="w-full">
      <p className="w-full whitespace-normal break-words text-[11px] leading-tight text-secondary xl:leading-tight">
        {renderSegments()}
      </p>

      {/* Tooltip */}
      {tooltipData && moveEvaluation && (
        <MoveTooltip
          move={tooltipData.move}
          colorSanMapping={colorSanMapping}
          maiaProb={moveEvaluation.maia?.policy[tooltipData.move]}
          stockfishCp={moveEvaluation.stockfish?.cp_vec[tooltipData.move]}
          stockfishWinrate={
            moveEvaluation.stockfish?.winrate_vec?.[tooltipData.move]
          }
          stockfishCpRelative={
            moveEvaluation.stockfish?.cp_relative_vec[tooltipData.move]
          }
          position={tooltipData.position}
        />
      )}
    </div>
  )
}
