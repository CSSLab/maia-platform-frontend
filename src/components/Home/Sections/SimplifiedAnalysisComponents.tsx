import Chessground from '@react-chess/chessground'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Scatter,
  ScatterChart,
  CartesianGrid,
  Tooltip,
  Cell,
  Label,
  Legend,
  LabelList,
} from 'recharts'
import { motion } from 'framer-motion'
import { ContentType } from 'recharts/types/component/Label'
import { useEffect, useRef, useState } from 'react'

type ChessMove = 'e4' | 'd4' | 'Nf3' | 'c4' | 'g3' | 'a4' | 'h4'
type ColorSanMapping = Record<ChessMove, { san: string; color: string }>

const COLORS = {
  good: ['#238b45', '#41ab5d', '#74c476', '#a1d99b', '#c7e9c0'],
  ok: ['#feb24c', '#fed976', '#ffeda0', '#ffffcc'].reverse(),
  blunder: ['#cb181d', '#ef3b2c', '#fb6a4a', '#fc9272', '#fcbba1'].reverse(),
}

const MOCK_COLOR_SAN_MAPPING: Partial<ColorSanMapping> = {
  e4: { san: 'e4', color: COLORS.good[0] },
  d4: { san: 'd4', color: COLORS.good[1] },
  Nf3: { san: 'Nf3', color: COLORS.ok[0] },
}

// Only include moves that have data in MOCK_MOVES_BY_RATING
const MOVES_WITH_DATA = ['e4', 'd4', 'Nf3'] as const

interface MovesByRatingData {
  rating: number
  [key: string]: number // Allow dynamic move keys
}

interface SimplifiedMovesByRatingProps {
  data?: MovesByRatingData[]
  moves?: readonly string[]
  colorMapping?: Record<string, { san: string; color: string }>
  title?: string
}

const MOCK_MOVES_BY_RATING: MovesByRatingData[] = [
  { rating: 1100, e4: 63.2, d4: 22.7, Nf3: 9.5 },
  { rating: 1300, e4: 49.2, d4: 38.4, Nf3: 22.1 },
  { rating: 1500, e4: 52.8, d4: 33.6, Nf3: 15.3 },
  { rating: 1700, e4: 34.2, d4: 51.7, Nf3: 31.4 },
  { rating: 1900, e4: 41.5, d4: 37.8, Nf3: 28.6 },
]

interface MoveMapEntry {
  move: ChessMove
  x: number
  y: number
}

const MOCK_MOVE_MAP: MoveMapEntry[] = [
  { move: 'e4', x: -0.1, y: 75 },
  { move: 'd4', x: -0.3, y: 65 },
  { move: 'Nf3', x: -0.5, y: 45 },
  { move: 'c4', x: -0.8, y: 35 },
  { move: 'g3', x: -1.2, y: 25 },
]

interface MoveWithProbability {
  move: ChessMove
  probability: number
}

interface BlunderMeterData {
  goodMoves: {
    probability: number
    moves: MoveWithProbability[]
  }
  okMoves: {
    probability: number
    moves: MoveWithProbability[]
  }
  blunderMoves: {
    probability: number
    moves: MoveWithProbability[]
  }
}

const MOCK_BLUNDER_METER: BlunderMeterData = {
  goodMoves: {
    probability: 16,
    moves: [
      { move: 'e4', probability: 30 },
      { move: 'd4', probability: 25 },
      { move: 'Nf3', probability: 20 },
    ],
  },
  okMoves: {
    probability: 12,
    moves: [
      { move: 'c4', probability: 15 },
      { move: 'g3', probability: 12 },
    ],
  },
  blunderMoves: {
    probability: 72,
    moves: [
      { move: 'a4', probability: 10 },
      { move: 'h4', probability: 8 },
    ],
  },
}

const DEMO_FEN = '3r1k2/5pp1/4p2p/1R6/8/5P2/r4PPP/4R1K1 w - - 0 1'

const getColorForMove = (move: string | number | undefined) => {
  if (typeof move === 'string' && move in MOCK_COLOR_SAN_MAPPING) {
    return MOCK_COLOR_SAN_MAPPING[move as ChessMove]?.color ?? '#fff'
  }
  return '#fff'
}

const getSanForMove = (move: string | number | undefined) => {
  if (typeof move === 'string' && move in MOCK_COLOR_SAN_MAPPING) {
    return MOCK_COLOR_SAN_MAPPING[move as ChessMove]?.san ?? move
  }
  return move?.toString() ?? ''
}

export const SimplifiedMovesByRating = ({
  data = MOCK_MOVES_BY_RATING,
  moves = MOVES_WITH_DATA,
  colorMapping = MOCK_COLOR_SAN_MAPPING,
  title = 'Moves by Rating',
}: SimplifiedMovesByRatingProps) => {
  const getColorForMoveLocal = (move: string | number | undefined) => {
    if (typeof move === 'string' && move in colorMapping) {
      return colorMapping[move]?.color ?? '#fff'
    }
    return '#fff'
  }

  const getSanForMoveLocal = (move: string | number | undefined) => {
    if (typeof move === 'string' && move in colorMapping) {
      return colorMapping[move]?.san ?? move
    }
    return move?.toString() ?? ''
  }

  return (
    <div className="flex h-64 w-full flex-col rounded bg-background-1/60 md:h-full">
      <motion.p
        className="p-3 text-primary md:text-lg"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {title}
      </motion.p>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ left: 0, right: 50, bottom: 0, top: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#3C3C3C" />
          <XAxis
            dataKey="rating"
            axisLine={false}
            tick={{ fill: 'white', fontSize: 11 }}
            tickMargin={4}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            axisLine={false}
            domain={[0, 100]}
            tick={{ fill: 'white', fontSize: 11 }}
            label={{
              value: 'Maia Probability',
              angle: -90,
              fill: '#FE7F6D',
              position: 'insideLeft',
              dy: 46,
              offset: 15,
              fontWeight: 600,
              fontSize: 14,
            }}
            tickCount={5}
            tickMargin={2}
            tickLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <defs>
            {moves.map((move) => (
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
                  stopColor={getColorForMoveLocal(move)}
                  stopOpacity={0.5}
                />
                <stop
                  offset="95%"
                  stopColor={getColorForMoveLocal(move)}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
          {moves.map((move, index) => (
            <Area
              key={move}
              yAxisId="left"
              dataKey={move}
              stroke={getColorForMoveLocal(move)}
              fill={`url(#color${move})`}
              strokeWidth={3}
              name={getSanForMoveLocal(move)}
              animationDuration={300}
            />
          ))}
          <Tooltip
            content={({ payload }) => {
              return (
                <motion.div
                  className="flex w-32 flex-col rounded border border-white/10 bg-background-1 pb-2"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex px-3 py-2">
                    {payload ? (
                      <p className="text-sm">{payload[0]?.payload.rating}</p>
                    ) : null}
                  </div>
                  {payload?.map((point, index) => {
                    const san = point.name
                    const prob = Math.round((point.value as number) * 10) / 10

                    return (
                      <motion.div
                        key={san}
                        className="flex items-center justify-between px-3"
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                      >
                        <p
                          style={{
                            color: getColorForMoveLocal(san),
                          }}
                          className="text-xs"
                        >
                          {getSanForMoveLocal(san)}
                        </p>
                        <p
                          style={{
                            color: getColorForMoveLocal(san),
                          }}
                          className="font-mono text-xs"
                        >
                          {prob}%
                        </p>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )
            }}
          />
          <Legend
            align="right"
            verticalAlign="top"
            wrapperStyle={{
              top: -14,
              right: 20,
              fontSize: 14,
            }}
            iconSize={0}
            formatter={(value) => getSanForMoveLocal(value)}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Simplified MoveMap component
export const SimplifiedMoveMap = () => {
  return (
    <div className="flex h-64 max-h-full flex-col overflow-hidden bg-background-1/60 md:h-full md:rounded">
      <p className="p-3 text-primary md:text-lg">Move Map</p>
      <div className="flex h-full w-full flex-col">
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
                fontSize: 14,
                fontWeight: 600,
                offset: -8,
                dx: -12,
              }}
              tickCount={5}
              tickLine={false}
              tickMargin={0}
              tick={{ fill: 'white', fontSize: 11 }}
              domain={[-4, 0]}
              ticks={[-4, -3, -2, -1, 0]}
            >
              <Label
                value="← Blunders"
                position="insideBottomLeft"
                fill="#5A9DD7"
                fontSize={12}
                fontWeight={500}
                dy={10}
                dx={-18}
              />
              <Label
                value="Best Moves →"
                position="insideBottomRight"
                fontSize={12}
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
                fontSize: 14,
                fontWeight: 600,
                dx: 10,
                dy: 32,
              }}
              tickCount={4}
              tick={{ fill: 'white', fontSize: 11 }}
              tickMargin={0}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
            >
              <Label
                value="← Unlikely"
                dx={10}
                angle={-90}
                fontSize={12}
                fontWeight={500}
                dy={140}
                position="insideLeft"
                fill="#BF5F52"
              />
              <Label
                value="Likely →"
                fill="#BF5F52"
                position="insideLeft"
                fontSize={12}
                dx={10}
                angle={-90}
                fontWeight={500}
                dy={-56}
              />
            </YAxis>
            <Scatter name="Moves" data={MOCK_MOVE_MAP}>
              <LabelList
                dataKey="move"
                position="top"
                fontSize={12}
                fill="white"
                content={
                  (({
                    x,
                    y,
                    value,
                    index,
                  }: {
                    x: number
                    y: number
                    value: string
                    index: number
                  }) => {
                    return (
                      <text
                        x={x}
                        y={y}
                        key={index}
                        fontSize={12}
                        textAnchor="middle"
                        dx={x < 100 ? 22 : -15}
                        dy={8}
                        fill={getColorForMove(value as ChessMove)}
                      >
                        {getSanForMove(value as ChessMove)}
                      </text>
                    )
                  }) as ContentType
                }
              />
              {MOCK_MOVE_MAP.map((entry, index) => (
                <Cell
                  key={`cell-${entry.move}${index}`}
                  fill={getColorForMove(entry.move as ChessMove)}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export const SimplifiedBlunderMeter = () => {
  return (
    <div className="flex w-full flex-col gap-1 overflow-hidden rounded bg-background-1/60 p-3">
      <div className="flex h-6 w-full flex-col overflow-hidden">
        <div className="flex h-full w-full select-none flex-row overflow-hidden rounded">
          <motion.div
            className="flex h-full flex-col items-start justify-start overflow-hidden"
            animate={{
              width: MOCK_BLUNDER_METER.goodMoves.probability + '%',
              maxWidth: MOCK_BLUNDER_METER.goodMoves.probability + '%',
              height: '100%',
            }}
          >
            <motion.div className="flex h-full w-full flex-col items-center justify-center rounded-l bg-[#238b45]">
              <motion.p className="text-xs font-bold text-black text-opacity-50">
                {Math.round(MOCK_BLUNDER_METER.goodMoves.probability)}%
              </motion.p>
            </motion.div>
          </motion.div>
          <motion.div
            className="flex h-full flex-col items-start justify-start overflow-hidden"
            animate={{
              width: MOCK_BLUNDER_METER.okMoves.probability + '%',
              maxWidth: MOCK_BLUNDER_METER.okMoves.probability + '%',
              height: '100%',
            }}
          >
            <motion.div className="flex h-full w-full flex-col items-center justify-center bg-[#fed976]">
              <motion.p className="text-xs font-bold text-black text-opacity-50">
                {Math.round(MOCK_BLUNDER_METER.okMoves.probability)}%
              </motion.p>
            </motion.div>
          </motion.div>

          <motion.div
            className="flex h-full flex-col items-start justify-start overflow-hidden"
            animate={{
              width: MOCK_BLUNDER_METER.blunderMoves.probability + '%',
              maxWidth: MOCK_BLUNDER_METER.blunderMoves.probability + '%',
              height: '100%',
            }}
          >
            <motion.div className="flex h-full w-full flex-col items-center justify-center rounded-r bg-[#cb181d]">
              <motion.p className="text-xs font-bold text-black text-opacity-50">
                {Math.round(MOCK_BLUNDER_METER.blunderMoves.probability)}%
              </motion.p>
            </motion.div>
          </motion.div>
        </div>
      </div>
      <div className="flex justify-between px-1 text-xs text-primary/60">
        <span>Best Moves</span>
        <span>OK Moves</span>
        <span>Blunder Moves</span>
      </div>
    </div>
  )
}

export const SimplifiedChessboard = ({ forceKey }: { forceKey?: number }) => {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const stableKey = `chess-${forceKey || 0}-${windowSize.width}-${windowSize.height}`

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{
        transform: 'translateZ(0)',
        aspectRatio: '1/1',
      }}
    >
      <div
        className="h-full w-full"
        style={{
          position: 'relative',
          transform: 'translateZ(0)',
        }}
      >
        <Chessground
          key={stableKey}
          contained
          config={{
            fen: DEMO_FEN,
            viewOnly: true,
            coordinates: true,
            animation: {
              duration: 0,
            },
            disableContextMenu: true,
            highlight: {
              lastMove: false,
              check: false,
            },
            drawable: {
              enabled: false,
              visible: false,
            },
          }}
        />
      </div>
    </div>
  )
}

export const SimplifiedHighlight = () => {
  const moveData = [
    { move: 'Rb7+', maiaPct: '67.3%', sfEval: '+2.1', color: '#238b45' },
    { move: 'Rb6+', maiaPct: '24.8%', sfEval: '+1.8', color: '#41ab5d' },
    { move: 'Re7', maiaPct: '5.2%', sfEval: '+1.4', color: '#74c476' },
    { move: 'Rc5', maiaPct: '2.1%', sfEval: '+0.9', color: '#a1d99b' },
    { move: 'Ra5', maiaPct: '0.4%', sfEval: '+0.3', color: '#c7e9c0' },
    { move: 'Rd5', maiaPct: '0.2%', sfEval: '-0.1', color: '#feb24c' },
  ]

  return (
    <div className="flex w-full flex-col gap-2 overflow-hidden rounded bg-background-1/60 p-3">
      <p className="text-lg text-primary">Position Analysis</p>
      <p className="text-sm text-primary/80">
        White has a decisive advantage with the rook on b5 threatening the 7th
        rank. Black&apos;s misplaced rook and exposed king create tactical
        opportunities.
      </p>
      <div className="grid grid-cols-2 gap-4 rounded bg-background-1/80 p-2">
        <div className="flex flex-col items-center justify-center gap-1 bg-human-3/5 py-2">
          <p className="text-center text-xs text-human-2">
            Maia 1900
            <br />
            White Win %
          </p>
          <p className="text-xl font-bold text-human-1">67.3%</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 bg-engine-3/5 py-2">
          <p className="text-center text-xs text-engine-2">
            SF Eval
            <br />
            (Depth 24)
          </p>
          <p className="text-xl font-bold text-engine-1">+2.1</p>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
          <div className="grid grid-rows-2 items-center justify-center">
            {moveData.map((data, index) => {
              let visibilityClass = ''
              if (index === 2) visibilityClass = 'hidden xl:grid'
              else if (index === 3) visibilityClass = 'hidden 2xl:grid'
              else if (index === 4) visibilityClass = 'hidden 3xl:grid'
              else if (index === 5) visibilityClass = 'hidden 4xl:grid'

              return (
                <div
                  key={`maia-${index}`}
                  className={`grid cursor-pointer grid-cols-2 gap-3 ${visibilityClass}`}
                >
                  <p
                    className="text-right font-mono text-xs"
                    style={{ color: data.color }}
                  >
                    {data.maiaPct}
                  </p>
                  <p
                    className="text-left font-mono text-xs"
                    style={{ color: data.color }}
                  >
                    {data.move}
                  </p>
                </div>
              )
            })}
          </div>
          <div className="grid grid-rows-2 items-center justify-center">
            {moveData.map((data, index) => {
              let visibilityClass = ''
              if (index === 2) visibilityClass = 'hidden xl:grid'
              else if (index === 3) visibilityClass = 'hidden 2xl:grid'
              else if (index === 4) visibilityClass = 'hidden 3xl:grid'
              else if (index === 5) visibilityClass = 'hidden 4xl:grid'

              return (
                <div
                  key={`sf-${index}`}
                  className={`grid cursor-pointer grid-cols-2 gap-3 ${visibilityClass}`}
                >
                  <p
                    className="text-right font-mono text-xs"
                    style={{ color: data.color }}
                  >
                    {data.sfEval}
                  </p>
                  <p
                    className="text-left font-mono text-xs"
                    style={{ color: data.color }}
                  >
                    {data.move}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
