import { Chess } from 'chess.ts'
import { PlayType } from 'src/types'
import { motion } from 'framer-motion'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'
import Chessground from '@react-chess/chessground'
import { useInView } from 'react-intersection-observer'
import {
  useContext,
  useState,
  useEffect,
  useRef,
  type ElementType,
} from 'react'
import { AuthContext } from 'src/contexts/AuthContext'
import { ModalContext } from 'src/contexts/ModalContext'

const DEMO_POSITION = {
  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 1',
  moves: [
    { from: 'f8', to: 'c5', probability: 0.45 },
    { from: 'f6', to: 'e4', probability: 0.25 },
    { from: 'd7', to: 'd6', probability: 0.15 },
    { from: 'f6', to: 'd7', probability: 0.1 },
    { from: 'c6', to: 'a5', probability: 0.05 },
  ],
}

const TRAINING_POSITIONS = [
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
  'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 5 5',
]

interface PlaySectionProps {
  id: string
}

export const PlaySection = ({ id }: PlaySectionProps) => {
  const { setPlaySetupModalProps } = useContext(ModalContext)
  const { user } = useContext(AuthContext)

  const [ref, inView] = useInView({
    triggerOnce: false,
    threshold: 0.2,
  })

  const startGame = () => {
    setPlaySetupModalProps({ playType: 'againstMaia' as PlayType })
  }

  return (
    <section
      id={id}
      className="relative flex min-h-[80vh] w-full flex-col items-center justify-center overflow-hidden bg-transparent py-10 md:py-16"
      ref={ref}
    >
      <div className="mx-auto flex w-full max-w-[95%] flex-col items-center px-2 md:max-w-[90%] md:flex-row md:gap-12 md:px-4 lg:gap-16">
        <div className="mb-6 w-full md:mb-10 md:w-1/2">
          <div className="mb-3 inline-block rounded-full bg-human-3/10 px-4 py-1 text-sm font-medium text-human-3 md:mb-4">
            Play Against Maia
          </div>
          <h2 className="mb-4 max-w-2xl text-2xl font-bold md:mb-6 md:text-4xl lg:text-5xl">
            Play against the most human-like chess AI
          </h2>
          <p className="mb-3 max-w-2xl text-base text-primary/80 md:mb-4 md:text-lg">
            Challenge Maia, a neural network trained to play like a human at
            your chosen rating level. Unlike traditional engines that play
            robotically, Maia naturally plays moves that a person would make.
          </p>
          <p className="mb-3 max-w-2xl text-base text-primary/80 md:mb-4 md:text-lg">
            Trained on millions of human games, Maia plays with human chess
            intuition and decision-making style.
          </p>
          <motion.button
            onClick={startGame}
            className="flex items-center justify-center rounded-md bg-human-3 px-6 py-3 font-medium text-white"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            Play Now
          </motion.button>
        </div>
        <motion.div
          className="relative w-full md:w-1/2"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="relative flex aspect-square w-full items-center justify-center">
            <div className="absolute left-0 top-0 grid h-3/4 w-3/4 grid-cols-6 grid-rows-6 gap-0.5 bg-transparent">
              <AnimatedTrainingBoards />
            </div>
            <motion.div
              className="from-white/8 to-white/4 absolute bottom-0 right-0 z-10 h-3/4 w-3/4 overflow-hidden border border-glass-border bg-gradient-to-br backdrop-blur-md"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="h-full w-full">
                <PredictionBoard />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// chessground's elements, which its board and piece styles are written for.
const CgContainer = 'cg-container' as unknown as ElementType
const CgBoard = 'cg-board' as unknown as ElementType
const Piece = 'piece' as unknown as ElementType

const PIECE_ROLES: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

/**
 * A board as chessground draws it (same elements, classes and size), but
 * without a chessground instance: these never change. chessground moves
 * every piece with a transform on its own compositing layer, and the grid's
 * ~1100 piece layers made each frame of the page's animations cost tens of
 * milliseconds of compositing.
 */
const StaticBoard = ({
  fen,
  size,
}: {
  fen: string
  size: { width: number; height: number } | null
}) => (
  <div style={{ height: '100%', width: '100%' }}>
    <div
      className="cg-wrap orientation-white"
      style={{ height: '100%', width: '100%', display: 'table' }}
    >
      {size !== null && (
        <CgContainer style={size}>
          <CgBoard>
            {fen
              .split(' ')[0]
              .split('/')
              .flatMap((row, rank) => {
                let file = 0
                return [...row].flatMap((symbol) => {
                  if (/\d/.test(symbol)) {
                    file += Number(symbol)
                    return []
                  }
                  const color =
                    symbol === symbol.toUpperCase() ? 'white' : 'black'
                  const piece = (
                    <Piece
                      key={`${rank}-${file}`}
                      className={`${color} ${PIECE_ROLES[symbol.toLowerCase()]}`}
                      style={{
                        left: `${file * 12.5}%`,
                        top: `${rank * 12.5}%`,
                        willChange: 'auto',
                      }}
                    />
                  )
                  file++
                  return [piece]
                })
              })}
          </CgBoard>
        </CgContainer>
      )}
    </div>
  </div>
)

const AnimatedTrainingBoards = () => {
  // The board size chessground would use: the cell's width rounded down to
  // a multiple of 8 device pixels, and its shape. Measured after the first
  // paint (the grid is below the fold), so the boards' ~1100 pieces don't
  // delay it.
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  )
  const firstCell = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cell = firstCell.current
    if (!cell) return
    const measure = () => {
      const bounds = cell.getBoundingClientRect()
      const ratio = window.devicePixelRatio
      const width = (Math.floor((bounds.width * ratio) / 8) * 8) / ratio
      setSize({ width, height: (width * bounds.height) / bounds.width })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(cell)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {[...Array(36)].map((_, i) => (
        <motion.div key={i} className="relative">
          <div className="h-full w-full" ref={i === 0 ? firstCell : undefined}>
            <StaticBoard
              fen={TRAINING_POSITIONS[i % TRAINING_POSITIONS.length]}
              size={size}
            />
          </div>
        </motion.div>
      ))}
    </>
  )
}

const PredictionBoard = () => {
  const [chess] = useState(new Chess(DEMO_POSITION.fen))
  const [renderKey, setRenderKey] = useState(0)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setRenderKey((prev) => prev + 1)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [])

  const shapes: DrawShape[] = DEMO_POSITION.moves.map((move) => ({
    orig: move.from as Key,
    dest: move.to as Key,
    brush: 'custom',
  }))

  return (
    <Chessground
      key={renderKey}
      contained
      config={{
        fen: chess.fen(),
        viewOnly: true,
        orientation: 'black',
        drawable: {
          enabled: true,
          visible: true,
          autoShapes: shapes,
          brushes: {
            custom: {
              key: 'custom',
              color: '#BF5F52',
              opacity: 0.8,
              lineWidth: 8,
            },
          },
        },
        animation: {
          duration: 0,
        },
      }}
    />
  )
}
