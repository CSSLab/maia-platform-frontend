import { Chess } from 'chess.ts'
import { cpToWinrate } from 'src/lib'
import { MoveTooltip } from './MoveTooltip'
import { InteractiveDescription } from './InteractiveDescription'
import { useState, useEffect, useRef, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MaiaEvaluation,
  StockfishEvaluation,
  ColorSanMapping,
  GameNode,
} from 'src/types'
import { MAIA_MODELS } from 'src/constants/common'
import { WindowSizeContext } from 'src/contexts'

type DescriptionSegment =
  | { type: 'text'; content: string }
  | { type: 'move'; san: string; uci: string }

interface Props {
  currentMaiaModel: string
  setCurrentMaiaModel: (model: string) => void
  moveEvaluation: {
    maia?: MaiaEvaluation
    stockfish?: StockfishEvaluation
  }
  colorSanMapping: ColorSanMapping
  recommendations: {
    maia?: { move: string; prob: number }[]
    stockfish?: {
      move: string
      cp: number
      winrate?: number
      cp_relative?: number
    }[]
    isBlackTurn?: boolean
  }
  hover: (move?: string) => void
  makeMove: (move: string) => void
  boardDescription: { segments: DescriptionSegment[] }
  currentNode?: GameNode
  isHomePage?: boolean
}

export const Highlight: React.FC<Props> = ({
  hover,
  makeMove,
  moveEvaluation,
  colorSanMapping,
  recommendations,
  currentMaiaModel,
  setCurrentMaiaModel,
  boardDescription,
  currentNode,
  isHomePage = false,
}: Props) => {
  const { isMobile } = useContext(WindowSizeContext)

  // Check if current position is checkmate (independent of Stockfish analysis)
  const isCurrentPositionCheckmate = currentNode
    ? (() => {
        try {
          const chess = new Chess(currentNode.fen)
          return chess.inCheckmate()
        } catch {
          return false
        }
      })()
    : false

  // Helper function to format evaluation values
  const formatEvaluation = (
    cp: number,
    mateIn?: number,
    isCheckmate?: boolean,
  ) => {
    if (isCheckmate) {
      return 'Checkmate'
    }
    if (mateIn !== undefined) {
      // Show +M2/-M2 to indicate whose mate it is
      const sign = mateIn > 0 ? '+' : '-'
      return `${sign}M${Math.abs(mateIn)}`
    }
    return `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(2)}`
  }
  const [tooltipData, setTooltipData] = useState<{
    move: string
    maiaProb?: number
    stockfishCp?: number
    stockfishWinrate?: number
    stockfishCpRelative?: number
    position: { x: number; y: number }
  } | null>(null)
  const [mobileTooltipMove, setMobileTooltipMove] = useState<string | null>(
    null,
  )

  // Clear tooltip when position changes (indicated by currentNode change)
  useEffect(() => {
    setTooltipData(null)
    setMobileTooltipMove(null)
  }, [currentNode])

  const findMatchingMove = (move: string, source: 'maia' | 'stockfish') => {
    if (source === 'maia') {
      return recommendations.stockfish?.find((rec) => rec.move === move)
    } else {
      return recommendations.maia?.find((rec) => rec.move === move)
    }
  }

  const handleMouseEnter = (
    move: string,
    source: 'maia' | 'stockfish',
    event: React.MouseEvent,
    prob?: number,
    cp?: number,
    winrate?: number,
    cpRelative?: number,
  ) => {
    if (!isMobile) {
      hover(move)

      const matchingMove = findMatchingMove(move, source)
      const maiaProb =
        source === 'maia' ? prob : (matchingMove as { prob: number })?.prob
      const stockfishCp =
        source === 'stockfish' ? cp : (matchingMove as { cp: number })?.cp
      const stockfishWinrate =
        source === 'stockfish'
          ? winrate
          : (matchingMove as { winrate?: number })?.winrate
      const stockfishCpRelative =
        source === 'stockfish'
          ? cpRelative
          : (matchingMove as { cp_relative?: number })?.cp_relative

      // Get Stockfish cp relative from the move evaluation if not provided
      const actualStockfishCpRelative =
        stockfishCpRelative !== undefined
          ? stockfishCpRelative
          : moveEvaluation?.stockfish?.cp_relative_vec?.[move]

      setTooltipData({
        move,
        maiaProb,
        stockfishCp,
        stockfishWinrate,
        stockfishCpRelative: actualStockfishCpRelative,
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

  const handleClick = (
    move: string,
    source: 'maia' | 'stockfish',
    event: React.MouseEvent,
    prob?: number,
    cp?: number,
    winrate?: number,
    cpRelative?: number,
  ) => {
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

        const matchingMove = findMatchingMove(move, source)
        const maiaProb =
          source === 'maia' ? prob : (matchingMove as { prob: number })?.prob
        const stockfishCp =
          source === 'stockfish' ? cp : (matchingMove as { cp: number })?.cp
        const stockfishWinrate =
          source === 'stockfish'
            ? winrate
            : (matchingMove as { winrate?: number })?.winrate
        const stockfishCpRelative =
          source === 'stockfish'
            ? cpRelative
            : (matchingMove as { cp_relative?: number })?.cp_relative

        // Get Stockfish cp relative from the move evaluation if not provided
        const actualStockfishCpRelative =
          stockfishCpRelative !== undefined
            ? stockfishCpRelative
            : moveEvaluation?.stockfish?.cp_relative_vec?.[move]

        setTooltipData({
          move,
          maiaProb,
          stockfishCp,
          stockfishWinrate,
          stockfishCpRelative: actualStockfishCpRelative,
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

  // Track whether description exists (not its content)
  const hasDescriptionRef = useRef(boardDescription?.segments?.length > 0)
  const [animationKey, setAnimationKey] = useState(0)

  // Calculate if we're in the first 10 ply
  const isInFirst10Ply = currentNode
    ? (() => {
        const moveNumber = currentNode.moveNumber
        const turn = currentNode.turn
        const plyFromStart = (moveNumber - 1) * 2 + (turn === 'b' ? 1 : 0)
        return plyFromStart < 10
      })()
    : false

  // Get the appropriate win rate
  const getWhiteWinRate = () => {
    // Handle checkmate positions (check this first, even without Stockfish analysis)
    if (isCurrentPositionCheckmate) {
      // If it's checkmate, the current player has lost
      const currentTurn = currentNode?.turn || 'w'
      return currentTurn === 'w' ? '0.0%' : '100.0%'
    }

    // Handle checkmate positions detected by Stockfish
    if (moveEvaluation?.stockfish?.is_checkmate) {
      // If it's checkmate, the current player has lost
      const currentTurn = currentNode?.turn || 'w'
      return currentTurn === 'w' ? '0.0%' : '100.0%'
    }

    // Handle mate in X positions
    if (moveEvaluation?.stockfish?.mate_in !== undefined) {
      const mateIn = moveEvaluation.stockfish.mate_in
      return mateIn > 0 ? '100.0%' : '0.0%'
    }

    if (
      isInFirst10Ply &&
      moveEvaluation?.stockfish?.model_optimal_cp !== undefined
    ) {
      // Use Stockfish win rate for first 10 ply
      const stockfishWinRate = cpToWinrate(
        moveEvaluation.stockfish.model_optimal_cp,
      )
      return `${Math.round(stockfishWinRate * 1000) / 10}%`
    } else if (moveEvaluation?.maia) {
      // Use Maia win rate for later positions
      return `${Math.round(moveEvaluation.maia.value * 1000) / 10}%`
    }
    return '...'
  }

  useEffect(() => {
    const descriptionNowExists = boardDescription?.segments?.length > 0
    // Only trigger animation when presence changes (exists vs doesn't exist)
    if (hasDescriptionRef.current !== descriptionNowExists) {
      hasDescriptionRef.current = descriptionNowExists
      setAnimationKey((prev) => prev + 1)
    }
  }, [boardDescription?.segments?.length])

  return (
    <div
      id="analysis-highlight"
      className="flex h-full w-full flex-col border-white/10 bg-transparent"
    >
      <div className="grid grid-cols-2 border-b border-white/10">
        <div className="flex flex-col items-center justify-start gap-0.5 border-r border-white/10 xl:gap-1">
          <div className="relative flex w-full flex-col border-b border-white/5">
            {isHomePage ? (
              <div className="py-2 text-center text-sm font-semibold text-human-1 md:text-xxs lg:text-xs">
                Maia {currentMaiaModel.slice(-4)}
              </div>
            ) : (
              <>
                <select
                  value={currentMaiaModel}
                  onChange={(e) => setCurrentMaiaModel(e.target.value)}
                  className="cursor-pointer appearance-none bg-transparent py-2 text-center text-base font-semibold text-human-1 outline-none transition-colors duration-200 hover:text-human-1/80 md:text-xxs lg:text-xs"
                >
                  {MAIA_MODELS.map((model) => (
                    <option
                      value={model}
                      key={model}
                      className="bg-transparent text-human-1"
                    >
                      Maia {model.slice(-4)}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-sm text-human-1/60">
                  keyboard_arrow_down
                </span>
              </>
            )}
          </div>

          <div className="flex w-full flex-row items-center justify-between border-b border-white/5 px-2 py-1 md:flex-col md:items-center md:justify-start md:py-0.5 lg:py-1">
            <p className="whitespace-nowrap text-base font-semibold text-human-2 md:text-xxs lg:text-xs">
              White Win %
            </p>
            <p className="text-base font-bold text-human-1 md:text-sm lg:text-lg">
              {getWhiteWinRate()}
            </p>
          </div>

          <div className="flex w-full flex-col items-start justify-center px-2 py-1.5 md:items-center xl:py-2">
            <p className="mb-1 whitespace-nowrap text-base font-semibold text-human-2 md:text-xxs lg:text-xs">
              Human Moves
            </p>
            <div className="flex w-full cursor-pointer items-center justify-between">
              <p className="text-left font-mono text-sm text-secondary/50 md:text-xxs">
                move
              </p>
              <p className="text-right font-mono text-sm text-secondary/50 md:text-xxs">
                prob
              </p>
            </div>
            {recommendations.maia?.slice(0, 4).map(({ move, prob }, index) => {
              return (
                <button
                  key={index}
                  className="flex w-full cursor-pointer items-center justify-between hover:underline"
                  style={{
                    color: colorSanMapping[move]?.color ?? '#fff',
                  }}
                  onMouseLeave={handleMouseLeave}
                  onMouseEnter={(e) => handleMouseEnter(move, 'maia', e, prob)}
                  onClick={(e) => handleClick(move, 'maia', e, prob)}
                >
                  <p className="text-left font-mono text-sm md:text-xxs xl:text-xs">
                    {colorSanMapping[move]?.san ?? move}
                  </p>
                  <p className="text-right font-mono text-sm md:text-xxs xl:text-xs">
                    {(Math.round(prob * 1000) / 10).toFixed(1)}%
                  </p>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-col items-center justify-start gap-0.5 xl:gap-1">
          <div className="flex w-full flex-col border-b border-white/5 py-2">
            <p className="whitespace-nowrap text-center text-base font-semibold text-engine-1 md:text-xxs lg:text-xs">
              Stockfish 17
            </p>
          </div>

          <div className="flex w-full flex-row items-center justify-between border-b border-white/5 px-2 py-1 md:flex-col md:items-center md:justify-start md:py-0.5 lg:py-1">
            <p className="whitespace-nowrap text-base font-semibold text-engine-2 md:text-xxs lg:text-xs">
              SF Eval{' '}
              {moveEvaluation?.stockfish?.depth
                ? ` (d${moveEvaluation.stockfish?.depth})`
                : ''}
            </p>
            <p className="text-base font-bold text-engine-1 md:text-sm lg:text-lg">
              {isCurrentPositionCheckmate
                ? 'Checkmate'
                : moveEvaluation?.stockfish
                  ? formatEvaluation(
                      moveEvaluation.stockfish.model_optimal_cp,
                      moveEvaluation.stockfish.mate_in,
                      moveEvaluation.stockfish.is_checkmate,
                    )
                  : '...'}
            </p>
          </div>

          <div className="flex w-full flex-col items-start justify-center px-2 py-1.5 md:items-center xl:py-2">
            <p className="mb-1 whitespace-nowrap text-base font-semibold text-engine-2 md:text-xxs lg:text-xs">
              Engine Moves
            </p>
            <div className="flex w-full cursor-pointer items-center justify-between">
              <p className="text-left font-mono text-sm text-secondary/50 md:text-xxs">
                move
              </p>
              <p className="text-right font-mono text-sm text-secondary/50 md:text-xxs">
                eval
              </p>
            </div>
            {recommendations.stockfish
              ?.slice(0, 4)
              .map(({ move, cp, winrate, cp_relative }, index) => {
                return (
                  <button
                    key={index}
                    className="flex w-full cursor-pointer items-center justify-between hover:underline"
                    style={{
                      color: colorSanMapping[move]?.color ?? '#fff',
                    }}
                    onMouseLeave={handleMouseLeave}
                    onMouseEnter={(e) =>
                      handleMouseEnter(
                        move,
                        'stockfish',
                        e,
                        undefined,
                        cp,
                        winrate,
                        cp_relative,
                      )
                    }
                    onClick={(e) =>
                      handleClick(
                        move,
                        'stockfish',
                        e,
                        undefined,
                        cp,
                        winrate,
                        cp_relative,
                      )
                    }
                  >
                    <p className="text-left font-mono text-sm md:text-xxs xl:text-xs">
                      {colorSanMapping[move]?.san ?? move}
                    </p>
                    <p className="text-right font-mono text-sm md:text-xxs xl:text-xs">
                      {Math.abs(cp) >= 10000
                        ? `${cp > 0 ? '+' : '-'}M${Math.max(1, Math.floor(Math.abs(10000 - Math.abs(cp)) / 100) + 1)}`
                        : `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(2)}`}
                    </p>
                  </button>
                )
              })}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-start justify-start bg-transparent p-2 text-sm">
        <AnimatePresence mode="wait">
          {boardDescription?.segments?.length > 0 ? (
            <motion.div
              key={animationKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.075 }}
              className="w-full"
            >
              <InteractiveDescription
                description={boardDescription}
                colorSanMapping={colorSanMapping}
                moveEvaluation={moveEvaluation}
                hover={hover}
                makeMove={makeMove}
                isHomePage={isHomePage}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Tooltip */}
      {tooltipData && (
        <MoveTooltip
          move={tooltipData.move}
          colorSanMapping={colorSanMapping}
          maiaProb={tooltipData.maiaProb}
          stockfishCp={tooltipData.stockfishCp}
          stockfishWinrate={tooltipData.stockfishWinrate}
          stockfishCpRelative={tooltipData.stockfishCpRelative}
          position={tooltipData.position}
          onClickMove={isMobile ? handleTooltipClick : undefined}
        />
      )}
    </div>
  )
}
