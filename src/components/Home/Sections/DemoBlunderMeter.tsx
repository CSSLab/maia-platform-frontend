import { motion } from 'framer-motion'

type ChessMove = 'e4' | 'd4' | 'Nf3' | 'c4' | 'g3' | 'a4' | 'h4'

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

export const DemoBlunderMeter = () => {
  return (
    <div className="flex w-full flex-col gap-1 overflow-hidden rounded p-3">
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
