/**
 * Maia3 Web Worker — runs ONNX inference off the main thread.
 *
 * Messages FROM main thread:
 *   { type: 'init', modelUrl, modelVersion }
 *   { type: 'download' }
 *   { type: 'inference', id, tokens, eloSelfs, eloOppos, batchSize }
 *
 * Messages TO main thread:
 *   { type: 'status', status }
 *   { type: 'progress', progress }
 *   { type: 'error', message, id? }
 *   { type: 'inference-result', id, logitsMove, logitsValue }
 */

importScripts('/ort/ort.wasm.min.js')

const ORT = ort
ORT.env.wasm.wasmPaths = '/ort/'

// A session for a one-node model (y = Identity(x)) starts ORT's WebAssembly
// runtime (~0.2-0.35 s) while the real model is read from IndexedDB. It is
// started only once a cached model is found: before that, it would make a
// first-time visitor download ORT's 11.8 MB WebAssembly file, which on a slow
// connection held up the rest of the page.
const RUNTIME_MODEL = Uint8Array.from(
  atob(
    'CAc6NwoQCgF4EgF5IghJZGVudGl0eRIBZ1oPCgF4EgoKCAgBEgQKAggBYg8KAXkSCgoICAESBAoCCAFCAhAN',
  ),
  (c) => c.charCodeAt(0),
)
let runtimeReady = null

function startRuntime() {
  if (!runtimeReady) {
    runtimeReady = ORT.InferenceSession.create(RUNTIME_MODEL)
      .then((runtimeSession) => runtimeSession.release())
      .catch(() => undefined)
  }
  return runtimeReady
}

// ── IndexedDB storage (mirrors MaiaModelStorage) ─────────────────────────────

const DB_NAME = 'MaiaModels'
const STORE_NAME = 'models'
const MODEL_KEY = 'maia-rapid-model'

function isCompatibleModelCache(data, expectedUrl, expectedVersion) {
  return data.url === expectedUrl && data.version === expectedVersion
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

async function getCachedModel(modelUrl, modelVersion) {
  const db = await openDB()
  const tx = db.transaction([STORE_NAME], 'readonly')
  const store = tx.objectStore(STORE_NAME)

  const data = await new Promise((resolve, reject) => {
    const req = store.get(MODEL_KEY)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })

  if (!data) return null

  if (!isCompatibleModelCache(data, modelUrl, modelVersion)) {
    const rwTx = db.transaction([STORE_NAME], 'readwrite')
    rwTx.objectStore(STORE_NAME).delete(MODEL_KEY)
    return null
  }

  startRuntime()
  return await data.data.arrayBuffer()
}

async function storeModel(modelUrl, modelVersion, buffer) {
  const db = await openDB()
  const tx = db.transaction([STORE_NAME], 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  await new Promise((resolve, reject) => {
    const req = store.put({
      id: MODEL_KEY,
      url: modelUrl,
      version: modelVersion,
      data: new Blob([buffer]),
      timestamp: Date.now(),
      size: buffer.byteLength,
    })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ── Worker state ─────────────────────────────────────────────────────────────

let session = null
let modelUrl = null
let modelVersion = null

// 'basic' graph optimisation, not the default 'all': on 157 positions of two
// real games at all 21 ratings, 'basic' gave exactly the unoptimised model's
// outputs, while 'all' moved move probabilities by up to 0.64 percentage
// points (and the top move in 5 of 3297 cases). It also creates the session
// sooner: Maia's moves showed 0.34 s earlier on a desktop and 1.2 s earlier
// on an emulated phone; later inferences take about as long.
async function initSession(buffer) {
  await startRuntime()
  session = await ORT.InferenceSession.create(buffer, {
    graphOptimizationLevel: 'basic',
  })
}

// ── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (e) => {
  const msg = e.data

  try {
    switch (msg.type) {
      case 'init': {
        modelUrl = msg.modelUrl
        modelVersion = msg.modelVersion
        postMessage({ type: 'status', status: 'loading' })

        const buffer = await getCachedModel(modelUrl, modelVersion)
        if (buffer) {
          await initSession(buffer)
          postMessage({ type: 'status', status: 'ready' })
        } else {
          postMessage({ type: 'status', status: 'no-cache' })
        }
        break
      }

      case 'download': {
        postMessage({ type: 'status', status: 'downloading' })
        postMessage({ type: 'progress', progress: 0 })
        const response = await fetch(modelUrl)
        if (!response.ok) throw new Error('Failed to fetch model')

        let buffer

        if (response.body && typeof response.body.getReader === 'function') {
          const reader = response.body.getReader()
          const contentLength = +(response.headers.get('Content-Length') || 0)
          const chunks = []
          let receivedLength = 0
          let lastReportedProgress = 0

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            receivedLength += value.length

            if (contentLength > 0) {
              const currentProgress = Math.floor(
                (receivedLength / contentLength) * 100,
              )
              if (currentProgress >= lastReportedProgress + 10) {
                postMessage({ type: 'progress', progress: currentProgress })
                lastReportedProgress = currentProgress
              }
            }
          }

          buffer = new Uint8Array(receivedLength)
          let position = 0
          for (const chunk of chunks) {
            buffer.set(chunk, position)
            position += chunk.length
          }
        } else {
          buffer = new Uint8Array(await response.arrayBuffer())
        }

        await storeModel(modelUrl, modelVersion, buffer.buffer)
        await initSession(buffer.buffer)
        postMessage({ type: 'progress', progress: 100 })
        postMessage({ type: 'status', status: 'ready' })
        break
      }

      case 'inference': {
        if (!session) {
          postMessage({
            type: 'error',
            message: 'Model not initialized',
            id: msg.id,
          })
          return
        }

        const { id, tokens, eloSelfs, eloOppos, batchSize } = msg

        const feeds = {
          tokens: new ORT.Tensor('float32', new Float32Array(tokens), [
            batchSize,
            64,
            12,
          ]),
          elo_self: new ORT.Tensor('float32', new Float32Array(eloSelfs), [
            batchSize,
          ]),
          elo_oppo: new ORT.Tensor('float32', new Float32Array(eloOppos), [
            batchSize,
          ]),
        }

        const result = await session.run(feeds)

        const logitsMove = new Float32Array(result.logits_move.data)
        const logitsValue = new Float32Array(result.logits_value.data)

        postMessage(
          {
            type: 'inference-result',
            id,
            logitsMove: logitsMove.buffer,
            logitsValue: logitsValue.buffer,
          },
          [logitsMove.buffer, logitsValue.buffer],
        )
        break
      }
    }
  } catch (err) {
    postMessage({
      type: 'error',
      message: err.message || 'Unknown worker error',
      id: msg.id,
    })
  }
}
