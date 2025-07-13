import { Chess } from 'chess.ts'
import { PlayType } from 'src/types'
import { motion } from 'framer-motion'
import type { Key } from 'chessground/types'
import type { DrawShape } from 'chessground/draw'
import Chessground from '@react-chess/chessground'
import { useInView } from 'react-intersection-observer'
import { useContext, useState, useEffect } from 'react'
import { ModalContext, AuthContext } from 'src/contexts'

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
      className="relative flex min-h-[80vh] w-full flex-col items-center justify-center overflow-hidden bg-background-1 py-10 md:py-16"
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
          {user?.lichessId ? (
            <motion.button
              onClick={startGame}
              className="flex items-center justify-center rounded-md bg-human-3 px-6 py-3 font-medium text-white"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              Play Now
            </motion.button>
          ) : (
            <motion.a
              href="https://lichess.org/@/maia1"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center rounded-md bg-human-3 px-6 py-3 font-medium text-white"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              Play on Lichess
            </motion.a>
          )}
        </div>
        <motion.div
          className="relative w-full md:w-1/2"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="relative flex aspect-square w-full items-center justify-center">
            <div className="absolute left-0 top-0 grid h-3/4 w-3/4 grid-cols-6 grid-rows-6 gap-0.5 bg-background-2">
              <AnimatedTrainingBoards inView={inView} />
            </div>
            <motion.div
              className="absolute bottom-0 right-0 z-10 h-3/4 w-3/4 overflow-hidden border border-background-3/20 bg-background-1 shadow-lg"
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

const AnimatedTrainingBoards = ({ inView }: { inView: boolean }) => {
  const [currentBatch, setCurrentBatch] = useState(0)
  // This will force a re-render when needed
  const [renderKey, setRenderKey] = useState(0)

  useEffect(() => {
    if (!inView) return

    const interval = setInterval(() => {
      setCurrentBatch((prev) => (prev + 1) % 3)
    }, 3000)

    const timeoutId = setTimeout(() => {
      setRenderKey((prev) => prev + 1)
    }, 100)

    return () => {
      clearInterval(interval)
      clearTimeout(timeoutId)
    }
  }, [inView])

  return (
    <>
      {[...Array(36)].map((_, i) => (
        <motion.div key={i} className="relative">
          <div className="h-full w-full">
            <Chessground
              key={`board-${i}-${renderKey}`}
              contained
              config={{
                fen: TRAINING_POSITIONS[i % TRAINING_POSITIONS.length],
                viewOnly: true,
                coordinates: false,
                drawable: { enabled: false },
                animation: {
                  duration: 0,
                },
              }}
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
