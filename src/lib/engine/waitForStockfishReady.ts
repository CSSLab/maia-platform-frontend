import { StockfishEngine } from 'src/types'

type StockfishReadiness = Pick<
  StockfishEngine,
  'isReady' | 'getInitializationError'
>

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 100))

export const waitForStockfishReady = async (
  stockfish: StockfishReadiness,
  isCancelled: () => boolean,
  wait: () => Promise<void> = pause,
): Promise<boolean> => {
  while (!stockfish.isReady()) {
    if (isCancelled() || stockfish.getInitializationError()) return false
    await wait()
  }

  return !isCancelled()
}
