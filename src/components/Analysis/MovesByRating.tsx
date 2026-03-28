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
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ColorSanMapping } from 'src/types'
import { WindowSizeContext } from 'src/contexts'

interface Props {
  moves: { [key: string]: number }[] | undefined
  colorSanMapping: ColorSanMapping
  isHomePage?: boolean
  positionKey?: string
}

export const MovesByRating: React.FC<Props> = ({
  moves,
  colorSanMapping,
  isHomePage = false,
  positionKey,
}: Props) => {
  const { isMobile } = useContext(WindowSizeContext)
  const [displayedMoves, setDisplayedMoves] = useState(moves)
  const [displayedColorSanMapping, setDisplayedColorSanMapping] =
    useState(colorSanMapping)
  const [displayedPositionKey, setDisplayedPositionKey] = useState(positionKey)
  const lastRenderedPositionKeyRef = useRef<string | undefined>(positionKey)
  const shouldAnimateSeries =
    !!displayedPositionKey &&
    displayedPositionKey !== lastRenderedPositionKeyRef.current

  useEffect(() => {
    if (!moves?.length || !positionKey) return
    setDisplayedMoves(moves)
    setDisplayedColorSanMapping(colorSanMapping)
    setDisplayedPositionKey(positionKey)
  }, [moves, colorSanMapping, positionKey])

  useEffect(() => {
    if (!displayedPositionKey) return
    lastRenderedPositionKeyRef.current = displayedPositionKey
  }, [displayedPositionKey])

  const moveKeys = useMemo(() => {
    if (!displayedMoves?.length) return []
    return Object.keys(displayedMoves[0]).filter((move) => move !== 'rating')
  }, [displayedMoves])

  const maxValue = displayedMoves
    ? Math.max(
        ...displayedMoves.flatMap((move) =>
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
      className="flex h-64 w-full flex-col bg-transparent md:h-full md:rounded"
    >
      <h2 className="p-3 text-base text-primary md:text-sm xl:text-base">
        Moves by Rating
      </h2>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart
          data={displayedMoves}
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
                ? [600, 1000, 1400, 1800, 2200, 2600]
                : [
                    600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400,
                    2600,
                  ]
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
            {displayedMoves &&
              moveKeys.map((move) => {
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
                      stopColor={
                        displayedColorSanMapping[move]?.color ?? '#fff'
                      }
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor={
                        displayedColorSanMapping[move]?.color ?? '#fff'
                      }
                      stopOpacity={0}
                    />
                  </linearGradient>
                )
              })}
          </defs>
          {displayedMoves &&
            // First, collect all the end points and sort them by y-position
            (() => {
              const lastIndex = displayedMoves.length - 1

              // Define the type for end points
              interface EndPoint {
                move: string
                value: number
                san: string
                color: string
                yPosition?: number // Actual y-coordinate after rendering
                adjustment?: number
              }

              const endPoints = moveKeys
                .map((move) => {
                  const value = displayedMoves[lastIndex][move] as number
                  return {
                    move,
                    value,
                    san: displayedColorSanMapping[move]?.san || move,
                    color: displayedColorSanMapping[move]?.color ?? '#fff',
                  } as EndPoint
                })
                .sort((a, b) => a.value - b.value) // Sort by value (y-position)

              // Return the original map function with adjusted positions
              return moveKeys.map((move, index) => {
                const endPoint = endPoints.find((ep) => ep.move === move)
                const san = endPoint?.san || move

                return (
                  <Area
                    key={index}
                    yAxisId="left"
                    dataKey={move}
                    dot={{
                      r: isMobile ? 2 : 3,
                      stroke: displayedColorSanMapping[move]?.color ?? '#fff',
                      strokeWidth: isMobile ? 2 : 3,
                    }}
                    stroke={displayedColorSanMapping[move]?.color ?? '#fff'}
                    fill={`url(#color${move})`}
                    strokeWidth={isMobile ? 2 : 3}
                    animationDuration={300}
                    isAnimationActive={shouldAnimateSeries}
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
                          fill={displayedColorSanMapping[move]?.color ?? '#fff'}
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
                <div
                  className="flex w-32 flex-col rounded-md border border-glass-border pb-2 text-white/90"
                  style={{
                    background:
                      'radial-gradient(ellipse 110% 90% at 20% 10%, rgba(239, 68, 68, 0.10) 0%, rgba(239, 68, 68, 0.06) 35%, transparent 75%), #171214',
                  }}
                >
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
            formatter={(value: string) => {
              return displayedColorSanMapping[value as string]?.san ?? value
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
