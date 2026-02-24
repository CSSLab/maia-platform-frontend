interface NnueStorage {
  id: string
  url: string
  data: Blob
  timestamp: number
  size: number
}

export class StockfishModelStorage {
  private dbName = 'StockfishModels'
  private storeName = 'models'
  private version = 1
  private db: IDBDatabase | null = null

  async openDB(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return null
    }

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

  async getModel(modelUrl: string): Promise<ArrayBuffer | null> {
    try {
      const db = await this.openDB()
      if (!db) return null

      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)

      const modelData = await new Promise<NnueStorage | null>(
        (resolve, reject) => {
          const request = store.get(modelUrl)
          request.onsuccess = () => resolve(request.result || null)
          request.onerror = () => reject(request.error)
        },
      )

      if (!modelData) {
        return null
      }

      if (modelData.url !== modelUrl) {
        await this.deleteModel(modelUrl)
        return null
      }

      return modelData.data.arrayBuffer()
    } catch (error) {
      console.warn('Stockfish cache read failed:', error)
      return null
    }
  }

  async storeModel(modelUrl: string, buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await this.openDB()
      if (!db) return

      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      const modelData: NnueStorage = {
        id: modelUrl,
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
    } catch (error) {
      console.warn('Stockfish cache write failed:', error)
    }
  }

  async deleteModel(modelUrl: string): Promise<void> {
    try {
      const db = await this.openDB()
      if (!db) return

      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(modelUrl)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.warn('Stockfish cache delete failed:', error)
    }
  }

  async requestPersistentStorage(): Promise<boolean> {
    try {
      if (
        typeof navigator !== 'undefined' &&
        'storage' in navigator &&
        'persist' in navigator.storage
      ) {
        return navigator.storage.persist()
      }
      return false
    } catch (error) {
      console.warn('Failed to request persistent storage:', error)
      return false
    }
  }
}

export default StockfishModelStorage
