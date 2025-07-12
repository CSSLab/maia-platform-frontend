import Chessground from '@react-chess/chessground'
import { useEffect, useMemo, useState } from 'react'

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

export const Loading: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [renderKey, setRenderKey] = useState(0)

  const currentState = useMemo(
    () => states[currentIndex % states.length],
    [currentIndex],
  )

  useEffect(() => {
    const increment = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setCurrentIndex(currentIndex + 1)

      setRenderKey((prev) => prev + 1)
    }

    increment()
  }, [currentIndex])

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-backdrop pb-20">
      <div className="flex flex-col items-center gap-4">
        <div className="h-[50vw] w-[50vw] opacity-50 md:h-[30vh] md:w-[30vh]">
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
      </div>
    </div>
  )
}
