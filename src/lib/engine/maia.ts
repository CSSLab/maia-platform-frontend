import { MaiaStatus } from 'src/types'
import { Tensor } from 'onnxruntime-web'

import {
  mirrorMove,
  preprocessMaia3,
  allPossibleMovesMaia3Reversed,
} from './tensor'
import { MaiaModelStorage } from './storage'
import {
  getMaiaWorkerSettings,
  MAIA_WORKER_SETTINGS_EVENT,
} from './workerSettings'

interface MaiaOptions {
  model: string
  modelVersion: string
  setStatus: (status: MaiaStatus) => void
  setProgress: (progress: number) => void
  setError: (error: string) => void
}

interface PendingInference {
  resolve: (value: {
    logitsMove: Float32Array
    logitsValue: Float32Array
  }) => void
  reject: (error: Error) => void
  slot: WorkerSlot
}

interface WorkerSlot {
  worker: Worker
  ready: boolean
  pending: number
  resolveReady: () => void
  rejectReady: (error: Error) => void
  readyPromise: Promise<void>
}

interface PendingDownload {
  resolve: () => void
  reject: (error: Error) => void
}

const SECONDARY_WORKER_STARTUP_TIMEOUT_MS = 5_000

class Maia {
  private workers: WorkerSlot[] = []
  private options: MaiaOptions
  private storage: MaiaModelStorage
  private pendingInferences: Map<number, PendingInference> = new Map()
  private pendingDownload: PendingDownload | null = null
  private downloadPromise: Promise<void> | null = null
  private nextRequestId = 0
  private disposed = false
  private modelUrl: string
  private modelVersion: string

  constructor(options: MaiaOptions) {
    this.options = options
    this.modelUrl = options.model
    this.modelVersion = options.modelVersion
    this.storage = new MaiaModelStorage()
    this.initialize(options.model, options.modelVersion)
    if (typeof window !== 'undefined') {
      window.addEventListener(
        MAIA_WORKER_SETTINGS_EVENT,
        this.onSettingsChanged,
      )
    }
  }

  private onSettingsChanged = () => {
    const desired = this.desiredWorkerCount()
    // Do not terminate an in-flight inference; excess workers are retired when idle.
    this.trimWorkers(desired)
  }

  private desiredWorkerCount() {
    const settings = getMaiaWorkerSettings()
    return settings.enabled ? settings.count : 1
  }

  private trimWorkers(desired: number) {
    for (let i = this.workers.length - 1; i >= desired; i--) {
      const slot = this.workers[i]
      if (slot.pending !== 0) continue
      slot.worker.terminate()
      slot.rejectReady(new Error('Maia worker disabled'))
      this.workers.splice(i, 1)
    }
  }

  private initialize(modelUrl: string, modelVersion: string) {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      return
    }

    this.createWorker(modelUrl, modelVersion)
  }

  private createWorker(modelUrl: string, modelVersion: string): WorkerSlot {
    const worker = new Worker('/maia-worker.js')
    let resolveReady!: () => void
    let rejectReady!: (error: Error) => void
    const readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    // The primary worker can report no-cache before a download; secondary
    // workers are only created after that download has completed.
    readyPromise.catch(() => undefined)
    const slot: WorkerSlot = {
      worker,
      ready: false,
      pending: 0,
      resolveReady,
      rejectReady,
      readyPromise,
    }
    this.workers.push(slot)
    const primary = this.workers.length === 1

    worker.onmessage = (e) => {
      const msg = e.data

      switch (msg.type) {
        case 'status':
          if (primary) this.options.setStatus(msg.status)
          if (msg.status === 'ready') {
            slot.ready = true
            slot.resolveReady()
            if (primary) {
              this.options.setProgress(100)
              this.pendingDownload?.resolve()
              this.pendingDownload = null
              this.downloadPromise = null
            }
          } else if (msg.status === 'no-cache' && !primary) {
            this.failWorker(slot, new Error('Maia model cache unavailable'))
          }
          break

        case 'progress':
          if (primary) this.options.setProgress(msg.progress)
          break

        case 'error': {
          if (msg.id !== undefined) {
            const pending = this.pendingInferences.get(msg.id)
            if (pending) {
              pending.reject(new Error(msg.message))
              this.pendingInferences.delete(msg.id)
              slot.pending--
            }
          } else {
            this.failWorker(slot, new Error(msg.message))
          }
          break
        }

        case 'inference-result': {
          const pending = this.pendingInferences.get(msg.id)
          if (pending) {
            pending.resolve({
              logitsMove: new Float32Array(msg.logitsMove),
              logitsValue: new Float32Array(msg.logitsValue),
            })
            this.pendingInferences.delete(msg.id)
            slot.pending--
            this.trimWorkers(this.desiredWorkerCount())
          }
          break
        }
      }
    }

    worker.onerror = (err) => {
      console.error('Maia worker error:', err)
      this.failWorker(slot, new Error(err.message || 'Worker crashed'))
    }

    try {
      worker.postMessage({ type: 'init', modelUrl, modelVersion })
    } catch (error) {
      this.failWorker(
        slot,
        error instanceof Error
          ? error
          : new Error('Could not start Maia worker'),
      )
      throw error
    }
    return slot
  }

  private failWorker(slot: WorkerSlot, error: Error) {
    slot.rejectReady(error)
    for (const [id, pending] of this.pendingInferences) {
      if (pending.slot !== slot) continue
      pending.reject(error)
      this.pendingInferences.delete(id)
    }
    slot.pending = 0
    if (slot === this.workers[0]) {
      this.options.setError(error.message)
      this.options.setStatus('error')
      this.pendingDownload?.reject(error)
      this.pendingDownload = null
      this.downloadPromise = null
    } else {
      slot.worker.terminate()
      this.workers = this.workers.filter((worker) => worker !== slot)
    }
  }

  public dispose() {
    this.disposed = true
    if (typeof window !== 'undefined') {
      window.removeEventListener(
        MAIA_WORKER_SETTINGS_EVENT,
        this.onSettingsChanged,
      )
    }
    this.pendingDownload?.reject(new Error('Maia engine disposed'))
    this.pendingDownload = null
    this.downloadPromise = null
    for (const slot of this.workers) {
      slot.worker.terminate()
      slot.rejectReady(new Error('Maia engine disposed'))
    }
    for (const pending of this.pendingInferences.values()) {
      pending.reject(new Error('Maia engine disposed'))
    }
    this.pendingInferences.clear()
    this.workers = []
  }

  private async availableWorkers(batchSize: number): Promise<WorkerSlot[]> {
    const desired = Math.min(batchSize, this.desiredWorkerCount())
    this.trimWorkers(desired)
    if (desired === 1 || !this.workers[0]?.ready)
      return this.workers.slice(0, 1)
    while (this.workers.length < desired && !this.disposed) {
      try {
        this.createWorker(this.modelUrl, this.modelVersion)
      } catch (error) {
        console.warn('Could not start an additional Maia worker:', error)
        break
      }
    }
    const candidates = this.workers.slice(0, desired)
    let timeout: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      Promise.allSettled(candidates.map((slot) => slot.readyPromise)),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, SECONDARY_WORKER_STARTUP_TIMEOUT_MS)
      }),
    ])
    if (timeout) clearTimeout(timeout)
    return candidates.filter((slot) => slot.ready)
  }

  public async downloadModel() {
    if (!this.workers[0]) throw new Error('Worker not initialized')
    if (this.downloadPromise) {
      return this.downloadPromise
    }

    this.options.setProgress(0)

    this.downloadPromise = new Promise<void>((resolve, reject) => {
      this.pendingDownload = { resolve, reject }
      this.workers[0].worker.postMessage({ type: 'download' })
    })

    return this.downloadPromise
  }

  public async getStorageInfo() {
    return await this.storage.getStorageInfo()
  }

  public async clearStorage() {
    return await this.storage.clearAllStorage()
  }

  private runInference(
    tokens: Float32Array,
    eloSelfs: Float32Array,
    eloOppos: Float32Array,
    batchSize: number,
    slot = this.workers[0],
  ): Promise<{ logitsMove: Float32Array; logitsValue: Float32Array }> {
    if (!slot) {
      return Promise.reject(new Error('Worker not initialized'))
    }

    const id = this.nextRequestId++

    return new Promise((resolve, reject) => {
      this.pendingInferences.set(id, { resolve, reject, slot })
      slot.pending++

      // Transfer ArrayBuffers for zero-copy send
      try {
        slot.worker.postMessage(
          {
            type: 'inference',
            id,
            tokens: tokens.buffer,
            eloSelfs: eloSelfs.buffer,
            eloOppos: eloOppos.buffer,
            batchSize,
          },
          [tokens.buffer, eloSelfs.buffer, eloOppos.buffer],
        )
      } catch (error) {
        this.pendingInferences.delete(id)
        slot.pending--
        reject(error)
      }
    })
  }

  /**
   * Evaluates a chess position using the Maia3 model (off main thread).
   */
  async evaluateMaia3(board: string, eloSelf: number, eloOppo: number) {
    const { boardTokens, legalMoves } = preprocessMaia3(board)

    const { logitsMove, logitsValue } = await this.runInference(
      boardTokens,
      Float32Array.from([eloSelf]),
      Float32Array.from([eloOppo]),
      1,
    )

    const policyTensor = new Tensor('float32', logitsMove, [logitsMove.length])
    const valueTensor = new Tensor('float32', logitsValue, [logitsValue.length])

    return processOutputsMaia3(board, policyTensor, valueTensor, legalMoves)
  }

  /**
   * Evaluates a batch of chess positions using the Maia3 model (off main thread).
   */
  async batchEvaluateMaia3(
    boards: string[],
    eloSelfs: number[],
    eloOppos: number[],
  ) {
    const batchSize = boards.length
    if (batchSize === 0) return { result: [], time: 0 }
    if (eloSelfs.length !== batchSize || eloOppos.length !== batchSize) {
      throw new Error('Maia batch inputs must have the same length')
    }
    const boardInputs: Float32Array[] = []
    const legalMovesArr: Float32Array[] = []

    for (let i = 0; i < batchSize; i++) {
      const { boardTokens, legalMoves } = preprocessMaia3(boards[i])
      boardInputs.push(boardTokens)
      legalMovesArr.push(legalMoves)
    }

    const start = performance.now()
    const slots = await this.availableWorkers(batchSize)
    if (slots.length === 0) throw new Error('No Maia workers available')
    const chunkSize = Math.ceil(batchSize / slots.length)
    const chunks = await Promise.all(
      slots.map(async (slot, index) => {
        const offset = index * chunkSize
        const count = Math.min(chunkSize, batchSize - offset)
        if (count <= 0) return null
        const run = (target: WorkerSlot) => {
          const tokens = new Float32Array(count * 64 * 12)
          for (let i = 0; i < count; i++) {
            tokens.set(boardInputs[offset + i], i * 64 * 12)
          }
          return this.runInference(
            tokens,
            Float32Array.from(eloSelfs.slice(offset, offset + count)),
            Float32Array.from(eloOppos.slice(offset, offset + count)),
            count,
            target,
          )
        }
        let output
        try {
          output = await run(slot)
        } catch (error) {
          if (slot === this.workers[0]) throw error
          // A secondary session may fail under memory pressure. Preserve the
          // analysis by running that chunk on the primary worker instead.
          output = await run(this.workers[0])
        }
        return { offset, output }
      }),
    )
    const logitsMove = new Float32Array(batchSize * 4352)
    const logitsValue = new Float32Array(batchSize * 3)
    for (const chunk of chunks) {
      if (!chunk) continue
      logitsMove.set(chunk.output.logitsMove, chunk.offset * 4352)
      logitsValue.set(chunk.output.logitsValue, chunk.offset * 3)
    }
    const end = performance.now()

    const results = []
    const moveLogitsPerItem = 4352
    const valueLogitsPerItem = 3

    for (let i = 0; i < batchSize; i++) {
      const moveStart = i * moveLogitsPerItem
      const policyLogits = logitsMove.slice(
        moveStart,
        moveStart + moveLogitsPerItem,
      )
      const policyTensor = new Tensor('float32', policyLogits, [
        moveLogitsPerItem,
      ])

      const valueStart = i * valueLogitsPerItem
      const valueLogitsSlice = logitsValue.slice(
        valueStart,
        valueStart + valueLogitsPerItem,
      )
      const valueTensor = new Tensor('float32', valueLogitsSlice, [
        valueLogitsPerItem,
      ])

      const { policy, value } = processOutputsMaia3(
        boards[i],
        policyTensor,
        valueTensor,
        legalMovesArr[i],
      )

      results.push({ policy, value })
    }

    return { result: results, time: end - start }
  }
}

/**
 * Processes maia3 ONNX outputs. Maia3 outputs LDW (loss/draw/win) logits
 * and uses a 4352-dimensional move space.
 */
function processOutputsMaia3(
  fen: string,
  logits_move: Tensor,
  logits_value: Tensor,
  legalMoves: Float32Array,
) {
  const logits = logits_move.data as Float32Array
  const wdl = logits_value.data as Float32Array

  // Model output channels: index 0 = Loss, 1 = Draw, 2 = Win (for side-to-move)
  const maxWdl = Math.max(wdl[0], wdl[1], wdl[2])
  const expL = Math.exp(wdl[0] - maxWdl)
  const expD = Math.exp(wdl[1] - maxWdl)
  const expW = Math.exp(wdl[2] - maxWdl)
  const sumExp = expL + expD + expW
  let winProb = (expW + 0.5 * expD) / sumExp

  let black_flag = false
  if (fen.split(' ')[1] === 'b') {
    black_flag = true
    winProb = 1 - winProb
  }

  winProb = Math.round(winProb * 10000) / 10000

  const legalMoveIndices = legalMoves
    .map((value, index) => (value > 0 ? index : -1))
    .filter((index) => index !== -1)

  const legalMovesMirrored = []
  for (const moveIndex of legalMoveIndices) {
    let move = allPossibleMovesMaia3Reversed[moveIndex]
    if (black_flag) {
      move = mirrorMove(move)
    }
    legalMovesMirrored.push(move)
  }

  const legalLogits = legalMoveIndices.map((idx) => logits[idx])
  const maxLogit = Math.max(...legalLogits)
  const expLogits = legalLogits.map((logit) => Math.exp(logit - maxLogit))
  const sumExpMoves = expLogits.reduce((a, b) => a + b, 0)
  const probs = expLogits.map((expLogit) => expLogit / sumExpMoves)

  const moveProbs: Record<string, number> = {}
  for (let i = 0; i < legalMoveIndices.length; i++) {
    moveProbs[legalMovesMirrored[i]] = probs[i]
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

  return { policy: sortedMoveProbs, value: winProb }
}

export default Maia
