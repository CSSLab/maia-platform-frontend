import Maia from './maia'
import {
  MAIA_WORKER_SETTINGS_KEY,
  saveMaiaWorkerSettings,
} from './workerSettings'

jest.mock('onnxruntime-web', () => ({
  Tensor: class {
    data: Float32Array
    constructor(_type: string, data: Float32Array) {
      this.data = data
    }
  },
}))

class FakeWorker {
  static instances: FakeWorker[] = []
  static active = 0
  static peakActive = 0
  static failSecondaryInference = false
  static delaySecondaryInitialization = false
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(message: any) {
    if (message.type === 'init') {
      if (
        !FakeWorker.delaySecondaryInitialization ||
        FakeWorker.instances[0] === this
      ) {
        setTimeout(() => this.emit({ type: 'status', status: 'ready' }), 0)
      }
    }
    if (message.type === 'inference') {
      if (
        FakeWorker.failSecondaryInference &&
        FakeWorker.instances[1] === this
      ) {
        setTimeout(
          () =>
            this.emit({
              type: 'error',
              id: message.id,
              message: 'Secondary inference failed',
            }),
          0,
        )
        return
      }
      FakeWorker.active++
      FakeWorker.peakActive = Math.max(FakeWorker.peakActive, FakeWorker.active)
      setTimeout(() => {
        const ratings = new Float32Array(message.eloSelfs)
        const logitsMove = new Float32Array(message.batchSize * 4352)
        const logitsValue = new Float32Array(message.batchSize * 3)
        for (let i = 0; i < message.batchSize; i++) {
          logitsMove[i * 4352] = ratings[i] / 1000
          logitsValue[i * 3 + 2] = ratings[i] / 1000
        }
        FakeWorker.active--
        this.emit({
          type: 'inference-result',
          id: message.id,
          logitsMove: logitsMove.buffer,
          logitsValue: logitsValue.buffer,
        })
      }, 5)
    }
  }

  emit(data: any) {
    this.onmessage?.({ data } as MessageEvent)
  }

  terminate() {
    this.terminated = true
  }
}

describe('Maia review inference', () => {
  const originalWorker = global.Worker
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  beforeEach(() => {
    global.Worker = FakeWorker as unknown as typeof Worker
    FakeWorker.instances = []
    FakeWorker.active = 0
    FakeWorker.peakActive = 0
    FakeWorker.failSecondaryInference = false
    FakeWorker.delaySecondaryInitialization = false
    localStorage.clear()
  })

  afterEach(() => {
    global.Worker = originalWorker
  })

  const makeEngine = () =>
    new Maia({
      model: '/maia3/maia3_simplified.onnx',
      modelVersion: '3',
      setStatus: jest.fn(),
      setProgress: jest.fn(),
      setError: jest.fn(),
    })

  it('keeps rating results in order while running chunks concurrently', async () => {
    const ratings = [600, 800, 1000, 1200, 1400, 1600]
    const engine = makeEngine()
    await new Promise((resolve) => setTimeout(resolve, 1))
    const parallel = await engine.batchEvaluateMaia3(
      ratings.map(() => fen),
      ratings,
      ratings,
    )
    expect(FakeWorker.instances).toHaveLength(2)
    expect(FakeWorker.peakActive).toBe(2)
    expect(parallel.result).toHaveLength(ratings.length)
    engine.dispose()

    localStorage.setItem(
      MAIA_WORKER_SETTINGS_KEY,
      JSON.stringify({ enabled: false, count: 2 }),
    )
    const single = makeEngine()
    await new Promise((resolve) => setTimeout(resolve, 1))
    const sequential = await single.batchEvaluateMaia3(
      ratings.map(() => fen),
      ratings,
      ratings,
    )
    expect(sequential.result).toEqual(parallel.result)
    single.dispose()
  })

  it('rejects mismatched inputs instead of misaligning ratings', async () => {
    const engine = makeEngine()
    await expect(engine.batchEvaluateMaia3([fen], [], [600])).rejects.toThrow(
      'same length',
    )
    engine.dispose()
  })

  it('retries a failed secondary chunk on the primary worker', async () => {
    FakeWorker.failSecondaryInference = true
    const engine = makeEngine()
    await new Promise((resolve) => setTimeout(resolve, 1))
    const output = await engine.batchEvaluateMaia3(
      [fen, fen],
      [600, 1600],
      [600, 1600],
    )
    expect(output.result).toHaveLength(2)
    expect(output.result[0].value).not.toEqual(output.result[1].value)
    engine.dispose()
  })

  it('continues with one worker when parallelism is disabled during startup', async () => {
    FakeWorker.delaySecondaryInitialization = true
    const engine = makeEngine()
    await new Promise((resolve) => setTimeout(resolve, 1))
    const result = engine.batchEvaluateMaia3(
      [fen, fen],
      [600, 1600],
      [600, 1600],
    )
    await new Promise((resolve) => setTimeout(resolve, 1))
    saveMaiaWorkerSettings({ enabled: false, count: 2 })
    expect((await result).result).toHaveLength(2)
    expect(FakeWorker.instances[1].terminated).toBe(true)
    engine.dispose()
  })
})
