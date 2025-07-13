import {
  Area,
  XAxis,
  YAxis,
  Legend,
  Tooltip,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { useContext } from 'react'
import { ColorSanMapping } from 'src/types'
import { WindowSizeContext } from 'src/contexts'

interface Props {
  moves: { [key: string]: number }[] | undefined
  colorSanMapping: ColorSanMapping
  isHomePage?: boolean
}

export const MovesByRating: React.FC<Props> = ({
  moves,
  colorSanMapping,
  isHomePage = false,
}: Props) => {
  const { isMobile } = useContext(WindowSizeContext)

  const maxValue = moves
    ? Math.max(
        ...moves.flatMap((move) =>
          Object.entries(move)
            .filter(([key]) => key !== 'rating')
            .map(([, value]) => value as number),
        ),
      )
    : 100

  const domainMax = maxValue > 60 ? 100 : 60
  const domain = [0, domainMax]

  return (
    <div
      id="analysis-moves-by-rating"
      className="flex h-64 w-full flex-col md:h-full"
    >
      <h2 className="p-3 text-sm text-primary xl:text-base">Moves by Rating</h2>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={moves}
          margin={{
            left: 0,
            right: isMobile ? 40 : 50,
            bottom: 0,
            top: isMobile ? 5 : 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#3C3C3C" />
          <XAxis
            dataKey="rating"
            axisLine={false}
            tick={{
              fill: 'white',
              fontSize: 11,
            }}
            tickMargin={4}
            ticks={
              isMobile
                ? [1100, 1300, 1500, 1700, 1900]
                : [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900]
            }
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            axisLine={false}
            domain={domain}
            tick={{
              fill: 'white',
              fontSize: 11,
            }}
            label={{
              value: 'Maia Probability',
              angle: -90,
              fill: '#FE7F6D',
              position: 'insideLeft',
              dy: 46,
              offset: 15,
              fontWeight: 600,
              fontSize: isHomePage ? 12 : 14,
            }}
            tickCount={isMobile ? 4 : 5}
            tickMargin={isMobile ? 1 : 2}
            tickLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <defs>
            {moves &&
              Object.keys(moves[0]).map((move, i) => {
                if (move === 'rating') {
                  return null
                }
                return (
                  <linearGradient
                    key={`color${move}`}
                    id={`color${move}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={colorSanMapping[move]?.color ?? '#fff'}
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor={colorSanMapping[move]?.color ?? '#fff'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                )
              })}
          </defs>
          {moves &&
            // First, collect all the end points and sort them by y-position
            (() => {
              const lastIndex = moves.length - 1

              // Define the type for end points
              interface EndPoint {
                move: string
                value: number
                san: string
                color: string
                yPosition?: number // Actual y-coordinate after rendering
                adjustment?: number
              }

              const endPoints = Object.keys(moves[0])
                .filter((move) => move !== 'rating')
                .map((move) => {
                  const value = moves[lastIndex][move] as number
                  return {
                    move,
                    value,
                    san: colorSanMapping[move]?.san || move,
                    color: colorSanMapping[move]?.color ?? '#fff',
                  } as EndPoint
                })
                .sort((a, b) => a.value - b.value) // Sort by value (y-position)

              // Return the original map function with adjusted positions
              return Object.keys(moves[0]).map((move, i) => {
                if (move === 'rating') {
                  return null
                }

                const endPoint = endPoints.find((ep) => ep.move === move)
                const san = endPoint?.san || move

                return (
                  <Area
                    key={i}
                    yAxisId="left"
                    dataKey={move}
                    dot={{
                      r: isMobile ? 2 : 3,
                      stroke: colorSanMapping[move]?.color ?? '#fff',
                      strokeWidth: isMobile ? 2 : 3,
                    }}
                    stroke={colorSanMapping[move]?.color ?? '#fff'}
                    fill={`url(#color${move})`}
                    strokeWidth={isMobile ? 2 : 3}
                    animationDuration={300}
                    name={san}
                    label={(props: {
                      x: number
                      y: number
                      index: number
                      width: number
                      height: number
                    }) => {
                      if (props.index !== lastIndex) return null

                      if (endPoint) {
                        endPoint.yPosition = props.y
                      }

                      const positionedEndPoints = endPoints.filter(
                        (ep) => ep.yPosition !== undefined,
                      )

                      positionedEndPoints.sort(
                        (a, b) => (a.yPosition || 0) - (b.yPosition || 0),
                      )

                      const currentIndex = positionedEndPoints.findIndex(
                        (ep) => ep.move === move,
                      )

                      let adjustment = 0
                      const minLabelHeight = isMobile ? 14 : 16

                      if (currentIndex > 0) {
                        const prevEndPoint =
                          positionedEndPoints[currentIndex - 1]
                        const prevY = prevEndPoint.yPosition || 0
                        const prevAdjustment = prevEndPoint.adjustment || 0
                        const adjustedPrevY = prevY - prevAdjustment

                        if (props.y - adjustedPrevY < minLabelHeight) {
                          adjustment =
                            minLabelHeight - (props.y - adjustedPrevY) + 2
                        }
                      }

                      if (endPoint) {
                        endPoint.adjustment = adjustment
                      }

                      return (
                        <text
                          x={props.x + (isMobile ? 6 : 10)}
                          y={props.y - adjustment}
                          dy={isMobile ? 3 : 4}
                          fontSize={11}
                          fontWeight={600}
                          fill={colorSanMapping[move]?.color ?? '#fff'}
                          textAnchor="start"
                        >
                          {san}
                        </text>
                      )
                    }}
                  />
                )
              })
            })()}
          <Tooltip
            content={({ payload }) => {
              return (
                <div className="flex w-32 flex-col rounded border border-white/10 bg-background-1 pb-2">
                  <div className="flex px-3 py-2">
                    {payload ? (
                      <p className="text-sm">{payload[0]?.payload.rating}</p>
                    ) : null}
                  </div>
                  {payload?.map((point) => {
                    const san = point.name
                    const prob = Math.round((point.value as number) * 10) / 10

                    return (
                      <div
                        key={san}
                        className="flex items-center justify-between px-3"
                      >
                        <p
                          style={{
                            color: point.color ?? '#fff',
                          }}
                          className="text-xs"
                        >
                          {san}
                        </p>
                        <p
                          style={{
                            color: point.color ?? '#fff',
                          }}
                          className="font-mono text-xs"
                        >
                          {prob}%
                        </p>
                      </div>
                    )
                  })}
                </div>
              )
            }}
          />
          <Legend
            align="right"
            verticalAlign="top"
            wrapperStyle={{
              top: isMobile ? -10 : -14,
              right: isMobile ? 10 : 20,
              fontSize: 14,
            }}
            iconSize={0}
            formatter={(value) => {
              return colorSanMapping[value as string]?.san ?? value
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
