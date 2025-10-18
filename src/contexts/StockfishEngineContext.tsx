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
  const [status, setStatus] = useState<StockfishStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const toastId = useRef<string | null>(null)

  if (!engineRef.current) {
    engineRef.current = new Engine()
  }

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
      if (engineRef.current?.ready) {
        setStatus('ready')
        setError(null)
      } else if (engineRef.current && !engineRef.current.ready) {
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
      toast.dismiss()
    }
  }, [])

  useEffect(() => {
    if (status === 'loading' && !toastId.current) {
      toastId.current = toast.loading('Loading Stockfish Engine...')
    } else if (status === 'ready') {
      if (toastId.current) {
        toast.success('Loaded Stockfish! Engine is ready', {
          id: toastId.current,
        })
        toastId.current = null
      } else {
        toast.success('Loaded Stockfish! Engine is ready')
      }
    } else if (status === 'error') {
      if (toastId.current) {
        toast.error('Failed to load Stockfish engine', {
          id: toastId.current,
        })
        toastId.current = null
      } else {
        toast.error('Failed to load Stockfish engine')
      }
    }
  }, [status])

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
