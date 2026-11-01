import Maia, { MAIA_RESTART_DELAYS_MS } from './maia'

type Message = { type: string; id?: number; batchSize?: number }

/** Records what Maia posts and lets a test answer like the Maia worker. */
class FakeWorker {
  static last: FakeWorker
  posted: Message[] = []
  terminated = false
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null

  constructor() {
    FakeWorker.last = this
  }

  postMessage(message: Message) {
    this.posted.push(message)
  }

  terminate() {
    this.terminated = true
  }

  fail(message: string) {
    this.onmessage?.({ data: { type: 'error', message } })
  }

  inferences() {
    return this.posted.filter((m) => m.type === 'inference')
  }

  answer(id: number, batchSize: number) {
    this.onmessage?.({
      data: {
        type: 'inference-result',
        id,
        logitsMove: new Float32Array(batchSize * 4352).buffer,
        logitsValue: new Float32Array(batchSize * 3).buffer,
      },
    })
  }
}

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('Maia inference queue', () => {
  const originalWorker = global.Worker

  beforeEach(() => {
    ;(global as unknown as { Worker: unknown }).Worker = FakeWorker
  })

  afterAll(() => {
    ;(global as unknown as { Worker: unknown }).Worker = originalWorker
  })

  const makeMaia = () =>
    new Maia({
      model: '/maia3/test.onnx',
      modelVersion: '3',
      setStatus: jest.fn(),
      setProgress: jest.fn(),
      setError: jest.fn(),
    })

  it('sends one request at a time, in order', async () => {
    const maia = makeMaia()
    const worker = FakeWorker.last

    const first = maia.batchEvaluateMaia3([FEN], [1500], [1500])
    const second = maia.batchEvaluateMaia3(
      [FEN, FEN],
      [1100, 1900],
      [1100, 1900],
    )
    expect(worker.inferences()).toHaveLength(1)

    const [request] = worker.inferences()
    worker.answer(request.id as number, 1)
    await expect(first).resolves.toMatchObject({ result: [expect.anything()] })

    expect(worker.inferences()).toHaveLength(2)
    worker.answer(worker.inferences()[1].id as number, 2)
    expect((await second).result).toHaveLength(2)
  })

  it('drops a request aborted before it reaches the worker', async () => {
    const maia = makeMaia()
    const worker = FakeWorker.last

    const inFlight = maia.batchEvaluateMaia3([FEN], [1500], [1500])
    const controller = new AbortController()
    const stale = maia.batchEvaluateMaia3([FEN], [1500], [1500], {
      signal: controller.signal,
    })
    const current = maia.batchEvaluateMaia3([FEN], [1500], [1500])

    controller.abort()
    await expect(stale).rejects.toMatchObject({ name: 'AbortError' })

    worker.answer(worker.inferences()[0].id as number, 1)
    await inFlight
    await flush()

    // The aborted request never reached the worker; the next one did.
    expect(worker.inferences()).toHaveLength(2)
    worker.answer(worker.inferences()[1].id as number, 1)
    await expect(current).resolves.toBeDefined()
  })

  it('rejects a request whose signal is already aborted', async () => {
    const maia = makeMaia()
    const controller = new AbortController()
    controller.abort()
    await expect(
      maia.batchEvaluateMaia3([FEN], [1500], [1500], {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeWorker.last.inferences()).toHaveLength(0)
  })

  it('rejects everything pending when the worker crashes', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const maia = makeMaia()
    const worker = FakeWorker.last

    const inFlight = maia.batchEvaluateMaia3([FEN], [1500], [1500])
    const queued = maia.batchEvaluateMaia3([FEN], [1500], [1500])
    worker.onerror?.({ message: 'boom' })

    await expect(inFlight).rejects.toThrow('boom')
    await expect(queued).rejects.toThrow('boom')
  })
})

describe('Maia start-up', () => {
  const originalWorker = global.Worker
  const OUT_OF_MEMORY =
    "no available backend found. ERR: [wasm] RangeError: Out of memory, [cpu] Error: previous call to 'initWasm()' failed."

  beforeEach(() => {
    ;(global as unknown as { Worker: unknown }).Worker = FakeWorker
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(() => {
    ;(global as unknown as { Worker: unknown }).Worker = originalWorker
  })

  const makeMaia = () => {
    const options = {
      model: '/maia3/test.onnx',
      modelVersion: '3',
      setStatus: jest.fn(),
      setProgress: jest.fn(),
      setError: jest.fn(),
    }
    return { maia: new Maia(options), options }
  }

  it('starts again in a new worker when the runtime runs out of memory', () => {
    const { options } = makeMaia()
    const first = FakeWorker.last
    first.fail(OUT_OF_MEMORY)

    expect(first.terminated).toBe(true)
    expect(options.setError).not.toHaveBeenCalled()
    expect(options.setStatus).toHaveBeenLastCalledWith('loading')

    jest.advanceTimersByTime(MAIA_RESTART_DELAYS_MS[0])
    expect(FakeWorker.last).not.toBe(first)
    expect(FakeWorker.last.posted).toEqual([
      { type: 'init', modelUrl: '/maia3/test.onnx', modelVersion: '3' },
    ])
  })

  it('reports the error when the restarts fail too', () => {
    const { options } = makeMaia()
    for (const delay of MAIA_RESTART_DELAYS_MS) {
      FakeWorker.last.fail(OUT_OF_MEMORY)
      jest.advanceTimersByTime(delay)
    }
    FakeWorker.last.fail(OUT_OF_MEMORY)

    expect(options.setError).toHaveBeenCalledWith(OUT_OF_MEMORY)
    expect(options.setStatus).toHaveBeenLastCalledWith('error')
  })

  it('reports other start-up errors at once', () => {
    const { options } = makeMaia()
    FakeWorker.last.fail('Failed to fetch model')

    expect(FakeWorker.last.terminated).toBe(false)
    expect(options.setError).toHaveBeenCalledWith('Failed to fetch model')
    expect(options.setStatus).toHaveBeenLastCalledWith('error')
  })
})
