import Link from 'next/link'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { useState, useEffect, useRef } from 'react'
import Chessground from '@react-chess/chessground'
import type { DrawShape } from 'chessground/draw'
import type { Key } from 'chessground/types'
import { SimplifiedMovesByRating } from './SimplifiedAnalysisComponents'

interface TrainSectionProps {
  id: string
}

interface MovesByRatingData {
  rating: number
  bestMove: number
  commonMistake: number
  otherMistake: number
}

interface ChessPuzzle {
  id: string
  fen: string
  bestMove: { orig: Key; dest: Key; brush: string }
  description: string
  solution: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  skill: string
  theme: string
  ratingData: MovesByRatingData[]
  movesMapping: {
    bestMove: string
    commonMistake: string
    otherMistake: string
  }
  explanation: string
}

const PUZZLES: ChessPuzzle[] = [
  {
    id: 'puzzle1',
    fen: '3r1k2/5pp1/4p2p/1R6/8/5P2/r4PPP/4R1K1 w - - 0 1',
    bestMove: { orig: 'b5' as Key, dest: 'b7' as Key, brush: 'green' },
    description: 'Find the winning tactic for White',
    solution: 'Rb7 threatening the 7th rank',
    difficulty: 'Intermediate',
    skill: 'Tactical Vision',
    theme: 'Seventh Rank Attack',
    movesMapping: {
      bestMove: 'Rb7',
      commonMistake: 'Rb6',
      otherMistake: 'Re5',
    },
    ratingData: [
      { rating: 1200, bestMove: 24, commonMistake: 42, otherMistake: 34 },
      { rating: 1400, bestMove: 35, commonMistake: 38, otherMistake: 27 },
      { rating: 1600, bestMove: 48, commonMistake: 32, otherMistake: 20 },
      { rating: 1800, bestMove: 61, commonMistake: 24, otherMistake: 15 },
      { rating: 2000, bestMove: 76, commonMistake: 18, otherMistake: 6 },
    ],
    explanation:
      'The Rb7 move threatens to invade the 7th rank, creating immediate threats against the king. Lower-rated players often miss this tactical opportunity, opting instead for less decisive moves like Rb6.',
  },
  {
    id: 'puzzle2',
    fen: 'r1bqk2r/pp1n1ppp/2pbpn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 0 7',
    bestMove: { orig: 'd1' as Key, dest: 'd2' as Key, brush: 'green' },
    description: 'Find the best development move',
    solution: 'Qd2 connecting the rooks',
    difficulty: 'Beginner',
    skill: 'Development',
    theme: 'Piece Coordination',
    movesMapping: {
      bestMove: 'Qd2',
      commonMistake: 'Bd2',
      otherMistake: 'a3',
    },
    ratingData: [
      { rating: 1200, bestMove: 31, commonMistake: 39, otherMistake: 30 },
      { rating: 1400, bestMove: 42, commonMistake: 35, otherMistake: 23 },
      { rating: 1600, bestMove: 53, commonMistake: 31, otherMistake: 16 },
      { rating: 1800, bestMove: 64, commonMistake: 26, otherMistake: 10 },
      { rating: 2000, bestMove: 72, commonMistake: 23, otherMistake: 5 },
    ],
    explanation:
      'Queen to d2 connects the rooks and prepares for castling. Many beginners fail to recognize the importance of connecting rooks early in the game, often choosing less harmonious development moves.',
  },
  {
    id: 'puzzle3',
    fen: '2r2rk1/pp1bppbp/3p1np1/q7/3PPPP1/1NN1B3/PPP5/R2QK2R b KQ - 0 13',
    bestMove: { orig: 'a5' as Key, dest: 'a2' as Key, brush: 'green' },
    description: 'Find the tactical shot for Black',
    solution: 'Qa2 winning material',
    difficulty: 'Advanced',
    skill: 'Tactics',
    theme: 'Material Gain',
    movesMapping: {
      bestMove: 'Qa2',
      commonMistake: 'Qb5',
      otherMistake: 'Qc5',
    },
    ratingData: [
      { rating: 1200, bestMove: 12, commonMistake: 53, otherMistake: 35 },
      { rating: 1400, bestMove: 23, commonMistake: 48, otherMistake: 29 },
      { rating: 1600, bestMove: 35, commonMistake: 43, otherMistake: 22 },
      { rating: 1800, bestMove: 52, commonMistake: 34, otherMistake: 14 },
      { rating: 2000, bestMove: 71, commonMistake: 21, otherMistake: 8 },
    ],
    explanation:
      'The queen sacrifice Qa2 leads to a material advantage. The difficulty in this position lies in calculating the consequences several moves ahead, which is why lower-rated players often miss this opportunity.',
  },
  {
    id: 'puzzle4',
    fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 0 1',
    bestMove: { orig: 'c4' as Key, dest: 'f7' as Key, brush: 'green' },
    description: 'Find the tactical opportunity',
    solution: 'Bxf7+ winning material',
    difficulty: 'Intermediate',
    skill: 'Tactics',
    theme: 'Bishop Sacrifice',
    movesMapping: {
      bestMove: 'Bxf7+',
      commonMistake: 'Bd5',
      otherMistake: 'b4',
    },
    ratingData: [
      { rating: 1200, bestMove: 19, commonMistake: 43, otherMistake: 38 },
      { rating: 1400, bestMove: 32, commonMistake: 41, otherMistake: 27 },
      { rating: 1600, bestMove: 45, commonMistake: 38, otherMistake: 17 },
      { rating: 1800, bestMove: 59, commonMistake: 32, otherMistake: 9 },
      { rating: 2000, bestMove: 75, commonMistake: 19, otherMistake: 6 },
    ],
    explanation:
      'The bishop sacrifice on f7 is a classic tactical motif. Lower-rated players often overlook sacrifices, preferring safer moves that do not immediately win material but also do not create tactical opportunities.',
  },
  {
    id: 'puzzle5',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQR1K1 w - - 0 1',
    bestMove: { orig: 'c4' as Key, dest: 'f7' as Key, brush: 'green' },
    description: 'Find the winning combination',
    solution: 'Bxf7+ followed by Ng5+',
    difficulty: 'Advanced',
    skill: 'Combinations',
    theme: 'Double Attack',
    movesMapping: {
      bestMove: 'Bxf7+',
      commonMistake: 'Bb5',
      otherMistake: 'Qd2',
    },
    ratingData: [
      { rating: 1200, bestMove: 15, commonMistake: 47, otherMistake: 38 },
      { rating: 1400, bestMove: 26, commonMistake: 43, otherMistake: 31 },
      { rating: 1600, bestMove: 41, commonMistake: 37, otherMistake: 22 },
      { rating: 1800, bestMove: 58, commonMistake: 31, otherMistake: 11 },
      { rating: 2000, bestMove: 74, commonMistake: 21, otherMistake: 5 },
    ],
    explanation:
      'This position features a multi-move combination starting with Bxf7+. The key insight is seeing beyond the initial sacrifice to the knight fork that follows, a calculation that improves dramatically with rating.',
  },
]

// Responsive chessboard component for TrainSection
const ResponsiveTrainChessboard = ({
  puzzle,
  shapes,
  forceKey,
}: {
  puzzle: ChessPuzzle
  shapes: DrawShape[]
  forceKey: number
}) => {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const stableKey = `train-chess-${puzzle.id}-${forceKey}-${windowSize.width}-${windowSize.height}`

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
            fen: puzzle.fen,
            viewOnly: true,
            coordinates: true,
            drawable: {
              enabled: true,
              visible: true,
              defaultSnapToValidMove: true,
              shapes,
              brushes: {
                green: {
                  key: 'g',
                  color: '#15781B',
                  opacity: 1,
                  lineWidth: 10,
                },
                red: {
                  key: 'r',
                  color: '#882020',
                  opacity: 1,
                  lineWidth: 10,
                },
                blue: {
                  key: 'b',
                  color: '#003088',
                  opacity: 1,
                  lineWidth: 10,
                },
                yellow: {
                  key: 'y',
                  color: '#e68f00',
                  opacity: 1,
                  lineWidth: 10,
                },
              },
            },
            highlight: {
              lastMove: true,
              check: true,
            },
            animation: {
              duration: 0,
            },
            disableContextMenu: true,
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

  const [currentPuzzle, setCurrentPuzzle] = useState(0)
  const [shapes, setShapes] = useState<DrawShape[]>([])

  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  // Force re-mounts of the board to ensure Chessground recalculates its
  // dimensions correctly on small screens after layout shifts.
  const [renderKey, setRenderKey] = useState(0)

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })

      // Re-render the board on window resize so it always fits its container
      setRenderKey((prev) => prev + 1)
    }

    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setShapes([PUZZLES[currentPuzzle].bestMove])
  }, [currentPuzzle])

  useEffect(() => {
    if (!inView) return

    const positionInterval = setInterval(() => {
      setCurrentPuzzle((prev) => (prev + 1) % PUZZLES.length)
    }, 8000)

    // Allow the layout to settle and then re-mount the board a few times so
    // Chessground can pick up the final container size, similar to the
    // behaviour in AnalysisSection.
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
      clearInterval(positionInterval)

      timeoutIds.forEach((id) => clearTimeout(id))
    }
  }, [inView])

  useEffect(() => {
    const timeouts = [100, 200, 300, 500, 700, 1000]
    const timeoutIds = timeouts.map((timeout) =>
      setTimeout(() => {
        setShapes([PUZZLES[currentPuzzle].bestMove])
      }, timeout),
    )

    return () => {
      timeoutIds.forEach((id) => clearTimeout(id))
    }
  }, [currentPuzzle])

  const puzzle = PUZZLES[currentPuzzle]

  return (
    <section
      id={id}
      className="relative w-full flex-col items-center overflow-hidden py-10 md:py-16"
      ref={ref}
    >
      <div className="z-10 mx-auto flex w-full max-w-[95%] flex-col items-center px-2 md:max-w-[90%] md:flex-row md:gap-12 md:px-4 lg:gap-16">
        <div className="mb-6 w-full md:mb-0 md:mb-10 md:w-2/5">
          <div className="bg-human-3/10 mb-3 inline-block rounded-full px-4 py-1 text-sm font-medium text-human-3 md:mb-4">
            Human-Centered Puzzles
          </div>
          <h2 className="mb-4 text-2xl font-bold md:mb-6 md:text-3xl md:text-4xl lg:text-5xl">
            Train with Maia as your coach
          </h2>
          <p className="text-primary/80 mb-3 text-base md:mb-4 md:text-lg">
            Maia curates puzzles based on its understanding of how millions of
            players improve. With Maia puzzles, you can benchmark your vision,
            focus on your gaps in understanding, and turn hard-to-spot ideas
            into second nature.
          </p>
          <p className="text-primary/80 mb-3 text-base md:mb-4 md:text-lg">
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
            <div className="border-background-3/20 border-b px-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      puzzle.difficulty === 'Beginner'
                        ? 'bg-human-1'
                        : puzzle.difficulty === 'Intermediate'
                          ? 'bg-human-3'
                          : 'bg-engine-3'
                    } mr-2`}
                  />
                  <p className="font-medium text-primary">
                    {puzzle.difficulty} Puzzle
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="bg-background-3/80 text-primary/60 rounded px-2 py-1 text-xs">
                    {puzzle.theme}
                  </span>
                  <span className="bg-background-3/80 text-primary/60 rounded px-2 py-1 text-xs">
                    {puzzle.skill}
                  </span>
                </div>
              </div>
              <p className="text-sm text-secondary">{puzzle.description}</p>
            </div>
            <div className="flex flex-col gap-4 p-4 md:flex-row">
              <div className="flex w-full justify-center md:w-1/2">
                <motion.div
                  className="w-full"
                  style={{
                    transform: 'translateZ(0)',
                  }}
                >
                  <ResponsiveTrainChessboard
                    puzzle={puzzle}
                    shapes={shapes}
                    forceKey={renderKey}
                  />
                </motion.div>
              </div>
              <div className="flex w-full flex-col md:w-1/2">
                <motion.div
                  className="h-full"
                  initial={{ opacity: 0, y: 20 }}
                  animate={
                    inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                  }
                  transition={{ duration: 0.3, delay: 0.5 }}
                >
                  <SimplifiedMovesByRating />
                </motion.div>
                <div className="text-primary/80 mt-3 text-sm">
                  <motion.h4
                    className="mb-1 font-medium"
                    initial={{ opacity: 0, y: 10 }}
                    animate={
                      inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }
                    }
                    transition={{ duration: 0.3, delay: 0.7 }}
                  >
                    Move Analysis
                  </motion.h4>
                  <motion.p
                    className="mb-3 text-xs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={
                      inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }
                    }
                    transition={{ duration: 0.3, delay: 0.8 }}
                  >
                    {puzzle.explanation}
                  </motion.p>
                  <motion.ul
                    className="space-y-1 text-xs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={
                      inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }
                    }
                    transition={{ duration: 0.3, delay: 0.9 }}
                  >
                    <li className="flex items-center">
                      <span className="mr-2 h-3 w-3 rounded-full bg-[#238b45]"></span>
                      <span className="font-mono font-medium">
                        {puzzle.movesMapping.bestMove}
                      </span>
                      <span className="ml-2">- Best move</span>
                    </li>
                    <li className="flex items-center">
                      <span className="mr-2 h-3 w-3 rounded-full bg-[#feb24c]"></span>
                      <span className="font-mono font-medium">
                        {puzzle.movesMapping.commonMistake}
                      </span>
                      <span className="ml-2">- Common mistake</span>
                    </li>
                    <li className="flex items-center">
                      <span className="mr-2 h-3 w-3 rounded-full bg-[#cb181d]"></span>
                      <span className="font-mono font-medium">
                        {puzzle.movesMapping.otherMistake}
                      </span>
                      <span className="ml-2">- Other mistake</span>
                    </li>
                  </motion.ul>
                </div>
              </div>
            </div>
            <motion.div
              className="border-background-3/20 flex items-center justify-center border-t p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <div className="flex items-center gap-2">
                {PUZZLES.map((_, idx) => {
                  const isActive = currentPuzzle === idx
                  return (
                    <motion.button
                      key={idx}
                      className={`h-2 w-8 rounded-full ${isActive ? 'scale-110' : ''}`}
                      onClick={() => setCurrentPuzzle(idx)}
                      initial={{
                        backgroundColor: isActive
                          ? '#5292e1'
                          : 'rgba(82, 82, 82, 0.2)',
                      }}
                      animate={{
                        backgroundColor: isActive
                          ? '#5292e1'
                          : 'rgba(82, 82, 82, 0.2)',
                        scale: isActive ? 1.1 : 1,
                        transition: {
                          backgroundColor: { duration: 0.3 },
                          scale: {
                            duration: 0.2,
                            type: 'spring',
                            stiffness: 500,
                          },
                        },
                      }}
                      whileHover={{
                        scale: 1.15,
                        backgroundColor: isActive
                          ? '#5292e1'
                          : 'rgba(255, 255, 255, 0.3)',
                      }}
                      whileTap={{ scale: 0.95 }}
                    />
                  )
                })}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
      <style jsx global>{`
        coords.ranks {
          right: 0 !important;
          top: 0 !important;
          width: 18px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-around !important;
          align-items: center !important;
          height: 100% !important;
          pointer-events: none !important;
        }

        coords.files {
          bottom: 0 !important;
          left: 0 !important;
          width: 100% !important;
          display: flex !important;
          flex-direction: row !important;
          justify-content: space-around !important;
          align-items: center !important;
          height: 18px !important;
          pointer-events: none !important;
        }
      `}</style>
    </section>
  )
}
