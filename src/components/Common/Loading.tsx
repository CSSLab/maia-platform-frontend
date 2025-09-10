import Chessground from '@react-chess/chessground'
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const states = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4',
]

interface LoadingProps {
  // When true, shows loading UI (optionally after a delay); when false, shows children
  isLoading?: boolean
  // Milliseconds to wait before showing the loading UI
  delay?: number
  // Visual options for the loading UI
  transparent?: boolean
  message?: React.ReactNode
  // Optional content to render when not loading
  children?: React.ReactNode
}

export const Loading: React.FC<LoadingProps> = ({
  isLoading = true,
  delay = 1000,
  transparent = false,
  message,
  children,
}) => {
  // Delay handling for showing the loading UI
  const [showLoading, setShowLoading] = useState(false)
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isLoading) {
      timer = setTimeout(() => setShowLoading(true), delay)
    } else {
      setShowLoading(false)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [isLoading, delay])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [renderKey, setRenderKey] = useState(0)

  const currentState = useMemo(
    () => states[currentIndex % states.length],
    [currentIndex],
  )

  useEffect(() => {
    const increment = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setCurrentIndex((idx) => idx + 1)
      setRenderKey((prev) => prev + 1)
    }
    if (isLoading && showLoading) {
      increment()
    }
  }, [isLoading, showLoading, currentIndex])

  return (
    <AnimatePresence mode="wait">
      {isLoading && showLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="my-auto"
        >
          <div
            className={`my-40 flex w-screen items-center justify-center ${
              transparent
                ? 'absolute left-0 top-0 h-screen bg-backdrop/90'
                : 'bg-backdrop'
            } md:my-auto`}
          >
            <div className="flex flex-col items-center gap-4">
              <div
                className={`h-[50vw] w-[50vw] md:h-[30vh] md:w-[30vh] ${
                  !transparent ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <div className="h-full w-full">
                  <Chessground
                    key={renderKey}
                    contained
                    config={{
                      fen: currentState,
                      animation: {
                        duration: 0,
                      },
                      viewOnly: true,
                    }}
                  />
                </div>
              </div>
              <h2 className="text-2xl font-semibold">Loading...</h2>
              {message ? (
                <p className="max-w-prose px-4 text-center text-secondary">
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : !isLoading ? (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
