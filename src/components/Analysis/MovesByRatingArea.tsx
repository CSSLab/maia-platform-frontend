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
import { useContext, useEffect, useRef } from 'react'
import { ColorSanMapping } from 'src/types'
import { WindowSizeContext } from 'src/contexts'

export interface MovesByRatingAreaProps {
  displayedMoves: { [key: string]: number }[] | undefined
  moveKeys: string[]
  displayedColorSanMapping: ColorSanMapping
  isHomePage: boolean
  displayedPositionKey?: string
}

/** A line's name shows at its end only if this share of some rating plays it. */
const LABEL_MIN_PEAK = 8
/** Two names at the lines' ends stay this far apart, as a share of the axis. */
const LABEL_MIN_GAP = 0.07

// The Moves by Rating chart itself: recharts and its d3 helpers (~320 KB of
// JavaScript, uncompressed), which MovesByRating loads after the page.
export const MovesByRatingArea: React.FC<MovesByRatingAreaProps> = ({
  displayedMoves,
  moveKeys,
  displayedColorSanMapping,
  isHomePage,
  displayedPositionKey,
}) => {
  const { isMobile } = useContext(WindowSizeContext)
  const lastRenderedPositionKeyRef = useRef(displayedPositionKey)
  const shouldAnimateSeries =
    !!displayedPositionKey &&
    displayedPositionKey !== lastRenderedPositionKeyRef.current

  useEffect(() => {
    if (!displayedPositionKey) return
    lastRenderedPositionKeyRef.current = displayedPositionKey
  }, [displayedPositionKey])

  const maxValue = displayedMoves
    ? Math.max(
        ...displayedMoves.flatMap((move) =>
          Object.entries(move)
            .filter(([key]) => key !== 'rating')
            .map(([, value]) => value as number),
        ),
      )
    : 100

  // On the analysis page's desktop layout the chart stays quiet: no dots, no
  // legend, and names only on the lines that matter.
  const calm = !isMobile && !isHomePage
  const peakOf = (move: string) =>
    Math.max(
      0,
      ...(displayedMoves ?? []).map(
        (row) => Number(row[move as keyof typeof row]) || 0,
      ),
    )
  const domainMax = maxValue > 60 ? 100 : 60
  const domain = [0, domainMax]
  // The most-played lines get a name at their end, as long as it clears the
  // names already placed.
  const calmLabels = new Set<string>()
  if (calm) {
    const endOf = (move: string) => {
      const last = displayedMoves?.[displayedMoves.length - 1]
      return Number(last?.[move as keyof typeof last]) || 0
    }
    const placed: number[] = []
    for (const move of [...moveKeys].sort((a, b) => peakOf(b) - peakOf(a))) {
      const end = endOf(move)
      if (
        peakOf(move) >= LABEL_MIN_PEAK &&
        placed.every((y) => Math.abs(y - end) >= domainMax * LABEL_MIN_GAP)
      ) {
        placed.push(end)
        calmLabels.add(move)
      }
    }
  }

  return (
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
        <CartesianGrid
          vertical={!calm}
          strokeDasharray={calm ? undefined : '3 3'}
          stroke={calm ? 'rgb(255 255 255 / 0.07)' : '#3C3C3C'}
        />
        <XAxis
          dataKey="rating"
          axisLine={false}
          tick={{
            fill: calm ? 'rgb(255 255 255 / 0.55)' : 'white',
            fontSize: 11,
          }}
          tickMargin={4}
          ticks={
            isMobile || calm
              ? [600, 1000, 1400, 1800, 2200, 2600]
              : [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600]
          }
        />
        <YAxis
          yAxisId="left"
          orientation="left"
          axisLine={false}
          domain={domain}
          width={calm ? 44 : undefined}
          tick={{
            fill: calm ? 'rgb(255 255 255 / 0.55)' : 'white',
            fontSize: 11,
          }}
          label={
            calm
              ? undefined
              : {
                  value: 'Maia Probability',
                  angle: -90,
                  fill: '#FE7F6D',
                  position: 'insideLeft',
                  dy: 46,
                  offset: 15,
                  fontWeight: 600,
                  fontSize: isHomePage ? 12 : 14,
                }
          }
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
                    stopColor={displayedColorSanMapping[move]?.color ?? '#fff'}
                    stopOpacity={calm ? 0.16 : 0.5}
                  />
                  <stop
                    offset="95%"
                    stopColor={displayedColorSanMapping[move]?.color ?? '#fff'}
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
                  dot={
                    calm
                      ? false
                      : {
                          r: isMobile ? 2 : 3,
                          stroke:
                            displayedColorSanMapping[move]?.color ?? '#fff',
                          strokeWidth: isMobile ? 2 : 3,
                        }
                  }
                  stroke={displayedColorSanMapping[move]?.color ?? '#fff'}
                  fill={`url(#color${move})`}
                  strokeWidth={calm ? 1.75 : isMobile ? 2 : 3}
                  strokeOpacity={
                    calm && peakOf(move) < LABEL_MIN_PEAK ? 0.55 : 1
                  }
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
                    if (calm && !calmLabels.has(move)) return null

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
                      const prevEndPoint = positionedEndPoints[currentIndex - 1]
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
        {calm ? null : (
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
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}
