// Maia in a worker, as on the site, doing the work the site asks of it on a
// phone after each move: one rating, then a batch of 11.
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/'
const MAX_MEMORY_PAGES = 8192
const NativeMemory = WebAssembly.Memory
WebAssembly.Memory = function Memory(d) {
  return new NativeMemory(d && d.shared && d.maximum > MAX_MEMORY_PAGES ? { ...d, maximum: MAX_MEMORY_PAGES } : d)
}
WebAssembly.Memory.prototype = NativeMemory.prototype
importScripts(ORT + 'ort.webgpu.min.js')
ort.env.wasm.wasmPaths = ORT
const RATINGS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600]
let session, vec, n = 0
const run = (v, ratings) => {
  const k = ratings.length, tok = new Float32Array(k * 768)
  for (let j = 0; j < k; j++) tok.set(v.tokens, j * 768)
  const elo = Float32Array.from(ratings)
  return session.run({ tokens: new ort.Tensor('float32', tok, [k, 64, 12]), elo_self: new ort.Tensor('float32', elo, [k]), elo_oppo: new ort.Tensor('float32', elo, [k]) })
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'start') {
      vec = await (await fetch('/engine-bench-vec.json')).json()
      const model = new Uint8Array(await (await fetch('/maia3/maia3_simplified.onnx')).arrayBuffer())
      const c0 = performance.now()
      session = await ort.InferenceSession.create(model, { executionProviders: [data.ep], graphOptimizationLevel: 'basic' })
      const create = performance.now() - c0
      const t = performance.now(); await run(vec[0], [1500])
      postMessage({ type: 'started', create, first: performance.now() - t })
    } else if (data.type === 'task') {
      const v = vec[n++ % vec.length]
      const t = performance.now(); await run(v, [1500]); const one = performance.now() - t
      await run(v, RATINGS)
      postMessage({ type: 'done', one, all: performance.now() - t })
    }
  } catch (e) {
    postMessage({ type: 'error', message: String((e && e.message) || e).slice(0, 300) })
  }
}
