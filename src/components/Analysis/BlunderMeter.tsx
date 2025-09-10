import React, { useContext, useState, useEffect } from 'react'
import { motion } from 'framer-motion'

import {
  BlunderMeterResult,
  ColorSanMapping,
  StockfishEvaluation,
  MaiaEvaluation,
} from 'src/types'
import { WindowSizeContext } from 'src/contexts'
import { MoveTooltip } from './MoveTooltip'

interface Props {
  data: BlunderMeterResult
  colorSanMapping: ColorSanMapping
  hover: (move?: string) => void
  makeMove: (move: string) => void
  showContainer?: boolean
  moveEvaluation?: {
    maia?: MaiaEvaluation
    stockfish?: StockfishEvaluation
  } | null
}

export const BlunderMeter: React.FC<Props> = ({
  data,
  hover,
  makeMove,
  colorSanMapping,
  showContainer = true,
  moveEvaluation,
}: Props) => {
  const { isMobile } = useContext(WindowSizeContext)

  return isMobile ? (
    <MobileBlunderMeter
      data={data}
      hover={hover}
      makeMove={makeMove}
      colorSanMapping={colorSanMapping}
      showContainer={showContainer}
      moveEvaluation={moveEvaluation}
    />
  ) : (
    <DesktopBlunderMeter
      data={data}
      hover={hover}
      makeMove={makeMove}
      colorSanMapping={colorSanMapping}
      showContainer={showContainer}
      moveEvaluation={moveEvaluation}
    />
  )
}

const DesktopBlunderMeter: React.FC<Props> = ({
  data,
  hover,
  makeMove,
  colorSanMapping,
  showContainer = true,
  moveEvaluation,
}: Props) => {
  return (
    <div
      id="analysis-blunder-meter"
      className={`flex h-64 max-h-full w-full flex-col gap-2 overflow-hidden rounded-md ${showContainer ? 'border border-glassBorder bg-glass p-3 backdrop-blur-md md:w-auto md:min-w-[40%] md:max-w-[40%]' : ''} md:h-full`}
    >
      <p className="text-sm text-primary xl:text-base">Blunder Meter</p>
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex h-full w-full select-none flex-col overflow-hidden rounded">
          <Meter
            hover={hover}
            makeMove={makeMove}
            title="Best Moves"
            textColor="text-[#1a9850]"
            moves={data.goodMoves.moves}
            bgColor="bg-[#1a9850] rounded-t"
            probability={data.goodMoves.probability}
            colorSanMapping={colorSanMapping}
            moveEvaluation={moveEvaluation}
          />
          <Meter
            hover={hover}
            title="OK Moves"
            makeMove={makeMove}
            moves={data.okMoves.moves}
            bgColor="bg-[#fee08b]"
            textColor="text-[#fee08b]"
            probability={data.okMoves.probability}
            colorSanMapping={colorSanMapping}
            moveEvaluation={moveEvaluation}
          />
          <Meter
            hover={hover}
            title="Blunders"
            makeMove={makeMove}
            textColor="text-[#d73027]"
            bgColor="bg-[#d73027] rounded-b"
            moves={data.blunderMoves.moves}
            probability={data.blunderMoves.probability}
            colorSanMapping={colorSanMapping}
            moveEvaluation={moveEvaluation}
          />
        </div>
      </div>
    </div>
  )
}

const MobileBlunderMeter: React.FC<Props> = ({
  data,
  hover,
  makeMove,
  colorSanMapping,
  showContainer,
  moveEvaluation,
}: Props) => {
  return (
    <div
      id="analysis-blunder-meter"
      className={`flex w-full flex-col gap-2 overflow-hidden rounded-md ${showContainer ? 'border border-glassBorder bg-glass p-3 backdrop-blur-md' : ''}`}
    >
      <p className="text-base text-primary">Blunder Meter</p>
      <div className="flex w-full flex-col gap-1">
        <div className="flex w-full flex-row overflow-hidden">
          <div className="flex w-full select-none flex-row overflow-hidden rounded">
            <HorizontalMeter
              hover={hover}
              makeMove={makeMove}
              title="Best Moves"
              textColor="text-[#1a9850]"
              moves={data.goodMoves.moves}
              bgColor="bg-[#1a9850] rounded-l"
              probability={data.goodMoves.probability}
              colorSanMapping={colorSanMapping}
            />
            <HorizontalMeter
              hover={hover}
              title="OK Moves"
              makeMove={makeMove}
              moves={data.okMoves.moves}
              bgColor="bg-[#fee08b]"
              textColor="text-[#fee08b]"
              probability={data.okMoves.probability}
              colorSanMapping={colorSanMapping}
            />
            <HorizontalMeter
              hover={hover}
              title="Blunders"
              makeMove={makeMove}
              textColor="text-[#d73027]"
              bgColor="bg-[#d73027] rounded-r"
              moves={data.blunderMoves.moves}
              probability={data.blunderMoves.probability}
              colorSanMapping={colorSanMapping}
            />
          </div>
        </div>
        <div className="grid w-full grid-cols-3 gap-2">
          <MovesList
            title="Best Moves"
            textColor="text-[#1a9850]"
            moves={data.goodMoves.moves}
            hover={hover}
            makeMove={makeMove}
            colorSanMapping={colorSanMapping}
            moveEvaluation={moveEvaluation}
          />
          <MovesList
            title="OK Moves"
            textColor="text-[#fee08b]"
            moves={data.okMoves.moves}
            hover={hover}
            makeMove={makeMove}
            colorSanMapping={colorSanMapping}
            moveEvaluation={moveEvaluation}
          />
          <MovesList
            title="Blunders"
            textColor="text-[#d73027]"
            moves={data.blunderMoves.moves}
            hover={hover}
            makeMove={makeMove}
            colorSanMapping={colorSanMapping}
            moveEvaluation={moveEvaluation}
          />
        </div>
      </div>
    </div>
  )
}

function MovesList({
  title,
  textColor,
  moves,
  hover,
  makeMove,
  colorSanMapping,
  moveEvaluation,
}: {
  title: string
  textColor: string
  moves: { move: string; probability: number }[]
  hover: (move?: string) => void
  makeMove: (move: string) => void
  colorSanMapping: ColorSanMapping
  moveEvaluation?: {
    maia?: MaiaEvaluation
    stockfish?: StockfishEvaluation
  } | null
}) {
  const { isMobile } = useContext(WindowSizeContext)
  const [tooltipData, setTooltipData] = useState<{
    move: string
    position: { x: number; y: number }
  } | null>(null)
  const [mobileTooltipMove, setMobileTooltipMove] = useState<string | null>(
    null,
  )

  // Clear tooltip when position changes (indicated by colorSanMapping change)
  useEffect(() => {
    setTooltipData(null)
    setMobileTooltipMove(null)
  }, [colorSanMapping])

  const filteredMoves = () => {
    return moves.slice(0, 6).filter((move) => move.probability >= 8)
  }

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
        // Second click on same move - make the move
        makeMove(move)
        setMobileTooltipMove(null)
        setTooltipData(null)
      } else {
        // First click - show tooltip
        hover(move)
        setMobileTooltipMove(move)
        setTooltipData({
          move,
          position: { x: event.clientX, y: event.clientY },
        })
      }
    } else {
      // Desktop - make move immediately
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
    <div className="flex flex-col">
      <p className={`text-sm font-medium ${textColor}`}>{title}</p>
      <div className="flex w-full flex-col overflow-hidden text-xs text-secondary">
        {filteredMoves().map((move) => (
          <button
            key={move.move}
            className="text-left hover:underline"
            onMouseLeave={handleMouseLeave}
            onMouseEnter={(e) => handleMouseEnter(move.move, e)}
            onClick={(e) => handleClick(move.move, e)}
          >
            {colorSanMapping[move.move]?.san || move.move} (
            {Math.round(move.probability)}%)
          </button>
        ))}
      </div>

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
            moveEvaluation.stockfish?.cp_relative_vec?.[tooltipData.move]
          }
          position={tooltipData.position}
          onClickMove={isMobile ? handleTooltipClick : undefined}
        />
      )}
    </div>
  )
}

function HorizontalMeter({
  moves,
  bgColor,
  title,
  hover,
  makeMove,
  textColor,
  probability,
  colorSanMapping,
}: {
  title: string
  textColor: string
  bgColor: string
  probability: number
  hover: (move?: string) => void
  makeMove: (move: string) => void
  colorSanMapping: ColorSanMapping
  moves: { move: string; probability: number }[]
}) {
  return (
    <motion.div
      className="flex h-6 min-w-8 flex-col items-center justify-start overflow-hidden"
      animate={{
        width: probability + '%',
        maxWidth: probability + '%',
      }}
    >
      <motion.div
        className={`flex h-full w-full flex-col items-center justify-center ${bgColor}`}
      >
        <motion.p className="text-xs font-bold text-black text-opacity-50">
          {Math.round(probability)}%
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

function Meter({
  moves,
  bgColor,
  title,
  hover,
  makeMove,
  textColor,
  probability,
  colorSanMapping,
  moveEvaluation,
}: {
  title: string
  textColor: string
  bgColor: string
  probability: number
  hover: (move?: string) => void
  makeMove: (move: string) => void
  colorSanMapping: ColorSanMapping
  moves: { move: string; probability: number }[]
  moveEvaluation?: {
    maia?: MaiaEvaluation
    stockfish?: StockfishEvaluation
  } | null
}) {
  const { isMobile } = useContext(WindowSizeContext)
  const [tooltipData, setTooltipData] = useState<{
    move: string
    position: { x: number; y: number }
  } | null>(null)
  const [mobileTooltipMove, setMobileTooltipMove] = useState<string | null>(
    null,
  )

  // Clear tooltip when position changes (indicated by colorSanMapping change)
  useEffect(() => {
    setTooltipData(null)
    setMobileTooltipMove(null)
  }, [colorSanMapping])

  const filteredMoves = () => {
    return moves.slice(0, 6).filter((move) => move.probability >= 8)
  }

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
        // Second click on same move - make the move
        makeMove(move)
        setMobileTooltipMove(null)
        setTooltipData(null)
      } else {
        // First click - show tooltip
        hover(move)
        setMobileTooltipMove(move)
        setTooltipData({
          move,
          position: { x: event.clientX, y: event.clientY },
        })
      }
    } else {
      // Desktop - make move immediately
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
    <motion.div
      className="flex min-h-6 w-full flex-row items-start justify-start gap-2 overflow-hidden"
      animate={{
        height: probability + '%',
        maxHeight: probability + '%',
        width: '100%',
      }}
    >
      <motion.div
        className={`flex h-full min-h-10 min-w-6 flex-col items-center justify-start py-1 xl:min-w-8 ${bgColor}`}
      >
        <motion.p className="text-xxs font-bold text-black text-opacity-50 xl:text-xs">
          {Math.round(probability)}%
        </motion.p>
      </motion.div>
      <div className="flex h-full w-full flex-col overflow-hidden">
        <p className={`text-xs font-medium xl:text-sm ${textColor}`}>{title}</p>
        <div className="grid w-full grid-cols-3 overflow-hidden overflow-ellipsis text-wrap text-xxs text-secondary xl:text-xs">
          {filteredMoves().map((move) => (
            <button
              key={move.move}
              className="text-left hover:underline"
              onMouseLeave={handleMouseLeave}
              onMouseEnter={(e) => handleMouseEnter(move.move, e)}
              onClick={(e) => handleClick(move.move, e)}
            >
              {colorSanMapping[move.move]?.san || move.move} (
              {Math.round(move.probability)}%){' '}
            </button>
          ))}
        </div>
      </div>

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
            moveEvaluation.stockfish?.cp_relative_vec?.[tooltipData.move]
          }
          position={tooltipData.position}
          onClickMove={isMobile ? handleTooltipClick : undefined}
        />
      )}
    </motion.div>
  )
}
