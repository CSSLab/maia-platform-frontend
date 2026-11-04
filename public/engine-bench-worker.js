// Maia in a worker, as on the site: one execution provider per worker.
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/'
const MAX_MEMORY_PAGES = 8192
const NativeMemory = WebAssembly.Memory
WebAssembly.Memory = function Memory(d) {
  return new NativeMemory(d && d.shared && d.maximum > MAX_MEMORY_PAGES ? { ...d, maximum: MAX_MEMORY_PAGES } : d)
}
WebAssembly.Memory.prototype = NativeMemory.prototype
importScripts(ORT + 'ort.webgpu.min.js')
ort.env.wasm.wasmPaths = ORT
const RATINGS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400]
let session, vec, looping = false, batches = 0
const one = (v) => session.run({ tokens: new ort.Tensor('float32', Float32Array.from(v.tokens), [1, 64, 12]), elo_self: new ort.Tensor('float32', Float32Array.from([1500]), [1]), elo_oppo: new ort.Tensor('float32', Float32Array.from([1500]), [1]) })
const ten = (v) => {
  const k = RATINGS.length, tok = new Float32Array(k * 768)
  for (let j = 0; j < k; j++) tok.set(v.tokens, j * 768)
  const elo = Float32Array.from(RATINGS)
  return session.run({ tokens: new ort.Tensor('float32', tok, [k, 64, 12]), elo_self: new ort.Tensor('float32', elo, [k]), elo_oppo: new ort.Tensor('float32', elo, [k]) })
}
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'start') {
      vec = await (await fetch('/engine-bench-vec.json')).json()
      const model = new Uint8Array(await (await fetch('/maia3/maia3_simplified.onnx')).arrayBuffer())
      const c0 = performance.now()
      session = await ort.InferenceSession.create(model, { executionProviders: [data.ep], graphOptimizationLevel: 'basic' })
      const create = performance.now() - c0
      const t1 = performance.now(); await one(vec[0]); const first = performance.now() - t1
      const ones = [], tens = []
      for (const v of vec) {
        let t = performance.now(); await one(v); ones.push(performance.now() - t)
        t = performance.now(); await ten(v); tens.push(performance.now() - t)
      }
      postMessage({ type: 'started', create, first, one: med(ones), ten: med(tens), threads: ort.env.wasm.numThreads })
    } else if (data.type === 'loop') {
      looping = true; batches = 0
      postMessage({ type: 'looping' })
      while (looping) { await ten(vec[batches % vec.length]); batches++; await new Promise((r) => setTimeout(r, 0)) }
      postMessage({ type: 'stopped', batches })
    } else if (data.type === 'stop') {
      looping = false
    }
  } catch (e) {
    postMessage({ type: 'error', message: String(e && e.message || e).slice(0, 300) })
  }
}
