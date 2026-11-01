import { Chess } from 'chess.ts'
import Engine, { legacyNetCacheKey, loadNnueModel } from './stockfish'
import { StockfishModelStorage } from './stockfishStorage'

/**
 * A small stand-in for lila-stockfish-web: UCI commands run in order on a
 * "UCI thread"; `go` searches one depth per timer tick; like Stockfish,
 * `ucinewgame`, `setoption` and `position` wait for a running search to end,
 * while `isready` and `stop` do not.
 */
class FakeStockfish {
  listen: (line: string) => void = () => undefined
  onError: (msg: string) => void = () => undefined
  log: string[] = []
  searching = false
  private queue: string[] = []
  private busy = false
  private stopRequested = false
  private multiPv = 1
  private legalMoves: string[] = []

  uci(command: string) {
    this.log.push(command)
    this.queue.push(command)
    void this.pump()
  }

  setNnueBuffer() {
    // not used
  }

  getRecommendedNnue() {
    return 'nn-test.nnue'
  }

  private emit(line: string) {
    setTimeout(() => this.listen(line), 0)
  }

  private async waitForSearchEnd() {
    while (this.searching) await new Promise((r) => setTimeout(r, 1))
  }

  private async pump() {
    if (this.busy) return
    this.busy = true
    while (this.queue.length) {
      const command = this.queue.shift() as string
      if (command === 'stop') {
        if (this.searching) this.stopRequested = true
      } else if (command === 'isready') {
        this.emit('readyok')
      } else if (command.startsWith('go ')) {
        await this.waitForSearchEnd()
        void this.search(command)
      } else {
        await this.waitForSearchEnd()
        if (command.startsWith('setoption name MultiPV value ')) {
          this.multiPv = Number(command.split(' ').pop())
        } else if (command.startsWith('position fen ')) {
          const chess = new Chess(command.slice('position fen '.length))
          this.legalMoves = chess
            .moves({ verbose: true })
            .map((m) => `${m.from}${m.to}${m.promotion || ''}`)
        }
      }
    }
    this.busy = false
  }

  private async search(command: string) {
    this.searching = true
    this.stopRequested = false
    const depth = Number(/depth (\d+)/.exec(command)?.[1] ?? 1)
    const searchMove = /searchmoves (\S+)/.exec(command)?.[1]
    const moves = searchMove
      ? [searchMove]
      : this.legalMoves.slice(0, Math.min(this.multiPv, this.legalMoves.length))
    for (let d = 1; d <= depth && !this.stopRequested; d++) {
      await new Promise((r) => setTimeout(r, 2))
      moves.forEach((move, i) =>
        this.emit(
          `info depth ${d} seldepth ${d} multipv ${i + 1} score cp ${50 - i * 10} nodes 100 nps 1000 time 1 pv ${move}`,
        ),
      )
    }
    this.emit(`bestmove ${moves[0] ?? '(none)'}`)
    // Output is delivered on later ticks; end the search after it.
    await new Promise((r) => setTimeout(r, 1))
    this.searching = false
  }
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

const makeEngine = () => {
  const engine = new Engine()
  const fake = new FakeStockfish()
  const internals = engine as unknown as {
    stockfish: FakeStockfish
    isReady: boolean
    nnueLoaded: boolean
    onMessage: (msg: string) => void
  }
  internals.stockfish = fake
  internals.isReady = true
  internals.nnueLoaded = true
  fake.listen = internals.onMessage
  return { engine, fake }
}

const legalMoveCount = (fen: string) => new Chess(fen).moves().length

const drain = async (
  stream: AsyncGenerator<{ depth: number }>,
  first?: IteratorResult<{ depth: number }>,
) => {
  let maxDepth = first && !first.done ? first.value.depth : 0
  for await (const evaluation of stream) {
    maxDepth = Math.max(maxDepth, evaluation.depth)
  }
  return maxDepth
}

describe('Stockfish Engine run hand-over', () => {
  it('finishes a new run when the old one is closed after the new one started', async () => {
    const { engine } = makeEngine()

    const oldRun = engine.streamEvaluations(START, legalMoveCount(START), 8)
    const firstOld = await oldRun.next()
    expect(firstOld.done).toBe(false)

    // The user moves on: the new run starts (installing its own listener)
    // before the page stops reading the old one.
    const newRun = engine.streamEvaluations(
      AFTER_E4,
      legalMoveCount(AFTER_E4),
      8,
    )
    const firstNew = newRun.next()
    await oldRun.return(undefined)

    const timeout = new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error('new run stalled')), 5000),
    )
    const maxDepth = await Promise.race([
      firstNew.then((first) => drain(newRun, first)),
      timeout,
    ])
    expect(maxDepth).toBe(8)
  })

  it('finishes a new run while the old one keeps reading', async () => {
    const { engine } = makeEngine()
    // No played move to deepen: after screening the old run goes straight
    // to its multi-PV search.
    const oldRun = engine.streamEvaluations(START, legalMoveCount(START), 8)
    await oldRun.next()
    // As on the page, the old run is still being read when the new one
    // (Maia's policy has arrived) starts, and is closed only afterwards.
    let oldClosed = false
    const readOld = (async () => {
      for (;;) {
        const next = await oldRun.next()
        if (next.done || oldClosed) break
      }
      await oldRun.return(undefined)
    })()

    const newRun = engine.streamEvaluations(START, legalMoveCount(START), 8, {
      maiaCandidateMoves: ['e2e4'],
    })
    const firstNew = newRun.next()
    oldClosed = true

    const timeout = new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error('new run stalled')), 5000),
    )
    const maxDepth = await Promise.race([
      firstNew.then((first) => drain(newRun, first)),
      timeout,
    ])
    expect(maxDepth).toBe(8)
    await readOld
  })

  it('stops an abandoned search before resetting MultiPV', async () => {
    const { engine, fake } = makeEngine()

    const run = engine.streamEvaluations(START, legalMoveCount(START), 8)
    await run.next()
    expect(fake.searching).toBe(true)

    const sent = fake.log.length
    await run.return(undefined)
    const after = fake.log.slice(sent)

    // `setoption` waits for a running search, so `stop` must come first.
    const stopAt = after.indexOf('stop')
    const resetAt = after.indexOf('setoption name MultiPV value 100')
    expect(stopAt).toBeGreaterThanOrEqual(0)
    expect(resetAt).toBeGreaterThan(stopAt)

    await new Promise((r) => setTimeout(r, 20))
    expect(fake.searching).toBe(false)
  })

  it('takes up Maia moves that arrive during the search, without restarting', async () => {
    const { engine, fake } = makeEngine()
    let candidates: string[] = []
    const run = engine.streamEvaluations(START, legalMoveCount(START), 8, {
      getMaiaCandidates: () => ({
        maiaCandidateMoves: candidates,
        maiaPolicy: { g1f3: 0.6 },
      }),
    })
    const first = await run.next()
    // Maia's policy arrives while the screening search runs.
    candidates = ['g1f3']

    expect(await drain(run, first)).toBe(8)
    expect(fake.log.filter((c) => c === 'ucinewgame')).toHaveLength(1)
    expect(fake.log).toContain('go depth 8 searchmoves g1f3')
  })

  it('deepens Maia moves that arrive after the screening search', async () => {
    const { engine, fake } = makeEngine()
    let candidates: string[] = []
    const run = engine.streamEvaluations(START, legalMoveCount(START), 8, {
      getMaiaCandidates: () => ({ maiaCandidateMoves: candidates }),
    })
    // Screening yields depths 1-4; the multi-PV search follows.
    let seen = 0
    let maxDepth = 0
    for await (const evaluation of run) {
      maxDepth = Math.max(maxDepth, evaluation.depth)
      if (++seen === 6) candidates = ['g1f3']
    }

    expect(maxDepth).toBe(8)
    expect(fake.log.filter((c) => c === 'ucinewgame')).toHaveLength(1)
    expect(fake.log).toContain('go depth 8 searchmoves g1f3')
  })

  it('reaches the target depth after a restart for the same position', async () => {
    const { engine } = makeEngine()

    const firstRun = engine.streamEvaluations(START, legalMoveCount(START), 8)
    await firstRun.next()

    // Maia's policy arrives: the page restarts the analysis of the position.
    const restart = engine.streamEvaluations(START, legalMoveCount(START), 8, {
      maiaCandidateMoves: ['e2e4', 'd2d4'],
    })
    const firstRestart = restart.next()
    await firstRun.return(undefined)

    expect(await drain(restart, await firstRestart)).toBe(8)
  })
})

describe('loadNnueModel', () => {
  const FILE = 'nn-test.nnue'
  const cachedNet = new ArrayBuffer(8)
  const downloadedNet = new ArrayBuffer(16)
  let signal: AbortSignal | undefined

  const later = <T>(ms: number, value: T) =>
    new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))
  const storage = (getModel: (key: string) => Promise<ArrayBuffer | null>) => {
    const storeModel = jest.fn(async () => undefined)
    return {
      storage: { getModel, storeModel } as unknown as StockfishModelStorage,
      storeModel,
    }
  }
  // A download that finishes after `ms`, or fails if aborted first.
  const mockDownload = (ms: number, fail = false) =>
    jest.fn((s?: AbortSignal) => {
      signal = s
      return new Promise<ArrayBuffer>((resolve, reject) => {
        s?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
        setTimeout(
          () =>
            fail
              ? reject(new TypeError('network error'))
              : resolve(downloadedNet),
          ms,
        )
      })
    })

  beforeEach(() => {
    jest.useFakeTimers()
    signal = undefined
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('keeps a cached net that is read after the lookup timeout, and stops the download', async () => {
    const download = mockDownload(60000)
    const { storage: s, storeModel } = storage(() => later(4000, cachedNet))
    const net = loadNnueModel(FILE, s, download)
    await jest.advanceTimersByTimeAsync(1600)
    expect(download).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(2500)
    await expect(net).resolves.toBe(cachedNet)
    expect(signal?.aborted).toBe(true)
    expect(storeModel).not.toHaveBeenCalled()
  })

  it('downloads the net when the cache never answers', async () => {
    const download = mockDownload(500)
    const { storage: s, storeModel } = storage(() => new Promise(() => null))
    const net = loadNnueModel(FILE, s, download)
    await jest.advanceTimersByTimeAsync(2100)
    await expect(net).resolves.toBe(downloadedNet)
    expect(storeModel).toHaveBeenCalledWith(FILE, downloadedNet)
  })

  it('downloads at once when the net is not cached', async () => {
    const download = mockDownload(500)
    const { storage: s } = storage(() => later(10, null))
    const net = loadNnueModel(FILE, s, download)
    await jest.advanceTimersByTimeAsync(25)
    expect(download).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(500)
    await expect(net).resolves.toBe(downloadedNet)
  })

  it('uses the cached net when the download fails while the cache is slow', async () => {
    const { storage: s } = storage(() => later(3000, cachedNet))
    const net = loadNnueModel(FILE, s, mockDownload(100, true))
    await jest.advanceTimersByTimeAsync(3100)
    await expect(net).resolves.toBe(cachedNet)
  })

  it('uses a net cached under its old raw.githubusercontent.com URL', async () => {
    const download = mockDownload(500)
    const { storage: s } = storage((key) =>
      later(10, key === legacyNetCacheKey(FILE) ? cachedNet : null),
    )
    const net = loadNnueModel(FILE, s, download)
    await jest.advanceTimersByTimeAsync(25)
    await expect(net).resolves.toBe(cachedNet)
    expect(download).not.toHaveBeenCalled()
  })
})
