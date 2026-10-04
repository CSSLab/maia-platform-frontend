import { chromium } from '@playwright/test'
import { Chess } from 'chess.ts'

const baseURL = process.env.MAIA_BENCHMARK_URL || 'http://127.0.0.1:3107'
const sampleMoves = [
  'e4',
  'e5',
  'Nf3',
  'Nc6',
  'Bb5',
  'a6',
  'Ba4',
  'Nf6',
  'O-O',
]
const sampleGame = new Chess()
const reviewFens = [sampleGame.fen()]
for (const move of sampleMoves) {
  sampleGame.move(move)
  reviewFens.push(sampleGame.fen())
}
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE,
})

try {
  const page = await browser.newPage()
  await page.goto(baseURL)
  const report = await page.evaluate(async (fens) => {
    const modelUrl = '/maia3/maia3_simplified.onnx'
    const ratings = Array.from({ length: 21 }, (_, i) => 600 + i * 100)
    const pieceTypes = 'PNBRQKpnbrqk'
    const tokenize = (fen) => {
      const [placement, turn] = fen.split(' ')
      const rows = placement.split('/')
      const canonicalRows =
        turn === 'b'
          ? rows.reverse().map((row) =>
              row.replace(/[a-zA-Z]/g, (piece) =>
                piece === piece.toUpperCase()
                  ? piece.toLowerCase()
                  : piece.toUpperCase(),
              ),
            )
          : rows
      const tokens = new Float32Array(64 * 12)
      canonicalRows.forEach((row, rank) => {
        let file = 0
        for (const symbol of row) {
          if (/\d/.test(symbol)) {
            file += Number(symbol)
          } else {
            tokens[((7 - rank) * 8 + file) * 12 + pieceTypes.indexOf(symbol)] = 1
            file++
          }
        }
      })
      return tokens
    }
    const positions = fens.map(tokenize)
    const workers = []
    let nextId = 1

    const waitFor = (worker, predicate) =>
      new Promise((resolve, reject) => {
        const onMessage = (event) => {
          if (event.data.type === 'error') {
            worker.removeEventListener('message', onMessage)
            reject(new Error(event.data.message))
          } else if (predicate(event.data)) {
            worker.removeEventListener('message', onMessage)
            resolve(event.data)
          }
        }
        worker.addEventListener('message', onMessage)
      })

    const addWorker = async () => {
      const worker = new Worker('/maia-worker.js')
      const initialized = waitFor(
        worker,
        (message) =>
          message.type === 'status' &&
          (message.status === 'ready' || message.status === 'no-cache'),
      )
      worker.postMessage({ type: 'init', modelUrl, modelVersion: '3' })
      const status = await initialized
      if (status.status === 'no-cache') {
        const ready = waitFor(
          worker,
          (message) => message.type === 'status' && message.status === 'ready',
        )
        worker.postMessage({ type: 'download' })
        await ready
      }
      workers.push(worker)
      return worker
    }

    const infer = (worker, position, chunkRatings) => {
      const size = chunkRatings.length
      const id = nextId++
      const result = waitFor(
        worker,
        (message) => message.type === 'inference-result' && message.id === id,
      )
      const tokens = new Float32Array(size * position.length)
      for (let i = 0; i < size; i++) {
        tokens.set(position, i * position.length)
      }
      worker.postMessage({
        type: 'inference',
        id,
        tokens: tokens.buffer,
        eloSelfs: Float32Array.from(chunkRatings).buffer,
        eloOppos: Float32Array.from(chunkRatings).buffer,
        batchSize: size,
      })
      return result
    }

    const runPosition = async (workerCount, position) => {
      const chunkSize = Math.ceil(ratings.length / workerCount)
      const chunks = await Promise.all(
        workers.slice(0, workerCount).map(async (worker, index) => {
          const offset = index * chunkSize
          const chunkRatings = ratings.slice(offset, offset + chunkSize)
          if (chunkRatings.length === 0) return null
          return { offset, result: await infer(worker, position, chunkRatings) }
        }),
      )
      const logitsMove = new Float32Array(ratings.length * 4352)
      const logitsValue = new Float32Array(ratings.length * 3)
      for (const chunk of chunks) {
        if (!chunk) continue
        logitsMove.set(new Float32Array(chunk.result.logitsMove), chunk.offset * 4352)
        logitsValue.set(new Float32Array(chunk.result.logitsValue), chunk.offset * 3)
      }
      return { logitsMove, logitsValue }
    }

    const benchmark = async (workerCount, positionCount) => {
      const started = performance.now()
      for (let index = 0; index < positionCount; index++) {
        await runPosition(workerCount, positions[index])
      }
      return Math.round(performance.now() - started)
    }

    const maxDifference = (left, right) => {
      let largest = 0
      for (let i = 0; i < left.length; i++) {
        largest = Math.max(largest, Math.abs(left[i] - right[i]))
      }
      return largest
    }

    const coldStart = performance.now()
    await addWorker()
    const firstWorkerReadyMs = Math.round(performance.now() - coldStart)
    while (workers.length < 4) await addWorker()
    await Promise.all(
      workers.map((worker) => infer(worker, positions[0], [1500])),
    )
    const baseline = []
    for (const position of positions) {
      baseline.push(await runPosition(1, position))
    }
    const outputComparisons = []
    for (const count of [1, 2, 4]) {
      let maxMoveLogitDifference = 0
      let maxValueLogitDifference = 0
      for (let index = 0; index < positions.length; index++) {
        const output = await runPosition(count, positions[index])
        maxMoveLogitDifference = Math.max(
          maxMoveLogitDifference,
          maxDifference(baseline[index].logitsMove, output.logitsMove),
        )
        maxValueLogitDifference = Math.max(
          maxValueLogitDifference,
          maxDifference(baseline[index].logitsValue, output.logitsValue),
        )
      }
      outputComparisons.push({
        workers: count,
        maxMoveLogitDifference,
        maxValueLogitDifference,
      })
    }
    const rows = []
    const orders = [
      [1, 2, 4],
      [4, 2, 1],
      [2, 1, 4],
    ]
    for (const positionCount of [1, 5, 10]) {
      const samples = new Map([[1, []], [2, []], [4, []]])
      for (const order of orders) {
        for (const count of order) {
          samples.get(count).push(await benchmark(count, positionCount))
        }
      }
      for (const count of [1, 2, 4]) {
        rows.push({
          workers: count,
          positions: positionCount,
          samplesMs: samples.get(count),
        })
      }
    }
    workers.forEach((worker) => worker.terminate())
    return {
      userAgent: navigator.userAgent,
      logicalCores: navigator.hardwareConcurrency,
      crossOriginIsolated: self.crossOriginIsolated,
      ratingLevels: ratings,
      positionCount: positions.length,
      outputComparisons,
      firstWorkerReadyMs,
      rows,
    }
  }, reviewFens)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} finally {
  await browser.close()
}
