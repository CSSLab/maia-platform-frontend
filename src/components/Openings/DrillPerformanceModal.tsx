import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useContext,
} from 'react'
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
import { ModalContainer, MovesContainer } from 'src/components'
import { DrillPerformanceData, MoveAnalysis } from 'src/types/openings'
import { MaiaRatingInsights } from './MaiaRatingInsights'
import { WindowSizeContext, TreeControllerContext } from 'src/contexts'
import {
  BlunderIcon,
  ExcellentIcon,
  InaccuracyIcon,
} from 'src/components/Common/MoveIcons'
import { useTreeController } from 'src/hooks'
import { generateColorSanMapping } from 'src/hooks/useAnalysisController/utils'
import { GameNode, GameTree } from 'src/types'

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

// Helper function to get color using the actual Stockfish analysis from GameNodes
const getColorFromMoveAnalysis = (
  moveAnalysis: MoveAnalysis,
  gameNodesMap: Map<string, GameNode>,
): string => {
  // Get the GameNode for the position before the move
  const parentNode = gameNodesMap.get(moveAnalysis.fenBeforeMove || '')

  if (!parentNode || !parentNode.analysis.stockfish) {
    return 'inherit'
  }

  // Use the actual Stockfish analysis to generate color mapping
  const colorSanMapping = generateColorSanMapping(
    parentNode.analysis.stockfish,
    parentNode.fen,
  )

  // Get the color for this specific move
  const moveKey = moveAnalysis.move
  return colorSanMapping[moveKey]?.color || 'inherit'
}

// Component for animated game replay
const AnimatedGameReplay: React.FC<{
  openingFen: string
  playerColor: 'white' | 'black'
  gameTree: GameTree
}> = ({ openingFen, playerColor, gameTree }) => {
  const [currentFen, setCurrentFen] = useState(openingFen)
  const [currentNode, setCurrentNode] = useState<GameNode | null>(null)

  const treeController = useContext(TreeControllerContext)

  if (!treeController) {
    throw new Error(
      'AnimatedGameReplay must be used within TreeControllerContext',
    )
  }

  // Sync current FEN and node with tree controller
  useEffect(() => {
    if (treeController.currentNode) {
      setCurrentFen(treeController.currentNode.fen)
      setCurrentNode(treeController.currentNode)
    }
  }, [treeController.currentNode])

  // Get arrows for optimal moves from the current position
  const getArrowsForCurrentMove = useCallback((): DrawShape[] => {
    if (!currentNode) return []

    const arrows: DrawShape[] = []

    // IMPORTANT: The currentNode represents the position AFTER a move was played
    // But we want to show the best moves for the position BEFORE that move (the current FEN)
    // So we need to use the currentNode.analysis which is the analysis from the position before the move
    // But display the arrows on the current board (after the move)

    // We need to find the position that the current FEN represents
    // This is tricky because the FEN shows the position after the move
    // But we want the best moves for the player to move in this position

    // The current FEN is the position after the last move
    // We need to check who is to move in this position
    const chess = new Chess(currentFen)
    const currentTurn = chess.turn() // 'w' or 'b'

    // Get the best moves for the player who is to move in the current position
    // This means we need analysis for the current position, not the previous position

    // Since currentNode represents the position after the move was played,
    // and currentFen is the FEN of that position,
    // we need to show arrows for moves that can be played FROM this position

    // Get legal moves from current position
    const legalMoves = chess.moves({ verbose: true })

    // Get Maia best move (red arrow) - for the player to move in current position
    if (currentNode.analysis?.maia?.['maia_kdd_1500']?.policy) {
      const maiaPolicy = currentNode.analysis.maia['maia_kdd_1500'].policy
      const maiaEntries = Object.entries(maiaPolicy)
      if (maiaEntries.length > 0) {
        const bestMove = maiaEntries.reduce((a, b) =>
          maiaPolicy[a[0]] > maiaPolicy[b[0]] ? a : b,
        )
        // Check if this move is legal from current position
        const isLegal = legalMoves.some(
          (move) =>
            move.from + move.to + (move.promotion || '') === bestMove[0],
        )
        if (isLegal) {
          arrows.push({
            brush: 'red',
            orig: bestMove[0].slice(0, 2) as Key,
            dest: bestMove[0].slice(2, 4) as Key,
          })
        }
      }
    }

    // Get Stockfish best move (blue arrow) - for the player to move in current position
    if (currentNode.analysis?.stockfish?.model_move) {
      const stockfishMove = currentNode.analysis.stockfish.model_move
      // Check if this move is legal from current position
      const isLegal = legalMoves.some(
        (move) =>
          move.from + move.to + (move.promotion || '') === stockfishMove,
      )
      if (isLegal) {
        arrows.push({
          brush: 'blue',
          orig: stockfishMove.slice(0, 2) as Key,
          dest: stockfishMove.slice(2, 4) as Key,
        })
      }
    }

    return arrows
  }, [currentNode, currentFen])

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
        {/* Move Quality Display is now handled by MovesContainer */}

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

      {/* Move History - Use MovesContainer for consistency */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-white/10">
        <TreeControllerContext.Provider value={treeController}>
          <MovesContainer
            game={{
              id: 'drill-performance',
              tree: gameTree,
            }}
            showAnnotations={true}
            showVariations={false}
          />
        </TreeControllerContext.Provider>
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
            {data.classification}
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
  gameNodesMap: Map<string, GameNode>
  getChartClassification: (
    analysis: MoveAnalysis,
    gameNodesMap: Map<string, GameNode>,
  ) => 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
}> = ({
  evaluationChart,
  moveAnalyses,
  currentMoveIndex = -1,
  onHoverMove,
  playerColor,
  drill,
  gameNodesMap,
  getChartClassification,
}) => {
  const [isHovering, setIsHovering] = useState(false)

  if (evaluationChart.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded bg-background-2 p-3 text-secondary">
        <p>Evaluation chart unavailable</p>
      </div>
    )
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
      ? getChartClassification(moveAnalysis, gameNodesMap)
      : ''

    return {
      moveNumber: isWhite ? moveNumber : `${moveNumber}...`,
      evaluation: point.evaluation,
      isPlayerMove: point.isPlayerMove,
      classification: dynamicClassification,
      isCurrentMove: index === currentMoveIndex,
      san: moveAnalysis?.san || '',
      whiteAdvantage: point.evaluation > 0 ? point.evaluation : 0,
      blackAdvantage: point.evaluation < 0 ? point.evaluation : 0,
      zero: 0,
      stockfishDepth: 12,
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
      <div className="relative h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 15, right: 20, left: -20, bottom: 6 }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
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
            <Tooltip
              content={<CustomTooltip moveAnalyses={moveAnalyses} />}
              active={isHovering}
            />

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

            {/* Vertical line at current move position */}
            {currentMoveIndex >= 0 && currentMoveIndex < chartData.length && (
              <ReferenceLine
                x={chartData[currentMoveIndex]?.moveNumber}
                stroke="rgba(244, 63, 94, 0.8)"
                strokeWidth={2}
                strokeDasharray="4 2"
                ifOverflow="extendDomain"
              />
            )}

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

        {/* Fixed tooltip for current move position - only show when not hovering */}
        {!isHovering &&
          currentMoveIndex >= 0 &&
          currentMoveIndex < chartData.length &&
          (() => {
            // Get the filtered moveAnalyses that match the chart data
            const firstPlayerMoveIndex = moveAnalyses.findIndex(
              (move) => move.isPlayerMove,
            )
            const startIndex = Math.max(0, firstPlayerMoveIndex - 1)
            const filteredMoveAnalyses = moveAnalyses.slice(startIndex)

            const currentData = chartData[currentMoveIndex]
            // Convert string move numbers (like "...5") back to numeric for the tooltip
            const numericMoveNumber =
              typeof currentData.moveNumber === 'string'
                ? parseInt(currentData.moveNumber.replace('...', ''))
                : currentData.moveNumber

            // Calculate the x position of the tooltip based on the current move's position in the chart
            // Chart width is approximately 100% - margins, and we need to map the currentMoveIndex to x position
            const totalDataPoints = chartData.length
            const dataPointRatio =
              totalDataPoints > 1 ? currentMoveIndex / (totalDataPoints - 1) : 0

            // Position tooltip at the calculated x position
            const tooltipLeftPercent = Math.min(
              Math.max(dataPointRatio * 100, 10),
              85,
            ) // Keep within 10%-85% range

            return (
              <div
                className="absolute top-4 z-10"
                style={{
                  left: `${tooltipLeftPercent}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <CustomTooltip
                  active={true}
                  payload={[
                    {
                      payload: {
                        san: currentData.san,
                        evaluation: currentData.evaluation,
                        classification: currentData.classification,
                        isPlayerMove: currentData.isPlayerMove,
                        moveNumber: numericMoveNumber,
                        stockfishDepth: currentData.stockfishDepth,
                      },
                    },
                  ]}
                  label={String(currentData.moveNumber)}
                  moveAnalyses={filteredMoveAnalyses}
                />
              </div>
            )
          })()}
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
  filteredEvaluationChart: DrillPerformanceData['evaluationChart']
  openingFen: string
  performanceData: DrillPerformanceData
  onContinueAnalyzing: () => void
  onNextDrill: () => void
  isLastDrill: boolean
  gameTree: GameTree
  playerMoveCount: number
  treeController: ReturnType<typeof useTreeController>
  gameNodesMap: Map<string, GameNode>
  currentMoveIndex: number
  getChartClassification: (
    analysis: MoveAnalysis,
    gameNodesMap: Map<string, GameNode>,
  ) => 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
}> = ({
  drill,
  filteredEvaluationChart,
  openingFen,
  performanceData,
  onContinueAnalyzing,
  onNextDrill,
  isLastDrill,
  gameTree,
  playerMoveCount,
  treeController,
  gameNodesMap,
  currentMoveIndex,
  getChartClassification,
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
            Analyzed {playerMoveCount} of your moves
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
        <TreeControllerContext.Provider
          value={{
            gameTree: treeController.tree,
            ...treeController,
          }}
        >
          <AnimatedGameReplay
            openingFen={openingFen}
            playerColor={drill.selection.playerColor}
            gameTree={gameTree}
          />
        </TreeControllerContext.Provider>
      </div>

      {/* Center Panel - Evaluation Chart & Critical Decisions */}
      <div className="red-scrollbar flex w-1/3 flex-col overflow-y-auto border-r border-white/10">
        <EvaluationChart
          evaluationChart={filteredEvaluationChart}
          moveAnalyses={performanceData.moveAnalyses}
          currentMoveIndex={currentMoveIndex}
          onHoverMove={(moveIndex) => {
            // Navigate to the corresponding move position when hovering over the chart
            // Adjust moveIndex back to the original moveAnalyses index
            const firstPlayerMoveIndex = performanceData.moveAnalyses.findIndex(
              (move) => move.isPlayerMove,
            )
            const startIndex = Math.max(0, firstPlayerMoveIndex - 1)
            const actualMoveIndex = moveIndex + startIndex

            const moveAnalysis = performanceData.moveAnalyses[actualMoveIndex]
            if (moveAnalysis) {
              // Find the node that represents the position after this move
              const targetFen = moveAnalysis.fen

              // Walk through the game tree to find the matching node
              const findNodeByFen = (node: GameNode): GameNode | null => {
                if (node.fen === targetFen) {
                  return node
                }

                // Check main child
                if (node.mainChild) {
                  const found = findNodeByFen(node.mainChild)
                  if (found) return found
                }

                // Check all children
                for (const child of node.children) {
                  const found = findNodeByFen(child)
                  if (found) return found
                }

                return null
              }

              const targetNode = findNodeByFen(gameTree.getRoot())
              if (targetNode) {
                treeController.goToNode(targetNode)
              }
            }
          }}
          playerColor={drill.selection.playerColor}
          drill={drill}
          gameNodesMap={gameNodesMap}
          getChartClassification={getChartClassification}
        />

        {/* Critical Decisions Section */}
        <div className="flex w-full flex-col gap-2 border-t border-white/10">
          <div className="flex flex-col px-3 pt-3">
            <h3 className="text-lg font-semibold">Critical Decisions</h3>
            <p className="text-xs text-secondary">
              Key moments that shaped the game
            </p>
          </div>
          <div className="flex flex-col gap-2 px-3 pb-3">
            {(() => {
              // Get critical moves directly from game tree (like MovesContainer)
              const mainLineNodes = gameTree.getMainLine().slice(1) // Skip root
              const criticalMoves = mainLineNodes
                .filter((node, index) => {
                  // Determine if this is a player move
                  const chess = new Chess(node.fen)
                  const isPlayerMove =
                    drill.selection.playerColor === 'white'
                      ? chess.turn() === 'b' // If black to move, white just played
                      : chess.turn() === 'w' // If white to move, black just played
                  return isPlayerMove
                })
                .filter((node) => {
                  // Filter for critical moves (same logic as MovesContainer)
                  return node.blunder || node.inaccuracy || node.excellentMove
                })
                .map((node) => {
                  // Convert to MoveAnalysis format for display
                  let classification: 'blunder' | 'inaccuracy' | 'excellent' =
                    'excellent'
                  if (node.blunder) {
                    classification = 'blunder'
                  } else if (node.inaccuracy) {
                    classification = 'inaccuracy'
                  }

                  return {
                    move: node.move || '',
                    san: node.san || '',
                    fen: node.fen,
                    fenBeforeMove: node.parent?.fen,
                    moveNumber: node.moveNumber,
                    isPlayerMove: true,
                    evaluation: 0, // Will be filled if needed
                    classification,
                    evaluationLoss: 0,
                  }
                })
                .sort((a, b) => {
                  // Sort by move number (chronological order)
                  return a.moveNumber - b.moveNumber
                })
                .slice(0, 5) // Show top 5 critical moves

              // Function to navigate to a specific move position
              const navigateToMove = (moveAnalysis: MoveAnalysis) => {
                // Find the node that represents the position BEFORE this move was made
                const targetFen = moveAnalysis.fenBeforeMove || moveAnalysis.fen

                // Walk through the game tree to find the matching node
                const findNodeByFen = (node: GameNode): GameNode | null => {
                  if (node.fen === targetFen) {
                    return node
                  }

                  // Check main child
                  if (node.mainChild) {
                    const found = findNodeByFen(node.mainChild)
                    if (found) return found
                  }

                  // Check all children
                  for (const child of node.children) {
                    const found = findNodeByFen(child)
                    if (found) return found
                  }

                  return null
                }

                const targetNode = findNodeByFen(gameTree.getRoot())
                if (targetNode) {
                  treeController.goToNode(targetNode)
                } else {
                  // If we can't find the position before the move, try to find the move node and go to its parent
                  const moveNodeFen = moveAnalysis.fen
                  const moveNode = findNodeByFen(gameTree.getRoot())
                  if (moveNode && moveNode.parent) {
                    treeController.goToNode(moveNode.parent)
                  }
                }
              }

              if (criticalMoves.length === 0) {
                return (
                  <div className="py-4 text-center text-sm text-secondary">
                    No critical decisions found. Great play!
                  </div>
                )
              }

              return criticalMoves.map((move, index) => (
                <button
                  key={index}
                  className="flex w-full cursor-pointer items-center gap-2 rounded bg-background-2/50 p-2 text-left transition-colors hover:bg-background-2"
                  onClick={() => navigateToMove(move)}
                  type="button"
                >
                  <div className="flex-shrink-0">
                    {move.classification === 'excellent' && (
                      <ExcellentIcon size="small" />
                    )}
                    {move.classification === 'inaccuracy' && (
                      <InaccuracyIcon size="small" />
                    )}
                    {move.classification === 'blunder' && (
                      <BlunderIcon size="small" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {move.moveNumber}. {move.san}
                      </span>
                      <span
                        className={`text-xs capitalize ${
                          move.classification === 'excellent'
                            ? 'text-green-400'
                            : move.classification === 'blunder'
                              ? 'text-red-400'
                              : 'text-yellow-400'
                        }`}
                      >
                        {move.classification}
                      </span>
                    </div>
                    <div className="text-xs text-secondary">
                      Eval: {move.evaluation > 0 ? '+' : ''}
                      {(move.evaluation / 100).toFixed(1)}
                      {move.evaluationLoss !== 0 && (
                        <span className="ml-2">
                          Loss: {Math.abs(move.evaluationLoss / 100).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            })()}
          </div>
        </div>
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
        Analyze
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
  filteredEvaluationChart: DrillPerformanceData['evaluationChart']
  openingFen: string
  performanceData: DrillPerformanceData
  onContinueAnalyzing: () => void
  onNextDrill: () => void
  isLastDrill: boolean
  activeTab: 'replay' | 'analysis' | 'insights'
  setActiveTab: (tab: 'replay' | 'analysis' | 'insights') => void
  gameTree: GameTree
  playerMoveCount: number
  treeController: ReturnType<typeof useTreeController>
  gameNodesMap: Map<string, GameNode>
  currentMoveIndex: number
  getChartClassification: (
    analysis: MoveAnalysis,
    gameNodesMap: Map<string, GameNode>,
  ) => 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
}> = ({
  drill,
  filteredEvaluationChart,
  openingFen,
  performanceData,
  onContinueAnalyzing,
  onNextDrill,
  isLastDrill,
  activeTab,
  setActiveTab,
  gameTree,
  playerMoveCount,
  treeController,
  gameNodesMap,
  currentMoveIndex,
  getChartClassification,
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
            {playerMoveCount} moves analyzed •{' '}
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
        <TreeControllerContext.Provider
          value={{
            gameTree: treeController.tree,
            ...treeController,
          }}
        >
          <AnimatedGameReplay
            openingFen={openingFen}
            playerColor={drill.selection.playerColor}
            gameTree={gameTree}
          />
        </TreeControllerContext.Provider>
      )}

      {activeTab === 'analysis' && (
        <div className="red-scrollbar h-full overflow-y-auto">
          <EvaluationChart
            evaluationChart={filteredEvaluationChart}
            moveAnalyses={performanceData.moveAnalyses}
            currentMoveIndex={currentMoveIndex}
            onHoverMove={(moveIndex) => {
              // Navigate to the corresponding move position when hovering over the chart
              // Adjust moveIndex back to the original moveAnalyses index
              const firstPlayerMoveIndex =
                performanceData.moveAnalyses.findIndex(
                  (move) => move.isPlayerMove,
                )
              const startIndex = Math.max(0, firstPlayerMoveIndex - 1)
              const actualMoveIndex = moveIndex + startIndex

              const moveAnalysis = performanceData.moveAnalyses[actualMoveIndex]
              if (moveAnalysis) {
                // Find the node that represents the position after this move
                const targetFen = moveAnalysis.fen

                // Walk through the game tree to find the matching node
                const findNodeByFen = (node: GameNode): GameNode | null => {
                  if (node.fen === targetFen) {
                    return node
                  }

                  // Check main child
                  if (node.mainChild) {
                    const found = findNodeByFen(node.mainChild)
                    if (found) return found
                  }

                  // Check all children
                  for (const child of node.children) {
                    const found = findNodeByFen(child)
                    if (found) return found
                  }

                  return null
                }

                const targetNode = findNodeByFen(gameTree.getRoot())
                if (targetNode) {
                  treeController.goToNode(targetNode)
                }
              }
            }}
            playerColor={drill.selection.playerColor}
            drill={drill}
            gameNodesMap={gameNodesMap}
            getChartClassification={getChartClassification}
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
        Analyze
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
  const [activeTab, setActiveTab] = useState<
    'replay' | 'analysis' | 'insights'
  >('replay')

  const { drill, evaluationChart, moveAnalyses } = performanceData

  // For now, let's work directly with the nodes instead of trying to recreate the full tree
  // This is a temporary solution until we can properly access the GameTree

  // Create a proper GameTree starting from the opening end node
  const gameTree = useMemo(() => {
    // Get the root node and build the tree from there
    let root = drill.finalNode
    while (root.parent) {
      root = root.parent
    }

    // Find the opening end node from the drill selection
    const openingEndFen = drill.selection.variation
      ? drill.selection.variation.fen
      : drill.selection.opening.fen

    // Find the actual opening end node in the tree
    let openingEndTreeNode = root
    let current: GameNode | null = root
    while (current) {
      if (current.fen === openingEndFen) {
        openingEndTreeNode = current
        break
      }
      current = current.mainChild
    }

    // Create a new GameTree starting from the opening end node
    const newTree = new (class extends GameTree {
      constructor(startNode: GameNode) {
        super(startNode.fen)
        // Replace the root with our opening end node
        this.setRoot(startNode)
      }

      private setRoot(node: GameNode) {
        // Use reflection to set the private root field
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(this as any).root = node
      }

      getRoot(): GameNode {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).root
      }

      getMainLine(): GameNode[] {
        const mainLine = []
        let current: GameNode | null = this.getRoot()
        while (current) {
          mainLine.push(current)
          current = current.mainChild
        }
        return mainLine
      }
    })(openingEndTreeNode)

    return newTree
  }, [drill.finalNode, drill.selection])

  // Create tree controller for navigation
  const treeController = useTreeController(
    gameTree,
    drill.selection.playerColor,
  )

  // Calculate current move index from tree controller's current node
  const currentMoveIndex = useMemo(() => {
    if (!treeController.currentNode) return -1

    // Find the index in moveAnalyses that corresponds to the current node's FEN
    const currentFen = treeController.currentNode.fen
    const moveIndex = moveAnalyses.findIndex((move) => move.fen === currentFen)

    // Adjust for the filtered evaluation chart that starts earlier
    const firstPlayerMoveIndex = moveAnalyses.findIndex(
      (move) => move.isPlayerMove,
    )
    const startIndex = Math.max(0, firstPlayerMoveIndex - 1)

    return moveIndex >= startIndex ? moveIndex - startIndex : -1
  }, [treeController.currentNode, moveAnalyses])

  // Create a map of FEN -> GameNode for consistent classification
  const gameNodesMap = useMemo(() => {
    const map = new Map<string, GameNode>()
    const collectNodes = (node: GameNode): void => {
      map.set(node.fen, node)
      node.children.forEach(collectNodes)
    }
    collectNodes(gameTree.getRoot())
    return map
  }, [gameTree])

  // Helper function to get move classification from GameNode (same as MovesContainer)
  const getChartClassification = useCallback(
    (
      analysis: MoveAnalysis,
      gameNodesMap: Map<string, GameNode>,
    ): 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' => {
      // Get the GameNode for the position after the move
      const moveNode = gameNodesMap.get(analysis.fen)
      if (!moveNode) {
        return analysis.classification || 'good'
      }

      // Use the same logic as MovesContainer
      if (moveNode.blunder) {
        return 'blunder'
      } else if (moveNode.inaccuracy) {
        return 'inaccuracy'
      } else if (moveNode.excellentMove) {
        return 'excellent'
      }

      return 'good'
    },
    [],
  )

  // Count player moves from move analyses for display purposes
  const playerMoveCount = useMemo(() => {
    return moveAnalyses.filter((move) => move.isPlayerMove).length
  }, [moveAnalyses])

  // Filter evaluation chart to start from the position before the first player move
  // This provides context by showing the evaluation before the player's first contribution
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

  // Get opening FEN from the drill
  const openingFen = drill.selection.variation
    ? drill.selection.variation.fen
    : drill.selection.opening.fen

  return (
    <ModalContainer dismiss={onContinueAnalyzing}>
      {isMobile ? (
        <MobileLayout
          drill={drill}
          filteredEvaluationChart={filteredEvaluationChart}
          openingFen={openingFen}
          performanceData={performanceData}
          onContinueAnalyzing={onContinueAnalyzing}
          onNextDrill={onNextDrill}
          isLastDrill={isLastDrill}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          gameTree={gameTree}
          playerMoveCount={playerMoveCount}
          treeController={treeController}
          gameNodesMap={gameNodesMap}
          currentMoveIndex={currentMoveIndex}
          getChartClassification={getChartClassification}
        />
      ) : (
        <DesktopLayout
          drill={drill}
          filteredEvaluationChart={filteredEvaluationChart}
          openingFen={openingFen}
          performanceData={performanceData}
          onContinueAnalyzing={onContinueAnalyzing}
          onNextDrill={onNextDrill}
          isLastDrill={isLastDrill}
          gameTree={gameTree}
          playerMoveCount={playerMoveCount}
          treeController={treeController}
          gameNodesMap={gameNodesMap}
          currentMoveIndex={currentMoveIndex}
          getChartClassification={getChartClassification}
        />
      )}
    </ModalContainer>
  )
}
