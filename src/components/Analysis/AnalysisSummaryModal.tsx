import React, { useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ComposedChart, 
  Line, 
  Area,
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  ReferenceLine,
  CartesianGrid,
  Tooltip,
  Dot
} from 'recharts'
import { AnalyzedGame } from 'src/types'
import { extractPlayerMistakes } from 'src/lib/analysis'

interface Props {
  isOpen: boolean
  onClose: () => void
  game: AnalyzedGame
}

interface GameSummary {
  whiteMistakes: {
    total: number
    blunders: number
    inaccuracies: number
  }
  blackMistakes: {
    total: number
    blunders: number
    inaccuracies: number
  }
  evaluationData: Array<{
    moveNumber: number | string
    evaluation: number
    whiteAdvantage: number
    blackAdvantage: number
    san?: string
    isBlunder: boolean
    isInaccuracy: boolean
    isWhiteMove: boolean
  }>
  criticalMoments: Array<{
    moveNumber: number
    san: string
    playerColor: 'white' | 'black'
    type: 'blunder' | 'inaccuracy' | 'excellent'
    evaluation: number
  }>
  gameInsights: {
    totalMoves: number
    turningPoints: number
    maxAdvantage: { player: 'white' | 'black'; value: number }
    gamePhase: 'opening' | 'middlegame' | 'endgame'
  }
}

// Custom dot component for move quality indicators
const CustomDot: React.FC<{
  cx?: number
  cy?: number
  payload?: {
    isBlunder: boolean
    isInaccuracy: boolean
    isWhiteMove: boolean
  }
}> = ({ cx, cy, payload }) => {
  if (!payload || (!payload.isBlunder && !payload.isInaccuracy)) return null

  const color = payload.isBlunder ? '#ef4444' : '#eab308' // Red for blunders, yellow for inaccuracies
  const radius = payload.isBlunder ? 5 : 4

  return (
    <Dot
      cx={cx}
      cy={cy}
      r={radius}
      fill={color}
      stroke="#ffffff"
      strokeWidth={1}
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
      moveNumber: number | string
      isBlunder: boolean
      isInaccuracy: boolean
      isWhiteMove: boolean
    }
  }>
}> = ({ active, payload }) => {
  if (!active || !payload || !payload[0]) return null

  const data = payload[0].payload
  const formatEvaluation = (evaluation: number) => {
    if (Math.abs(evaluation) >= 10) {
      return evaluation > 0 ? '+M' : '-M'
    }
    return evaluation > 0 ? `+${evaluation.toFixed(1)}` : `${evaluation.toFixed(1)}`
  }

  const moveType = data.isBlunder ? 'Blunder' : data.isInaccuracy ? 'Inaccuracy' : null

  return (
    <div className="rounded border border-white/20 bg-background-1/95 p-3 shadow-lg">
      <p className="text-sm font-medium text-primary">
        {typeof data.moveNumber === 'string' ? data.moveNumber : `${data.moveNumber}.`} {data.san}
      </p>
      <p className="text-sm text-secondary">
        Evaluation: {formatEvaluation(data.evaluation)}
      </p>
      {moveType && (
        <p className={`text-sm ${data.isBlunder ? 'text-red-400' : 'text-yellow-400'}`}>
          {moveType}
        </p>
      )}
    </div>
  )
}

export const AnalysisSummaryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  game,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const summary = useMemo((): GameSummary => {
    const mainLine = game.tree.getMainLine()
    const whiteMistakes = extractPlayerMistakes(game.tree, 'white')
    const blackMistakes = extractPlayerMistakes(game.tree, 'black')

    // Generate evaluation data for the chart
    const evaluationData = mainLine.slice(1).map((node, index) => {
      const evaluation = (node.analysis.stockfish?.model_optimal_cp || 0) / 100
      // Cap evaluation for chart readability but store original for tooltips
      const clampedEval = Math.max(-10, Math.min(10, evaluation))
      const isWhiteMove = index % 2 === 0
      
      return {
        moveNumber: isWhiteMove ? Math.ceil((index + 1) / 2) : `${Math.ceil((index + 1) / 2)}...`,
        evaluation: clampedEval,
        whiteAdvantage: clampedEval > 0 ? clampedEval : 0,
        blackAdvantage: clampedEval < 0 ? clampedEval : 0,
        san: node.san || '',
        isBlunder: node.blunder || false,
        isInaccuracy: node.inaccuracy || false,
        isWhiteMove,
      }
    })

    // Extract critical moments
    const criticalMoments = mainLine
      .slice(1)
      .filter(node => node.blunder || node.inaccuracy || node.excellentMove)
      .map((node, index) => ({
        moveNumber: node.moveNumber || Math.ceil((index + 1) / 2),
        san: node.san || '',
        playerColor: (node.moveNumber || 1) % 2 === 1 ? 'white' : 'black' as 'white' | 'black',
        type: node.blunder ? 'blunder' : node.inaccuracy ? 'inaccuracy' : 'excellent' as 'blunder' | 'inaccuracy' | 'excellent',
        evaluation: (node.analysis.stockfish?.model_optimal_cp || 0) / 100,
      }))
      .slice(0, 5)

    // Calculate game insights
    const evaluations = evaluationData.map(d => d.evaluation)
    const maxEval = Math.max(...evaluations)
    const minEval = Math.min(...evaluations)
    const maxAdvantageValue = Math.max(Math.abs(maxEval), Math.abs(minEval))
    const maxAdvantagePlayer = Math.abs(maxEval) > Math.abs(minEval) ? 'white' : 'black'
    
    // Count significant evaluation swings (turning points)
    let turningPoints = 0
    for (let i = 1; i < evaluations.length - 1; i++) {
      const prev = evaluations[i - 1]
      const curr = evaluations[i]
      const next = evaluations[i + 1]
      if ((prev > 1 && curr < -1) || (prev < -1 && curr > 1) || 
          (Math.abs(curr - prev) > 2 && Math.abs(next - curr) > 2)) {
        turningPoints++
      }
    }

    const gameInsights = {
      totalMoves: Math.ceil((mainLine.length - 1) / 2),
      turningPoints,
      maxAdvantage: { player: maxAdvantagePlayer, value: maxAdvantageValue },
      gamePhase: mainLine.length > 40 ? 'endgame' : mainLine.length > 20 ? 'middlegame' : 'opening' as 'opening' | 'middlegame' | 'endgame',
    }

    return {
      whiteMistakes: {
        total: whiteMistakes.length,
        blunders: whiteMistakes.filter((m) => m.type === 'blunder').length,
        inaccuracies: whiteMistakes.filter((m) => m.type === 'inaccuracy').length,
      },
      blackMistakes: {
        total: blackMistakes.length,
        blunders: blackMistakes.filter((m) => m.type === 'blunder').length,
        inaccuracies: blackMistakes.filter((m) => m.type === 'inaccuracy').length,
      },
      evaluationData,
      criticalMoments,
      gameInsights,
    }
  }, [game.tree])

  if (!isOpen) return null

  const formatEvaluation = (evaluation: number) => {
    if (Math.abs(evaluation) >= 10) {
      return evaluation > 0 ? '+M' : '-M'
    }
    return evaluation > 0 ? `+${evaluation.toFixed(1)}` : `${evaluation.toFixed(1)}`
  }

  const PlayerPerformanceRow = ({ 
    title, 
    color, 
    mistakes, 
    playerName 
  }: { 
    title: string
    color: string
    mistakes: { total: number; blunders: number; inaccuracies: number }
    playerName: string 
  }) => (
    <div className="flex items-center justify-between rounded border border-white/5 bg-background-2/30 p-3">
      <div className="flex items-center gap-3">
        <div className={`h-4 w-4 rounded-full ${color === 'white' ? 'bg-white' : 'border border-white bg-black'}`} />
        <div>
          <p className="text-sm font-medium text-primary">{playerName}</p>
          <p className="text-xs text-secondary">{title}</p>
        </div>
      </div>
      
      {mistakes.total === 0 ? (
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined !text-sm text-green-400">check_circle</span>
          <span className="text-xs text-green-400">Clean game</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-red-400">{mistakes.blunders}</span>
            <span className="text-secondary">blunders</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-orange-400">{mistakes.inaccuracies}</span>
            <span className="text-secondary">inaccuracies</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-primary">{mistakes.total}</span>
            <span className="text-secondary">total</span>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <motion.div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        className="flex w-full max-w-5xl flex-col gap-5 rounded-lg border border-white/10 bg-background-1 p-6 shadow-2xl"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-human-4">
              analytics
            </span>
            <div>
              <h2 className="text-xl font-bold text-primary">Analysis Complete</h2>
              <p className="text-sm text-secondary">
                {summary.gameInsights.totalMoves} moves • {summary.gameInsights.gamePhase} phase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-secondary transition-colors hover:text-primary"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left Column - Player Performance & Insights */}
          <div className="flex flex-col gap-4">
            {/* Player Performance */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-primary/90">Player Performance</h3>
              <div className="flex flex-col gap-2">
                <PlayerPerformanceRow
                  title="White"
                  color="white"
                  mistakes={summary.whiteMistakes}
                  playerName={game.whitePlayer.name}
                />
                <PlayerPerformanceRow
                  title="Black"
                  color="black"
                  mistakes={summary.blackMistakes}
                  playerName={game.blackPlayer.name}
                />
              </div>
            </div>

            {/* Game Insights */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-primary/90">Game Insights</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-background-2/40 p-2">
                  <p className="text-secondary">Turning Points</p>
                  <p className="text-lg font-semibold text-primary">{summary.gameInsights.turningPoints}</p>
                </div>
                <div className="rounded bg-background-2/40 p-2">
                  <p className="text-secondary">Max Advantage</p>
                  <p className="text-lg font-semibold text-primary">
                    {formatEvaluation(summary.gameInsights.maxAdvantage.value)}
                  </p>
                  <p className="text-xs text-secondary capitalize">
                    {summary.gameInsights.maxAdvantage.player}
                  </p>
                </div>
                <div className="rounded bg-background-2/40 p-2">
                  <p className="text-secondary">Game Length</p>
                  <p className="text-lg font-semibold text-primary">{summary.gameInsights.totalMoves}</p>
                  <p className="text-xs text-secondary">moves</p>
                </div>
                <div className="rounded bg-background-2/40 p-2">
                  <p className="text-secondary">Phase</p>
                  <p className="text-lg font-semibold text-primary capitalize">
                    {summary.gameInsights.gamePhase}
                  </p>
                </div>
              </div>
            </div>

            {/* Critical Moments */}
            {summary.criticalMoments.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-primary/90">Critical Moments</h3>
                <div className="flex flex-col gap-2">
                  {summary.criticalMoments.slice(0, 3).map((moment, index) => (
                    <div key={index} className="flex items-center gap-2 rounded bg-background-2/30 p-2">
                      <div className={`h-2 w-2 rounded-full ${
                        moment.type === 'blunder' ? 'bg-red-400' : 
                        moment.type === 'inaccuracy' ? 'bg-yellow-400' : 'bg-green-400'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary">
                          {moment.moveNumber}. {moment.san}
                        </p>
                        <p className="text-xs text-secondary capitalize">
                          {moment.type} • {formatEvaluation(moment.evaluation)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Columns - Evaluation Chart */}
          <div className="flex flex-col gap-3 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary/90">Position Evaluation</h3>
              <div className="flex items-center gap-4 text-xs text-secondary">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-white/40"></div>
                  <span>White advantage</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-gray-600"></div>
                  <span>Black advantage</span>
                </div>
              </div>
            </div>
            
            <div className="rounded border border-white/10 bg-background-2/20 p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={summary.evaluationData}
                    margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="moveNumber" 
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={{ stroke: '#334155' }}
                      axisLine={{ stroke: '#334155' }}
                      label={{
                        value: 'Move Number',
                        position: 'insideBottom',
                        dy: 8,
                        style: { textAnchor: 'middle', fill: '#9ca3af', fontSize: '11px' }
                      }}
                    />
                    <YAxis 
                      domain={[-10, 10]}
                      tickFormatter={formatEvaluation}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={{ stroke: '#334155' }}
                      axisLine={{ stroke: '#334155' }}
                      label={{
                        value: 'Evaluation',
                        angle: -90,
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: '#9ca3af', fontSize: '11px' }
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* White advantage area */}
                    <Area
                      type="monotone"
                      dataKey="whiteAdvantage"
                      stroke="none"
                      fill="rgba(255, 255, 255, 0.4)"
                      fillOpacity={0.5}
                    />
                    
                    {/* Black advantage area */}
                    <Area
                      type="monotone"
                      dataKey="blackAdvantage"
                      stroke="none"
                      fill="rgba(75, 85, 99, 0.5)"
                      fillOpacity={0.6}
                    />
                    
                    <ReferenceLine 
                      y={0} 
                      stroke="rgba(255,255,255,0.4)" 
                      strokeWidth={1}
                      strokeDasharray="2 2"
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
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded bg-human-4 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-human-4/90"
          >
            <span className="material-symbols-outlined !text-sm">check</span>
            Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}