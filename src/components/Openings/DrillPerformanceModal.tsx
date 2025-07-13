import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Chess } from 'chess.ts'
import Chessground from '@react-chess/chessground'
import type { Key } from 'chessground/types'
import type { DrawShape, DrawBrushes } from 'chessground/draw'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
  Tooltip,
} from 'recharts'
import { ModalContainer } from '../Misc'
import { DrillPerformanceData, MoveAnalysis } from 'src/types/openings'
import { GameNode } from 'src/types'
import { cpToWinrate } from 'src/utils/stockfish'
import { MaiaRatingInsights } from './MaiaRatingInsights'
import { WindowSizeContext } from 'src/contexts'
import {
  ExcellentIcon,
  InaccuracyIcon,
  BlunderIcon,
  MoveClassificationIcon,
} from 'src/components/Common/MoveIcons'
import { MOVE_CLASSIFICATION_THRESHOLDS } from 'src/constants/moveClassification'

interface Props {
  performanceData: DrillPerformanceData
  onContinueAnalyzing: () => void
  onNextDrill: () => void
  isLastDrill: boolean
}

// Helper function to extract move number from FEN string
const getMoveNumberFromFen = (fen: string): number => {
  const fenParts = fen.split(' ')
  return parseInt(fenParts[5]) || 1 // 6th part is the full move number
}

// Helper function to determine if a move is white's or black's based on FEN
// Note: this tells us who is TO MOVE in this position, not who just moved
const isWhiteToMove = (fen: string): boolean => {
  const fenParts = fen.split(' ')
  return fenParts[1] === 'w' // 2nd part is active color
}

// Helper function to determine if a move was played by white or black
// This is the inverse of who is to move after the move
const isMoveByWhite = (fen: string): boolean => {
  return !isWhiteToMove(fen) // If white is to move, then black just moved
}

// Component for animated game replay
const AnimatedGameReplay: React.FC<{
  moveAnalyses: MoveAnalysis[]
  openingFen: string
  playerColor: 'white' | 'black'
  onMoveIndexChange?: (index: number) => void
  externalMoveIndex?: number
  onMoveClick?: (moveIndex: number) => void
}> = ({
  moveAnalyses,
  openingFen,
  playerColor,
  onMoveIndexChange,
  externalMoveIndex,
  onMoveClick,
}) => {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1)
  const [chess] = useState(() => new Chess(openingFen))
  const [currentFen, setCurrentFen] = useState(openingFen)
  const [currentMoveQuality, setCurrentMoveQuality] = useState<string | null>(
    null,
  )

  // Go to specific move
  const goToMove = useCallback(
    (moveIndex: number) => {
      chess.load(openingFen)
      setCurrentMoveIndex(moveIndex)
      onMoveIndexChange?.(moveIndex)

      for (let i = 0; i <= moveIndex && i < moveAnalyses.length; i++) {
        const move = moveAnalyses[i]
        try {
          chess.move(move.move, { sloppy: true })
        } catch (error) {
          console.error('Error making move:', move.move, error)
          break
        }
      }

      setCurrentFen(chess.fen())

      if (moveIndex >= 0 && moveIndex < moveAnalyses.length) {
        const currentMove = moveAnalyses[moveIndex]
        if (currentMove.isPlayerMove) {
          setCurrentMoveQuality(currentMove.classification)
        } else {
          setCurrentMoveQuality(null)
        }
      } else {
        setCurrentMoveQuality(null)
      }
    },
    [chess, openingFen, moveAnalyses, onMoveIndexChange],
  )

  // Respond to external move index changes (from chart hover)
  useEffect(() => {
    if (
      externalMoveIndex !== undefined &&
      externalMoveIndex !== currentMoveIndex
    ) {
      goToMove(externalMoveIndex)
    }
  }, [externalMoveIndex, currentMoveIndex, goToMove])

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-400'
      case 'inaccuracy':
        return 'text-yellow-400'
      case 'blunder':
        return 'text-red-400'
      default:
        return 'text-secondary'
    }
  }

  const getQualitySymbol = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return '!!'
      case 'inaccuracy':
        return '?!'
      case 'blunder':
        return '??'
      default:
        return '' // No symbol for normal/good moves
    }
  }

  // Helper function to get move classification (simplified for this component)
  const getSimpleClassification = (analysis: MoveAnalysis): string => {
    // For the modal, we'll use the classification from the analysis data directly
    // This maintains compatibility while the underlying system is unified
    return analysis.classification || ''
  }

  // Helper function to pair moves for display with proper chess notation
  const pairMoves = (moves: MoveAnalysis[]) => {
    const pairs: Array<{
      white?: MoveAnalysis & {
        index: number
        displayMoveNumber: number
        isWhiteMove: boolean
      }
      black?: MoveAnalysis & {
        index: number
        displayMoveNumber: number
        isWhiteMove: boolean
      }
      moveNumber: number
    }> = []

    if (moves.length === 0) return pairs

    let currentMoveNumber = getMoveNumberFromFen(moves[0].fen)
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i]
      const isWhite = isMoveByWhite(move.fen)
      // For white's move, increment move number
      if (isWhite) {
        currentMoveNumber = getMoveNumberFromFen(move.fen)
        let pair = pairs.find((p) => p.moveNumber === currentMoveNumber)
        if (!pair) {
          pair = { moveNumber: currentMoveNumber }
          pairs.push(pair)
        }
        pair.white = {
          ...move,
          index: i,
          displayMoveNumber: currentMoveNumber,
          isWhiteMove: true,
        }
      } else {
        // For black's move, use the same move number as the previous white move
        let pair = pairs.find((p) => p.moveNumber === currentMoveNumber)
        if (!pair) {
          pair = { moveNumber: currentMoveNumber }
          pairs.push(pair)
        }
        pair.black = {
          ...move,
          index: i,
          displayMoveNumber: currentMoveNumber,
          isWhiteMove: false,
        }
      }
    }
    // Sort pairs by move number to ensure proper chronological order
    return pairs.sort((a, b) => a.moveNumber - b.moveNumber)
  }

  // Get arrows for optimal moves from the current position (before next move is played)
  const getArrowsForCurrentMove = useCallback((): DrawShape[] => {
    // Show arrows for the position we're currently viewing
    // If we're at the start (currentMoveIndex = -1), show arrows for the opening position
    // If we're at move N, show arrows for what's optimal from the current position
    const positionIndex = currentMoveIndex + 1 // Next move to be analyzed

    if (positionIndex < 0 || positionIndex >= moveAnalyses.length) {
      return []
    }

    const arrows: DrawShape[] = []
    const nextMove = moveAnalyses[positionIndex]

    // Show arrows for any position where we have analysis data
    try {
      // Maia best move (red arrow - user requested red for Maia)
      if (nextMove.maiaBestMove && nextMove.maiaBestMove.length === 4) {
        arrows.push({
          brush: 'red',
          orig: nextMove.maiaBestMove.slice(0, 2) as Key,
          dest: nextMove.maiaBestMove.slice(2, 4) as Key,
        })
      }

      // Stockfish best move (blue arrow - user requested blue for Stockfish)
      if (
        nextMove.stockfishBestMove &&
        nextMove.stockfishBestMove.length === 4 &&
        nextMove.stockfishBestMove !== nextMove.maiaBestMove
      ) {
        arrows.push({
          brush: 'blue',
          orig: nextMove.stockfishBestMove.slice(0, 2) as Key,
          dest: nextMove.stockfishBestMove.slice(2, 4) as Key,
          modifiers: { lineWidth: 8 },
        })
      }
    } catch (error) {
      // Move parsing failed, skip arrows
      console.warn('Error creating arrows:', error)
    }

    return arrows
  }, [currentMoveIndex, moveAnalyses])

  return (
    <div className="flex h-full flex-col">
      {/* Game Replay Section with padding */}
      <div className="relative p-3">
        <div className="mb-3">
          <h3 className="text-lg font-semibold">Game Replay</h3>
          <p className="text-xs text-secondary">
            Watch your opening unfold with move quality indicators
          </p>
        </div>
        {/* Move Quality Display - Fixed position in top-right */}
        {currentMoveQuality && currentMoveQuality !== 'good' && (
          <div className="absolute right-4 top-4 z-10 flex rounded border border-white/20 bg-background-1/95 px-2 py-1 shadow-lg">
            <div
              className={`font-mono text-sm font-bold ${getQualityColor(currentMoveQuality)}`}
            >
              {getQualitySymbol(currentMoveQuality)}
            </div>
            <div className="ml-2 text-sm capitalize text-secondary">
              {currentMoveQuality}
            </div>
          </div>
        )}

        {/* Chess Board */}
        <div className="mx-auto aspect-square w-full max-w-[280px]">
          <Chessground
            contained
            config={{
              viewOnly: true,
              fen: currentFen,
              orientation: playerColor,
              coordinates: true,
              animation: { enabled: true, duration: 200 },
              drawable: {
                enabled: true,
                visible: true,
                defaultSnapToValidMove: false,
                autoShapes: getArrowsForCurrentMove(),
                brushes: {
                  red: {
                    key: 'red',
                    color: '#dc2626',
                    opacity: 0.8,
                    lineWidth: 8,
                  },
                  blue: {
                    key: 'blue',
                    color: '#2563eb',
                    opacity: 0.8,
                    lineWidth: 8,
                  },
                } as DrawBrushes,
              },
            }}
          />
        </div>
      </div>

      {/* Move History - No padding, fills remaining height */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-white/10">
        <div className="red-scrollbar flex-1 overflow-y-auto">
          <div className="grid auto-rows-min grid-cols-5 whitespace-nowrap rounded-none bg-background-1/60">
            {pairMoves(moveAnalyses).map((pair, index) => (
              <React.Fragment key={pair.moveNumber}>
                {/* Move number */}
                <span className="flex h-7 items-center justify-center bg-background-2 text-sm text-secondary">
                  {pair.moveNumber}
                </span>

                {/* White's move */}
                <div
                  role="button"
                  tabIndex={0}
                  className={`col-span-2 flex h-7 cursor-pointer items-center justify-between px-2 text-sm hover:bg-background-2 ${
                    externalMoveIndex === pair.white?.index
                      ? 'bg-human-4/20'
                      : ''
                  }`}
                  onClick={() => pair.white && onMoveClick?.(pair.white.index)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && pair.white) {
                      e.preventDefault()
                      onMoveClick?.(pair.white.index)
                    }
                  }}
                >
                  <span>{pair.white?.san || ''}</span>
                  <div className="flex items-center">
                    {pair.white &&
                      (() => {
                        const classification = getSimpleClassification(
                          pair.white,
                        )
                        const classificationObj = {
                          blunder: classification === 'blunder',
                          inaccuracy: classification === 'inaccuracy',
                          excellent: classification === 'excellent',
                          bestMove: false,
                        }
                        return (
                          <MoveClassificationIcon
                            classification={classificationObj}
                            size="small"
                          />
                        )
                      })()}
                  </div>
                </div>

                {/* Black's move */}
                <div
                  role="button"
                  tabIndex={0}
                  className={`col-span-2 flex h-7 cursor-pointer items-center justify-between px-2 text-sm hover:bg-background-2 ${
                    externalMoveIndex === pair.black?.index
                      ? 'bg-human-4/20'
                      : ''
                  }`}
                  onClick={() => pair.black && onMoveClick?.(pair.black.index)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && pair.black) {
                      e.preventDefault()
                      onMoveClick?.(pair.black.index)
                    }
                  }}
                >
                  <span>{pair.black?.san || ''}</span>
                  <div className="flex items-center">
                    {pair.black &&
                      (() => {
                        const classification = getSimpleClassification(
                          pair.black,
                        )
                        const classificationObj = {
                          blunder: classification === 'blunder',
                          inaccuracy: classification === 'inaccuracy',
                          excellent: classification === 'excellent',
                          bestMove: false,
                        }
                        return (
                          <MoveClassificationIcon
                            classification={classificationObj}
                            size="small"
                          />
                        )
                      })()}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Custom dot component for move quality indicators
const CustomDot: React.FC<{
  cx?: number
  cy?: number
  payload?: {
    isPlayerMove: boolean
    classification: string
    isCurrentMove: boolean
  }
  index?: number
}> = (props) => {
  const { cx, cy, payload, index } = props
  if (!payload) return null

  const isPlayerMove = payload.isPlayerMove
  const classification = payload.classification
  const isCurrentMove = payload.isCurrentMove

  // Only show indicators for notable moves (like MovesContainer.tsx)
  let color = '#9ca3af' // Default gray
  let radius = 3

  // Only highlight notable moves
  switch (classification) {
    case 'excellent':
      color = '#10b981' // Green
      radius = 5
      break
    case 'inaccuracy':
      color = '#eab308' // Yellow
      radius = 4
      break
    case 'blunder':
      color = '#ef4444' // Red
      radius = 5
      break
    default:
      // Normal/good moves get default appearance
      radius = 3
  }

  if (isCurrentMove) {
    radius = Math.max(radius + 2, 6)
  }

  const strokeColor = isCurrentMove
    ? '#ffffff'
    : classification === 'excellent' || classification === 'blunder'
      ? '#ffffff'
      : '#1f2937'
  const strokeWidth = isCurrentMove ? 2 : 0.5

  return (
    <Dot
      cx={cx}
      cy={cy}
      r={radius}
      fill={color}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
    />
  )
}

// Custom tooltip component
const CustomTooltip: React.FC<{
  active?: boolean
  payload?: Array<{
    payload: {
      san?: string
      evaluation: number
      classification?: string
      isPlayerMove: boolean
      moveNumber: number
      stockfishDepth?: number
    }
  }>
  label?: string
  moveAnalyses: MoveAnalysis[]
}> = ({ active, payload, label, moveAnalyses }) => {
  if (!active || !payload || !payload[0]) return null

  const data = payload[0].payload
  const moveNumber = data.moveNumber

  // Determine if this was a white or black move
  // We need to look at the corresponding move analysis to get the FEN
  const moveAnalysis = moveAnalyses.find((m) => m.san === data.san)
  const isWhiteMove = moveAnalysis ? isMoveByWhite(moveAnalysis.fen) : true
  const moveNotation = `${moveNumber}.`

  const formatEvaluation = (evaluation: number) => {
    if (Math.abs(evaluation) >= 1000) {
      return evaluation > 0 ? '+M' : '-M'
    }
    return evaluation > 0
      ? `+${(evaluation / 100).toFixed(1)}`
      : `${(evaluation / 100).toFixed(1)}`
  }

  return (
    <div className="rounded border border-white/20 bg-background-1/95 p-3 shadow-lg">
      <p className="text-sm font-medium text-primary">
        {data.san ? `${moveNotation} ${data.san}` : `${moveNotation}`}
      </p>
      <p className="text-sm text-secondary">
        Evaluation: {formatEvaluation(data.evaluation)}
        {data.stockfishDepth && (
          <span className="ml-2 text-xs text-secondary/70">
            (d{data.stockfishDepth})
          </span>
        )}
      </p>
      {data.classification &&
        ['excellent', 'inaccuracy', 'blunder'].includes(
          data.classification,
        ) && (
          <p
            className={`text-sm capitalize ${
              data.classification === 'excellent'
                ? 'text-green-400'
                : data.classification === 'blunder'
                  ? 'text-red-400'
                  : 'text-yellow-400'
            }`}
          >
            {data.classification} {data.isPlayerMove ? '(You)' : '(Maia)'}
          </p>
        )}
    </div>
  )
}

// Component for the evaluation chart using Recharts
const EvaluationChart: React.FC<{
  evaluationChart: DrillPerformanceData['evaluationChart']
  moveAnalyses: MoveAnalysis[]
  currentMoveIndex?: number
  onHoverMove?: (moveIndex: number) => void
  playerColor: 'white' | 'black'
  drill: DrillPerformanceData['drill']
}> = ({
  evaluationChart,
  moveAnalyses,
  currentMoveIndex = -1,
  onHoverMove,
  playerColor,
  drill,
}) => {
  if (evaluationChart.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded bg-background-2 p-3 text-secondary">
        <p>Evaluation chart unavailable</p>
      </div>
    )
  }

  // Helper function to get move classification (use analysis data for compatibility)
  const getChartClassification = (analysis: MoveAnalysis): string => {
    return analysis.classification || ''
  }

  // Generate move numbers for chartData - create pairs first then extract chart data
  const movePairs = (() => {
    const pairs: Array<{
      white?: MoveAnalysis & {
        index: number
        displayMoveNumber: number
        isWhiteMove: boolean
      }
      black?: MoveAnalysis & {
        index: number
        displayMoveNumber: number
        isWhiteMove: boolean
      }
      moveNumber: number
    }> = []

    if (moveAnalyses.length === 0) return pairs

    let currentMoveNumber = getMoveNumberFromFen(moveAnalyses[0].fen)
    for (let i = 0; i < moveAnalyses.length; i++) {
      const move = moveAnalyses[i]
      const isWhite = isMoveByWhite(move.fen)
      // For white's move, update move number
      if (isWhite) {
        currentMoveNumber = getMoveNumberFromFen(move.fen)
        let pair = pairs.find((p) => p.moveNumber === currentMoveNumber)
        if (!pair) {
          pair = { moveNumber: currentMoveNumber }
          pairs.push(pair)
        }
        pair.white = {
          ...move,
          index: i,
          displayMoveNumber: currentMoveNumber,
          isWhiteMove: true,
        }
      } else {
        // For black's move, use the same move number as the previous white move
        let pair = pairs.find((p) => p.moveNumber === currentMoveNumber)
        if (!pair) {
          pair = { moveNumber: currentMoveNumber }
          pairs.push(pair)
        }
        pair.black = {
          ...move,
          index: i,
          displayMoveNumber: currentMoveNumber,
          isWhiteMove: false,
        }
      }
    }
    return pairs.sort((a, b) => a.moveNumber - b.moveNumber)
  })()

  // Now create chart data using the same move numbering from pairs
  const chartData = evaluationChart.map((point, index) => {
    const moveAnalysis = moveAnalyses[index]
    const isWhite = moveAnalysis ? isMoveByWhite(moveAnalysis.fen) : true

    // Find the move number from our pairs (same logic as move list)
    let moveNumber = 1
    if (moveAnalysis) {
      // Find this move in our pairs
      for (const pair of movePairs) {
        if (pair.white?.index === index) {
          moveNumber = pair.moveNumber
          break
        } else if (pair.black?.index === index) {
          moveNumber = pair.moveNumber
          break
        }
      }
    }

    const dynamicClassification = moveAnalysis
      ? getChartClassification(moveAnalysis)
      : ''

    // Get Stockfish depth by finding the corresponding game node
    // Since all positions are now analyzed to minimum depth 12, we can show this
    const stockfishDepth = 12 // Minimum depth guaranteed by the analysis system

    return {
      moveNumber: isWhite ? moveNumber : `...${moveNumber}`,
      evaluation: point.evaluation,
      isPlayerMove: point.isPlayerMove,
      classification: dynamicClassification,
      isCurrentMove: index === currentMoveIndex,
      san: moveAnalysis?.san || '',
      whiteAdvantage: point.evaluation > 0 ? point.evaluation : 0,
      blackAdvantage: point.evaluation < 0 ? point.evaluation : 0,
      zero: 0,
      stockfishDepth,
    }
  })

  // Calculate evaluation bounds for Y-axis
  const maxEval = Math.max(
    Math.abs(Math.max(...evaluationChart.map((point) => point.evaluation))),
    Math.abs(Math.min(...evaluationChart.map((point) => point.evaluation))),
    300,
  )

  const formatEvaluation = (evaluation: number) => {
    if (Math.abs(evaluation) >= 1000) {
      return evaluation > 0 ? '+M' : '-M'
    }
    return evaluation > 0
      ? `+${(evaluation / 100).toFixed(1)}`
      : `${(evaluation / 100).toFixed(1)}`
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col">
        <h3 className="text-lg font-semibold">Position Evaluation</h3>
        <p className="text-xs text-secondary">
          Track how evaluation value changed throughout the drill
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 15, right: 20, left: -20, bottom: 6 }}
            onMouseMove={(data) => {
              if (
                data &&
                data.activeTooltipIndex !== undefined &&
                onHoverMove
              ) {
                // Use the chartData index directly, which matches moveAnalyses index
                onHoverMove(data.activeTooltipIndex)
              }
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
            />
            <XAxis
              dataKey="moveNumber"
              stroke="#9ca3af"
              fontSize={11}
              tickFormatter={(value) => value}
              label={{
                value: 'Move Number',
                position: 'insideBottom',
                dy: 8,
                style: {
                  textAnchor: 'middle',
                  fill: '#9ca3af',
                  fontSize: '11px',
                },
              }}
            />
            <YAxis
              domain={[-maxEval, maxEval]}
              stroke="#9ca3af"
              fontSize={11}
              tickFormatter={formatEvaluation}
              label={{
                value: 'Evaluation',
                angle: -90,
                dx: 24,
                position: 'insideLeft',
                style: {
                  textAnchor: 'middle',
                  fill: '#9ca3af',
                  fontSize: '11px',
                },
              }}
            />
            <Tooltip content={<CustomTooltip moveAnalyses={moveAnalyses} />} />

            {/* White advantage area (positive evaluations only) */}
            <Area
              type="monotone"
              dataKey="whiteAdvantage"
              stroke="none"
              fill="rgba(255, 255, 255, 0.4)"
              fillOpacity={0.5}
              connectNulls={false}
            />

            {/* Black advantage area (negative evaluations only) */}
            <Area
              type="monotone"
              dataKey="blackAdvantage"
              stroke="none"
              fill="rgba(75, 85, 99, 0.5)"
              fillOpacity={0.6}
              connectNulls={false}
            />

            {/* Reference line at 0 evaluation - no interaction */}
            <ReferenceLine
              y={0}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={1}
              strokeDasharray="2 2"
              ifOverflow="extendDomain"
            />

            <Line
              type="monotone"
              dataKey="evaluation"
              stroke="#e5e7eb"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <ExcellentIcon size="small" />
          <span className="text-secondary">Excellent</span>
        </div>
        <div className="flex items-center gap-1">
          <InaccuracyIcon size="small" />
          <span className="text-secondary">Inaccuracy</span>
        </div>
        <div className="flex items-center gap-1">
          <BlunderIcon size="small" />
          <span className="text-secondary">Blunder</span>
        </div>
      </div>
    </div>
  )
}

// Desktop layout component
const DesktopLayout: React.FC<{
  drill: DrillPerformanceData['drill']
  filteredMoveAnalyses: (MoveAnalysis & { originalIndex: number })[]
  filteredEvaluationChart: DrillPerformanceData['evaluationChart']
  currentMoveIndex: number
  hoveredMoveIndex: number | null
  handleMoveClick: (index: number) => void
  handleChartHover: (index: number) => void
  setCurrentMoveIndex: (index: number) => void
  openingFen: string
  performanceData: DrillPerformanceData
  onContinueAnalyzing: () => void
  onNextDrill: () => void
  isLastDrill: boolean
}> = ({
  drill,
  filteredMoveAnalyses,
  filteredEvaluationChart,
  currentMoveIndex,
  hoveredMoveIndex,
  handleMoveClick,
  handleChartHover,
  setCurrentMoveIndex,
  openingFen,
  performanceData,
  onContinueAnalyzing,
  onNextDrill,
  isLastDrill,
}) => (
  <div className="relative flex h-[90vh] max-h-[800px] w-[95vw] max-w-[1200px] flex-col overflow-hidden rounded-lg bg-background-1 shadow-2xl">
    {/* Header */}
    <div className="flex items-center justify-between border-b border-white/10 p-4">
      <div>
        <h2 className="text-xl font-bold text-primary">
          Opening Analysis Complete
        </h2>
        <div className="mt-1">
          <p className="text-base font-medium text-secondary">
            {drill.selection.opening.name}
            {drill.selection.variation &&
              ` - ${drill.selection.variation.name}`}
            {' • '}
            Analyzed {
              filteredMoveAnalyses.filter((m) => m.isPlayerMove).length
            }{' '}
            of your moves
            {' • '}
            Playing as{' '}
            {drill.selection.playerColor === 'white' ? 'White' : 'Black'}
          </p>
        </div>
      </div>
      <button
        onClick={onContinueAnalyzing}
        className="text-secondary hover:text-primary"
      >
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>

    {/* Content */}
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel - Animated Game Replay */}
      <div className="flex w-1/3 flex-col border-r border-white/10">
        <AnimatedGameReplay
          moveAnalyses={filteredMoveAnalyses}
          openingFen={openingFen}
          playerColor={drill.selection.playerColor}
          onMoveIndexChange={setCurrentMoveIndex}
          externalMoveIndex={currentMoveIndex}
          onMoveClick={handleMoveClick}
        />
      </div>

      {/* Center Panel - Evaluation Chart & Critical Decisions */}
      <div className="red-scrollbar flex w-1/3 flex-col overflow-y-auto border-r border-white/10">
        <EvaluationChart
          evaluationChart={filteredEvaluationChart}
          moveAnalyses={filteredMoveAnalyses}
          currentMoveIndex={hoveredMoveIndex ?? currentMoveIndex}
          onHoverMove={handleChartHover}
          playerColor={drill.selection.playerColor}
          drill={drill}
        />

        {/* Critical Decisions Section */}
        {(() => {
          // Define helper function first
          const getMoveNumberForIndex = (
            index: number,
          ): { moveNumber: number; isWhiteMove: boolean } => {
            if (index < 0 || index >= filteredMoveAnalyses.length)
              return { moveNumber: 1, isWhiteMove: true }

            const moveAnalysis = filteredMoveAnalyses[index]
            if (!moveAnalysis) return { moveNumber: 1, isWhiteMove: true }

            const isWhiteMove = isMoveByWhite(moveAnalysis.fen)
            let moveNumber = 1
            if (isWhiteMove) {
              moveNumber = getMoveNumberFromFen(moveAnalysis.fen)
            } else {
              let currentIndex = index - 1
              while (currentIndex >= 0) {
                const prevMove = filteredMoveAnalyses[currentIndex]
                if (isMoveByWhite(prevMove.fen)) {
                  moveNumber = getMoveNumberFromFen(prevMove.fen)
                  break
                }
                currentIndex--
              }
            }
            return { moveNumber, isWhiteMove }
          }

          const criticalMoments = filteredMoveAnalyses
            .map((moveAnalysis, index) => {
              if (!moveAnalysis.isPlayerMove) return null
              const classification = moveAnalysis.classification || ''

              let winrateChange = 0
              if (classification === 'blunder') {
                winrateChange = MOVE_CLASSIFICATION_THRESHOLDS.BLUNDER_THRESHOLD
              } else if (classification === 'inaccuracy') {
                winrateChange =
                  MOVE_CLASSIFICATION_THRESHOLDS.INACCURACY_THRESHOLD
              } else {
                const evaluationLoss = Math.abs(
                  moveAnalysis.evaluationLoss || 0,
                )
                winrateChange = Math.min(evaluationLoss / 300, 0.05)
              }

              const moveInfo = getMoveNumberForIndex(index)
              const evaluationPoint = filteredEvaluationChart[index]
              const previousEvaluationPoint =
                index > 0 ? filteredEvaluationChart[index - 1] : null

              return {
                index,
                moveNumber: moveInfo.moveNumber,
                isWhiteMove: moveInfo.isWhiteMove,
                winrateChange,
                moveAnalysis,
                isPlayerMove: true,
                evaluation: evaluationPoint?.evaluation || 0,
                previousEvaluation: previousEvaluationPoint?.evaluation || 0,
              }
            })
            .filter(
              (moment): moment is NonNullable<typeof moment> =>
                moment !== null &&
                moment.isPlayerMove &&
                moment.winrateChange >
                  MOVE_CLASSIFICATION_THRESHOLDS.INACCURACY_THRESHOLD,
            )
            .sort((a, b) => a.index - b.index)

          const formatEvaluation = (evaluation: number) => {
            if (Math.abs(evaluation) >= 1000) {
              return evaluation > 0 ? '+M' : '-M'
            }
            return evaluation > 0
              ? `+${(evaluation / 100).toFixed(1)}`
              : `${(evaluation / 100).toFixed(1)}`
          }

          const classifyMoveInCritical = (
            moment: (typeof criticalMoments)[0],
          ): string => {
            const winrateChange = moment.winrateChange

            if (
              winrateChange >= MOVE_CLASSIFICATION_THRESHOLDS.BLUNDER_THRESHOLD
            ) {
              return 'blunder'
            } else if (
              winrateChange >=
              MOVE_CLASSIFICATION_THRESHOLDS.INACCURACY_THRESHOLD
            ) {
              return 'inaccuracy'
            }

            return ''
          }

          return criticalMoments.length > 0 ? (
            <div className="flex w-full flex-col gap-1 border-t border-white/10">
              <div className="flex flex-col px-3 pt-3">
                <h3 className="text-lg font-semibold">Critical Decisions</h3>
                <p className="text-xs text-secondary">
                  Key moments that shifted the evaluation
                </p>
              </div>
              <div className="flex flex-col">
                {criticalMoments.map((moment) => {
                  const classification = classifyMoveInCritical(moment)
                  const classificationObj = {
                    blunder: classification === 'blunder',
                    inaccuracy: classification === 'inaccuracy',
                    excellent: classification === 'excellent',
                    bestMove: false,
                  }

                  return (
                    <div
                      key={moment.index}
                      role="button"
                      tabIndex={0}
                      className="flex cursor-pointer items-center justify-between border-b border-white/10 px-3 py-2 transition-colors last:border-b-0 hover:bg-background-2"
                      onClick={() => handleMoveClick(moment.index)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleMoveClick(moment.index)
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">
                            {moment.isWhiteMove
                              ? `${moment.moveNumber}.`
                              : `...${moment.moveNumber}.`}{' '}
                            {moment.moveAnalysis?.san}
                          </span>
                          <MoveClassificationIcon
                            classification={classificationObj}
                            size="small"
                          />
                        </div>
                        <span className="text-xs text-secondary">
                          Loss:{' '}
                          {Math.abs(moment.moveAnalysis?.evaluationLoss || 0)}cp
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-secondary">
                          {formatEvaluation(moment.previousEvaluation)}
                        </span>
                        <span className="text-secondary">→</span>
                        <span
                          className={
                            moment.evaluation > moment.previousEvaluation
                              ? 'text-green-400'
                              : 'text-red-400'
                          }
                        >
                          {formatEvaluation(moment.evaluation)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null
        })()}
      </div>

      {/* Right Panel - Maia Rating Insights & Key Moments Analysis */}
      <div className="red-scrollbar flex w-1/3 flex-col gap-3 overflow-y-auto p-4">
        <MaiaRatingInsights
          ratingPrediction={performanceData.ratingPrediction}
        />
      </div>
    </div>

    {/* Action Buttons */}
    <div className="flex gap-3 border-t border-white/10 p-4">
      <button
        onClick={onContinueAnalyzing}
        className="flex-1 rounded bg-background-2 py-2 font-medium transition-colors hover:bg-background-3"
      >
        Continue Analyzing
      </button>
      <button
        onClick={onNextDrill}
        className="flex-1 rounded bg-human-4 py-2 font-medium transition-colors hover:bg-human-4/80"
      >
        {isLastDrill ? 'View Summary' : 'Next Drill'}
      </button>
    </div>
  </div>
)

// Mobile layout component with tabs
const MobileLayout: React.FC<{
  drill: DrillPerformanceData['drill']
  filteredMoveAnalyses: (MoveAnalysis & { originalIndex: number })[]
  filteredEvaluationChart: DrillPerformanceData['evaluationChart']
  currentMoveIndex: number
  hoveredMoveIndex: number | null
  handleMoveClick: (index: number) => void
  handleChartHover: (index: number) => void
  setCurrentMoveIndex: (index: number) => void
  openingFen: string
  performanceData: DrillPerformanceData
  onContinueAnalyzing: () => void
  onNextDrill: () => void
  isLastDrill: boolean
  activeTab: 'replay' | 'analysis' | 'insights'
  setActiveTab: (tab: 'replay' | 'analysis' | 'insights') => void
}> = ({
  drill,
  filteredMoveAnalyses,
  filteredEvaluationChart,
  currentMoveIndex,
  hoveredMoveIndex,
  handleMoveClick,
  handleChartHover,
  setCurrentMoveIndex,
  openingFen,
  performanceData,
  onContinueAnalyzing,
  onNextDrill,
  isLastDrill,
  activeTab,
  setActiveTab,
}) => (
  <div className="relative flex h-[95vh] w-[95vw] flex-col overflow-hidden rounded-lg bg-background-1 shadow-2xl">
    {/* Header */}
    <div className="flex items-center justify-between border-b border-white/10 p-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold text-primary">Analysis Complete</h2>
        <div className="mt-1">
          <p className="text-sm font-medium text-secondary">
            {drill.selection.opening.name}
            {drill.selection.variation &&
              ` - ${drill.selection.variation.name}`}
          </p>
          <p className="text-xs text-secondary">
            {filteredMoveAnalyses.filter((m) => m.isPlayerMove).length} moves
            analyzed •{' '}
            {drill.selection.playerColor === 'white' ? 'White' : 'Black'}
          </p>
        </div>
      </div>
      <button
        onClick={onContinueAnalyzing}
        className="text-secondary hover:text-primary"
      >
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>

    {/* Mobile Tab Navigation */}
    <div className="flex w-full border-b border-white/10 bg-background-1">
      <button
        onClick={() => setActiveTab('replay')}
        className={`flex-1 py-3 text-sm font-medium transition-colors ${
          activeTab === 'replay'
            ? 'border-b-2 border-human-4 bg-background-2 text-primary'
            : 'text-secondary hover:text-primary'
        }`}
      >
        Replay
      </button>
      <button
        onClick={() => setActiveTab('analysis')}
        className={`flex-1 py-3 text-sm font-medium transition-colors ${
          activeTab === 'analysis'
            ? 'border-b-2 border-human-4 bg-background-2 text-primary'
            : 'text-secondary hover:text-primary'
        }`}
      >
        Chart
      </button>
      <button
        onClick={() => setActiveTab('insights')}
        className={`flex-1 py-3 text-sm font-medium transition-colors ${
          activeTab === 'insights'
            ? 'border-b-2 border-human-4 bg-background-2 text-primary'
            : 'text-secondary hover:text-primary'
        }`}
      >
        Insights
      </button>
    </div>

    {/* Tab Content */}
    <div className="flex-1 overflow-hidden">
      {activeTab === 'replay' && (
        <AnimatedGameReplay
          moveAnalyses={filteredMoveAnalyses}
          openingFen={openingFen}
          playerColor={drill.selection.playerColor}
          onMoveIndexChange={setCurrentMoveIndex}
          externalMoveIndex={currentMoveIndex}
          onMoveClick={handleMoveClick}
        />
      )}

      {activeTab === 'analysis' && (
        <div className="red-scrollbar h-full overflow-y-auto">
          <EvaluationChart
            evaluationChart={filteredEvaluationChart}
            moveAnalyses={filteredMoveAnalyses}
            currentMoveIndex={hoveredMoveIndex ?? currentMoveIndex}
            onHoverMove={handleChartHover}
            playerColor={drill.selection.playerColor}
            drill={drill}
          />
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="red-scrollbar h-full overflow-y-auto p-4">
          <MaiaRatingInsights
            ratingPrediction={performanceData.ratingPrediction}
          />
        </div>
      )}
    </div>

    {/* Action Buttons */}
    <div className="flex gap-3 border-t border-white/10 p-4">
      <button
        onClick={onContinueAnalyzing}
        className="flex-1 rounded bg-background-2 py-2 font-medium transition-colors hover:bg-background-3"
      >
        Continue
      </button>
      <button
        onClick={onNextDrill}
        className="flex-1 rounded bg-human-4 py-2 font-medium transition-colors hover:bg-human-4/80"
      >
        {isLastDrill ? 'Summary' : 'Next'}
      </button>
    </div>
  </div>
)

export const DrillPerformanceModal: React.FC<Props> = ({
  performanceData,
  onContinueAnalyzing,
  onNextDrill,
  isLastDrill,
}) => {
  const { isMobile } = useContext(WindowSizeContext)
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1)
  const [hoveredMoveIndex, setHoveredMoveIndex] = useState<number | null>(null)
  const [isClicked, setIsClicked] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'replay' | 'analysis' | 'insights'
  >('replay')

  const { drill, evaluationChart, moveAnalyses } = performanceData

  // Filter out pre-loaded opening moves - only show moves after the opening sequence
  const filteredMoveAnalyses = useMemo(() => {
    // Find the index of the first actual gameplay move (first player move)
    const firstPlayerMoveIndex = moveAnalyses.findIndex(
      (move) => move.isPlayerMove,
    )

    if (firstPlayerMoveIndex === -1) {
      // No player moves found, return empty array
      return []
    }

    // Include the position before the first player move if it exists
    // This ensures we can see the evaluation change from the first move
    const startIndex = Math.max(0, firstPlayerMoveIndex - 1)

    // Return all moves starting from before the first player move, but preserve original indices
    return moveAnalyses.slice(startIndex).map((move, index) => ({
      ...move,
      originalIndex: startIndex + index, // Track original index for board navigation
    }))
  }, [moveAnalyses])

  // Filter evaluation chart to match the filtered moves
  const filteredEvaluationChart = useMemo(() => {
    const firstPlayerMoveIndex = moveAnalyses.findIndex(
      (move) => move.isPlayerMove,
    )
    if (firstPlayerMoveIndex === -1) {
      return []
    }
    // Start one move earlier to include the position before the first player move
    const startIndex = Math.max(0, firstPlayerMoveIndex - 1)
    return evaluationChart.slice(startIndex)
  }, [evaluationChart, moveAnalyses])

  // Handle hover on chart - update board position only if not clicked
  const handleChartHover = useCallback(
    (filteredIndex: number) => {
      if (!isClicked) {
        setCurrentMoveIndex(filteredIndex)
        setHoveredMoveIndex(filteredIndex)
      }
    },
    [isClicked],
  )

  // Handle click on move list - update both board position and chart highlighting
  const handleMoveClick = useCallback((filteredIndex: number) => {
    setCurrentMoveIndex(filteredIndex)
    setHoveredMoveIndex(filteredIndex)
    setIsClicked(true)

    setTimeout(() => {
      setIsClicked(false)
    }, 500)
  }, [])

  // Get opening FEN from the drill
  const openingFen = drill.selection.variation
    ? drill.selection.variation.fen
    : drill.selection.opening.fen

  return (
    <ModalContainer dismiss={onContinueAnalyzing}>
      {isMobile ? (
        <MobileLayout
          drill={drill}
          filteredMoveAnalyses={filteredMoveAnalyses}
          filteredEvaluationChart={filteredEvaluationChart}
          currentMoveIndex={currentMoveIndex}
          hoveredMoveIndex={hoveredMoveIndex}
          handleMoveClick={handleMoveClick}
          handleChartHover={handleChartHover}
          setCurrentMoveIndex={setCurrentMoveIndex}
          openingFen={openingFen}
          performanceData={performanceData}
          onContinueAnalyzing={onContinueAnalyzing}
          onNextDrill={onNextDrill}
          isLastDrill={isLastDrill}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      ) : (
        <DesktopLayout
          drill={drill}
          filteredMoveAnalyses={filteredMoveAnalyses}
          filteredEvaluationChart={filteredEvaluationChart}
          currentMoveIndex={currentMoveIndex}
          hoveredMoveIndex={hoveredMoveIndex}
          handleMoveClick={handleMoveClick}
          handleChartHover={handleChartHover}
          setCurrentMoveIndex={setCurrentMoveIndex}
          openingFen={openingFen}
          performanceData={performanceData}
          onContinueAnalyzing={onContinueAnalyzing}
          onNextDrill={onNextDrill}
          isLastDrill={isLastDrill}
        />
      )}
    </ModalContainer>
  )
}
