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
  maxCandidates: number
  cpWindow: number
}

type RootMovePhase = 'multipv' | 'screen' | 'deep' | 'ground-truth'

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
    this.currentTargetDepth = 0
    this.currentMoveMapStrategy = 'multipv-all'
    this.currentAnalysisStartedAtMs = 0
    this.currentDiagnosticsToConsole = false

    this.onMessage = this.onMessage.bind(this)

    // Skip browser-only Stockfish initialization during SSR/Node renders.
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      return
    }

    setupStockfish()
      .then((stockfish: StockfishWeb) => {
        this.stockfish = stockfish
        stockfish.uci('uci')
        stockfish.uci('isready')
        stockfish.uci('setoption name MultiPV value 100')
        stockfish.onError = this.onError
        stockfish.listen = this.onMessage
        this.isReady = true
        this.nnueLoaded = true
      })
      .catch((error) => {
        console.error('Failed to initialize Stockfish:', error)
        this.isReady = false
      })
  }

  get ready(): boolean {
    return this.isReady && this.stockfish !== null && this.nnueLoaded
  }

  async *streamEvaluations(
    fen: string,
    legalMoveCount: number,
    targetDepth = 18,
    options?: StockfishStreamOptions,
  ): AsyncGenerator<StockfishEvaluation> {
    if (this.stockfish && this.isReady) {
      if (typeof global.gc === 'function') {
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
      if (moveMapStrategy === 'searchmoves-all' && this.moves.length > 0) {
        try {
          yield* this.streamEvaluationsSearchmovesAll(targetDepth)
          return
        } catch (error) {
          console.warn(
            'Searchmoves-all Stockfish analysis failed, falling back to MultiPV-all:',
            error,
          )
          this.store = {}
          if (!this.isEvaluating) {
            return
          }
        }
      }
      if (moveMapStrategy === 'staged-root-probe' && this.moves.length > 0) {
        try {
          yield* this.streamEvaluationsStaged(targetDepth)
          return
        } catch (error) {
          console.warn(
            'Staged Stockfish move-map analysis failed, falling back to MultiPV-all:',
            error,
          )
          this.store = {}
          if (!this.isEvaluating) {
            return
          }
        }
      }

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
      'multipv-all'

    if (rawStrategy === 'staged-root-probe') return 'staged-root-probe'
    if (rawStrategy === 'searchmoves-all') return 'searchmoves-all'
    return 'multipv-all'
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
    legalMoveCount: number,
  ): RootProbePlan {
    let screeningDepth = Math.max(4, Math.min(10, targetDepth - 6))
    if (screeningDepth >= targetDepth) {
      screeningDepth = Math.max(1, targetDepth - 2)
    }

    const maxCandidates = Math.min(
      legalMoveCount,
      Math.max(4, Math.min(8, Math.ceil(Math.sqrt(legalMoveCount)) + 1)),
    )

    return {
      screeningDepth,
      maxCandidates,
      cpWindow: targetDepth >= 16 ? 90 : 70,
    }
  }

  private async *streamEvaluationsStaged(
    targetDepth: number,
  ): AsyncGenerator<StockfishEvaluation> {
    if (!this.stockfish) {
      return
    }

    if (this.moves.length === 0) {
      return
    }

    try {
      const plan = this.getRootProbePlan(targetDepth, this.moves.length)
      const rootScores: Record<string, RootMoveScore> = {}
      const movePhases: Record<string, RootMovePhase> = {}
      const phaseTimesMs: Record<string, number> = {
        best: 0,
        screening: 0,
        deepening: 0,
      }
      let deepenedCount = 0

      this.sendMessage('ucinewgame')
      this.sendMessage(`position fen ${this.fen}`)
      await this.waitForReady()

      let t0 = Date.now()
      const deepBest = await this.runRootSearch(targetDepth)
      phaseTimesMs.best += Date.now() - t0
      if (deepBest) {
        rootScores[deepBest.move] = {
          cp: deepBest.cp,
          depth: Math.max(1, Math.min(targetDepth, deepBest.depth)),
          mateIn: deepBest.mateIn,
        }
        movePhases[deepBest.move] = 'deep'
      }

      for (const move of this.moves) {
        if (!this.isEvaluating) {
          return
        }

        t0 = Date.now()
        const probe = await this.runRootSearch(plan.screeningDepth, move)
        phaseTimesMs.screening += Date.now() - t0
        if (!probe) {
          throw new Error(`Failed to probe root move ${move}`)
        }

        rootScores[move] = {
          cp: probe.cp,
          depth: Math.max(1, Math.min(plan.screeningDepth, probe.depth)),
          mateIn: probe.mateIn,
        }
        movePhases[move] = 'screen'
      }

      if (Object.keys(rootScores).length !== this.moves.length) {
        throw new Error(
          `Incomplete staged screening (${Object.keys(rootScores).length}/${this.moves.length})`,
        )
      }

      if (plan.screeningDepth > 0 && plan.screeningDepth < targetDepth) {
        const screeningEval = this.buildEvaluationFromRootScores(
          plan.screeningDepth,
          rootScores,
        )
        this.attachDiagnostics(screeningEval, {
          strategy: 'staged-root-probe',
          targetDepth,
          legalMoveCount: this.moves.length,
          phaseTimesMs,
          rootScores,
          movePhases,
          moveCounts: {
            screened: this.moves.length,
            deepened: 0,
            finalAtTargetDepth: Object.values(rootScores).filter(
              (score) => score.depth >= targetDepth,
            ).length,
          },
        })
        this.maybePublishDiagnostics(screeningEval, false)
        yield screeningEval
      }

      const candidateMoves = this.selectCandidateMoves(rootScores, plan, deepBest)

      for (const move of candidateMoves) {
        if (!this.isEvaluating) {
          return
        }

        const current = rootScores[move]
        if (current && current.depth >= targetDepth) {
          continue
        }

        t0 = Date.now()
        const deepProbe = await this.runRootSearch(targetDepth, move)
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
        deepenedCount += 1
      }

      if (!this.isEvaluating) {
        return
      }

      const finalEval = this.buildEvaluationFromRootScores(targetDepth, rootScores)
      this.attachDiagnostics(finalEval, {
        strategy: 'staged-root-probe',
        targetDepth,
        legalMoveCount: this.moves.length,
        phaseTimesMs,
        rootScores,
        movePhases,
        moveCounts: {
          screened: this.moves.length,
          deepened: deepenedCount,
          finalAtTargetDepth: Object.values(rootScores).filter(
            (score) => score.depth >= targetDepth,
          ).length,
        },
      })
      this.maybePublishDiagnostics(finalEval, true)
      yield finalEval
    } finally {
      this.isEvaluating = false
    }
  }

  private async *streamEvaluationsSearchmovesAll(
    targetDepth: number,
  ): AsyncGenerator<StockfishEvaluation> {
    if (!this.stockfish || this.moves.length === 0) {
      return
    }

    try {
      const rootScores: Record<string, RootMoveScore> = {}
      const movePhases: Record<string, RootMovePhase> = {}
      const phaseTimesMs: Record<string, number> = { groundTruth: 0 }

      this.sendMessage('ucinewgame')
      this.sendMessage(`position fen ${this.fen}`)
      await this.waitForReady()

      for (const move of this.moves) {
        if (!this.isEvaluating) {
          return
        }

        const t0 = Date.now()
        const probe = await this.runRootSearch(targetDepth, move)
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

      const finalEval = this.buildEvaluationFromRootScores(targetDepth, rootScores)
      this.attachDiagnostics(finalEval, {
        strategy: 'searchmoves-all',
        targetDepth,
        legalMoveCount: this.moves.length,
        phaseTimesMs,
        rootScores,
        movePhases,
        moveCounts: {
          screened: 0,
          deepened: this.moves.length,
          finalAtTargetDepth: Object.values(rootScores).filter(
            (score) => score.depth >= targetDepth,
          ).length,
        },
      })
      this.maybePublishDiagnostics(finalEval, true)
      yield finalEval
    } finally {
      this.isEvaluating = false
    }
  }

  private selectCandidateMoves(
    rootScores: Record<string, RootMoveScore>,
    plan: RootProbePlan,
    deepBest: RootSearchResult | null,
  ): string[] {
    const rankedMoves = Object.entries(rootScores).sort(
      ([, a], [, b]) => b.cp - a.cp,
    )

    if (rankedMoves.length === 0) {
      return []
    }

    const candidates = new Set<string>()
    const referenceBestMove =
      (deepBest && rootScores[deepBest.move] && deepBest.move) || rankedMoves[0][0]
    const deepBestCp =
      deepBest && deepBest.move === referenceBestMove ? deepBest.cp : undefined
    const referenceBestCp =
      deepBestCp ?? rootScores[referenceBestMove]?.cp ?? rankedMoves[0][1].cp

    candidates.add(referenceBestMove)

    for (const [move] of rankedMoves.slice(0, plan.maxCandidates)) {
      candidates.add(move)
    }

    for (const [move, score] of rankedMoves) {
      if (referenceBestCp - score.cp <= plan.cpWindow) {
        candidates.add(move)
      }
    }

    const mateMoves = Object.entries(rootScores)
      .filter(([, score]) => score.mateIn !== undefined)
      .map(([move]) => move)
    for (const move of mateMoves) {
      candidates.add(move)
    }

    return [...candidates]
  }

  private buildEvaluationFromRootScores(
    depth: number,
    rootScores: Record<string, RootMoveScore>,
  ): StockfishEvaluation {
    const sortedMoves = Object.entries(rootScores).sort(([, a], [, b]) => {
      if (b.cp !== a.cp) return b.cp - a.cp

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

    const board = new Chess(this.fen)
    const isBlackTurn = board.turn() === 'b'
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
  ): Record<string, StockfishMoveDiagnostic> {
    const diagnostics: Record<string, StockfishMoveDiagnostic> = {}

    for (const [move, score] of Object.entries(rootScores)) {
      diagnostics[move] = {
        cp: score.cp,
        depth: score.depth,
        mateIn: score.mateIn,
        phase: movePhases?.[move],
      }
    }

    return diagnostics
  }

  private attachDiagnostics(
    evaluation: StockfishEvaluation,
    params: {
      strategy: StockfishDiagnostics['strategy']
      targetDepth: number
      legalMoveCount: number
      phaseTimesMs?: { [phase: string]: number }
      rootScores: Record<string, RootMoveScore>
      movePhases?: Record<string, RootMovePhase>
      moveCounts?: StockfishDiagnostics['moveCounts']
    },
  ) {
    evaluation.diagnostics = {
      positionId: this.currentPositionId,
      fen: this.fen,
      strategy: params.strategy,
      targetDepth: params.targetDepth,
      legalMoveCount: params.legalMoveCount,
      totalTimeMs: Date.now() - this.currentAnalysisStartedAtMs,
      phaseTimesMs: params.phaseTimesMs ? { ...params.phaseTimesMs } : undefined,
      moveCounts: params.moveCounts ? { ...params.moveCounts } : undefined,
      moves: this.buildMoveDiagnostics(params.rootScores, params.movePhases),
    }
  }

  private cloneEvaluation(evaluation: StockfishEvaluation): StockfishEvaluation {
    return {
      ...evaluation,
      cp_vec: { ...evaluation.cp_vec },
      cp_relative_vec: { ...evaluation.cp_relative_vec },
      root_move_depth_vec: evaluation.root_move_depth_vec
        ? { ...evaluation.root_move_depth_vec }
        : undefined,
      winrate_vec: evaluation.winrate_vec ? { ...evaluation.winrate_vec } : undefined,
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
                  Object.entries(evaluation.diagnostics.moves).map(([move, data]) => [
                    move,
                    { ...data },
                  ]),
                )
              : undefined,
          }
        : undefined,
    }
  }

  private maybePublishDiagnostics(
    evaluation: StockfishEvaluation,
    isFinalForRun: boolean,
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

    if (!this.currentDiagnosticsToConsole || !snapshot.diagnostics) {
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
          }))
          .sort((a, b) => b.cp - a.cp),
      )
    }
    console.groupEnd()
  }

  private finalizeEvaluation(evaluation: StockfishEvaluation): StockfishEvaluation {
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
        Object.entries(evaluation.winrate_vec || {}).sort(([, a], [, b]) => b - a),
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

  private async runRootSearch(
    depth: number,
    searchMove?: string,
  ): Promise<RootSearchResult | null> {
    if (!this.stockfish || !this.isEvaluating || depth <= 0) {
      return null
    }

    await this.waitForReady()

    const engine = this.stockfish
    const originalListen = engine.listen
    const fallbackMove = searchMove
    const isBlackTurn = new Chess(this.fen).turn() === 'b'

    type SearchInfo = {
      move: string
      cp: number
      depth: number
      mateIn?: number
      isBound: boolean
    }

    let latestInfo: SearchInfo | null = null

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
      const scoreMatch = line.match(
        /\bscore (?:cp (-?\d+)|mate (-?\d+))(?: (upperbound|lowerbound))?\b/,
      )
      if (!depthMatch || !scoreMatch) {
        return
      }

      const pvMatch = line.match(/\bpv ((?:\S+\s*)+)$/)
      const moveFromPv = pvMatch?.[1]?.trim().split(/\s+/)[0]
      const move = moveFromPv || fallbackMove
      if (!move || !this.moves.includes(move)) {
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

          if (!this.isEvaluating) {
            finish(null)
            return
          }

          const engineBestMove =
            bestMoveMatch[1] && bestMoveMatch[1] !== '(none)'
              ? bestMoveMatch[1]
              : undefined
          const resolvedMove = fallbackMove || latestInfo?.move || engineBestMove

          if (!latestInfo || !resolvedMove) {
            finish(null)
            return
          }

          finish({
            move: resolvedMove,
            cp: latestInfo.cp,
            depth: latestInfo.depth,
            mateIn: latestInfo.mateIn,
          })
          return
        }
      }

      engine.uci(`position fen ${this.fen}`)
      engine.uci(
        searchMove
          ? `go depth ${depth} searchmoves ${searchMove}`
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

const setupStockfish = (): Promise<StockfishWeb> => {
  return new Promise<StockfishWeb>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('lila-stockfish-web/sf17-79.js').then((makeModule: any) => {
      makeModule
        .default({
          wasmMemory: sharedWasmMemory(2560),
          onError: (msg: string) => reject(new Error(msg)),
          locateFile: (name: string) => `/stockfish/${name}`,
        })
        .then(async (instance: StockfishWeb) => {
          // NNUE weights served via raw.githubusercontent.com permalink (CORS + COEP compatible).
          // Override with NEXT_PUBLIC_STOCKFISH_NNUE_BASE_URL for self-hosted deployments.
          const nnueBaseUrl =
            process.env.NEXT_PUBLIC_STOCKFISH_NNUE_BASE_URL ??
            'https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/e23a50e/public/stockfish'
          // Load NNUE models before resolving
          Promise.all([
            fetch(`${nnueBaseUrl}/${instance.getRecommendedNnue(0)}`),
            fetch(`${nnueBaseUrl}/${instance.getRecommendedNnue(1)}`),
          ])
            .then((responses) => {
              return Promise.all([
                responses[0].arrayBuffer(),
                responses[1].arrayBuffer(),
              ])
            })
            .then((buffers) => {
              instance.setNnueBuffer(new Uint8Array(buffers[0]), 0)
              instance.setNnueBuffer(new Uint8Array(buffers[1]), 1)
              resolve(instance)
            })
            .catch((error) => {
              console.error('Failed to load NNUE models:', error)
              reject(error)
            })
        })
    })
  })
}

export default Engine
