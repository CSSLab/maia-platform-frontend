interface ModelStorage {
  id: string
  url: string
  data: Blob
  timestamp: number
  size: number
}

export class MaiaModelStorage {
  private dbName = 'MaiaModels'
  private storeName = 'models'
  private version = 1
  private db: IDBDatabase | null = null

  async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async storeModel(modelUrl: string, buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await this.openDB()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      const modelData: ModelStorage = {
        id: 'maia-rapid-model',
        url: modelUrl,
        data: new Blob([buffer]),
        timestamp: Date.now(),
        size: buffer.byteLength,
      }

      await new Promise<void>((resolve, reject) => {
        const request = store.put(modelData)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      console.log('Maia model stored in IndexedDB')
    } catch (error) {
      console.error('Failed to store model in IndexedDB:', error)
      throw error
    }
  }

  async getModel(modelUrl: string): Promise<ArrayBuffer | null> {
    console.log('Storage: getModel called with URL:', modelUrl)

    try {
      console.log('Storage: Opening IndexedDB...')
      const db = await this.openDB()
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)

      console.log('Storage: Requesting model data...')
      const modelData = await new Promise<ModelStorage | null>(
        (resolve, reject) => {
          const request = store.get('maia-rapid-model')
          request.onsuccess = () => {
            console.log(
              'Storage: IndexedDB request successful, result:',
              request.result ? 'Found' : 'Not found',
            )
            resolve(request.result || null)
          }
          request.onerror = () => {
            console.log('Storage: IndexedDB request error:', request.error)
            reject(request.error)
          }
        },
      )

      if (!modelData) {
        console.log(
          'Storage: No model data found in IndexedDB (normal for first time)',
        )
        return null
      }

      // Check if URL matches (for cache invalidation)
      if (modelData.url !== modelUrl) {
        console.log('Storage: Model URL changed, clearing old cache')
        console.log('Storage: Cached URL:', modelData.url)
        console.log('Storage: Requested URL:', modelUrl)
        await this.deleteModel()
        console.log(
          'Storage: Old cache cleared, model needs to be re-downloaded',
        )
        return null
      }

      console.log('Storage: Converting Blob to ArrayBuffer...')
      // Convert Blob back to ArrayBuffer
      const buffer = await modelData.data.arrayBuffer()
      console.log(
        'Storage: Successfully retrieved model, size:',
        buffer.byteLength,
      )
      return buffer
    } catch (error) {
      console.error('Storage: IndexedDB operation failed:', error)
      // Don't throw - return null to indicate model not available
      return null
    }
  }

  async deleteModel(): Promise<void> {
    try {
      const db = await this.openDB()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      await new Promise<void>((resolve, reject) => {
        const request = store.delete('maia-rapid-model')
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Failed to delete model from IndexedDB:', error)
    }
  }

  async getStorageInfo(): Promise<{
    supported: boolean
    quota?: number
    usage?: number
    modelSize?: number
    modelTimestamp?: number
  }> {
    try {
      const supported = 'indexedDB' in window
      if (!supported) {
        return { supported: false }
      }

      let quota: number | undefined
      let usage: number | undefined

      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        quota = estimate.quota
        usage = estimate.usage
      }

      const db = await this.openDB()
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)

      const modelData = await new Promise<ModelStorage | null>(
        (resolve, reject) => {
          const request = store.get('maia-rapid-model')
          request.onsuccess = () => resolve(request.result || null)
          request.onerror = () => reject(request.error)
        },
      )

      return {
        supported: true,
        quota,
        usage,
        modelSize: modelData?.size,
        modelTimestamp: modelData?.timestamp,
      }
    } catch (error) {
      console.error('Failed to get storage info:', error)
      return { supported: false }
    }
  }

  async requestPersistentStorage(): Promise<boolean> {
    try {
      if ('storage' in navigator && 'persist' in navigator.storage) {
        const isPersistent = await navigator.storage.persist()
        console.log(
          isPersistent
            ? 'Persistent storage granted'
            : 'Persistent storage denied',
        )
        return isPersistent
      }
      return false
    } catch (error) {
      console.error('Failed to request persistent storage:', error)
      return false
    }
  }

  async clearAllStorage(): Promise<void> {
    try {
      await this.deleteModel()
      console.log('Maia storage cleared')
    } catch (error) {
      console.warn('Failed to clear storage:', error)
    }
  }
}

export default MaiaModelStorage
