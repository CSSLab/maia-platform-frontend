import Link from 'next/link'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { useState, useEffect, useRef } from 'react'
import Chessground from '@react-chess/chessground'
import type { DrawShape } from 'chessground/draw'
import type { Key } from 'chessground/types'
import { MovesByRating } from 'src/components/Analysis/MovesByRating'
import { MoveTooltip } from 'src/components/Analysis/MoveTooltip'
import { puzzleMockData } from './puzzleMockData.js'
import type {
  ColorSanMapping,
  MaiaEvaluation,
  StockfishEvaluation,
} from 'src/types'

interface TrainSectionProps {
  id: string
}

// Custom chessboard component for the puzzle
const PuzzleChessboard = ({ forceKey }: { forceKey?: number }) => {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const stableKey = `puzzle-chess-${forceKey || 0}-${windowSize.width}-${windowSize.height}`

  // Define the puzzle arrows
  const arrows: DrawShape[] = [
    {
      brush: 'red',
      orig: 'g4' as Key,
      dest: 'e2' as Key,
      modifiers: { lineWidth: 8 },
    },
    {
      brush: 'blue',
      orig: 'g7' as Key,
      dest: 'f6' as Key,
      modifiers: { lineWidth: 8 },
    },
  ]

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
            fen: puzzleMockData.fen,
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
              enabled: true,
              visible: true,
              autoShapes: arrows,
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
              },
            },
          }}
        />
      </div>
    </div>
  )
}

export const TrainSection = ({ id }: TrainSectionProps) => {
  const [ref, inView] = useInView({
    triggerOnce: false,
    threshold: 0.1,
  })

  const [renderKey, setRenderKey] = useState(0)
  const [tooltipData, setTooltipData] = useState<{
    move: string
    position: { x: number; y: number }
  } | null>(null)

  // Create move evaluation data for tooltips
  const moveEvaluation = {
    maia: {
      policy:
        puzzleMockData.moveRecommendations.maia?.reduce(
          (acc, rec) => {
            acc[rec.move] = rec.prob
            return acc
          },
          {} as Record<string, number>,
        ) || {},
      value: 0.5,
    } as MaiaEvaluation,
    stockfish: {
      sent: true,
      depth: 24,
      model_move: puzzleMockData.moveRecommendations.stockfish?.[0]?.move || '',
      model_optimal_cp:
        puzzleMockData.moveRecommendations.stockfish?.[0]?.cp || 0,
      cp_vec:
        puzzleMockData.moveRecommendations.stockfish?.reduce(
          (acc, rec) => {
            acc[rec.move] = rec.cp
            return acc
          },
          {} as Record<string, number>,
        ) || {},
      cp_relative_vec:
        puzzleMockData.moveRecommendations.stockfish?.reduce(
          (acc, rec) => {
            acc[rec.move] = rec.cp_relative || 0
            return acc
          },
          {} as Record<string, number>,
        ) || {},
      winrate_vec:
        puzzleMockData.moveRecommendations.stockfish?.reduce(
          (acc, rec) => {
            acc[rec.move] = rec.winrate || 0
            return acc
          },
          {} as Record<string, number>,
        ) || {},
    } as StockfishEvaluation,
  }

  const handleMouseEnter = (move: string, event: React.MouseEvent) => {
    setTooltipData({
      move,
      position: { x: event.clientX, y: event.clientY },
    })
  }

  const handleMouseLeave = () => {
    setTooltipData(null)
  }

  const handleHover = (move?: string) => {
    // Handle move hover for highlighting
  }

  const handleMakeMove = (move: string) => {
    // Handle move selection
    console.log('Move selected:', move)
  }

  useEffect(() => {
    const handleResize = () => {
      setRenderKey((prev) => prev + 1)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!inView) return

    const timeoutIds: NodeJS.Timeout[] = []
    const delays = [100, 300, 500]
    delays.forEach((delay) => {
      timeoutIds.push(
        setTimeout(() => {
          setRenderKey((prev) => prev + 1)
        }, delay),
      )
    })

    return () => {
      timeoutIds.forEach((id) => clearTimeout(id))
    }
  }, [inView])

  return (
    <section
      id={id}
      className="relative w-full flex-col items-center overflow-hidden py-10 md:py-16"
      ref={ref}
    >
      <div className="z-10 mx-auto flex w-full max-w-[95%] flex-col items-center px-2 md:max-w-[90%] md:flex-row md:gap-12 md:px-4 lg:gap-16">
        <div className="mb-6 w-full md:mb-10 md:w-2/5">
          <div className="mb-3 inline-block rounded-full bg-human-3/10 px-4 py-1 text-sm font-medium text-human-3 md:mb-4">
            Human-Centered Puzzles
          </div>
          <h2 className="mb-4 text-2xl font-bold md:mb-6 md:text-4xl lg:text-5xl">
            Train with Maia as your coach
          </h2>
          <p className="mb-3 text-base text-primary/80 md:mb-4 md:text-lg">
            Maia curates puzzles based on its understanding of how millions of
            players improve. With Maia puzzles, you can benchmark your vision,
            focus on your gaps in understanding, and turn hard-to-spot ideas
            into second nature.
          </p>
          <p className="mb-3 text-base text-primary/80 md:mb-4 md:text-lg">
            Each puzzle includes data showing how players of different ratings
            approach the position, making your training more targeted and
            effective.
          </p>
          <div className="flex flex-wrap gap-4">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/puzzles"
                className="flex items-center justify-center rounded-md bg-human-3 px-6 py-3 font-medium text-white transition duration-200 hover:bg-opacity-90"
              >
                Start Puzzles
              </Link>
            </motion.div>
          </div>
        </div>

        <motion.div
          className="relative w-full md:w-3/5"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="flex flex-col overflow-hidden rounded-lg bg-background-2 shadow-xl">
            <div className="border-b border-background-3/20 px-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="mr-2 h-2 w-2 rounded-full bg-human-3" />
                  <p className="font-medium text-primary">Tactical Puzzle</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded bg-background-3/80 px-2 py-1 text-xs text-primary/60">
                    Intermediate
                  </span>
                </div>
              </div>
              <p className="text-sm text-secondary">
                Find the best move in this tactical position
              </p>
            </div>

            <div className="flex flex-col gap-4 p-4 md:flex-row">
              {/* Left side - Chessboard */}
              <div className="flex w-full justify-center md:w-1/2">
                <motion.div
                  className="w-full"
                  style={{
                    transform: 'translateZ(0)',
                  }}
                >
                  <div className="flex flex-col overflow-hidden rounded border border-white/10">
                    <div
                      className="relative w-full"
                      style={{
                        aspectRatio: '1/1',
                        transform: 'translateZ(0)',
                      }}
                    >
                      <div
                        className="h-full w-full"
                        style={{
                          position: 'relative',
                          transform: 'translateZ(0)',
                        }}
                      >
                        <PuzzleChessboard forceKey={renderKey} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Right side - Moves by Rating and Position Analysis */}
              <div className="flex w-full flex-col md:w-1/2">
                <motion.div
                  className="h-64"
                  initial={{ opacity: 0, y: 20 }}
                  animate={
                    inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                  }
                  transition={{ duration: 0.3, delay: 0.5 }}
                >
                  <div className="h-full w-full rounded border border-white/10 bg-background-1/60">
                    <MovesByRating
                      moves={puzzleMockData.movesByRating}
                      colorSanMapping={puzzleMockData.colorSanMapping}
                      isHomePage={true}
                    />
                  </div>
                </motion.div>

                {/* Position Analysis */}
                <motion.div
                  className="mt-3 overflow-hidden rounded border border-white/10 bg-background-1/60 p-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={
                    inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                  }
                  transition={{ duration: 0.3, delay: 0.6 }}
                >
                  <h4 className="mb-2 text-base font-semibold text-primary">
                    Position Analysis
                  </h4>
                  <p className="mb-3 text-xs leading-relaxed text-primary/80">
                    Be alert, this position is highly treacherous! It is easy to
                    go astray with tempting blunders like{' '}
                    <button
                      className="cursor-pointer font-mono hover:underline"
                      style={{ color: '#fcbba1' }}
                      onMouseEnter={(e) => handleMouseEnter('g4e2', e)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleMakeMove('g4e2')}
                    >
                      Bxe2
                    </button>
                    . Only{' '}
                    <button
                      className="cursor-pointer font-mono hover:underline"
                      style={{ color: '#238b45' }}
                      onMouseEnter={(e) => handleMouseEnter('g7f6', e)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleMakeMove('g7f6')}
                    >
                      Bxf6
                    </button>{' '}
                    offers an advantage, and it is hard for human players to
                    find.
                  </p>

                  <div className="flex flex-col gap-2 2xl:flex-row">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        <span className="mr-1.5 h-2.5 w-2.5 rounded-full bg-[#238b45]"></span>
                        <span className="text-[10px] text-primary/70">
                          Best Move
                        </span>
                      </div>
                      <button
                        className="cursor-pointer font-mono text-xs hover:underline"
                        style={{ color: '#238b45' }}
                        onMouseEnter={(e) => handleMouseEnter('g7f6', e)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleMakeMove('g7f6')}
                      >
                        Bxf6
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        <span className="mr-1.5 h-2.5 w-2.5 rounded-full bg-[#fcbba1]"></span>
                        <span className="text-[10px] text-primary/70">
                          Common Mistake
                        </span>
                      </div>
                      <button
                        className="cursor-pointer font-mono text-xs hover:underline"
                        style={{ color: '#fcbba1' }}
                        onMouseEnter={(e) => handleMouseEnter('g4e2', e)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleMakeMove('g4e2')}
                      >
                        Bxe2
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        <span className="mr-1.5 h-2.5 w-2.5 rounded-full bg-[#cb181d]"></span>
                        <span className="text-[10px] text-primary/70">
                          Other Mistake
                        </span>
                      </div>
                      <button
                        className="cursor-pointer font-mono text-xs hover:underline"
                        style={{ color: '#cb181d' }}
                        onMouseEnter={(e) => handleMouseEnter('d6f6', e)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleMakeMove('d6f6')}
                      >
                        Qxf6
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Tooltip */}
          {tooltipData && moveEvaluation && (
            <MoveTooltip
              move={tooltipData.move}
              colorSanMapping={puzzleMockData.colorSanMapping}
              maiaProb={moveEvaluation.maia?.policy[tooltipData.move]}
              stockfishCp={moveEvaluation.stockfish?.cp_vec[tooltipData.move]}
              stockfishWinrate={
                moveEvaluation.stockfish?.winrate_vec?.[tooltipData.move]
              }
              stockfishCpRelative={
                moveEvaluation.stockfish?.cp_relative_vec[tooltipData.move]
              }
              position={tooltipData.position}
            />
          )}
        </motion.div>
      </div>
    </section>
  )
}
