import { Chess } from 'chess.ts'
import { cpToWinrate } from 'src/lib'
import StockfishWeb from 'lila-stockfish-web'
import {
  StockfishDiagnostics,
  StockfishEvaluation,
  StockfishMoveDiagnostic,
  StockfishMoveMapStrategy,
  StockfishStreamOptions,
} from 'src/types'
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

type RootMoveScore = {
  cp: number
  depth: number
  mateIn?: number
}

type RootSearchResult = {
  move: string
  cp: number
  depth: number
  mateIn?: number
}

type RootProbePlan = {
  screeningDepth: number
}

type RootMovePhase = 'multipv' | 'screen' | 'deep' | 'ground-truth'
type CandidateSelectionSource = 'sf-top' | 'maia-95' | 'both'
const MAX_MAIA_DEEPEN_MOVES = 4
const MAIA_MID_DEPTH = 14

type AnalysisRunContext = {
  positionId: string
  fen: string
  legalMoves: string[]
  legalMoveCount: number
  maiaCandidateMoves: string[]
  forcedCandidateMoves: string[]
  maiaPolicy: Record<string, number>
  kSf: number
  targetDepth: number
  analysisStartedAtMs: number
  diagnosticsToConsole: boolean
}

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
  private currentTargetDepth: number
  private currentMoveMapStrategy: StockfishMoveMapStrategy
  private currentAnalysisStartedAtMs: number
  private currentDiagnosticsToConsole: boolean

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
    this.currentTargetDepth = 0
    this.currentMoveMapStrategy = 'staged-root-probe'
    this.currentAnalysisStartedAtMs = 0
    this.currentDiagnosticsToConsole = false

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
          error instanceof Error
            ? error.message
            : 'Unknown initialization error'
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
    options?: StockfishStreamOptions,
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
      this.currentTargetDepth = targetDepth
      this.currentAnalysisStartedAtMs = Date.now()
      this.evaluationGenerator = this.createEvaluationGenerator()

      const moveMapStrategy = this.resolveMoveMapStrategy(options)
      this.currentMoveMapStrategy = moveMapStrategy
      this.currentDiagnosticsToConsole = this.resolveDiagnosticsToConsole()
      const maiaCandidateMoves = Array.from(
        new Set(options?.maiaCandidateMoves || []),
      ).filter((move) => this.moves.includes(move))
      const forcedCandidateMoves = Array.from(
        new Set(options?.forcedCandidateMoves || []),
      ).filter((move) => this.moves.includes(move))
      const maiaPolicy = Object.fromEntries(
        Object.entries(options?.maiaPolicy || {}).filter(
          ([move, prob]) => this.moves.includes(move) && Number.isFinite(prob),
        ),
      )
      const kSfFromOptions = Number.isFinite(options?.kSf)
        ? Math.max(1, Math.floor(options?.kSf || 1))
        : undefined
      const runContext: AnalysisRunContext = {
        positionId: this.currentPositionId,
        fen,
        legalMoves: [...this.moves],
        legalMoveCount: this.legalMoveCount,
        maiaCandidateMoves,
        forcedCandidateMoves,
        maiaPolicy,
        kSf: kSfFromOptions || 0,
        targetDepth,
        analysisStartedAtMs: this.currentAnalysisStartedAtMs,
        diagnosticsToConsole: this.currentDiagnosticsToConsole,
      }

      if (
        moveMapStrategy === 'searchmoves-all' &&
        runContext.legalMoves.length > 0
      ) {
        try {
          yield* this.streamEvaluationsSearchmovesAll(runContext)
          return
        } catch (error) {
          console.warn(
            'Searchmoves-all Stockfish analysis failed, falling back to MultiPV-all:',
            error,
          )
          this.store = {}
          if (!this.isActiveRun(runContext.positionId)) {
            return
          }
        }
      }
      if (
        moveMapStrategy === 'staged-root-probe' &&
        runContext.legalMoves.length > 0
      ) {
        try {
          yield* this.streamEvaluationsStaged(runContext)
          return
        } catch (error) {
          console.warn(
            'Staged Stockfish move-map analysis failed, falling back to MultiPV-all:',
            error,
          )
          this.store = {}
          if (!this.isActiveRun(runContext.positionId)) {
            return
          }
        }
      }

      this.sendMessage('ucinewgame')
      this.sendMessage(`position fen ${fen}`)
      this.sendMessage(`go depth ${targetDepth}`)

      while (this.isActiveRun(runContext.positionId)) {
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

  private isActiveRun(positionId: string): boolean {
    return this.isEvaluating && this.currentPositionId === positionId
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

  private resolveMoveMapStrategy(
    options?: StockfishStreamOptions,
  ): StockfishMoveMapStrategy {
    const fromOptions = options?.moveMapStrategy

    let fromLocalStorage: string | null = null
    if (typeof window !== 'undefined') {
      try {
        fromLocalStorage =
          window.localStorage.getItem('maia.stockfishMoveMapStrategy') ??
          window.localStorage.getItem('stockfishMoveMapStrategy')
      } catch {
        fromLocalStorage = null
      }
    }

    const rawStrategy =
      fromOptions ||
      fromLocalStorage ||
      process.env.NEXT_PUBLIC_STOCKFISH_MOVE_MAP_STRATEGY ||
      'staged-root-probe'

    if (rawStrategy === 'staged-root-probe') return 'staged-root-probe'
    if (rawStrategy === 'searchmoves-all') return 'searchmoves-all'
    return 'staged-root-probe'
  }

  private resolveDiagnosticsToConsole(): boolean {
    if (typeof window !== 'undefined') {
      try {
        const raw =
          window.localStorage.getItem('maia.stockfishDiagnostics') ??
          window.localStorage.getItem('stockfishDiagnostics')
        if (raw) {
          return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
        }
      } catch {
        // ignore localStorage access failures
      }
    }

    const envValue = process.env.NEXT_PUBLIC_STOCKFISH_DIAGNOSTICS
    if (envValue) {
      return ['1', 'true', 'yes', 'on'].includes(envValue.toLowerCase())
    }

    return false
  }

  private getRootProbePlan(
    targetDepth: number,
    _legalMoveCount: number,
  ): RootProbePlan {
    let screeningDepth = Math.max(4, Math.min(10, targetDepth - 6))
    if (screeningDepth >= targetDepth) {
      screeningDepth = Math.max(1, targetDepth - 2)
    }

    return {
      screeningDepth,
    }
  }

  private async *streamMultiPvSnapshots(
    runContext: AnalysisRunContext,
    targetDepth: number,
    requestedMultiPv: number,
  ): AsyncGenerator<{
    depth: number
    elapsedMs: number
    moves: RootSearchResult[]
  }> {
    if (!this.stockfish || requestedMultiPv <= 0) {
      return
    }

    const effectiveMultiPv = Math.max(
      1,
      Math.min(requestedMultiPv, runContext.legalMoveCount),
    )
    const engine = this.stockfish
    const originalListen = engine.listen

    await this.waitForReady()
    if (!this.isActiveRun(runContext.positionId)) {
      return
    }
    engine.uci(`setoption name MultiPV value ${effectiveMultiPv}`)
    await this.waitForReady()
    if (!this.isActiveRun(runContext.positionId)) {
      return
    }
    const startedAtMs = Date.now()
    const isBlackTurn = new Chess(runContext.fen).turn() === 'b'

    type ParsedPvInfo = {
      move: string
      cp: number
      depth: number
      mateIn?: number
      isBound: boolean
      multipv: number
    }

    const depthBuckets: Record<number, Record<number, ParsedPvInfo>> = {}
    let lastEmittedDepth = 0
    const snapshotQueue: {
      depth: number
      elapsedMs: number
      moves: RootSearchResult[]
    }[] = []
    let pendingResolver:
      | ((
          value: {
            depth: number
            elapsedMs: number
            moves: RootSearchResult[]
          } | null,
        ) => void)
      | null = null
    let finished = false

    const shouldReplace = (
      current: ParsedPvInfo | undefined,
      incoming: ParsedPvInfo,
    ) => {
      if (!current) return true
      if (incoming.depth !== current.depth) {
        return incoming.depth > current.depth
      }
      if (current.isBound !== incoming.isBound) {
        return current.isBound && !incoming.isBound
      }
      return true
    }

    const enqueueSnapshot = (snapshot: {
      depth: number
      elapsedMs: number
      moves: RootSearchResult[]
    }) => {
      if (pendingResolver) {
        const resolve = pendingResolver
        pendingResolver = null
        resolve(snapshot)
        return
      }
      snapshotQueue.push(snapshot)
    }

    const finish = () => {
      if (finished) return
      finished = true
      if (pendingResolver) {
        const resolve = pendingResolver
        pendingResolver = null
        resolve(null)
      }
    }

    const emitDepthIfReady = (depth: number) => {
      const bucket = depthBuckets[depth]
      if (!bucket || depth <= lastEmittedDepth) {
        return
      }

      const moves: RootSearchResult[] = []
      for (let i = 1; i <= effectiveMultiPv; i++) {
        const info = bucket[i]
        if (!info) return
        moves.push({
          move: info.move,
          cp: info.cp,
          depth: info.depth,
          mateIn: info.mateIn,
        })
      }

      lastEmittedDepth = depth
      enqueueSnapshot({
        depth,
        elapsedMs: Date.now() - startedAtMs,
        moves,
      })
    }

    const parseInfoLine = (line: string) => {
      if (!line.startsWith('info ')) return

      const depthMatch = line.match(/\bdepth (\d+)\b/)
      const multipvMatch = line.match(/\bmultipv (\d+)\b/)
      const scoreMatch = line.match(
        /\bscore (?:cp (-?\d+)|mate (-?\d+))(?: (upperbound|lowerbound))?\b/,
      )
      if (!depthMatch || !multipvMatch || !scoreMatch) {
        return
      }

      const multipv = Number.parseInt(multipvMatch[1], 10)
      if (multipv < 1 || multipv > effectiveMultiPv) {
        return
      }

      const pvMatch = line.match(/\bpv ((?:\S+\s*)+)$/)
      const move = pvMatch?.[1]?.trim().split(/\s+/)[0]
      if (!move || !runContext.legalMoves.includes(move)) {
        return
      }

      let cp = Number.parseInt(scoreMatch[1], 10)
      const mate = Number.parseInt(scoreMatch[2], 10)
      let mateIn: number | undefined

      if (!Number.isFinite(cp) && Number.isFinite(mate)) {
        mateIn = mate
        cp = mate > 0 ? 10000 : -10000
      }

      if (!Number.isFinite(cp)) {
        return
      }

      if (isBlackTurn) {
        cp *= -1
      }

      const depth = Number.parseInt(depthMatch[1], 10)
      const parsed: ParsedPvInfo = {
        move,
        cp,
        depth,
        mateIn,
        isBound: !!scoreMatch[3],
        multipv,
      }

      if (!depthBuckets[depth]) {
        depthBuckets[depth] = {}
      }
      if (shouldReplace(depthBuckets[depth][multipv], parsed)) {
        depthBuckets[depth][multipv] = parsed
      }

      emitDepthIfReady(depth)
    }

    try {
      engine.listen = (msg: string) => {
        if (!this.isActiveRun(runContext.positionId)) {
          finish()
          return
        }

        const lines = msg
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)

        for (const line of lines) {
          parseInfoLine(line)
          if (line.startsWith('bestmove ')) {
            const knownDepths = Object.keys(depthBuckets)
              .map((d) => Number.parseInt(d, 10))
              .filter((d) => Number.isFinite(d))
              .sort((a, b) => a - b)
            for (const depth of knownDepths) {
              emitDepthIfReady(depth)
            }
            finish()
            return
          }
        }
      }

      engine.uci(`position fen ${runContext.fen}`)
      engine.uci(`go depth ${targetDepth}`)

      while (true) {
        if (!this.isActiveRun(runContext.positionId)) {
          finish()
        }

        const next =
          snapshotQueue.length > 0
            ? snapshotQueue.shift() || null
            : await new Promise<{
                depth: number
                elapsedMs: number
                moves: RootSearchResult[]
              } | null>((resolve) => {
                if (finished) {
                  resolve(null)
                } else {
                  pendingResolver = resolve
                }
              })

        if (!next) {
          break
        }

        yield next
      }
    } finally {
      if (this.stockfish) {
        this.stockfish.listen = originalListen
        this.stockfish.uci('setoption name MultiPV value 100')
      }
    }
  }

  private async *streamEvaluationsStaged(
    runContext: AnalysisRunContext,
  ): AsyncGenerator<StockfishEvaluation> {
    if (!this.stockfish) {
      return
    }

    if (runContext.legalMoves.length === 0) {
      return
    }

    try {
      const targetDepth = runContext.targetDepth
      const plan = this.getRootProbePlan(targetDepth, runContext.legalMoveCount)
      const rootScores: Record<string, RootMoveScore> = {}
      const movePhases: Record<string, RootMovePhase> = {}
      const moveSelectionSources: Record<string, CandidateSelectionSource> = {}
      const phaseTimesMs: Record<string, number> = {
        screening: 0,
        multipv: 0,
        deepening: 0,
      }
      const deepenedMoves = new Set<string>()

      const markSelectionSource = (
        move: string,
        source: CandidateSelectionSource,
      ) => {
        const existing = moveSelectionSources[move]
        if (!existing) {
          moveSelectionSources[move] = source
          return
        }
        if (existing !== source) {
          moveSelectionSources[move] = 'both'
        }
      }

      this.sendMessage('ucinewgame')
      this.sendMessage(`position fen ${runContext.fen}`)
      await this.waitForReady()
      if (!this.isActiveRun(runContext.positionId)) {
        return
      }

      let lastScreeningSnapshot: {
        depth: number
        elapsedMs: number
        moves: RootSearchResult[]
      } | null = null

      for await (const screeningSnapshot of this.streamMultiPvSnapshots(
        runContext,
        plan.screeningDepth,
        runContext.legalMoveCount,
      )) {
        if (!this.isActiveRun(runContext.positionId)) {
          return
        }

        lastScreeningSnapshot = screeningSnapshot
        phaseTimesMs.screening = screeningSnapshot.elapsedMs
        const screeningDepthAchieved = Math.max(
          1,
          Math.min(plan.screeningDepth, screeningSnapshot.depth),
        )

        for (const score of screeningSnapshot.moves) {
          rootScores[score.move] = {
            cp: score.cp,
            depth: Math.max(
              rootScores[score.move]?.depth || 0,
              Math.max(1, Math.min(plan.screeningDepth, score.depth)),
            ),
            mateIn: score.mateIn,
          }
          movePhases[score.move] = 'screen'
        }

        if (Object.keys(rootScores).length !== runContext.legalMoveCount) {
          continue
        }

        if (screeningDepthAchieved < targetDepth) {
          const screeningEval = this.buildEvaluationFromRootScores(
            screeningDepthAchieved,
            rootScores,
            runContext.fen,
          )
          this.attachDiagnostics(screeningEval, {
            runContext,
            strategy: 'staged-root-probe',
            targetDepth,
            legalMoveCount: runContext.legalMoveCount,
            phaseTimesMs,
            rootScores,
            movePhases,
            moveCounts: {
              screened: runContext.legalMoveCount,
              deepened: 0,
              finalAtTargetDepth: Object.values(rootScores).filter(
                (score) => score.depth >= targetDepth,
              ).length,
            },
          })
          this.maybePublishDiagnostics(
            screeningEval,
            false,
            runContext.diagnosticsToConsole,
          )
          yield screeningEval
        }
      }

      if (!lastScreeningSnapshot || lastScreeningSnapshot.moves.length === 0) {
        throw new Error('Failed to collect staged screening scores')
      }

      if (Object.keys(rootScores).length !== runContext.legalMoveCount) {
        throw new Error(
          `Incomplete staged screening (${Object.keys(rootScores).length}/${runContext.legalMoveCount})`,
        )
      }

      const stagedMultiPv = Math.max(
        1,
        Math.min(
          runContext.legalMoveCount,
          runContext.kSf > 0 ? runContext.kSf : 4,
        ),
      )
      const maiaTopMoves = runContext.maiaCandidateMoves.slice(
        0,
        MAX_MAIA_DEEPEN_MOVES,
      )
      const targetDeepeningMoves = Array.from(
        new Set([...maiaTopMoves, ...runContext.forcedCandidateMoves]),
      )
      const maiaMidDepth = Math.min(MAIA_MID_DEPTH, targetDepth)

      if (maiaMidDepth > plan.screeningDepth) {
        for (const move of targetDeepeningMoves) {
          if (!this.isActiveRun(runContext.positionId)) {
            return
          }

          if (!rootScores[move]) {
            continue
          }

          markSelectionSource(move, 'maia-95')
          const current = rootScores[move]
          if (current && current.depth >= maiaMidDepth) {
            continue
          }

          const t0 = Date.now()
          const deepProbe = await this.runRootSearchWithRetry(
            runContext,
            maiaMidDepth,
            move,
          )
          phaseTimesMs.deepening += Date.now() - t0
          if (!deepProbe) {
            continue
          }

          rootScores[move] = {
            cp: deepProbe.cp,
            depth: Math.max(1, Math.min(maiaMidDepth, deepProbe.depth)),
            mateIn: deepProbe.mateIn,
          }
          movePhases[move] = 'deep'
          deepenedMoves.add(move)

          const maiaMidEval = this.buildEvaluationFromRootScores(
            maiaMidDepth,
            rootScores,
            runContext.fen,
          )
          this.attachDiagnostics(maiaMidEval, {
            runContext,
            strategy: 'staged-root-probe',
            targetDepth,
            legalMoveCount: runContext.legalMoveCount,
            phaseTimesMs,
            rootScores,
            movePhases,
            moveSelectionSources,
            moveCounts: {
              screened: runContext.legalMoveCount,
              deepened: deepenedMoves.size,
              finalAtTargetDepth: Object.values(rootScores).filter(
                (score) => score.depth >= targetDepth,
              ).length,
            },
          })
          this.maybePublishDiagnostics(
            maiaMidEval,
            false,
            runContext.diagnosticsToConsole,
          )
          yield maiaMidEval
        }
      }

      for await (const multipvSnapshot of this.streamMultiPvSnapshots(
        runContext,
        targetDepth,
        stagedMultiPv,
      )) {
        if (!this.isActiveRun(runContext.positionId)) {
          return
        }

        phaseTimesMs.multipv = multipvSnapshot.elapsedMs
        for (const score of multipvSnapshot.moves) {
          const existing = rootScores[score.move]
          rootScores[score.move] = {
            cp: score.cp,
            depth: Math.max(existing?.depth || 0, score.depth),
            mateIn: score.mateIn,
          }
          movePhases[score.move] = 'multipv'
          deepenedMoves.add(score.move)
          markSelectionSource(score.move, 'sf-top')
        }

        const streamingEval = this.buildEvaluationFromRootScores(
          Math.max(plan.screeningDepth, multipvSnapshot.depth),
          rootScores,
          runContext.fen,
        )
        this.attachDiagnostics(streamingEval, {
          runContext,
          strategy: 'staged-root-probe',
          targetDepth,
          legalMoveCount: runContext.legalMoveCount,
          phaseTimesMs,
          rootScores,
          movePhases,
          moveSelectionSources,
          moveCounts: {
            screened: runContext.legalMoveCount,
            deepened: deepenedMoves.size,
            finalAtTargetDepth: Object.values(rootScores).filter(
              (score) => score.depth >= targetDepth,
            ).length,
          },
        })
        this.maybePublishDiagnostics(
          streamingEval,
          false,
          runContext.diagnosticsToConsole,
        )
        yield streamingEval
      }

      for (const move of targetDeepeningMoves) {
        if (!this.isActiveRun(runContext.positionId)) {
          return
        }

        if (!rootScores[move]) {
          continue
        }

        markSelectionSource(move, 'maia-95')
        const current = rootScores[move]
        if (current && current.depth >= targetDepth) {
          continue
        }

        const t0 = Date.now()
        const deepProbe = await this.runRootSearchWithRetry(
          runContext,
          targetDepth,
          move,
        )
        phaseTimesMs.deepening += Date.now() - t0
        if (!deepProbe) {
          continue
        }

        rootScores[move] = {
          cp: deepProbe.cp,
          depth: Math.max(1, Math.min(targetDepth, deepProbe.depth)),
          mateIn: deepProbe.mateIn,
        }
        movePhases[move] = 'deep'
        deepenedMoves.add(move)

        const maiaDeepenedEval = this.buildEvaluationFromRootScores(
          targetDepth,
          rootScores,
          runContext.fen,
        )
        this.attachDiagnostics(maiaDeepenedEval, {
          runContext,
          strategy: 'staged-root-probe',
          targetDepth,
          legalMoveCount: runContext.legalMoveCount,
          phaseTimesMs,
          rootScores,
          movePhases,
          moveSelectionSources,
          moveCounts: {
            screened: runContext.legalMoveCount,
            deepened: deepenedMoves.size,
            finalAtTargetDepth: Object.values(rootScores).filter(
              (score) => score.depth >= targetDepth,
            ).length,
          },
        })
        this.maybePublishDiagnostics(
          maiaDeepenedEval,
          false,
          runContext.diagnosticsToConsole,
        )
        yield maiaDeepenedEval
      }

      if (!this.isActiveRun(runContext.positionId)) {
        return
      }

      const finalEval = this.buildEvaluationFromRootScores(
        targetDepth,
        rootScores,
        runContext.fen,
      )
      this.attachDiagnostics(finalEval, {
        runContext,
        strategy: 'staged-root-probe',
        targetDepth,
        legalMoveCount: runContext.legalMoveCount,
        phaseTimesMs,
        rootScores,
        movePhases,
        moveSelectionSources,
        moveCounts: {
          screened: runContext.legalMoveCount,
          deepened: deepenedMoves.size,
          finalAtTargetDepth: Object.values(rootScores).filter(
            (score) => score.depth >= targetDepth,
          ).length,
        },
      })
      this.maybePublishDiagnostics(
        finalEval,
        true,
        runContext.diagnosticsToConsole,
      )
      yield finalEval
    } finally {
      if (this.currentPositionId === runContext.positionId) {
        this.isEvaluating = false
      }
    }
  }

  private async *streamEvaluationsSearchmovesAll(
    runContext: AnalysisRunContext,
  ): AsyncGenerator<StockfishEvaluation> {
    if (!this.stockfish || runContext.legalMoves.length === 0) {
      return
    }

    try {
      const targetDepth = runContext.targetDepth
      const rootScores: Record<string, RootMoveScore> = {}
      const movePhases: Record<string, RootMovePhase> = {}
      const phaseTimesMs: Record<string, number> = { groundTruth: 0 }

      this.sendMessage('ucinewgame')
      this.sendMessage(`position fen ${runContext.fen}`)
      await this.waitForReady()
      if (!this.isActiveRun(runContext.positionId)) {
        return
      }

      for (const move of runContext.legalMoves) {
        if (!this.isActiveRun(runContext.positionId)) {
          return
        }

        const t0 = Date.now()
        const probe = await this.runRootSearchWithRetry(
          runContext,
          targetDepth,
          move,
        )
        phaseTimesMs.groundTruth += Date.now() - t0
        if (!probe) {
          throw new Error(`Failed to analyze root move ${move}`)
        }

        rootScores[move] = {
          cp: probe.cp,
          depth: Math.max(1, Math.min(targetDepth, probe.depth)),
          mateIn: probe.mateIn,
        }
        movePhases[move] = 'ground-truth'
      }

      const finalEval = this.buildEvaluationFromRootScores(
        targetDepth,
        rootScores,
        runContext.fen,
      )
      this.attachDiagnostics(finalEval, {
        runContext,
        strategy: 'searchmoves-all',
        targetDepth,
        legalMoveCount: runContext.legalMoveCount,
        phaseTimesMs,
        rootScores,
        movePhases,
        moveCounts: {
          screened: 0,
          deepened: runContext.legalMoveCount,
          finalAtTargetDepth: Object.values(rootScores).filter(
            (score) => score.depth >= targetDepth,
          ).length,
        },
      })
      this.maybePublishDiagnostics(
        finalEval,
        true,
        runContext.diagnosticsToConsole,
      )
      yield finalEval
    } finally {
      if (this.currentPositionId === runContext.positionId) {
        this.isEvaluating = false
      }
    }
  }

  private buildEvaluationFromRootScores(
    depth: number,
    rootScores: Record<string, RootMoveScore>,
    fen: string,
  ): StockfishEvaluation {
    const board = new Chess(fen)
    const isBlackTurn = board.turn() === 'b'

    const sortedMoves = Object.entries(rootScores).sort(([, a], [, b]) => {
      if (b.cp !== a.cp) return isBlackTurn ? a.cp - b.cp : b.cp - a.cp

      const aMate = a.mateIn
      const bMate = b.mateIn
      if (aMate === undefined && bMate === undefined) return 0
      if (aMate === undefined) return 1
      if (bMate === undefined) return -1

      // Prefer faster wins and slower losses when cp values are both mapped to mate sentinels.
      return Math.abs(aMate) - Math.abs(bMate)
    })

    if (sortedMoves.length === 0) {
      throw new Error('No root move scores available')
    }

    const [bestMove, bestScore] = sortedMoves[0]

    const cpVec: Record<string, number> = {}
    const cpRelativeVec: Record<string, number> = {}
    const winrateVec: Record<string, number> = {}
    const winrateLossVec: Record<string, number> = {}
    const rootMoveDepthVec: Record<string, number> = {}
    let mateVec: Record<string, number> | undefined

    for (const [move, score] of sortedMoves) {
      cpVec[move] = score.cp
      cpRelativeVec[move] = isBlackTurn
        ? bestScore.cp - score.cp
        : score.cp - bestScore.cp

      const winrate = cpToWinrate(score.cp * (isBlackTurn ? -1 : 1), false)
      winrateVec[move] = winrate
      rootMoveDepthVec[move] = score.depth

      if (score.mateIn !== undefined) {
        mateVec = mateVec || {}
        mateVec[move] = score.mateIn
      }
    }

    const evaluation: StockfishEvaluation = {
      sent: true,
      depth,
      model_move: bestMove,
      model_optimal_cp: bestScore.cp,
      cp_vec: cpVec,
      cp_relative_vec: cpRelativeVec,
      root_move_depth_vec: rootMoveDepthVec,
      winrate_vec: winrateVec,
      winrate_loss_vec: winrateLossVec,
      mate_vec: mateVec,
      is_checkmate: board.inCheckmate(),
    }

    return this.finalizeEvaluation(evaluation)
  }

  private buildMoveDiagnostics(
    rootScores: Record<string, RootMoveScore>,
    movePhases?: Record<string, RootMovePhase>,
    moveSelectionSources?: Record<string, CandidateSelectionSource>,
    maiaPolicy?: Record<string, number>,
  ): Record<string, StockfishMoveDiagnostic> {
    const diagnostics: Record<string, StockfishMoveDiagnostic> = {}

    for (const [move, score] of Object.entries(rootScores)) {
      diagnostics[move] = {
        cp: score.cp,
        depth: score.depth,
        mateIn: score.mateIn,
        phase: movePhases?.[move],
        selectedBy: moveSelectionSources?.[move],
        maiaProb: maiaPolicy?.[move],
      }
    }

    return diagnostics
  }

  private attachDiagnostics(
    evaluation: StockfishEvaluation,
    params: {
      runContext: AnalysisRunContext
      strategy: StockfishDiagnostics['strategy']
      targetDepth: number
      legalMoveCount: number
      phaseTimesMs?: { [phase: string]: number }
      rootScores: Record<string, RootMoveScore>
      movePhases?: Record<string, RootMovePhase>
      moveSelectionSources?: Record<string, CandidateSelectionSource>
      moveCounts?: StockfishDiagnostics['moveCounts']
    },
  ) {
    const { runContext } = params
    evaluation.diagnostics = {
      positionId: runContext.positionId,
      fen: runContext.fen,
      strategy: params.strategy,
      targetDepth: params.targetDepth,
      legalMoveCount: params.legalMoveCount,
      totalTimeMs: Date.now() - runContext.analysisStartedAtMs,
      phaseTimesMs: params.phaseTimesMs
        ? { ...params.phaseTimesMs }
        : undefined,
      moveCounts: params.moveCounts ? { ...params.moveCounts } : undefined,
      moves: this.buildMoveDiagnostics(
        params.rootScores,
        params.movePhases,
        params.moveSelectionSources,
        runContext.maiaPolicy,
      ),
    }
  }

  private cloneEvaluation(
    evaluation: StockfishEvaluation,
  ): StockfishEvaluation {
    return {
      ...evaluation,
      cp_vec: { ...evaluation.cp_vec },
      cp_relative_vec: { ...evaluation.cp_relative_vec },
      root_move_depth_vec: evaluation.root_move_depth_vec
        ? { ...evaluation.root_move_depth_vec }
        : undefined,
      winrate_vec: evaluation.winrate_vec
        ? { ...evaluation.winrate_vec }
        : undefined,
      winrate_loss_vec: evaluation.winrate_loss_vec
        ? { ...evaluation.winrate_loss_vec }
        : undefined,
      mate_vec: evaluation.mate_vec ? { ...evaluation.mate_vec } : undefined,
      diagnostics: evaluation.diagnostics
        ? {
            ...evaluation.diagnostics,
            phaseTimesMs: evaluation.diagnostics.phaseTimesMs
              ? { ...evaluation.diagnostics.phaseTimesMs }
              : undefined,
            moveCounts: evaluation.diagnostics.moveCounts
              ? { ...evaluation.diagnostics.moveCounts }
              : undefined,
            moves: evaluation.diagnostics.moves
              ? Object.fromEntries(
                  Object.entries(evaluation.diagnostics.moves).map(
                    ([move, data]) => [move, { ...data }],
                  ),
                )
              : undefined,
          }
        : undefined,
    }
  }

  private maybePublishDiagnostics(
    evaluation: StockfishEvaluation,
    isFinalForRun: boolean,
    diagnosticsToConsole = this.currentDiagnosticsToConsole,
  ) {
    if (!isFinalForRun) {
      return
    }

    const snapshot = this.cloneEvaluation(evaluation)

    if (typeof window !== 'undefined') {
      try {
        const globalObj = window as typeof window & {
          __maiaStockfishDiagnostics?: StockfishEvaluation[]
        }
        const existing = globalObj.__maiaStockfishDiagnostics || []
        existing.push(snapshot)
        globalObj.__maiaStockfishDiagnostics = existing.slice(-50)
      } catch {
        // ignore window publish failures
      }
    }

    if (!diagnosticsToConsole || !snapshot.diagnostics) {
      return
    }

    const d = snapshot.diagnostics
    console.groupCollapsed(
      `[Stockfish ${d.strategy}] depth ${snapshot.depth}/${d.targetDepth} in ${d.totalTimeMs}ms (${d.legalMoveCount} legal)`,
    )
    console.log('Summary', {
      positionId: d.positionId,
      bestMove: snapshot.model_move,
      bestCp: snapshot.model_optimal_cp,
      totalTimeMs: d.totalTimeMs,
      phaseTimesMs: d.phaseTimesMs,
      moveCounts: d.moveCounts,
    })
    if (d.moves) {
      console.table(
        Object.entries(d.moves)
          .map(([move, data]) => ({
            move,
            cp: data.cp,
            depth: data.depth,
            mateIn: data.mateIn,
            phase: data.phase,
            selectedBy: data.selectedBy,
            maiaProb: data.maiaProb,
          }))
          .sort((a, b) => b.cp - a.cp),
      )
    }
    console.groupEnd()
  }

  private finalizeEvaluation(
    evaluation: StockfishEvaluation,
  ): StockfishEvaluation {
    let bestWinrate = -Infinity

    const winrateVec = evaluation.winrate_vec
    if (winrateVec) {
      for (const m in winrateVec) {
        const wr = winrateVec[m]
        if (wr > bestWinrate) {
          bestWinrate = wr
        }
      }

      const winrateLossVec = evaluation.winrate_loss_vec
      if (winrateLossVec) {
        for (const m in winrateVec) {
          winrateLossVec[m] = winrateVec[m] - bestWinrate
        }
      }
    }

    if (evaluation.winrate_vec) {
      evaluation.winrate_vec = Object.fromEntries(
        Object.entries(evaluation.winrate_vec || {}).sort(
          ([, a], [, b]) => b - a,
        ),
      )
    }

    if (evaluation.winrate_loss_vec) {
      evaluation.winrate_loss_vec = Object.fromEntries(
        Object.entries(evaluation.winrate_loss_vec || {}).sort(
          ([, a], [, b]) => b - a,
        ),
      )
    }

    if (evaluation.mate_vec && Object.keys(evaluation.mate_vec).length === 0) {
      delete evaluation.mate_vec
    }

    return evaluation
  }

  private async runRootSearchWithRetry(
    runContext: AnalysisRunContext,
    depth: number,
    searchMove?: string,
  ): Promise<RootSearchResult | null> {
    const primary = await this.runRootSearch(
      runContext,
      depth,
      searchMove,
      false,
    )
    if (primary || !searchMove) {
      return primary
    }

    return this.runRootSearch(runContext, depth, searchMove, true)
  }

  private async runRootSearch(
    runContext: AnalysisRunContext,
    depth: number,
    searchMove?: string,
    searchMovesFirst = false,
  ): Promise<RootSearchResult | null> {
    if (
      !this.stockfish ||
      depth <= 0 ||
      !this.isActiveRun(runContext.positionId)
    ) {
      return null
    }

    await this.waitForReady()
    if (!this.isActiveRun(runContext.positionId)) {
      return null
    }

    const engine = this.stockfish
    const originalListen = engine.listen
    const expectedMove = searchMove
    const isBlackTurn = new Chess(runContext.fen).turn() === 'b'

    type SearchInfo = {
      move: string
      cp: number
      depth: number
      mateIn?: number
      isBound: boolean
    }

    let latestInfo: SearchInfo | null = null
    let bestPvInfo: SearchInfo | null = null
    const infosByMove: Record<string, SearchInfo> = {}

    const shouldReplaceSearchInfo = (
      current: SearchInfo | null,
      incoming: SearchInfo,
    ) => {
      if (!current) return true
      if (incoming.depth !== current.depth) {
        return incoming.depth > current.depth
      }
      if (current.isBound !== incoming.isBound) {
        return current.isBound && !incoming.isBound
      }
      return true
    }

    const parseInfoLine = (line: string) => {
      if (!line.startsWith('info ')) return

      const depthMatch = line.match(/\bdepth (\d+)\b/)
      const multipvMatch = line.match(/\bmultipv (\d+)\b/)
      const scoreMatch = line.match(
        /\bscore (?:cp (-?\d+)|mate (-?\d+))(?: (upperbound|lowerbound))?\b/,
      )
      if (!depthMatch || !scoreMatch) {
        return
      }

      const pvMatch = line.match(/\bpv ((?:\S+\s*)+)$/)
      const moveFromPv = pvMatch?.[1]?.trim().split(/\s+/)[0]
      if (expectedMove) {
        if (!moveFromPv || moveFromPv !== expectedMove) {
          return
        }
      } else if (!moveFromPv) {
        return
      }

      const move = expectedMove || moveFromPv
      if (!move || !runContext.legalMoves.includes(move)) {
        return
      }

      let cp = Number.parseInt(scoreMatch[1], 10)
      const mate = Number.parseInt(scoreMatch[2], 10)
      let mateIn: number | undefined

      if (!Number.isFinite(cp) && Number.isFinite(mate)) {
        mateIn = mate
        cp = mate > 0 ? 10000 : -10000
      }

      if (!Number.isFinite(cp)) {
        return
      }

      if (isBlackTurn) {
        cp *= -1
      }

      const info: SearchInfo = {
        move,
        cp,
        depth: Number.parseInt(depthMatch[1], 10),
        mateIn,
        isBound: !!scoreMatch[3],
      }

      if (shouldReplaceSearchInfo(latestInfo, info)) {
        latestInfo = info
      }

      const currentForMove = infosByMove[move]
      if (shouldReplaceSearchInfo(currentForMove || null, info)) {
        infosByMove[move] = info
      }

      const multipv = Number.parseInt(multipvMatch?.[1] ?? '1', 10)
      if (multipv === 1 && shouldReplaceSearchInfo(bestPvInfo, info)) {
        bestPvInfo = info
      }
    }

    return new Promise<RootSearchResult | null>((resolve) => {
      let resolved = false

      const finish = (result: RootSearchResult | null) => {
        if (resolved) return
        resolved = true
        if (this.stockfish) {
          this.stockfish.listen = originalListen
        }
        resolve(result)
      }

      engine.listen = (msg: string) => {
        const lines = msg
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)

        for (const line of lines) {
          parseInfoLine(line)

          const bestMoveMatch = line.match(/^bestmove (\S+)/)
          if (!bestMoveMatch) {
            continue
          }

          if (!this.isActiveRun(runContext.positionId)) {
            finish(null)
            return
          }

          const engineBestMove =
            bestMoveMatch[1] && bestMoveMatch[1] !== '(none)'
              ? bestMoveMatch[1]
              : undefined
          const resolvedMove =
            expectedMove || engineBestMove || latestInfo?.move
          const resolvedInfo =
            (resolvedMove ? infosByMove[resolvedMove] : undefined) ||
            (expectedMove ? latestInfo : null) ||
            bestPvInfo ||
            latestInfo

          if (
            !resolvedInfo ||
            !resolvedMove ||
            !runContext.legalMoves.includes(resolvedMove)
          ) {
            finish(null)
            return
          }

          finish({
            move: resolvedMove,
            cp: resolvedInfo.cp,
            depth: resolvedInfo.depth,
            mateIn: resolvedInfo.mateIn,
          })
          return
        }
      }

      engine.uci(`position fen ${runContext.fen}`)
      engine.uci(
        searchMove
          ? searchMovesFirst
            ? `go searchmoves ${searchMove} depth ${depth}`
            : `go depth ${depth} searchmoves ${searchMove}`
          : `go depth ${depth}`,
      )
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
      if (!this.store[depth].root_move_depth_vec) {
        this.store[depth].root_move_depth_vec = {}
      }
      this.store[depth].root_move_depth_vec[move] = depth

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
        root_move_depth_vec: { [move]: depth },
        winrate_vec: { [move]: winrate },
        winrate_loss_vec: { [move]: 0 },
        mate_vec: mateIn !== undefined ? { [move]: mateIn } : undefined,
        sent: false,
      }
    }

    if (!this.store[depth].sent && multipv === this.legalMoveCount) {
      this.store[depth] = this.finalizeEvaluation(this.store[depth])
      const board = new Chess(this.fen)
      this.store[depth].is_checkmate = board.inCheckmate()
      this.attachDiagnostics(this.store[depth], {
        runContext: {
          positionId: this.currentPositionId,
          fen: this.fen,
          legalMoves: [...this.moves],
          legalMoveCount: this.legalMoveCount,
          maiaCandidateMoves: [],
          forcedCandidateMoves: [],
          maiaPolicy: {},
          kSf: 0,
          targetDepth: this.currentTargetDepth,
          analysisStartedAtMs: this.currentAnalysisStartedAtMs,
          diagnosticsToConsole: this.currentDiagnosticsToConsole,
        },
        strategy: 'multipv-all',
        targetDepth: this.currentTargetDepth,
        legalMoveCount: this.legalMoveCount,
        phaseTimesMs: undefined,
        rootScores: Object.fromEntries(
          Object.entries(this.store[depth].cp_vec).map(([rootMove, rootCp]) => [
            rootMove,
            {
              cp: rootCp,
              depth: this.store[depth].root_move_depth_vec?.[rootMove] ?? depth,
              mateIn: this.store[depth].mate_vec?.[rootMove],
            },
          ]),
        ),
        movePhases: Object.fromEntries(
          Object.keys(this.store[depth].cp_vec).map((rootMove) => [
            rootMove,
            'multipv',
          ]),
        ) as Record<string, 'multipv'>,
        moveCounts: {
          finalAtTargetDepth: Object.values(
            this.store[depth].root_move_depth_vec || {},
          ).filter((d) => d >= this.currentTargetDepth).length,
        },
      })
      this.store[depth].sent = true
      this.maybePublishDiagnostics(
        this.store[depth],
        depth >= this.currentTargetDepth && this.currentTargetDepth > 0,
      )
      if (this.evaluationResolver) {
        this.evaluationResolver(this.store[depth])
        this.evaluationResolver = null
        this.evaluationRejecter = null
      }
      if (depth >= this.currentTargetDepth && this.currentTargetDepth > 0) {
        this.stopEvaluation()
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
      throw new Error(
        `Stockfish NNUE fetch timed out after ${timeoutMs}ms: ${url}`,
      )
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
