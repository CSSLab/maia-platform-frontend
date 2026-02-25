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
  simplified?: boolean
  hideStockfishEvalSummary?: boolean
  hideWhiteWinRateSummary?: boolean
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
  simplified = false,
  hideStockfishEvalSummary = false,
  hideWhiteWinRateSummary = false,
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

  const currentTurn: 'w' | 'b' =
    currentNode?.turn || (recommendations.isBlackTurn ? 'b' : 'w')

  const formatMateDisplay = (mateValue: number) => {
    const deliveringColor =
      mateValue > 0 ? currentTurn : currentTurn === 'w' ? 'b' : 'w'
    const prefix = deliveringColor === 'w' ? '+' : '-'
    return `${prefix}M${Math.abs(mateValue)}`
  }

  const getStockfishEvalDisplay = () => {
    if (!moveEvaluation?.stockfish) {
      return '...'
    }

    const { stockfish } = moveEvaluation
    const isBlackTurn = currentTurn === 'b'

    if (stockfish.is_checkmate) {
      return 'Checkmate'
    }

    const mateEntries = Object.entries(stockfish.mate_vec ?? {})
    const positiveMates = mateEntries.filter(([, mate]) => mate > 0)

    if (positiveMates.length > 0) {
      const minMate = positiveMates.reduce(
        (min, [, mate]) => Math.min(min, mate),
        Infinity,
      )

      if (isFinite(minMate)) {
        return formatMateDisplay(minMate)
      }
    }

    const mateVec = stockfish.mate_vec ?? {}
    const cpEntries = Object.entries(stockfish.cp_vec)
    const nonMateEntries = cpEntries.filter(
      ([move]) => mateVec[move] === undefined,
    )
    const bestCp = nonMateEntries.reduce<number | null>((acc, [, cp]) => {
      if (acc === null) {
        return cp
      }
      return isBlackTurn ? Math.min(acc, cp) : Math.max(acc, cp)
    }, null)

    if (bestCp !== null) {
      return `${bestCp > 0 ? '+' : ''}${(bestCp / 100).toFixed(2)}`
    }

    const opponentMates = mateEntries.filter(([, mate]) => mate < 0)
    if (opponentMates.length > 0) {
      const maxMate = opponentMates.reduce(
        (max, [, mate]) => Math.max(max, Math.abs(mate)),
        0,
      )

      if (maxMate > 0) {
        return formatMateDisplay(-maxMate)
      }
    }

    const fallbackCp = cpEntries.reduce<number | null>((acc, [, cp]) => {
      if (acc === null) {
        return cp
      }
      return isBlackTurn ? Math.min(acc, cp) : Math.max(acc, cp)
    }, null)

    if (fallbackCp !== null) {
      return `${fallbackCp > 0 ? '+' : ''}${(fallbackCp / 100).toFixed(2)}`
    }

    return '...'
  }
  const [tooltipData, setTooltipData] = useState<{
    move: string
    maiaProb?: number
    stockfishCp?: number
    stockfishWinrate?: number
    stockfishCpRelative?: number
    stockfishMate?: number
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

      const stockfishMate = moveEvaluation?.stockfish?.mate_vec?.[move]

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
        stockfishMate,
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

        const stockfishMate = moveEvaluation?.stockfish?.mate_vec?.[move]

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
          stockfishMate,
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
  const maiaHeaderSelectRef = useRef<HTMLSelectElement | null>(null)

  // Calculate if we're in the first 10 ply
  const isInFirst10Ply = currentNode
    ? (() => {
        const moveNumber = currentNode.moveNumber
        const turn = currentNode.turn
        const plyFromStart = (moveNumber - 1) * 2 + (turn === 'b' ? 1 : 0)
        return plyFromStart < 10
      })()
    : false

  const getWhiteWinRate = () => {
    if (isCurrentPositionCheckmate) {
      const currentTurn = currentNode?.turn || 'w'
      return currentTurn === 'w' ? '0.0%' : '100.0%'
    }

    const stockfishEval = moveEvaluation?.stockfish

    if (stockfishEval?.is_checkmate) {
      const currentTurn = currentNode?.turn || 'w'
      return currentTurn === 'w' ? '0.0%' : '100.0%'
    }

    if (
      stockfishEval?.model_move &&
      stockfishEval.mate_vec &&
      stockfishEval.mate_vec[stockfishEval.model_move] !== undefined
    ) {
      const mateValue = stockfishEval.mate_vec[stockfishEval.model_move]
      const deliveringColor =
        mateValue > 0 ? currentTurn : currentTurn === 'w' ? 'b' : 'w'
      return deliveringColor === 'w' ? '100.0%' : '0.0%'
    }

    if (isInFirst10Ply && stockfishEval?.model_optimal_cp !== undefined) {
      const stockfishWinRate = cpToWinrate(stockfishEval.model_optimal_cp)
      return `${Math.round(stockfishWinRate * 1000) / 10}%`
    } else if (moveEvaluation?.maia) {
      return `${Math.round(moveEvaluation.maia.value * 1000) / 10}%`
    }
    return '...'
  }

  useEffect(() => {
    const descriptionNowExists = boardDescription?.segments?.length > 0
    if (hasDescriptionRef.current !== descriptionNowExists) {
      hasDescriptionRef.current = descriptionNowExists
      setAnimationKey((prev) => prev + 1)
    }
  }, [boardDescription?.segments?.length])

  const useCompactMobileColumnTitles = isMobile && !simplified
  const mobileMaiaColumnTitle = `Maia ${currentMaiaModel.slice(-4)}: Human Moves`
  const mobileStockfishColumnTitle = 'SF 17: Engine Moves'
  const openMaiaHeaderPicker = () => {
    const select = maiaHeaderSelectRef.current as
      | (HTMLSelectElement & { showPicker?: () => void })
      | null
    if (!select) return

    select.focus()
    if (select.showPicker) {
      try {
        select.showPicker()
        return
      } catch {
        // Fall back to click if showPicker is unavailable or rejected.
      }
    }
    select.click()
  }

  return (
    <div
      id="analysis-highlight"
      className="flex h-full w-full flex-col border-glass-border bg-transparent"
    >
      <div
        className={`grid grid-cols-2 border-b border-glass-border ${
          simplified ? 'grid-cols-1' : ''
        }`}
      >
        <div className="flex flex-col items-center justify-start gap-0.5 border-r border-glass-border xl:gap-1">
          <div className="relative flex w-full flex-col border-b border-white/5">
            {isHomePage ? (
              <div className="py-2 text-center text-sm font-semibold text-human-1 md:text-xxs lg:text-xs">
                {useCompactMobileColumnTitles
                  ? mobileMaiaColumnTitle
                  : `Maia ${currentMaiaModel.slice(-4)}`}
              </div>
            ) : (
              <>
                {useCompactMobileColumnTitles ? (
                  <div className="flex items-center justify-center py-2 pr-4 text-sm font-semibold text-human-1">
                    <select
                      ref={maiaHeaderSelectRef}
                      value={currentMaiaModel}
                      onChange={(e) => setCurrentMaiaModel(e.target.value)}
                      className="cursor-pointer appearance-none bg-transparent text-center outline-none transition-colors duration-200 hover:text-human-1/80"
                    >
                      {MAIA_MODELS.map((model) => (
                        <option
                          value={model}
                          key={model}
                          className="bg-transparent text-human-1"
                        >
                          {`Maia ${model.slice(-4)}`}
                        </option>
                      ))}
                    </select>
                    <span className="ml-0.5 whitespace-nowrap">
                      : Human Moves
                    </span>
                  </div>
                ) : (
                  <select
                    ref={maiaHeaderSelectRef}
                    value={currentMaiaModel}
                    onChange={(e) => setCurrentMaiaModel(e.target.value)}
                    className="cursor-pointer appearance-none bg-transparent py-2 text-center text-sm font-semibold text-human-1 outline-none transition-colors duration-200 hover:text-human-1/80 md:text-xxs lg:text-xs"
                  >
                    {MAIA_MODELS.map((model) => (
                      <option
                        value={model}
                        key={model}
                        className="bg-transparent text-human-1"
                      >
                        {`Maia ${model.slice(-4)}`}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="material-symbols-outlined absolute right-0.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center text-base leading-none text-human-1/65"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    openMaiaHeaderPicker()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openMaiaHeaderPicker()
                    }
                  }}
                  aria-label="Change Maia model"
                >
                  expand_more
                </button>
              </>
            )}
          </div>

          {!hideWhiteWinRateSummary && (
            <div className="flex w-full flex-row items-center justify-between border-b border-white/5 px-2 py-1 md:flex-col md:items-center md:justify-start md:py-0.5 lg:py-1">
              <p className="whitespace-nowrap text-sm font-semibold text-human-2 md:text-xxs lg:text-xs">
                White Win %
              </p>
              <p className="text-sm font-bold text-human-1 lg:text-lg">
                {getWhiteWinRate()}
              </p>
            </div>
          )}

          <div
            className={`flex w-full flex-col items-start justify-center md:items-center ${simplified ? 'p-3' : 'px-2 py-1.5 xl:py-2'}`}
          >
            {!useCompactMobileColumnTitles && (
              <p
                className={`mb-1 whitespace-nowrap text-sm font-semibold text-human-2 ${simplified ? 'text-sm' : 'md:text-xxs lg:text-xs'}`}
              >
                Human Moves
              </p>
            )}
            <div className="flex w-full cursor-pointer items-center justify-between">
              <p
                className={`text-left font-mono ${simplified ? 'text-xs' : 'text-sm md:text-xxs'} text-secondary/50`}
              >
                move
              </p>
              <p
                className={`text-right font-mono ${simplified ? 'text-xs' : 'text-sm md:text-xxs'} text-secondary/50`}
              >
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
                  <p
                    className={`text-left font-mono ${simplified ? 'text-sm' : 'text-sm md:text-xxs xl:text-xs'}`}
                  >
                    {colorSanMapping[move]?.san ?? move}
                  </p>
                  <p
                    className={`text-right font-mono ${simplified ? 'text-sm' : 'text-sm md:text-xxs xl:text-xs'}`}
                  >
                    {(Math.round(prob * 1000) / 10).toFixed(1)}%
                  </p>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-col items-center justify-start gap-0.5 xl:gap-1">
          <div className="flex w-full flex-col border-b border-white/5 py-2">
            <p className="whitespace-nowrap text-center text-sm font-semibold text-engine-1 md:text-xxs lg:text-xs">
              {useCompactMobileColumnTitles
                ? mobileStockfishColumnTitle
                : 'Stockfish 17'}
            </p>
          </div>

          {!hideStockfishEvalSummary && (
            <div className="flex w-full flex-row items-center justify-between border-b border-white/5 px-2 py-1 md:flex-col md:items-center md:justify-start md:py-0.5 lg:py-1">
              <p className="whitespace-nowrap text-sm font-semibold text-engine-2 md:text-xxs lg:text-xs">
                SF Eval{' '}
                {moveEvaluation?.stockfish?.depth
                  ? ` (d${moveEvaluation.stockfish?.depth})`
                  : ''}
              </p>
              <p className="text-sm font-bold text-engine-1 md:text-sm lg:text-lg">
                {isCurrentPositionCheckmate
                  ? 'Checkmate'
                  : getStockfishEvalDisplay()}
              </p>
            </div>
          )}

          <div
            className={`flex w-full flex-col items-start justify-center ${simplified ? 'p-3' : 'px-2 py-1.5 xl:py-2'} md:items-center`}
          >
            {!useCompactMobileColumnTitles && (
              <p
                className={`mb-1 whitespace-nowrap text-sm font-semibold text-engine-2 ${simplified ? 'text-sm' : 'md:text-xxs lg:text-xs'}`}
              >
                Engine Moves
              </p>
            )}
            <div className="flex w-full cursor-pointer items-center justify-between">
              <p
                className={`text-left font-mono text-secondary/50 ${simplified ? 'text-xs' : 'text-sm md:text-xxs'}`}
              >
                move
              </p>
              <p
                className={`text-right font-mono text-secondary/50 ${simplified ? 'text-xs' : 'text-sm md:text-xxs'}`}
              >
                eval
              </p>
            </div>
            {recommendations.stockfish
              ?.slice(0, 4)
              .map(({ move, cp, winrate, cp_relative }, index) => {
                const mateValue = moveEvaluation?.stockfish?.mate_vec?.[move]
                const moveEvalDisplay =
                  mateValue !== undefined
                    ? formatMateDisplay(mateValue)
                    : `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(2)}`
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
                    <p
                      className={`text-left font-mono ${simplified ? 'text-sm' : 'text-sm md:text-xxs xl:text-xs'}`}
                    >
                      {colorSanMapping[move]?.san ?? move}
                    </p>
                    <p
                      className={`text-right font-mono ${simplified ? 'text-sm' : 'text-sm md:text-xxs xl:text-xs'}`}
                    >
                      {moveEvalDisplay}
                    </p>
                  </button>
                )
              })}
          </div>
        </div>
      </div>
      <div
        className={`flex flex-col items-start justify-start bg-transparent text-sm ${simplified ? 'p-3' : 'p-2'}`}
      >
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
                simplified={simplified}
                playerToMove={currentTurn}
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
          stockfishMate={tooltipData.stockfishMate}
          playerToMove={currentTurn}
          position={tooltipData.position}
          onClickMove={isMobile ? handleTooltipClick : undefined}
        />
      )}
    </div>
  )
}
