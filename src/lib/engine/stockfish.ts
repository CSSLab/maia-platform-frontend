import { Chess } from 'chess.ts'
import { cpToWinrate } from 'src/lib'
import StockfishWeb from 'lila-stockfish-web'
import { StockfishEvaluation } from 'src/types'
import { StockfishModelStorage } from './stockfishStorage'

const DEFAULT_NNUE_FETCH_TIMEOUT_MS = 30000
type StockfishInitPhase =
  | 'idle'
  | 'loading-module'
  | 'checking-cache'
  | 'downloading-nnue'
  | 'loading-nnue'
  | 'ready'
  | 'error'

class Engine {
  private fen: string
  private moves: string[]
  private isEvaluating: boolean
  private stockfish: StockfishWeb | null = null
  private isReady = false
  private nnueLoaded = false
  private currentPositionId = ''

  private store: {
    [key: string]: StockfishEvaluation
  }
  private legalMoveCount: number
  private evaluationResolver: ((value: StockfishEvaluation) => void) | null
  private evaluationRejecter: ((reason?: unknown) => void) | null
  private evaluationPromise: Promise<StockfishEvaluation> | null
  private evaluationGenerator: AsyncGenerator<StockfishEvaluation> | null
  private initError: string | null
  private initInFlight: boolean
  private initPhase: StockfishInitPhase

  constructor() {
    this.fen = ''
    this.store = {}
    this.moves = []
    this.isEvaluating = false

    this.legalMoveCount = 0
    this.evaluationResolver = null
    this.evaluationRejecter = null
    this.evaluationPromise = null
    this.evaluationGenerator = null
    this.initError = null
    this.initInFlight = false
    this.initPhase = 'idle'

    this.onMessage = this.onMessage.bind(this)

    // Skip browser-only Stockfish initialization during SSR/Node renders.
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      return
    }

    this.initInFlight = true
    this.initPhase = 'loading-module'
    setupStockfish((phase) => {
      this.initPhase = phase
    })
      .then((stockfish: StockfishWeb) => {
        this.stockfish = stockfish
        stockfish.uci('uci')
        stockfish.uci('isready')
        stockfish.uci('setoption name MultiPV value 100')
        stockfish.onError = this.onError
        stockfish.listen = this.onMessage
        this.initError = null
        this.isReady = true
        this.nnueLoaded = true
        this.initPhase = 'ready'
      })
      .catch((error) => {
        console.error('Failed to initialize Stockfish:', error)
        this.initError =
          error instanceof Error ? error.message : 'Unknown initialization error'
        this.isReady = false
        this.nnueLoaded = false
        this.initPhase = 'error'
      })
      .finally(() => {
        this.initInFlight = false
      })
  }

  get ready(): boolean {
    return this.isReady && this.stockfish !== null && this.nnueLoaded
  }

  get initializationError(): string | null {
    return this.initError
  }

  get initializing(): boolean {
    return this.initInFlight
  }

  get initializationPhase(): StockfishInitPhase {
    return this.initPhase
  }

  async *streamEvaluations(
    fen: string,
    legalMoveCount: number,
    targetDepth = 18,
  ): AsyncGenerator<StockfishEvaluation> {
    if (this.stockfish && this.isReady) {
      if (typeof global !== 'undefined' && typeof global.gc === 'function') {
        global.gc()
      }

      // Stop any previous evaluation
      this.stopEvaluation()
      this.store = {}
      this.legalMoveCount = legalMoveCount
      const board = new Chess(fen)
      this.moves = board
        .moves({ verbose: true })
        .map((x) => x.from + x.to + (x.promotion || ''))
      this.fen = fen
      this.currentPositionId = fen + '_' + Date.now()
      this.isEvaluating = true
      this.evaluationGenerator = this.createEvaluationGenerator()

      this.sendMessage('ucinewgame')
      this.sendMessage(`position fen ${fen}`)
      this.sendMessage(`go depth ${targetDepth}`)

      while (this.isEvaluating) {
        try {
          const evaluation = await this.getNextEvaluation()
          if (evaluation) {
            yield evaluation
          } else {
            break
          }
        } catch (error) {
          console.error('Error in evaluation stream:', error)
          break
        }
      }
    }
  }

  private async getNextEvaluation(): Promise<StockfishEvaluation | null> {
    return new Promise((resolve, reject) => {
      this.evaluationResolver = resolve
      this.evaluationRejecter = reject
    })
  }

  private createEvaluationGenerator(): AsyncGenerator<StockfishEvaluation> | null {
    return null
  }

  private sendMessage(message: string) {
    if (this.stockfish) {
      this.stockfish.uci(message)
    }
  }

  private async waitForReady(): Promise<void> {
    if (!this.stockfish) return

    return new Promise((resolve) => {
      if (!this.stockfish) {
        resolve()
        return
      }

      let resolved = false
      const originalListen = this.stockfish.listen

      const tempListener = (msg: string) => {
        if (msg.includes('readyok') && !resolved) {
          resolved = true
          if (this.stockfish) {
            this.stockfish.listen = originalListen
          }
          resolve()
        } else {
          // Forward all other messages to the original listener
          originalListen(msg)
        }
      }

      this.stockfish.listen = tempListener
      this.stockfish.uci('isready')
    })
  }

  private onMessage(msg: string) {
    // Only process evaluation messages if we're currently evaluating
    if (!this.isEvaluating) {
      return
    }

    const matches = [
      ...msg.matchAll(
        /info depth (\d+) seldepth (\d+) multipv (\d+) score (?:cp (-?\d+)|mate (-?\d+)).+ pv ((?:\S+\s*)+)/g,
      ),
    ][0]

    if (!matches || !matches.length) {
      return
    }

    const depth = parseInt(matches[1], 10)
    const multipv = parseInt(matches[3], 10)
    let cp = parseInt(matches[4], 10)
    const mate = parseInt(matches[5], 10)
    const pv = matches[6]
    const move = pv.split(' ')[0]

    if (!this.moves.includes(move)) {
      return
    }

    // here, mate is in the perspective of white
    let mateIn: number | undefined = undefined
    if (!isNaN(mate) && isNaN(cp)) {
      mateIn = mate
      cp = mate > 0 ? 10000 : -10000
    }

    /*
      The Stockfish engine, by default, reports mate and centipawn (CP) scores from White's perspective.
      This means a positive CP indicates an advantage for White, while a negative CP indicates an advantage for Black.

      However, when it's Black's turn to move, we want to interpret the CP score from Black's
      perspective. To achieve this, we invert the sign of the CP score when it's Black's turn.
      This ensures that a positive CP always represents an advantage for the player whose turn it is.

      For example:
        - If Stockfish reports CP = 100 (White's advantage) and it's White's turn, we keep CP = 100.
        - If Stockfish reports CP = 100 (White's advantage) and it's Black's turn, we change CP to -100, indicating that Black is at a disadvantage.
      
      The same logic applies to mate values - they need to be adjusted for the current player's perspective.
    */
    const board = new Chess(this.fen)
    const isBlackTurn = board.turn() === 'b'
    if (isBlackTurn) {
      cp *= -1
    }

    if (this.store[depth]) {
      /*
        The cp_relative_vec (centipawn relative vector) is calculated to determine how much worse or better a given move is compared to the engine's "optimal" move (model_move) at the same depth.

        Because the centipawn score (cp) has already been flipped to be relative to the current player's perspective (positive is good for the current player),
        we need to ensure that the comparison to the optimal move (model_optimal_cp) is done in a consistent manner.
        Therefore, we also flip the sign of model_optimal_cp when it is black's turn, so that the relative value is calculated correctly.

        For example:
          - If the engine evaluates the optimal move as CP = 50 when it's Black's turn, model_optimal_cp will be -50 after the initial flip.
          - To calculate the relative value of another move with CP = 20, we use modelOptimalCp - cp, which is (-50) - (-20) = 30
          - This indicates that the move with CP = 20 is significantly worse than the optimal move from Black's perspective.
      */

      this.store[depth].cp_vec[move] = cp
      this.store[depth].cp_relative_vec[move] = isBlackTurn
        ? this.store[depth].model_optimal_cp - cp
        : cp - this.store[depth].model_optimal_cp

      if (mateIn !== undefined) {
        if (!this.store[depth].mate_vec) {
          this.store[depth].mate_vec = {}
        }
        this.store[depth].mate_vec[move] = mateIn
      } else if (this.store[depth].mate_vec) {
        delete this.store[depth].mate_vec[move]
        if (Object.keys(this.store[depth].mate_vec).length === 0) {
          delete this.store[depth].mate_vec
        }
      }

      const winrate = cpToWinrate(cp * (isBlackTurn ? -1 : 1), false)

      if (!this.store[depth].winrate_vec) {
        this.store[depth].winrate_vec = {}
      }
      if (!this.store[depth].winrate_loss_vec) {
        this.store[depth].winrate_loss_vec = {}
      }

      const winrateVec = this.store[depth].winrate_vec
      if (winrateVec) {
        winrateVec[move] = winrate
      }
    } else {
      const winrate = cpToWinrate(cp * (isBlackTurn ? -1 : 1), false)

      this.store[depth] = {
        depth: depth,
        model_move: move,
        model_optimal_cp: cp,
        cp_vec: { [move]: cp },
        cp_relative_vec: { [move]: 0 },
        winrate_vec: { [move]: winrate },
        winrate_loss_vec: { [move]: 0 },
        mate_vec: mateIn !== undefined ? { [move]: mateIn } : undefined,
        sent: false,
      }
    }

    if (!this.store[depth].sent && multipv === this.legalMoveCount) {
      let bestWinrate = -Infinity

      const winrateVec = this.store[depth].winrate_vec
      if (winrateVec) {
        for (const m in winrateVec) {
          const wr = winrateVec[m]
          if (wr > bestWinrate) {
            bestWinrate = wr
          }
        }

        const winrateLossVec = this.store[depth].winrate_loss_vec
        if (winrateLossVec) {
          for (const m in winrateVec) {
            winrateLossVec[m] = winrateVec[m] - bestWinrate
          }
        }
      }

      if (this.store[depth].winrate_vec) {
        this.store[depth].winrate_vec = Object.fromEntries(
          Object.entries(this.store[depth].winrate_vec || {}).sort(
            ([, a], [, b]) => b - a,
          ),
        )
      }

      if (this.store[depth].winrate_loss_vec) {
        this.store[depth].winrate_loss_vec = Object.fromEntries(
          Object.entries(this.store[depth].winrate_loss_vec || {}).sort(
            ([, a], [, b]) => b - a,
          ),
        )
      }

      // Check if position is checkmate (no legal moves and king in check)
      const board = new Chess(this.fen)
      this.store[depth].is_checkmate = board.inCheckmate()

      this.store[depth].sent = true
      if (this.evaluationResolver) {
        this.evaluationResolver(this.store[depth])
        this.evaluationResolver = null
        this.evaluationRejecter = null
      }
    }
  }

  private onError(msg: string) {
    console.error(msg)
    if (this.evaluationRejecter) {
      this.evaluationRejecter(msg)
      this.evaluationResolver = null
      this.evaluationRejecter = null
    }
    this.isEvaluating = false
  }
  stopEvaluation() {
    if (this.isEvaluating) {
      this.isEvaluating = false
      this.sendMessage('stop')
    }
  }
}

const sharedWasmMemory = (lo: number, hi = 32767): WebAssembly.Memory => {
  let shrink = 4 // 32767 -> 24576 -> 16384 -> 12288 -> 8192 -> 6144 -> etc
  while (true) {
    try {
      return new WebAssembly.Memory({ shared: true, initial: lo, maximum: hi })
    } catch (e) {
      if (hi <= lo || !(e instanceof RangeError)) throw e
      hi = Math.max(lo, Math.ceil(hi - hi / shrink))
      shrink = shrink === 4 ? 3 : 4
    }
  }
}

const getNnueFetchTimeoutMs = (): number => {
  const raw = process.env.NEXT_PUBLIC_STOCKFISH_NNUE_FETCH_TIMEOUT_MS
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_NNUE_FETCH_TIMEOUT_MS
}

const fetchWithTimeout = async (
  url: string,
  timeoutMs: number,
): Promise<Response> => {
  if (typeof AbortController === 'undefined' || timeoutMs <= 0) {
    return fetch(url)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Stockfish NNUE fetch timed out after ${timeoutMs}ms: ${url}`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

const loadNnueModel = async (
  modelUrl: string,
  storage: StockfishModelStorage,
  timeoutMs: number,
  onNetworkFetchStart?: () => void,
): Promise<ArrayBuffer> => {
  const cachedModel = await storage.getModel(modelUrl)
  if (cachedModel) {
    return cachedModel
  }

  onNetworkFetchStart?.()
  const response = await fetchWithTimeout(modelUrl, timeoutMs)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Stockfish NNUE model (${response.status}) from ${modelUrl}`,
    )
  }

  const buffer = await response.arrayBuffer()
  await storage.storeModel(modelUrl, buffer)
  return buffer
}

const setupStockfish = async (
  onPhaseChange?: (phase: StockfishInitPhase) => void,
): Promise<StockfishWeb> => {
  onPhaseChange?.('loading-module')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeModule: any = await import('lila-stockfish-web/sf17-79.js')
  const instance: StockfishWeb = await makeModule.default({
    wasmMemory: sharedWasmMemory(2560),
    locateFile: (name: string) => `/stockfish/${name}`,
  })

  // NNUE weights served via raw.githubusercontent.com permalink (CORS + COEP compatible).
  // Override with NEXT_PUBLIC_STOCKFISH_NNUE_BASE_URL for self-hosted deployments.
  const nnueBaseUrl =
    process.env.NEXT_PUBLIC_STOCKFISH_NNUE_BASE_URL ??
    'https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/e23a50e/public/stockfish'
  const storage = new StockfishModelStorage()
  await storage.requestPersistentStorage()

  const nnue0Url = `${nnueBaseUrl}/${instance.getRecommendedNnue(0)}`
  const nnue1Url = `${nnueBaseUrl}/${instance.getRecommendedNnue(1)}`
  const timeoutMs = getNnueFetchTimeoutMs()
  let downloadStarted = false

  try {
    onPhaseChange?.('checking-cache')
    const buffers = await Promise.all([
      loadNnueModel(nnue0Url, storage, timeoutMs, () => {
        if (!downloadStarted) {
          downloadStarted = true
          onPhaseChange?.('downloading-nnue')
        }
      }),
      loadNnueModel(nnue1Url, storage, timeoutMs, () => {
        if (!downloadStarted) {
          downloadStarted = true
          onPhaseChange?.('downloading-nnue')
        }
      }),
    ])
    onPhaseChange?.('loading-nnue')
    instance.setNnueBuffer(new Uint8Array(buffers[0]), 0)
    instance.setNnueBuffer(new Uint8Array(buffers[1]), 1)
    return instance
  } catch (error) {
    console.error('Failed to load NNUE models:', error)
    throw error
  }
}

export default Engine
