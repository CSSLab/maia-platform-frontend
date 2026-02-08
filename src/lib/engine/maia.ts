import { MaiaStatus } from 'src/types'
import { InferenceSession, Tensor } from 'onnxruntime-web'

import { preprocess, mirrorMove, policyIndexToUci, POLICY_SIZE } from './tensor'
import { MaiaModelStorage } from './storage'

interface MaiaOptions {
  model: string
  setStatus: (status: MaiaStatus) => void
  setProgress: (progress: number) => void
  setError: (error: string) => void
}

class Maia {
  private model!: InferenceSession
  private modelUrl: string
  private options: MaiaOptions
  private storage: MaiaModelStorage

  // For web: we will assume the deployed ONNX expects no time-info.
  // If the ONNX was exported with history > 1, we can bump this to match,
  // but for minimal integration we default to 1.
  private history = 1

  constructor(options: MaiaOptions) {
    this.modelUrl = options.model
    this.options = options
    this.storage = new MaiaModelStorage()

    this.initialize()
  }

  private async initialize() {
    await this.storage.requestPersistentStorage()

    console.log('Attempting to get model from IndexedDB...')
    const buffer = await this.storage.getModel(this.modelUrl)

    if (buffer) {
      console.log('Model found in IndexedDB, initializing...')
      try {
        await this.initializeModel(buffer)
        console.log('Model initialized successfully')
      } catch (e) {
        console.error('Failed to initialize model:', e)
        this.options.setStatus('error')
      }
    } else {
      console.log('Model not found in cache, will show download modal')

      const storageInfo = await this.storage.getStorageInfo()
      console.log('Maia cache status:', {
        modelUrl: this.modelUrl,
        userAgent: navigator.userAgent,
        indexedDBSupported: storageInfo.supported,
        storageEstimate: storageInfo.quota
          ? { quota: storageInfo.quota, usage: storageInfo.usage }
          : 'not supported',
        modelSize: storageInfo.modelSize,
        modelTimestamp: storageInfo.modelTimestamp,
      })

      this.options.setStatus('no-cache')
    }
  }

  public async downloadModel() {
    const response = await fetch(this.modelUrl)
    if (!response.ok) throw new Error('Failed to fetch model')

    const reader = response.body?.getReader()
    const contentLength = +(response.headers.get('Content-Length') ?? 0)
    if (!reader) throw new Error('No response body')

    const chunks: Uint8Array[] = []
    let receivedLength = 0
    let lastReportedProgress = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      receivedLength += value.length

      const currentProgress = Math.floor((receivedLength / contentLength) * 100)
      if (currentProgress >= lastReportedProgress + 10) {
        this.options.setProgress(currentProgress)
        lastReportedProgress = currentProgress
      }
    }

    const buffer = new Uint8Array(receivedLength)
    let position = 0
    for (const chunk of chunks) {
      buffer.set(chunk, position)
      position += chunk.length
    }

    await this.storage.storeModel(this.modelUrl, buffer.buffer)

    await this.initializeModel(buffer.buffer)
    this.options.setStatus('ready')
  }

  public async getStorageInfo() {
    return await this.storage.getStorageInfo()
  }

  public async clearStorage() {
    return await this.storage.clearAllStorage()
  }

  public async initializeModel(buffer: ArrayBuffer) {
    this.model = await InferenceSession.create(buffer)

    // Optional: if exporter fixed a tokens last-dim, we can infer history
    // by checking input metadata tokens dims (B,64,D). If D is multiple of 12,
    // history = D/12.
    const meta = (this.model as any).inputMetadata as
      | Record<string, { type: string; dimensions?: number[] }>
      | undefined

    const tokenDims = meta?.tokens?.dimensions
    if (tokenDims && tokenDims.length === 3) {
      const d = tokenDims[2]
      if (typeof d === 'number' && d > 0 && d % 12 === 0) {
        this.history = d / 12
      }
    }

    console.log('Model inputs:', (this.model as any).inputNames)
    console.log('Maia3 inferred history:', this.history)

    this.options.setStatus('ready')
  }

  /**
   * Maia 3 evaluation.
   * Inputs:
   *  - tokens:    float32 [B,64,12*history]
   *  - self_elos: int64   [B] (or float32 depending on export)
   *  - oppo_elos: int64   [B]
   * Outputs (names depend on exporter):
   *  - logits_move:  float32 [B,4352]
   *  - logits_value: float32 [B,3]  (loss,draw,win)
   *  - logits_ponder: float32 [B]   (ignored)
   */
  async evaluate(fen: string, eloSelf: number, eloOppo: number) {
    if (!this.model) throw new Error('Maia model not initialized')

    const { tokens, legalMask, tokenDimUsed, blackToMove } = preprocess(
      fen,
      this.history,
    )

    const meta = (this.model as any).inputMetadata as
      | Record<string, { type: string; dimensions?: number[] }>
      | undefined

    const feeds: Record<string, Tensor> = {
      tokens: new Tensor('float32', tokens, [1, 64, tokenDimUsed]),
      self_elos: makeScalarTensor(meta, 'self_elos', eloSelf),
      oppo_elos: makeScalarTensor(meta, 'oppo_elos', eloOppo),
    }

    const outs = await this.model.run(feeds)

    const logitsMove = pickOutput(outs, ['logits_move', 'logits_maia', 'policy'])
    const logitsValue = pickOutput(outs, ['logits_value', 'value'])

    if (!logitsMove || !logitsValue) {
      throw new Error(
        `Unexpected ONNX outputs: ${Object.keys(outs).join(', ')}`,
      )
    }

    const { policy, value } = processOutputsMaia3(
      logitsMove,
      logitsValue,
      legalMask,
      blackToMove,
    )

    return { policy, value }
  }

  async batchEvaluate(boards: string[], eloSelfs: number[], eloOppos: number[]) {
    if (!this.model) throw new Error('Maia model not initialized')

    const batchSize = boards.length
    const tokenDim = 12 * this.history

    const tokensAll = new Float32Array(batchSize * 64 * tokenDim)
    const legalMasks: Float32Array[] = []
    const blackFlags: boolean[] = []

    for (let i = 0; i < batchSize; i++) {
      const { tokens, legalMask, tokenDimUsed, blackToMove } = preprocess(
        boards[i],
        this.history,
      )

      if (tokenDimUsed !== tokenDim) {
        throw new Error(
          `Token dim mismatch: expected ${tokenDim}, got ${tokenDimUsed}`,
        )
      }

      tokensAll.set(tokens, i * 64 * tokenDim)
      legalMasks.push(legalMask)
      blackFlags.push(blackToMove)
    }

    const meta = (this.model as any).inputMetadata as
      | Record<string, { type: string; dimensions?: number[] }>
      | undefined

    const feeds: Record<string, Tensor> = {
      tokens: new Tensor('float32', tokensAll, [batchSize, 64, tokenDim]),
      self_elos: makeVectorTensor(meta, 'self_elos', eloSelfs),
      oppo_elos: makeVectorTensor(meta, 'oppo_elos', eloOppos),
    }

    const start = performance.now()
    const outs = await this.model.run(feeds)
    const end = performance.now()

    const logitsMove = pickOutput(outs, ['logits_move', 'logits_maia', 'policy'])
    const logitsValue = pickOutput(outs, ['logits_value', 'value'])

    if (!logitsMove || !logitsValue) {
      throw new Error(
        `Unexpected ONNX outputs: ${Object.keys(outs).join(', ')}`,
      )
    }

    const moveData = logitsMove.data as Float32Array
    const valueData = logitsValue.data as Float32Array

    const movePerItem = logitsMove.size / batchSize
    const valuePerItem = logitsValue.size / batchSize

    const results = []
    for (let i = 0; i < batchSize; i++) {
      const m0 = i * movePerItem
      const m1 = m0 + movePerItem
      const moveSlice = moveData.slice(m0, m1) as Float32Array
      const moveTensor = new Tensor('float32', moveSlice, [movePerItem])

      const v0 = i * valuePerItem
      const v1 = v0 + valuePerItem
      const valueSlice = valueData.slice(v0, v1) as Float32Array
      const valueTensor = new Tensor('float32', valueSlice, [valuePerItem])

      const { policy, value } = processOutputsMaia3(
        moveTensor,
        valueTensor,
        legalMasks[i],
        blackFlags[i],
      )

      results.push({ policy, value })
    }

    return { result: results, time: end - start }
  }
}

/* =========================================================
   Output processing
   ========================================================= */

function processOutputsMaia3(
  logits_move: Tensor,
  logits_value: Tensor,
  legalMask: Float32Array,
  blackToMoveOriginal: boolean,
) {
  const logits = logits_move.data as Float32Array

  // Collect legal indices
  const legalIdx: number[] = []
  const n = Math.min(logits.length, legalMask.length, POLICY_SIZE)
  for (let i = 0; i < n; i++) {
    if (legalMask[i] > 0) legalIdx.push(i)
  }

  // Softmax over legal moves only
  const legalLogits = legalIdx.map((i) => logits[i])
  const probs = softmax1d(legalLogits)

  const moveProbs: Record<string, number> = {}
  for (let i = 0; i < legalIdx.length; i++) {
    const idx = legalIdx[i]
    let uci = policyIndexToUci(idx)

    if (blackToMoveOriginal) {
      uci = mirrorMove(uci)
    }

    moveProbs[uci] = probs[i]
  }

  const sortedMoveProbs = Object.keys(moveProbs)
    .sort((a, b) => moveProbs[b] - moveProbs[a])
    .reduce(
      (acc, key) => {
        acc[key] = moveProbs[key]
        return acc
      },
      {} as Record<string, number>,
    )

  // Value logits order confirmed in train.py:
  // label = (self_win + 1) where self_win ∈ {-1,0,1}
  // so: 0=loss, 1=draw, 2=win
  const v = logits_value.data as Float32Array
  if (v.length < 3) {
    throw new Error(`Expected logits_value length 3, got ${v.length}`)
  }

  const pv = softmax1d([v[0] as number, v[1] as number, v[2] as number])
  let winProb = pv[2] + 0.5 * pv[1]

  if (blackToMoveOriginal) {
    winProb = 1 - winProb
  }

  winProb = Math.round(winProb * 10000) / 10000

  return { policy: sortedMoveProbs, value: winProb }
}

/* =========================================================
   Helpers: ONNX outputs & tensor typing
   ========================================================= */

function pickOutput(
  outs: Record<string, Tensor>,
  preferredNames: string[],
): Tensor | null {
  for (const name of preferredNames) {
    if (outs[name]) return outs[name] as Tensor
  }

  // Fallback by heuristics:
  // - policy is the largest 2D tensor (B,4352)
  // - value is the 2D tensor with last dim 3 (B,3)
  const vals = Object.values(outs) as Tensor[]

  const valueCandidate = vals.find((t) => {
    const dims = (t as any).dims as number[] | undefined
    return dims && dims.length === 2 && dims[1] === 3
  })
  if (preferredNames.includes('logits_value') || preferredNames.includes('value')) {
    if (valueCandidate) return valueCandidate
  }

  const policyCandidate = vals
    .slice()
    .sort((a, b) => b.size - a.size)[0]

  return policyCandidate ?? null
}

function softmax1d(xs: number[]): number[] {
  if (xs.length === 0) return []
  const m = Math.max(...xs)
  const exps = xs.map((x) => Math.exp(x - m))
  const s = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / s)
}

function makeScalarTensor(
  meta: Record<string, { type: string; dimensions?: number[] }> | undefined,
  name: string,
  value: number,
): Tensor {
  const t = meta?.[name]?.type?.toLowerCase() ?? 'int64'
  if (t.includes('float')) {
    return new Tensor('float32', Float32Array.from([value]), [1])
  }
  return new Tensor('int64', BigInt64Array.from([BigInt(Math.trunc(value))]), [
    1,
  ])
}

function makeVectorTensor(
  meta: Record<string, { type: string; dimensions?: number[] }> | undefined,
  name: string,
  values: number[],
): Tensor {
  const t = meta?.[name]?.type?.toLowerCase() ?? 'int64'
  if (t.includes('float')) {
    return new Tensor('float32', Float32Array.from(values), [values.length])
  }
  return new Tensor(
    'int64',
    BigInt64Array.from(values.map((v) => BigInt(Math.trunc(v)))),
    [values.length],
  )
}

export default Maia
