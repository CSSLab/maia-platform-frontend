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

// ONNX Runtime asks for a shared WebAssembly memory that may grow to 4 GB,
// and a shared memory's maximum is reserved when it is created. iOS limits
// how much a tab can reserve, and earlier pages' memory is held for a while
// after a reload, so on an iPhone Maia failed to start after reloads
// ("RangeError: Out of memory"). Maia uses 165 MB for the phone's batch of 11
// ratings and 198 MB for 21 (the most the site asks for), so its memory may
// grow to 268 MB.
const MAX_MEMORY_PAGES = 4096 // of 64 KiB
const NativeMemory = WebAssembly.Memory
WebAssembly.Memory = function Memory(descriptor) {
  return new NativeMemory(
    descriptor && descriptor.shared && descriptor.maximum > MAX_MEMORY_PAGES
      ? { ...descriptor, maximum: MAX_MEMORY_PAGES }
      : descriptor,
  )
}
WebAssembly.Memory.prototype = NativeMemory.prototype

// From the folder this worker was loaded from, which names their version.
importScripts('ort/ort.wasm.min.js')

const ORT = ort
ORT.env.wasm.wasmPaths = new URL('ort/', self.location.href).href

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
  // Saved as a Blob, or as the bytes themselves where the Blob wasn't taken.
  return data.data instanceof Blob ? await data.data.arrayBuffer() : data.data
}

const describeError = (error) =>
  error ? `${error.name}: ${error.message}` : 'no error given'

// Saved only once the transaction completes: a full disk can still fail it
// after the request itself has succeeded. A failed request aborts the
// transaction, whose own error is then empty, so the request's is kept.
function putModel(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite')
    let requestError = null
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(requestError || tx.error)
    const req = tx.objectStore(STORE_NAME).put(record)
    req.onerror = () => {
      requestError = req.error
    }
  })
}

/**
 * Saves the model as a Blob, or, where that is refused, as the bytes
 * themselves: Safari can refuse a large Blob in IndexedDB (known in private
 * tabs) while taking the same bytes as an ArrayBuffer. Returns why the Blob
 * was refused, or null if it wasn't.
 */
async function storeModel(modelUrl, modelVersion, buffer) {
  const db = await openDB()
  const record = {
    id: MODEL_KEY,
    url: modelUrl,
    version: modelVersion,
    timestamp: Date.now(),
    size: buffer.byteLength,
  }
  let blobError
  try {
    await putModel(db, { ...record, data: new Blob([buffer]) })
    return null
  } catch (error) {
    blobError = describeError(error)
  }
  try {
    await putModel(db, { ...record, data: buffer })
    return blobError
  } catch (error) {
    throw new Error(
      `as a Blob: ${blobError}; as bytes: ${describeError(error)}`,
    )
  }
}

/** The origin's storage, in MB, for reporting a failed save. */
async function storageEstimate() {
  try {
    const { quota, usage } = await navigator.storage.estimate()
    return {
      quota_mb: Math.round(quota / 1e6),
      usage_mb: Math.round(usage / 1e6),
    }
  } catch {
    return {}
  }
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
          // A compressed response has no usable length, and the bytes read here
          // are decompressed: use the size the page knows.
          const contentLength = response.headers.get('Content-Encoding')
            ? msg.expectedBytes || 0
            : +(response.headers.get('Content-Length') || 0)
          const chunks = []
          let receivedLength = 0
          let lastReportedProgress = 0
          let lastReportedAt = 0

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            receivedLength += value.length

            if (contentLength > 0) {
              const currentProgress = Math.min(
                99,
                Math.floor((receivedLength / contentLength) * 100),
              )
              const now = Date.now()
              if (
                currentProgress > lastReportedProgress &&
                now - lastReportedAt >= 250
              ) {
                postMessage({ type: 'progress', progress: currentProgress })
                lastReportedProgress = currentProgress
                lastReportedAt = now
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

        // Maia still works on this page if saving fails, but it will be
        // needed again on the next.
        try {
          const blobRefused = await storeModel(
            modelUrl,
            modelVersion,
            buffer.buffer,
          )
          if (blobRefused) {
            postMessage({ type: 'stored-as-bytes', message: blobRefused })
          }
        } catch (err) {
          postMessage({
            type: 'store-failed',
            message: err instanceof Error ? err.message : String(err),
            storage: await storageEstimate(),
          })
        }
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
