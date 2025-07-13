import {
  Cell,
  Label,
  XAxis,
  YAxis,
  Scatter,
  ScatterChart,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { useContext, useState } from 'react'
import { ColorSanMapping } from 'src/types'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'
import { WindowSizeContext } from 'src/contexts'
import { MoveTooltip } from './MoveTooltip'

interface MoveMapEntry {
  move: string
  x: number
  y: number
  opacity?: number
  importance?: number
  size?: number
  rawCp?: number
  winrate?: number
  rawMaiaProb?: number
  relativeCp?: number
}

interface Props {
  moveMap?: MoveMapEntry[]
  colorSanMapping: ColorSanMapping
  setHoverArrow: React.Dispatch<React.SetStateAction<DrawShape | null>>
  makeMove: (move: string) => void
  isHomePage?: boolean
}

// Helper function to convert hex color to rgba with alpha
const hexToRgba = (hex: string, alpha: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return hex

  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const MoveMap: React.FC<Props> = ({
  moveMap,
  colorSanMapping,
  setHoverArrow,
  makeMove,
  isHomePage = false,
}: Props) => {
  const { isMobile, width } = useContext(WindowSizeContext)
  const [hoveredMove, setHoveredMove] = useState<string | null>(null)
  const [hoveredMoveData, setHoveredMoveData] = useState<MoveMapEntry | null>(
    null,
  )
  const [mousePosition, setMousePosition] = useState<{
    x: number
    y: number
  } | null>(null)

  // Responsive font sizing based on screen width
  const getAxisLabelFontSize = () => {
    if (width < 640) return 10 // Very small screens
    if (width < 768) return 11 // Small screens
    if (width < 1024) return 12 // Medium screens
    if (width < 1280) return 13 // Large screens
    return 14 // Extra large screens
  }

  const getTickFontSize = () => {
    if (width < 640) return 8 // Very small screens
    if (width < 768) return 9 // Small screens
    if (width < 1024) return 9 // Medium screens
    if (width < 1280) return 10 // Large screens
    return 11 // Extra large screens
  }

  const getDirectionalLabelFontSize = () => {
    if (width < 640) return 9 // Very small screens
    if (width < 768) return 10 // Small screens
    if (width < 1024) return 10 // Medium screens
    if (width < 1280) return 11 // Large screens
    return 12 // Extra large screens
  }

  const getYAxisLabelFontSize = () => {
    if (width < 640) return 10 // Very small screens
    if (width < 768) return 11 // Small screens
    if (width < 1024) return 12 // Medium screens
    if (width < 1280) return 13 // Large screens
    return 14 // Extra large screens
  }

  // Responsive dy values for Y-axis labels
  const getMainLabelDy = () => {
    if (width < 640) return 20 // Mobile - keep original value
    if (width < 1280) return 20 // Small desktop screens - reduce offset
    return 32 // Large screens - original value
  }

  const getUnlikelyLabelDy = () => {
    if (isHomePage) {
      // Reduced offset for home page
      if (width < 640) return 80 // Mobile
      if (width < 1280) return 90 // Small desktop
      return 100 // Large screens
    }
    // Original offsets for analysis page
    if (width < 640) return 100 // Mobile - keep original value
    if (width < 1280) return 110 // Small desktop screens - reduce offset
    return 130 // Large screens - original value
  }

  const getLikelyLabelDy = () => {
    if (isHomePage) {
      // Reduced offset for home page
      if (width < 640) return -20 // Mobile
      if (width < 1280) return -20 // Small desktop
      return -30 // Large screens
    }
    // Original offsets for analysis page
    if (width < 640) return -30 // Mobile - keep original value
    if (width < 1280) return -30 // Small desktop screens - reduce offset
    return -48 // Large screens - original value
  }

  const onMouseEnter = (
    move: string,
    moveData: MoveMapEntry,
    event?: React.MouseEvent,
  ) => {
    setHoverArrow({
      orig: move.slice(0, 2) as Key,
      dest: move.slice(2, 4) as Key,
      brush: 'green',
      modifiers: {
        lineWidth: 10,
      },
    })
    setHoveredMove(move)
    setHoveredMoveData(moveData)

    // Capture mouse position for tooltip positioning
    if (event) {
      // Get position relative to the viewport for better positioning
      setMousePosition({
        x: event.clientX,
        y: event.clientY,
      })
    }
  }

  const onMouseLeave = () => {
    setHoverArrow(null)
    setHoveredMove(null)
    setHoveredMoveData(null)
    setMousePosition(null)
  }

  const onContainerMouseLeave = () => {
    onMouseLeave()
  }

  const renderTooltip = () => {
    if (!hoveredMove || !hoveredMoveData || !mousePosition) return null

    return (
      <MoveTooltip
        move={hoveredMove}
        colorSanMapping={colorSanMapping}
        maiaProb={hoveredMoveData.rawMaiaProb}
        stockfishCp={hoveredMoveData.rawCp}
        stockfishWinrate={hoveredMoveData.winrate}
        stockfishCpRelative={hoveredMoveData.relativeCp}
        position={mousePosition}
      />
    )
  }

  return (
    <div
      id="analysis-move-map"
      className="flex h-64 max-h-full w-full flex-col overflow-hidden bg-background-1/60 md:h-full md:rounded"
      onMouseLeave={onContainerMouseLeave}
    >
      <h2 className="p-3 text-sm text-primary xl:text-base">Move Map</h2>
      <div className="relative flex h-full w-full flex-col">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ left: 0, top: 5, right: 30, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3C3C3C" />
            <XAxis
              dataKey="x"
              type="number"
              axisLine={false}
              label={{
                value: 'SF Loss',
                fill: '#76ADDD',
                position: 'insideBottom',
                fontSize: getAxisLabelFontSize(),
                fontWeight: 600,
                offset: -8,
                dx: isMobile ? -6 : -12,
              }}
              tickCount={5}
              tickLine={false}
              tickMargin={0}
              tick={{ fill: 'white', fontSize: getTickFontSize() }}
              domain={[-3, 0]}
              ticks={[-3, -2, -1, 0]}
            >
              <Label
                value="← Blunders"
                position="insideBottomLeft"
                fill="#5A9DD7"
                fontSize={getDirectionalLabelFontSize()}
                fontWeight={500}
                dy={10}
                dx={isMobile ? -40 : -18}
              />
              <Label
                value="Best Moves →"
                position="insideBottomRight"
                fontSize={getDirectionalLabelFontSize()}
                fill="#5A9DD7"
                fontWeight={500}
                dy={10}
                dx={18}
              />
            </XAxis>
            <YAxis
              dataKey="y"
              type="number"
              axisLine={false}
              label={{
                value: 'Maia',
                fill: '#FE7F6D',
                position: 'insideLeft',
                angle: -90,
                fontSize: getYAxisLabelFontSize(),
                fontWeight: 600,
                dx: isMobile ? 5 : 10,
                dy: getMainLabelDy(),
              }}
              tickCount={4}
              tick={{
                fill: 'white',
                fontSize: getTickFontSize(),
              }}
              tickMargin={0}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={([dataMin, dataMax]) => [0, dataMax > 60 ? 100 : 60]}
            >
              <Label
                value="← Unlikely"
                dx={10}
                angle={-90}
                fontSize={getDirectionalLabelFontSize()}
                fontWeight={500}
                dy={getUnlikelyLabelDy()}
                position="insideLeft"
                fill="#BF5F52"
              />
              <Label
                value="Likely →"
                fill="#BF5F52"
                position="insideLeft"
                fontSize={getDirectionalLabelFontSize()}
                dx={10}
                angle={-90}
                fontWeight={500}
                dy={getLikelyLabelDy()}
              />
            </YAxis>
            {moveMap?.map((entry, index) => {
              // Set minimum opacity to 0.5 to ensure visibility
              const opacity = Math.max(entry.opacity ?? 1, 0.5)
              const size = entry.size ?? (isMobile ? 8 : 10)
              const baseColor = colorSanMapping[entry.move]?.color ?? '#fff'
              const fillColor = baseColor.startsWith('#')
                ? hexToRgba(baseColor, opacity)
                : baseColor

              return (
                <Scatter
                  key={`scatter-${entry.move}${index}`}
                  name={`Move-${entry.move}`}
                  data={[entry]}
                  fill={fillColor}
                  r={size}
                >
                  <Cell
                    fill={fillColor}
                    onMouseEnter={(event) =>
                      onMouseEnter(entry.move, entry, event)
                    }
                    onMouseLeave={onMouseLeave}
                    onMouseDown={() => makeMove(entry.move)}
                    style={{ cursor: 'pointer' }}
                  />
                </Scatter>
              )
            })}
          </ScatterChart>
        </ResponsiveContainer>

        {/* Comprehensive tooltip */}
        {renderTooltip()}
      </div>
    </div>
  )
}
