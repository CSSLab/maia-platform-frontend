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

  const maia = useMemo(() => {
    const model = new Maia({
      model: '/maia2/maia_rapid.onnx',
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
      toast.dismiss()
    }
  }, [])

  useEffect(() => {
    if (status === 'loading' && !toastId.current) {
      toastId.current = toast.loading('Loading Maia Model...')
    } else if (status === 'ready') {
      if (toastId.current) {
        toast.success('Loaded Maia! Analysis is ready', {
          id: toastId.current,
        })
        toastId.current = null
      } else {
        toast.success('Loaded Maia! Analysis is ready')
      }
    } else if (status === 'error') {
      if (toastId.current) {
        toast.error('Failed to load Maia model', {
          id: toastId.current,
        })
        toastId.current = null
      } else {
        toast.error('Failed to load Maia model')
      }
    }
  }, [status])

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
