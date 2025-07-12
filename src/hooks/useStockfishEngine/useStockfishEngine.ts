import Engine from './engine'
import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { StockfishStatus } from 'src/types'

export const useStockfishEngine = () => {
  const engineRef = useRef<Engine | null>(null)
  const [status, setStatus] = useState<StockfishStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  if (!engineRef.current) {
    engineRef.current = new Engine()
  }

  const streamEvaluations = useCallback(
    (fen: string, legalMoveCount: number) => {
      if (!engineRef.current) {
        console.error('Engine not initialized')
        return null
      }
      return engineRef.current.streamEvaluations(fen, legalMoveCount)
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

  return useMemo(
    () => ({
      streamEvaluations,
      stopEvaluation,
      isReady,
      status,
      error,
    }),
    [streamEvaluations, stopEvaluation, isReady, status, error],
  )
}
