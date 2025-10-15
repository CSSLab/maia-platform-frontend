import React, { useContext, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

import {
  BlunderMeterResult,
  ColorSanMapping,
  StockfishEvaluation,
  MaiaEvaluation,
} from 'src/types'
import { WindowSizeContext } from 'src/contexts'
import { MoveTooltip } from './MoveTooltip'

interface SimplifiedBlunderMeterProps {
  data: BlunderMeterResult
  colorSanMapping: ColorSanMapping
  hover: (move?: string) => void
  makeMove: (move: string) => void
  moveEvaluation?: {
    maia?: MaiaEvaluation
    stockfish?: StockfishEvaluation
  } | null
  playerToMove?: 'w' | 'b'
}

type CategoryKey = 'goodMoves' | 'okMoves' | 'blunderMoves'

const CATEGORY_CONFIG: Record<
  CategoryKey,
  {
    title: string
    bgColor: string
    textColor: string
  }
> = {
  goodMoves: {
    title: 'Best Moves',
    bgColor: 'bg-[#1a9850]',
    textColor: 'text-[#1a9850]',
  },
  okMoves: {
    title: 'OK Moves',
    bgColor: 'bg-[#fee08b]',
    textColor: 'text-[#fee08b]',
  },
  blunderMoves: {
    title: 'Blunders',
    bgColor: 'bg-[#d73027]',
    textColor: 'text-[#d73027]',
  },
}

const MIN_PROBABILITY_TO_SHOW_MOVE = 8
const MAX_MOVES_TO_SHOW = 6

export const SimplifiedBlunderMeter: React.FC<SimplifiedBlunderMeterProps> = ({
  data,
  hover,
  makeMove,
  colorSanMapping,
  moveEvaluation,
  playerToMove = 'w',
}) => {
  const categories = useMemo(
    () =>
      (['goodMoves', 'okMoves', 'blunderMoves'] as CategoryKey[]).map(
        (key) => ({
          key,
          ...CATEGORY_CONFIG[key],
          probability: Math.max(0, Math.min(100, data[key].probability)),
          moves: data[key].moves,
        }),
      ),
    [data],
  )

  const totalProbability = categories.reduce(
    (acc, category) => acc + category.probability,
    0,
  )

  return (
    <div className="flex h-full w-full flex-col gap-4 p-3">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary xl:text-base">
          Blunder Meter
        </p>
        <div className="flex h-4 w-full items-center overflow-hidden rounded-full border border-glass-border bg-white/5">
          {categories.map((category) => {
            const flexGrow =
              category.probability > 0 ? category.probability : 0.5
            const percentage = totalProbability
              ? Math.round((category.probability / totalProbability) * 100)
              : 0

            return (
              <motion.div
                key={category.key}
                className={`relative flex h-full items-center justify-center ${category.bgColor}`}
                animate={{ flexGrow }}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                style={{ flexBasis: 0 }}
              >
                {percentage > 8 && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-black/60">
                    {percentage}%
                  </span>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      <div className="flex w-full flex-col gap-4 md:gap-6">
        {categories.map((category) => (
          <SimplifiedBlunderMeterColumn
            key={category.key}
            title={category.title}
            textColor={category.textColor}
            probability={category.probability}
            moves={category.moves}
            hover={hover}
            makeMove={makeMove}
            colorSanMapping={colorSanMapping}
            moveEvaluation={moveEvaluation}
            playerToMove={playerToMove}
          />
        ))}
      </div>
    </div>
  )
}

interface SimplifiedBlunderMeterColumnProps {
  title: string
  textColor: string
  probability: number
  moves: { move: string; probability: number }[]
  hover: (move?: string) => void
  makeMove: (move: string) => void
  colorSanMapping: ColorSanMapping
  moveEvaluation?: {
    maia?: MaiaEvaluation
    stockfish?: StockfishEvaluation
  } | null
  playerToMove?: 'w' | 'b'
}

const SimplifiedBlunderMeterColumn: React.FC<
  SimplifiedBlunderMeterColumnProps
> = ({
  title,
  textColor,
  probability,
  moves,
  hover,
  makeMove,
  colorSanMapping,
  moveEvaluation,
  playerToMove = 'w',
}) => {
  const { isMobile } = useContext(WindowSizeContext)
  const [tooltipData, setTooltipData] = useState<{
    move: string
    position: { x: number; y: number }
  } | null>(null)
  const [mobileTooltipMove, setMobileTooltipMove] = useState<string | null>(
    null,
  )

  useEffect(() => {
    setTooltipData(null)
    setMobileTooltipMove(null)
  }, [colorSanMapping])

  const filteredMoves = useMemo(
    () =>
      moves
        .slice(0, MAX_MOVES_TO_SHOW)
        .filter((move) => move.probability >= MIN_PROBABILITY_TO_SHOW_MOVE),
    [moves],
  )

  const handleMouseEnter = (move: string, event: React.MouseEvent) => {
    if (!isMobile) {
      hover(move)
      setTooltipData({
        move,
        position: { x: event.clientX, y: event.clientY },
      })
    }
  }

  const handleMouseLeave = () => {
    if (!isMobile) {
      hover()
      setTooltipData(null)
    }
  }

  const handleClick = (move: string, event: React.MouseEvent) => {
    if (isMobile) {
      if (mobileTooltipMove === move) {
        makeMove(move)
        setMobileTooltipMove(null)
        setTooltipData(null)
      } else {
        hover(move)
        setMobileTooltipMove(move)
        setTooltipData({
          move,
          position: { x: event.clientX, y: event.clientY },
        })
      }
    } else {
      makeMove(move)
    }
  }

  const handleTooltipClick = (move: string) => {
    if (isMobile) {
      makeMove(move)
      setMobileTooltipMove(null)
      setTooltipData(null)
      hover()
    }
  }

  return (
    <div className="flex min-w-[140px] flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <p className={`text-sm font-semibold ${textColor}`}>{title}</p>
        <span className="text-sm text-white/70">
          {Math.round(probability)}%
        </span>
      </div>
      <div className="mt-1 flex flex-row flex-wrap gap-3 text-sm text-secondary">
        {filteredMoves.length ? (
          filteredMoves.map((move) => (
            <button
              key={move.move}
              className="text-left font-medium text-white/80 transition-colors hover:text-white"
              onMouseLeave={handleMouseLeave}
              onMouseEnter={(event) => handleMouseEnter(move.move, event)}
              onClick={(event) => handleClick(move.move, event)}
            >
              {colorSanMapping[move.move]?.san || move.move}{' '}
              <span className="text-white/60">
                ({Math.round(move.probability)}%)
              </span>
            </button>
          ))
        ) : (
          <span className="text-white/50">No moves yet</span>
        )}
      </div>

      {tooltipData && moveEvaluation && (
        <MoveTooltip
          move={tooltipData.move}
          colorSanMapping={colorSanMapping}
          maiaProb={moveEvaluation.maia?.policy?.[tooltipData.move]}
          stockfishCp={moveEvaluation.stockfish?.cp_vec?.[tooltipData.move]}
          stockfishWinrate={
            moveEvaluation.stockfish?.winrate_vec?.[tooltipData.move]
          }
          stockfishCpRelative={
            moveEvaluation.stockfish?.cp_relative_vec?.[tooltipData.move]
          }
          stockfishMate={moveEvaluation.stockfish?.mate_vec?.[tooltipData.move]}
          playerToMove={playerToMove}
          position={tooltipData.position}
          onClickMove={isMobile ? handleTooltipClick : undefined}
        />
      )}
    </div>
  )
}
