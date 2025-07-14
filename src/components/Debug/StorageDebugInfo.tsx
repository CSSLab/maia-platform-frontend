import { useState, useEffect } from 'react'
import { useMaiaEngine } from 'src/hooks'

interface StorageInfo {
  supported: boolean
  quota?: number
  usage?: number
  modelSize?: number
  modelTimestamp?: number
}

export const StorageDebugInfo: React.FC = () => {
  const { getStorageInfo, clearStorage } = useMaiaEngine()
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadStorageInfo = async () => {
    setIsLoading(true)
    try {
      const info = await getStorageInfo()
      setStorageInfo(info)
    } catch (error) {
      console.error('Failed to load storage info:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearStorage = async () => {
    if (confirm('Are you sure you want to clear all stored models?')) {
      try {
        await clearStorage()
        await loadStorageInfo() // Refresh after clearing
      } catch (error) {
        console.error('Failed to clear storage:', error)
      }
    }
  }

  useEffect(() => {
    loadStorageInfo()
  }, [])

  if (isLoading) {
    return <div className="p-4">Loading storage info...</div>
  }

  if (!storageInfo) {
    return <div className="p-4">Failed to load storage info</div>
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="rounded border border-white/20 bg-background-1 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Storage Debug Info</h3>
        <div className="flex gap-2">
          <button
            onClick={loadStorageInfo}
            className="rounded bg-background-2 px-3 py-1 text-sm hover:bg-background-3"
          >
            Refresh
          </button>
          <button
            onClick={handleClearStorage}
            className="rounded bg-human-3 px-3 py-1 text-sm hover:bg-human-3/80"
          >
            Clear Storage
          </button>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <strong>IndexedDB Support:</strong>{' '}
          <span
            className={
              storageInfo.supported ? 'text-green-400' : 'text-red-400'
            }
          >
            {storageInfo.supported ? 'Yes' : 'No'}
          </span>
        </div>

        {storageInfo.quota && (
          <div>
            <strong>Storage Quota:</strong> {formatBytes(storageInfo.quota)}
          </div>
        )}

        {storageInfo.usage && (
          <div>
            <strong>Storage Used:</strong> {formatBytes(storageInfo.usage)}
          </div>
        )}

        <div>
          <strong>Maia Rapid Model:</strong>
          {!storageInfo.modelSize ? (
            <span className="ml-2 text-secondary">Not cached</span>
          ) : (
            <div className="mt-2">
              <div className="rounded bg-background-2 p-2">
                <div className="flex justify-between">
                  <span className="font-medium">Rapid Model</span>
                  <span>{formatBytes(storageInfo.modelSize)}</span>
                </div>
                {storageInfo.modelTimestamp && (
                  <div className="text-xs text-secondary">
                    Cached:{' '}
                    {new Date(storageInfo.modelTimestamp).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 text-xs text-secondary">
          <strong>User Agent:</strong> {navigator.userAgent}
        </div>
      </div>
    </div>
  )
}
