import { Chess } from 'chess.ts'
import Engine, {
  sharedWasmMemory,
  STOCKFISH_MAX_MEMORY_PAGES,
} from './stockfish'

/**
 * A small stand-in for @lichess-org/stockfish-web: UCI commands run in order on a
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
  /** The score of a search with one line, when it differs from the others'. */
  singleLineCp: number | null = null

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
          `info depth ${d} seldepth ${d} multipv ${i + 1} score cp ${!searchMove && moves.length === 1 && this.singleLineCp !== null ? this.singleLineCp : 50 - i * 10} nodes 100 nps 1000 time 1 pv ${move}`,
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

  it('takes the best line alone to the target depth before the other lines', async () => {
    const { engine, fake } = makeEngine()
    const run = engine.streamEvaluations(START, legalMoveCount(START), 8, {
      maiaCandidateMoves: ['g1f3'],
      kSf: 4,
    })
    await drain(run)

    const searches = fake.log.filter(
      (c) => c.startsWith('go ') || c.startsWith('setoption name MultiPV'),
    )
    const bestLine = searches.indexOf('setoption name MultiPV value 1')
    expect(searches[bestLine + 1]).toBe('go depth 8')
    expect(searches.indexOf('go depth 4')).toBeLessThan(bestLine)
    expect(searches.indexOf('go depth 8 searchmoves g1f3')).toBeGreaterThan(
      bestLine,
    )
    expect(searches.indexOf('setoption name MultiPV value 4')).toBeGreaterThan(
      bestLine,
    )
  })

  it('is partial until the last update, and its depth never falls', async () => {
    const { engine } = makeEngine()
    const run = engine.streamEvaluations(START, legalMoveCount(START), 8, {
      maiaCandidateMoves: ['g1f3'],
    })
    const seen: { depth: number; partial?: boolean }[] = []
    for await (const evaluation of run) seen.push(evaluation)

    const depths = seen.map((e) => e.depth)
    expect(depths).toEqual([...depths].sort((a, b) => a - b))
    const beforeLast = seen.slice(0, -1)
    const firstAtTarget = seen.findIndex((e) => e.depth === 8)
    expect(firstAtTarget).toBeLessThan(seen.length - 1)
    expect(
      beforeLast.slice(firstAtTarget).every((e) => e.partial === true),
    ).toBe(true)
    expect(seen[seen.length - 1].partial).toBeUndefined()
  })

  it('keeps a shallower score from outranking the best line', async () => {
    const { engine, fake } = makeEngine()
    // Screening scores the first move 50; alone, at full depth, it is 20.
    fake.singleLineCp = 20
    const run = engine.streamEvaluations(START, legalMoveCount(START), 8)
    const seen: {
      model_move: string
      model_optimal_cp: number
      depth: number
    }[] = []
    for await (const evaluation of run) {
      seen.push(evaluation)
      if (evaluation.depth === 8) break
    }
    const atTarget = seen[seen.length - 1]
    expect(atTarget.model_optimal_cp).toBe(20)
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

describe('sharedWasmMemory', () => {
  const NativeMemory = WebAssembly.Memory
  afterEach(() => {
    WebAssembly.Memory = NativeMemory
  })

  // Records each request, and refuses ones above `limit` pages as a browser
  // that cannot reserve that much does.
  const fakeMemory = (limit: number) => {
    const asked: WebAssembly.MemoryDescriptor[] = []
    WebAssembly.Memory = function Memory(
      descriptor: WebAssembly.MemoryDescriptor,
    ) {
      asked.push(descriptor)
      if ((descriptor.maximum ?? 0) > limit)
        throw new RangeError('Out of memory')
      return {} as WebAssembly.Memory
    } as unknown as typeof WebAssembly.Memory
    return asked
  }

  it('reserves at most 256 MB', () => {
    const asked = fakeMemory(Infinity)
    sharedWasmMemory(2560)
    expect(STOCKFISH_MAX_MEMORY_PAGES * 64 * 1024).toBe(2 ** 28)
    expect(asked).toEqual([
      { shared: true, initial: 2560, maximum: STOCKFISH_MAX_MEMORY_PAGES },
    ])
  })

  it('asks for less when the browser cannot reserve the maximum', () => {
    const asked = fakeMemory(2048)
    sharedWasmMemory(1024)
    expect(asked.map((d) => d.maximum)).toEqual([4096, 3072, 2048])
  })
})
