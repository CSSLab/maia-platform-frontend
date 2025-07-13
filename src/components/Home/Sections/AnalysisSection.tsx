import Link from 'next/link'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { useState, useEffect, useRef } from 'react'
import {
  SimplifiedChessboard,
  SimplifiedBlunderMeter,
} from './SimplifiedAnalysisComponents'
import { Highlight } from 'src/components/Analysis/Highlight'
import { MoveMap } from 'src/components/Analysis/MoveMap'
import { MovesByRating } from 'src/components/Analysis/MovesByRating'
import { analysisMockData } from './analysisMockData.js'
import type { DrawShape } from 'chessground/draw'
import {
  MaiaEvaluation,
  StockfishEvaluation,
  ColorSanMapping,
  GameNode,
} from 'src/types'
import Chessground from '@react-chess/chessground'
import type { Key } from 'chessground/types'

type DescriptionSegment =
  | { type: 'text'; content: string }
  | { type: 'move'; san: string; uci: string }

interface AnalysisSectionProps {
  id: string
}

// Custom SimplifiedChessboard component with the analysis position FEN
const AnalysisChessboard = ({ forceKey }: { forceKey?: number }) => {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const stableKey = `analysis-chess-${forceKey || 0}-${windowSize.width}-${windowSize.height}`

  // Define the arrows
  const arrows: DrawShape[] = [
    {
      brush: 'blue',
      orig: 'd2' as Key,
      dest: 'e4' as Key,
      modifiers: { lineWidth: 8 },
    },
    {
      brush: 'red',
      orig: 'e3' as Key,
      dest: 'f5' as Key,
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
            fen: analysisMockData.fen,
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
                blue: {
                  key: 'blue',
                  color: '#003088',
                  opacity: 0.8,
                  lineWidth: 8,
                },
                red: {
                  key: 'red',
                  color: '#880020',
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

export const AnalysisSection = ({ id }: AnalysisSectionProps) => {
  const [ref, inView] = useInView({
    triggerOnce: false,
    threshold: 0.1,
  })

  const [renderKey, setRenderKey] = useState(0)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [currentMaiaModel, setCurrentMaiaModel] = useState('maia_kdd_1500')
  const [hoverArrow, setHoverArrow] = useState<DrawShape | null>(null)

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
      setRenderKey((prev) => prev + 1)
    }

    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (inView) {
      const timeoutId = setTimeout(() => {
        setRenderKey((prev) => prev + 1)
      }, 100)

      const secondTimeoutId = setTimeout(() => {
        setRenderKey((prev) => prev + 1)
      }, 300)

      const thirdTimeoutId = setTimeout(() => {
        setRenderKey((prev) => prev + 1)
      }, 500)

      return () => {
        clearTimeout(timeoutId)
        clearTimeout(secondTimeoutId)
        clearTimeout(thirdTimeoutId)
      }
    }
  }, [inView])

  // Transform the imported mock data to match component expectations
  const mockMaiaEvaluation: MaiaEvaluation = {
    policy: Object.fromEntries(
      analysisMockData.moveRecommendations.maia.map(({ move, prob }) => [
        move,
        prob,
      ]),
    ),
    value: 0.5, // Default value, could be derived from position evaluation
  }

  const mockStockfishEvaluation: StockfishEvaluation = {
    sent: true,
    depth: 24,
    model_move: analysisMockData.moveRecommendations.stockfish[0].move,
    model_optimal_cp: analysisMockData.moveRecommendations.stockfish[0].cp,
    cp_vec: Object.fromEntries(
      analysisMockData.moveRecommendations.stockfish.map(({ move, cp }) => [
        move,
        cp,
      ]),
    ),
    cp_relative_vec: Object.fromEntries(
      analysisMockData.moveRecommendations.stockfish.map(
        ({ move, cp_relative }) => [move, cp_relative],
      ),
    ),
    winrate_vec: Object.fromEntries(
      analysisMockData.moveRecommendations.stockfish.map(
        ({ move, winrate }) => [move, winrate],
      ),
    ),
    winrate_loss_vec: Object.fromEntries(
      analysisMockData.moveRecommendations.stockfish.map(
        ({ move, winrate_loss }) => [move, winrate_loss],
      ),
    ),
  }

  const mockCurrentNode = {
    moveNumber: 15,
    turn: 'w' as const,
  } as GameNode

  const handleHover = (move?: string) => void 0

  const handleMakeMove = (move: string) => void 0

  return (
    <section
      id={id}
      className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-background-1 py-6 md:py-8"
      ref={ref}
    >
      <div className="mx-auto flex w-full max-w-[95%] flex-col-reverse items-center px-2 md:max-w-[90%] md:flex-row md:gap-8 md:px-4 lg:gap-12">
        <motion.div
          className="relative mt-4 w-full md:mt-6 md:w-1/2"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="relative w-full overflow-hidden rounded-lg border border-background-3/20 bg-background-2 shadow-xl">
            <div className="flex flex-col gap-3 p-3">
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="flex flex-col md:w-1/2">
                  <div className="flex flex-col overflow-hidden rounded border border-white/10">
                    <div className="w-full rounded-t-sm bg-background-1/60 p-2 text-left text-sm font-medium text-primary/80">
                      Spassky, Boris V.
                    </div>
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
                        <AnalysisChessboard forceKey={renderKey} />
                      </div>
                    </div>
                    <div className="rounded-b-sm bg-background-1/60 p-2 text-left text-sm font-medium text-primary/80">
                      Petrosian, Tigran V
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:w-1/2">
                  <motion.div
                    className="min-h-0 flex-1 overflow-hidden rounded border border-white/10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={
                      inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                    }
                    transition={{ duration: 0.3, delay: 0.4 }}
                  >
                    <Highlight
                      currentMaiaModel={currentMaiaModel}
                      setCurrentMaiaModel={setCurrentMaiaModel}
                      moveEvaluation={{
                        maia: mockMaiaEvaluation,
                        stockfish: mockStockfishEvaluation,
                      }}
                      colorSanMapping={analysisMockData.colorSanMapping}
                      recommendations={analysisMockData.moveRecommendations}
                      hover={handleHover}
                      makeMove={handleMakeMove}
                      boardDescription={
                        analysisMockData.boardDescription as {
                          segments: DescriptionSegment[]
                        }
                      }
                      currentNode={mockCurrentNode}
                      isHomePage={true}
                    />
                  </motion.div>
                  <motion.div
                    className="flex-shrink-0 overflow-hidden rounded border border-white/10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={
                      inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                    }
                    transition={{ duration: 0.3, delay: 0.5 }}
                  >
                    <SimplifiedBlunderMeter />
                  </motion.div>
                </div>
              </div>
              <div className="flex flex-col gap-3 md:flex-row">
                <motion.div
                  className="h-64 md:w-1/2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={
                    inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                  }
                  transition={{ duration: 0.3, delay: 0.6 }}
                >
                  <div className="h-full w-full overflow-hidden rounded border border-white/10 bg-background-1/60">
                    <MovesByRating
                      moves={analysisMockData.movesByRating}
                      colorSanMapping={analysisMockData.colorSanMapping}
                      isHomePage={true}
                    />
                  </div>
                </motion.div>
                <motion.div
                  className="h-64 overflow-hidden rounded border border-white/10 md:w-1/2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={
                    inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                  }
                  transition={{ duration: 0.3, delay: 0.7 }}
                >
                  <MoveMap
                    moveMap={analysisMockData.moveMap}
                    colorSanMapping={analysisMockData.colorSanMapping}
                    setHoverArrow={setHoverArrow}
                    makeMove={handleMakeMove}
                    isHomePage={true}
                  />
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
        <div className="w-full md:w-1/2">
          <div className="mb-4 inline-block rounded-full bg-engine-3/10 px-4 py-1 text-sm font-medium text-engine-3">
            Game Analysis
          </div>
          <h2 className="mb-6 max-w-2xl text-3xl font-bold md:text-4xl lg:text-5xl">
            Analyze games with human-aware AI
          </h2>
          <p className="mb-4 max-w-xl text-lg leading-relaxed text-primary/80">
            Go beyond perfect engine lines—see what real players would actually
            do. Maia combines Stockfish&apos;s precision with human tendencies
            learned from millions of real games, giving you real-world context
            in every position. Instantly tell whether a move wins only for
            computers or also works at your rating, and where players like you
            are most likely to stumble.
          </p>
          <p className="mb-4 max-w-xl text-lg leading-relaxed text-primary/80">
            Explore the top moves at every rating level, spot positions where
            blunders are likely, and understand how to level up your play in
            every single position. Get personalized insights based on your
            playing style and rating level.
          </p>
          <motion.div
            className="inline-block"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ transformOrigin: 'center' }}
          >
            <Link
              href="/analysis"
              className="flex items-center justify-center rounded-md bg-engine-3 px-6 py-3 font-medium text-white"
            >
              Try Analysis
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
