import Maia from './maia'

type Message = { type: string; id?: number; batchSize?: number }

/** Records what Maia posts and lets a test answer like the Maia worker. */
class FakeWorker {
  static last: FakeWorker
  posted: Message[] = []
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null

  constructor() {
    FakeWorker.last = this
  }

  postMessage(message: Message) {
    this.posted.push(message)
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
