import type StockfishWeb from '@lichess-org/stockfish-web'
import { setupStockfish } from './stockfish'

/**
 * The site's engine as the human-bar server knows it: Stockfish 19 with this
 * net. A new engine or net needs a new eval map on the server (practical LOG,
 * P89), which refuses a label it does not know; humanBar.test.ts checks this
 * net against public/stockfish, so an upgrade cannot miss it.
 */
export const HUMAN_BAR_ENGINE = 'sf19-61e7af4bb97d'

const EVAL_TIMEOUT_MS = 120000
const READY_TIMEOUT_MS = 30000
const INIT_ATTEMPTS = 3

export interface NodesLimitedEval {
  /** Centipawns for the side to move; null when the score is a mate. */
  cp: number | null
  /** Mate in N for the side to move (UCI sign convention); 0 = mated. */
  mate: number | null
  depth: number
  nodes: number
  bestmove: string | null
}

/**
 * One number per position, from the side to move's point of view: the
 * centipawn score, or for mate in N, sign * (10000 - |N|) (positive if the
 * side to move mates; a checkmated side to move gets -10000).
 */
export const encodeSideToMoveScore = (evaluation: NodesLimitedEval): number => {
  if (evaluation.mate !== null) {
    const n = evaluation.mate
    if (n > 0) return 10000 - n
    return -(10000 - Math.abs(n))
  }
  return evaluation.cp ?? 0
}

const parseInfoLine = (
  line: string,
): Omit<NodesLimitedEval, 'bestmove'> | null => {
  const score = line.match(/\bscore (cp|mate) (-?\d+)/)
  if (!score) return null
  const depth = line.match(/\bdepth (\d+)/)
  const nodes = line.match(/\bnodes (\d+)/)
  const value = Number.parseInt(score[2], 10)
  return {
    cp: score[1] === 'cp' ? value : null,
    mate: score[1] === 'mate' ? value : null,
    depth: depth ? Number.parseInt(depth[1], 10) : 0,
    nodes: nodes ? Number.parseInt(nodes[1], 10) : 0,
  }
}

const abortError = () => new DOMException('Evaluation aborted', 'AbortError')

/**
 * A second Stockfish instance for batches of node-limited evaluations
 * (MultiPV 1, one thread), separate from the analysis engine so the analysis
 * UI keeps its own MultiPV search. Requests run one at a time, in order.
 */
class BatchStockfish {
  private enginePromise: Promise<StockfishWeb> | null = null
  private lineHandler: ((line: string) => void) | null = null
  private queue: Promise<unknown> = Promise.resolve()

  private dispatch = (data: string) => {
    for (const line of data.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) this.lineHandler?.(trimmed)
    }
  }

  private waitForLine(
    engine: StockfishWeb,
    send: string[],
    isDone: (line: string) => boolean,
    timeoutMs: number,
    onLine?: (line: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // An abort stops the search; Stockfish then answers `bestmove` at once
      // and the caller discards the result.
      const onAbort = () => engine.uci('stop')
      signal?.addEventListener('abort', onAbort, { once: true })
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        // The instance is in an unknown state (still searching, or hung):
        // drop it so the next request starts a fresh one.
        this.lineHandler = null
        this.enginePromise = null
        engine.listen = () => undefined
        engine.uci('stop')
        reject(new Error(`Stockfish timed out after ${timeoutMs} ms`))
      }, timeoutMs)
      this.lineHandler = (line) => {
        onLine?.(line)
        if (isDone(line)) {
          clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
          this.lineHandler = null
          resolve(line)
        }
      }
      for (const command of send) engine.uci(command)
    })
  }

  /** When the engine's setup started and finished (ms since the page started). */
  readonly setupTimes: { started?: number; ready?: number } = {}

  /** The engine's `id name` (e.g. "Stockfish 19"), once it has started. */
  engineName: string | null = null

  private getEngine(): Promise<StockfishWeb> {
    if (!this.enginePromise) {
      this.setupTimes.started ??= performance.now()
      this.enginePromise = (async () => {
        let engine: StockfishWeb | null = null
        for (let attempt = 1; !engine; attempt++) {
          try {
            engine = await setupStockfish()
          } catch (error) {
            if (attempt >= INIT_ATTEMPTS) throw error
            console.warn(
              `[human bars] Stockfish init failed (attempt ${attempt}), retrying:`,
              error,
            )
          }
        }
        engine.listen = this.dispatch
        engine.onError = (msg: string) =>
          console.error('[human bars] Stockfish error:', msg)
        await this.waitForLine(
          engine,
          [
            'uci',
            'setoption name Threads value 1',
            'setoption name Hash value 16',
            'setoption name MultiPV value 1',
            'isready',
          ],
          (line) => line === 'readyok',
          READY_TIMEOUT_MS,
          (line) => {
            if (line.startsWith('id name ')) this.engineName = line.slice(8)
          },
        )
        this.setupTimes.ready ??= performance.now()
        return engine
      })().catch((error) => {
        this.enginePromise = null
        throw error
      })
    }
    return this.enginePromise
  }

  /**
   * Starts the engine (module, threads, net) without waiting for it, so it
   * is ready by the time the first position arrives.
   */
  warmUp(): void {
    this.getEngine().catch(() => undefined)
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Clears the hash; call before the first position of a new game. */
  newGame(): Promise<void> {
    return this.enqueue(async () => {
      const engine = await this.getEngine()
      await this.waitForLine(
        engine,
        ['ucinewgame', 'isready'],
        (line) => line === 'readyok',
        READY_TIMEOUT_MS,
      )
    })
  }

  /**
   * `position fen <fen>` + `go nodes <nodes>`; resolves on `bestmove`. An
   * abort through `signal` stops the search (or skips it if it has not
   * started) and rejects with an AbortError.
   */
  evaluate(
    fen: string,
    nodes: number,
    signal?: AbortSignal,
  ): Promise<NodesLimitedEval> {
    return this.enqueue(async () => {
      if (signal?.aborted) throw abortError()
      const engine = await this.getEngine()
      if (signal?.aborted) throw abortError()
      let last: Omit<NodesLimitedEval, 'bestmove'> | null = null
      const done = await this.waitForLine(
        engine,
        [`position fen ${fen}`, `go nodes ${nodes}`],
        (line) => line.startsWith('bestmove'),
        EVAL_TIMEOUT_MS,
        (line) => {
          if (line.startsWith('info') && !line.startsWith('info string')) {
            const parsed = parseInfoLine(line)
            if (parsed) last = parsed
          }
        },
        signal,
      )
      // A stopped search is cut short: its eval is not comparable.
      if (signal?.aborted) throw abortError()
      if (!last) {
        throw new Error(`Stockfish returned no score for ${fen}`)
      }
      const bestmove = done.split(/\s+/)[1] ?? null
      return {
        ...(last as Omit<NodesLimitedEval, 'bestmove'>),
        bestmove: bestmove && bestmove !== '(none)' ? bestmove : null,
      }
    })
  }
}

let sharedBatchStockfish: BatchStockfish | null = null

/** The page-wide batch evaluator (created lazily, browser only). */
export const getBatchStockfish = (): BatchStockfish => {
  if (!sharedBatchStockfish) sharedBatchStockfish = new BatchStockfish()
  return sharedBatchStockfish
}

export type { BatchStockfish }
