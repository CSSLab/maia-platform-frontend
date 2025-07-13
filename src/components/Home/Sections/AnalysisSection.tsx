import Link from 'next/link'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { useState, useEffect } from 'react'
import {
  SimplifiedChessboard,
  SimplifiedBlunderMeter,
  SimplifiedMovesByRating,
  SimplifiedMoveMap,
  SimplifiedHighlight,
} from './SimplifiedAnalysisComponents'

interface AnalysisSectionProps {
  id: string
}

export const AnalysisSection = ({ id }: AnalysisSectionProps) => {
  const [ref, inView] = useInView({
    triggerOnce: false,
    threshold: 0.1,
  })

  const [renderKey, setRenderKey] = useState(0)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

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
              <div className="flex gap-3">
                <div className="flex w-1/2 flex-col">
                  <div className="flex flex-col">
                    <div className="w-full rounded-t-sm bg-background-1/60 p-2 text-left text-sm font-medium text-primary/80">
                      Magnus Carlsen (2850)
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
                        <SimplifiedChessboard forceKey={renderKey} />
                      </div>
                    </div>
                    <div className="rounded-b-sm bg-background-1/60 p-2 text-left text-sm font-medium text-primary/80">
                      Hikaru Nakamura (2836)
                    </div>
                  </div>
                </div>
                <div className="flex w-1/2 flex-col justify-between gap-3">
                  <motion.div
                    className="flex-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={
                      inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                    }
                    transition={{ duration: 0.3, delay: 0.4 }}
                  >
                    <SimplifiedHighlight />
                  </motion.div>
                  <motion.div
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
              <div className="flex gap-3">
                <motion.div
                  className="h-48 w-1/2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={
                    inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                  }
                  transition={{ duration: 0.3, delay: 0.6 }}
                >
                  <SimplifiedMovesByRating />
                </motion.div>
                <motion.div
                  className="h-48 w-1/2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={
                    inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                  }
                  transition={{ duration: 0.3, delay: 0.7 }}
                >
                  <SimplifiedMoveMap />
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
            do. Maia combines Stockfish&apos;s precision with human tendencies learned
            from millions of real games, giving you real-world context in every
            position. Instantly tell whether a move wins only for computers or
            also works at your rating, and where players like you are most
            likely to stumble.
          </p>
          <p className="mb-4 max-w-xl text-lg leading-relaxed text-primary/80">
            Explore the top moves at every rating level, spot positions
            where blunders are likely, and understand how to level up your play in
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
