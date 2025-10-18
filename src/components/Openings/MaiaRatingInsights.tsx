import React, { useMemo } from 'react'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Area,
  ComposedChart,
  ReferenceLine,
} from 'recharts'
import { RatingPrediction } from 'src/types/openings'

interface Props {
  ratingPrediction: RatingPrediction
}

const CustomTooltip: React.FC<{
  active?: boolean
  payload?: Array<{
    value: number
    payload: {
      rating: number
      likelihoodProbability: number
      averageMoveProb: number
    }
  }>
}> = ({ active, payload }) => {
  if (!active || !payload || !payload[0]) return null

  const data = payload[0].payload
  const percentage = (data.likelihoodProbability * 100).toFixed(1)
  const avgMoveProb = (data.averageMoveProb * 100).toFixed(1)

  return (
    <div className="rounded border border-glass-border bg-backdrop p-3 shadow-lg backdrop-blur-md">
      <p className="text-sm font-medium text-primary">{data.rating} Rating</p>
      <p className="text-sm text-secondary">Likelihood: {percentage}%</p>
      <p className="text-xs text-secondary">Avg Move Prob: {avgMoveProb}%</p>
    </div>
  )
}

export const MaiaRatingInsights: React.FC<Props> = ({ ratingPrediction }) => {
  const chartData = useMemo(() => {
    return ratingPrediction.ratingDistribution.map((comparison) => ({
      rating: comparison.rating,
      likelihoodProbability: comparison.likelihoodProbability,
      averageMoveProb: comparison.averageMoveProb,
      percentage: comparison.likelihoodProbability * 100,
    }))
  }, [ratingPrediction.ratingDistribution])

  const getRatingDescription = (rating: number) => {
    if (rating <= 1200) return 'Beginner'
    if (rating <= 1400) return 'Intermediate'
    if (rating <= 1600) return 'Advanced'
    if (rating <= 1800) return 'Expert'
    return 'Master'
  }

  const getRatingRange = () => {
    const lowerBound = Math.round(
      ratingPrediction.predictedRating - ratingPrediction.standardDeviation,
    )
    const upperBound = Math.round(
      ratingPrediction.predictedRating + ratingPrediction.standardDeviation,
    )
    return `${Math.max(1100, lowerBound)} → ${Math.min(1900, upperBound)}`
  }

  return (
    <div className="space-y-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Maia Playing Style Match</h3>
        <p className="text-xs text-secondary">
          Your predicted rating based on {ratingPrediction.sampleSize} moves
          analyzed
        </p>
      </div>

      {/* Primary Rating Prediction */}
      <div className="rounded border border-human-3/50 bg-gradient-to-r from-human-3/10 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-human-2">
                {ratingPrediction.predictedRating}
              </p>
              <span className="text-sm text-secondary">
                ({getRatingDescription(ratingPrediction.predictedRating)})
              </span>
            </div>
            <p className="text-sm text-secondary">
              Rating Range: {getRatingRange()}
            </p>
          </div>
        </div>
      </div>

      {/* Probability Distribution Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
            />
            <XAxis
              dataKey="rating"
              stroke="#9ca3af"
              fontSize={10}
              tickFormatter={(value) => `${value}`}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={10}
              tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="likelihoodProbability"
              stroke="#10b981"
              fill="url(#colorGradient)"
              strokeWidth={2}
              fillOpacity={0.3}
            />
            <Line
              type="monotone"
              dataKey="likelihoodProbability"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 0, r: 2 }}
              activeDot={{ r: 4, stroke: '#10b981', strokeWidth: 2 }}
            />
            <ReferenceLine
              x={ratingPrediction.predictedRating}
              stroke="#10b981"
              strokeDasharray="4 4"
              strokeWidth={2}
            />
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* How It's Calculated */}
      <div className="rounded border border-glass-border bg-glass p-3">
        <p className="text-xs text-secondary">
          <span className="font-semibold text-human-2">
            How it&apos;s calculated:{' '}
          </span>
          We analyze each position before your moves using 9 different Maia
          models (1100-1900). For each model, we calculate the probability it
          would play your chosen move. The final rating is the specific level
          that had the highest log likelihood of predicting your actual moves.
        </p>
      </div>
    </div>
  )
}
