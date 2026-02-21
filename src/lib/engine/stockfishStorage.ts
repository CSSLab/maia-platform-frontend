interface NnueStorage {
  id: string
  data: Blob
  timestamp: number
  size: number
}

export class StockfishModelStorage {
  private dbName = 'StockfishModels'
  private storeName = 'nnue'
  private version = 1
  private db: IDBDatabase | null = null

  private get supported(): boolean {
    return typeof indexedDB !== 'undefined'
  }

  async requestPersistentStorage(): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined') return false
      if ('storage' in navigator && 'persist' in navigator.storage) {
        return await navigator.storage.persist()
      }
      return false
    } catch (error) {
      console.warn('Failed to request persistent storage for Stockfish:', error)
      return false
    }
  }

  async openDB(): Promise<IDBDatabase | null> {
    if (!this.supported) return null
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
          db.createObjectStore(this.storeName, { keyPath: 'id' })
        }
      }
    })
  }

  async getModel(url: string): Promise<ArrayBuffer | null> {
    try {
      const db = await this.openDB()
      if (!db) return null

      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)

      const modelData = await new Promise<NnueStorage | null>(
        (resolve, reject) => {
          const request = store.get(url)
          request.onsuccess = () => resolve(request.result || null)
          request.onerror = () => reject(request.error)
        },
      )

      if (!modelData) return null
      return modelData.data.arrayBuffer()
    } catch (error) {
      console.warn('Failed to read Stockfish cache:', error)
      return null
    }
  }

  async storeModel(url: string, buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await this.openDB()
      if (!db) return

      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      const modelData: NnueStorage = {
        id: url,
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
      console.warn('Failed to store Stockfish cache:', error)
    }
  }
}

export default StockfishModelStorage
