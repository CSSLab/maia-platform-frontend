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
const STOCKFISH_DEBUG_LOADING_KEY = 'maia.stockfishDebugLoading'

const isTruthy = (value: string | null | undefined): boolean => {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const isStockfishDebugLoadingEnabled = (): boolean => {
  if (typeof window !== 'undefined') {
    try {
      const localValue = window.localStorage.getItem(
        STOCKFISH_DEBUG_LOADING_KEY,
      )
      if (localValue !== null) return isTruthy(localValue)
    } catch {
      // ignore localStorage access failures
    }
  }

  return isTruthy(process.env.NEXT_PUBLIC_STOCKFISH_DEBUG_LOADING)
}

const getStockfishLoadingLabel = (
  engine: Engine | null,
  debugLoadingEnabled: boolean,
): string => {
  if (!debugLoadingEnabled) {
    return 'Loading Stockfish...'
  }

  if (!engine) return 'Loading Stockfish...'

  switch (engine.initializationPhase) {
    case 'checking-cache':
      return 'Checking local Stockfish cache...'
    case 'downloading-nnue':
      return 'Downloading Stockfish model weights...'
    case 'loading-nnue':
      return 'Loading Stockfish from local cache...'
    case 'loading-module':
      return 'Starting Stockfish engine...'
    default:
      return 'Loading Stockfish...'
  }
}

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
  const [debugLoadingEnabled] = useState<boolean>(() =>
    isStockfishDebugLoadingEnabled(),
  )
  const [loadingLabel, setLoadingLabel] = useState<string>(() =>
    getStockfishLoadingLabel(engineRef.current, debugLoadingEnabled),
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

      setLoadingLabel((prev) => {
        const next = getStockfishLoadingLabel(engine, debugLoadingEnabled)
        return prev === next ? prev : next
      })

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
  }, [debugLoadingEnabled])

  // Toast notifications for Stockfish engine status
  useEffect(() => {
    return () => {
      if (
        loadingToastTimerRef.current !== null &&
        typeof window !== 'undefined'
      ) {
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
      if (typeof window === 'undefined') {
        return
      }

      if (toastId.current) {
        toastId.current = toast.loading(loadingLabel, { id: toastId.current })
        return
      }

      if (loadingToastTimerRef.current !== null) {
        return
      }

      loadingToastTimerRef.current = window.setTimeout(() => {
        loadingToastTimerRef.current = null
        if (!toastId.current && engineRef.current && !engineRef.current.ready) {
          toastId.current = toast.loading(
            getStockfishLoadingLabel(engineRef.current, debugLoadingEnabled),
          )
        }
      }, STOCKFISH_LOADING_TOAST_DELAY_MS)
      return
    }

    if (
      loadingToastTimerRef.current !== null &&
      typeof window !== 'undefined'
    ) {
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
  }, [status, error, loadingLabel, debugLoadingEnabled])

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
