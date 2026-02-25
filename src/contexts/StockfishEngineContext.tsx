import React, {
  ReactNode,
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from 'react'
import toast from 'react-hot-toast'
import { StockfishStatus, StockfishEngine } from 'src/types'
import Engine from 'src/lib/engine/stockfish'

const STOCKFISH_LOADING_TOAST_DELAY_MS = 800

let sharedClientStockfishEngine: Engine | null = null

const getOrCreateStockfishEngine = (): Engine => {
  if (typeof window === 'undefined') {
    return new Engine()
  }

  if (
    !sharedClientStockfishEngine ||
    (sharedClientStockfishEngine.initializationError &&
      !sharedClientStockfishEngine.ready &&
      !sharedClientStockfishEngine.initializing)
  ) {
    sharedClientStockfishEngine = new Engine()
  }

  return sharedClientStockfishEngine
}

export const StockfishEngineContext = React.createContext<StockfishEngine>({
  streamEvaluations: () => {
    throw new Error(
      'poorly provided StockfishEngineContext, missing streamEvaluations',
    )
  },
  stopEvaluation: () => {
    throw new Error(
      'poorly provided StockfishEngineContext, missing stopEvaluation',
    )
  },
  isReady: () => {
    throw new Error('poorly provided StockfishEngineContext, missing isReady')
  },
  status: 'loading',
  error: null,
})

export const StockfishEngineContextProvider: React.FC<{
  children: ReactNode
}> = ({ children }: { children: ReactNode }) => {
  const engineRef = useRef<Engine | null>(null)
  if (!engineRef.current) {
    engineRef.current = getOrCreateStockfishEngine()
  }
  const [status, setStatus] = useState<StockfishStatus>(() => {
    if (engineRef.current?.initializationError) return 'error'
    return engineRef.current?.ready ? 'ready' : 'loading'
  })
  const [error, setError] = useState<string | null>(
    () => engineRef.current?.initializationError ?? null,
  )
  const toastId = useRef<string | null>(null)
  const loadingToastTimerRef = useRef<number | null>(null)

  const streamEvaluations = useCallback(
    (fen: string, legalMoveCount: number, depth?: number) => {
      if (!engineRef.current) {
        console.error('Engine not initialized')
        return null
      }
      return engineRef.current.streamEvaluations(fen, legalMoveCount, depth)
    },
    [],
  )

  const stopEvaluation = useCallback(() => {
    engineRef.current?.stopEvaluation()
  }, [])

  const isReady = useCallback(() => {
    return engineRef.current?.ready ?? false
  }, [])

  useEffect(() => {
    const checkEngineStatus = () => {
      const engine = engineRef.current
      if (!engine) return

      if (engine.initializationError) {
        setStatus('error')
        setError(engine.initializationError)
      } else if (engine.ready) {
        setStatus('ready')
        setError(null)
      } else {
        setStatus('loading')
      }
    }

    checkEngineStatus()
    const interval = setInterval(checkEngineStatus, 100)

    return () => clearInterval(interval)
  }, [])

  // Toast notifications for Stockfish engine status
  useEffect(() => {
    return () => {
      if (loadingToastTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(loadingToastTimerRef.current)
        loadingToastTimerRef.current = null
      }
      if (toastId.current) {
        toast.dismiss(toastId.current)
        toastId.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') {
      if (
        toastId.current ||
        loadingToastTimerRef.current !== null ||
        typeof window === 'undefined'
      ) {
        return
      }

      loadingToastTimerRef.current = window.setTimeout(() => {
        loadingToastTimerRef.current = null
        if (!toastId.current && engineRef.current && !engineRef.current.ready) {
          toastId.current = toast.loading('Loading Stockfish Engine...')
        }
      }, STOCKFISH_LOADING_TOAST_DELAY_MS)
      return
    }

    if (loadingToastTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(loadingToastTimerRef.current)
      loadingToastTimerRef.current = null
    }

    if (status === 'ready') {
      // Only show a success toast when we previously showed a loading toast.
      if (toastId.current) {
        toast.success('Loaded Stockfish! Engine is ready', {
          id: toastId.current,
        })
        toastId.current = null
      }
    } else if (status === 'error') {
      const message = error
        ? `Failed to load Stockfish engine: ${error}`
        : 'Failed to load Stockfish engine'
      if (toastId.current) {
        toast.error(message, {
          id: toastId.current,
        })
        toastId.current = null
      } else {
        toast.error(message)
      }
    }
  }, [status, error])

  const contextValue = useMemo(
    () => ({
      streamEvaluations,
      stopEvaluation,
      isReady,
      status,
      error,
    }),
    [streamEvaluations, stopEvaluation, isReady, status, error],
  )

  return (
    <StockfishEngineContext.Provider value={contextValue}>
      {children}
    </StockfishEngineContext.Provider>
  )
}
