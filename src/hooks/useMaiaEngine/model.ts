import { MaiaStatus } from 'src/types'
import { InferenceSession, Tensor } from 'onnxruntime-web'

import { mirrorMove, preprocess, allPossibleMovesReversed } from './utils'
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

  constructor(options: MaiaOptions) {
    this.modelUrl = options.model
    this.options = options
    this.storage = new MaiaModelStorage()

    this.initialize()
  }

  private async initialize() {
    // Request persistent storage for better reliability
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
    this.options.setStatus('ready')
  }

  /**
   * Evaluates a given chess position using the Maia model.
   *
   * @param board - The FEN string representing the chess position.
   * @param eloSelf - The ELO rating of the player making the move.
   * @param eloOppo - The ELO rating of the opponent.
   * @returns A promise that resolves to an object containing the policy and value predictions.
   */
  async evaluate(board: string, eloSelf: number, eloOppo: number) {
    if (!this.model) {
      throw new Error('Maia model not initialized')
    }

    const { boardInput, legalMoves, eloSelfCategory, eloOppoCategory } =
      preprocess(board, eloSelf, eloOppo)

    // Load and run the model
    const feeds: Record<string, Tensor> = {
      boards: new Tensor('float32', boardInput, [1, 18, 8, 8]),
      elo_self: new Tensor(
        'int64',
        BigInt64Array.from([BigInt(eloSelfCategory)]),
      ),
      elo_oppo: new Tensor(
        'int64',
        BigInt64Array.from([BigInt(eloOppoCategory)]),
      ),
    }
    const { logits_maia, logits_value } = await this.model.run(feeds)

    const { policy, value } = processOutputs(
      board,
      logits_maia,
      logits_value,
      legalMoves,
    )

    return {
      policy,
      value,
    }
  }

  /**
   * Evaluates a batch of chess positions using the Maia model.
   *
   * @param boards - An array of FEN strings representing the chess positions.
   * @param eloSelfs - An array of ELO ratings for the player making the move.
   * @param eloOppos - An array of ELO ratings for the opponent.
   * @returns A promise that resolves to an array of objects containing the policy and value predictions.
   */
  async batchEvaluate(
    boards: string[],
    eloSelfs: number[],
    eloOppos: number[],
  ) {
    if (!this.model) {
      throw new Error('Maia model not initialized')
    }

    const batchSize = boards.length
    const boardInputs = []
    const eloSelfCategories = []
    const eloOppoCategories = []
    const legalMoves = []

    for (let i = 0; i < boards.length; i++) {
      const {
        boardInput,
        legalMoves: legalMoves_,
        eloSelfCategory,
        eloOppoCategory,
      } = preprocess(boards[i], eloSelfs[i], eloOppos[i])

      boardInputs.push(boardInput)
      eloSelfCategories.push(eloSelfCategory)
      eloOppoCategories.push(eloOppoCategory)
      legalMoves.push(legalMoves_)
    }

    const combinedBoardInputs = new Float32Array(batchSize * 18 * 8 * 8)
    for (let i = 0; i < batchSize; i++) {
      combinedBoardInputs.set(boardInputs[i], i * 18 * 8 * 8)
    }

    const feeds: Record<string, Tensor> = {
      boards: new Tensor('float32', combinedBoardInputs, [batchSize, 18, 8, 8]),
      elo_self: new Tensor(
        'int64',
        BigInt64Array.from(eloSelfCategories.map(BigInt)),
        [batchSize],
      ),
      elo_oppo: new Tensor(
        'int64',
        BigInt64Array.from(eloOppoCategories.map(BigInt)),
        [batchSize],
      ),
    }

    const start = performance.now()
    const { logits_maia, logits_value } = await this.model.run(feeds)
    const end = performance.now()

    const results = []

    for (let i = 0; i < batchSize; i++) {
      const logitsPerItem = logits_maia.size / batchSize
      const startIdx = i * logitsPerItem
      const endIdx = startIdx + logitsPerItem

      const policyLogitsArray = logits_maia.data.slice(
        startIdx,
        endIdx,
      ) as Float32Array
      const policyTensor = new Tensor('float32', policyLogitsArray, [
        logitsPerItem,
      ])
      const valueLogit = logits_value.data[i] as number
      const valueTensor = new Tensor('float32', [valueLogit], [1])

      const { policy, value: winProb } = processOutputs(
        boards[i],
        policyTensor,
        valueTensor,
        legalMoves[i],
      )

      results.push({ policy, value: winProb })
    }

    return {
      result: results,
      time: end - start,
    }
  }
}

/**
 * Processes the outputs of the ONNX model to compute the policy and value.
 *
 * @param {string} fen - The FEN string representing the current board state.
 * @param {ort.Tensor} logits_maia - The logits tensor for the policy output from the model.
 * @param {ort.Tensor} logits_value - The logits tensor for the value output from the model.
 * @param {Float32Array} legalMoves - An array indicating the legal moves.
 * @returns {{ policy: Record<string, number>, value: number }} An object containing the policy (move probabilities) and the value (win probability).
 */
function processOutputs(
  fen: string,
  logits_maia: Tensor,
  logits_value: Tensor,
  legalMoves: Float32Array,
) {
  const logits = logits_maia.data as Float32Array
  const value = logits_value.data as Float32Array

  let winProb = Math.min(Math.max((value[0] as number) / 2 + 0.5, 0), 1)

  let black_flag = false
  if (fen.split(' ')[1] === 'b') {
    black_flag = true
    winProb = 1 - winProb
  }

  winProb = Math.round(winProb * 10000) / 10000

  // Get indices of legal moves
  const legalMoveIndices = legalMoves
    .map((value, index) => (value > 0 ? index : -1))
    .filter((index) => index !== -1)

  const legalMovesMirrored = []
  for (const moveIndex of legalMoveIndices) {
    let move = allPossibleMovesReversed[moveIndex]
    if (black_flag) {
      move = mirrorMove(move)
    }

    legalMovesMirrored.push(move)
  }

  // Extract logits for legal moves
  const legalLogits = legalMoveIndices.map((idx) => logits[idx])

  // Compute softmax over the legal logits
  const maxLogit = Math.max(...legalLogits)
  const expLogits = legalLogits.map((logit) => Math.exp(logit - maxLogit))
  const sumExp = expLogits.reduce((a, b) => a + b, 0)
  const probs = expLogits.map((expLogit) => expLogit / sumExp)

  // Map the probabilities back to their move indices
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
