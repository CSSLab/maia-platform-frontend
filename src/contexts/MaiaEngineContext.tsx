import Maia from '../lib/engine/maia'
import { MaiaStatus, MaiaEngine } from 'src/types'
import React, {
  ReactNode,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import toast from 'react-hot-toast'

const MAIA_LOADING_TOAST_DELAY_MS = 800

export const MaiaEngineContext = React.createContext<MaiaEngine>({
  maia: undefined,
  status: 'loading',
  progress: 0,
  downloadModel: async () => {
    throw new Error('poorly provided MaiaEngineContext, missing downloadModel')
  },
})

export const MaiaEngineContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}: {
  children: ReactNode
}) => {
  const [status, setStatus] = useState<MaiaStatus>('loading')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const toastId = useRef<string | null>(null)
  const loadingToastTimerRef = useRef<number | null>(null)

  const maia = useMemo(() => {
    const model = new Maia({
      model:
        process.env.NEXT_PUBLIC_MAIA_MODEL_URL ??
        'https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/e23a50e/public/maia2/maia_rapid.onnx',
      modelVersion: process.env.NEXT_PUBLIC_MAIA_MODEL_VERSION ?? '1',
      setStatus: setStatus,
      setProgress: setProgress,
      setError: setError,
    })
    return model
  }, [])

  const downloadModel = useCallback(async () => {
    try {
      setStatus('downloading')
      await maia.downloadModel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download model')
      setStatus('error')
    }
  }, [maia])

  const getStorageInfo = useCallback(async () => {
    return await maia.getStorageInfo()
  }, [maia])

  const clearStorage = useCallback(async () => {
    return await maia.clearStorage()
  }, [maia])

  // Toast notifications for Maia model status
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
      if (
        typeof window === 'undefined' ||
        toastId.current ||
        loadingToastTimerRef.current !== null
      ) {
        return
      }

      loadingToastTimerRef.current = window.setTimeout(() => {
        loadingToastTimerRef.current = null
        if (!toastId.current) {
          toastId.current = toast.loading('Loading Maia...')
        }
      }, MAIA_LOADING_TOAST_DELAY_MS)
      return
    }

    if (
      loadingToastTimerRef.current !== null &&
      typeof window !== 'undefined'
    ) {
      window.clearTimeout(loadingToastTimerRef.current)
      loadingToastTimerRef.current = null
    }

    if (status === 'no-cache' || status === 'downloading') {
      if (toastId.current) {
        toast.dismiss(toastId.current)
        toastId.current = null
      }
      return
    }

    if (status === 'ready') {
      // Only show success if a loading toast was visible.
      if (toastId.current) {
        toast.success('Loaded Maia! Analysis is ready', {
          id: toastId.current,
        })
        toastId.current = null
      }
    } else if (status === 'error') {
      const message = error
        ? `Failed to load Maia model: ${error}`
        : 'Failed to load Maia model'
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

  return (
    <MaiaEngineContext.Provider
      value={{
        maia,
        status,
        progress,
        downloadModel,
      }}
    >
      {children}
    </MaiaEngineContext.Provider>
  )
}
