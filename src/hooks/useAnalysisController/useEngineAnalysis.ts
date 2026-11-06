import { Chess } from 'chess.ts'
import { fetchOpeningBookMoves } from 'src/api'
import { startTransition, useEffect, useContext, useRef, useState } from 'react'
import {
  analysisMaiaStage,
  analysisPositionShown,
  analysisStockfishUpdate,
  startAnalysisTiming,
} from 'src/lib/analysisTiming'
import { MAIA_MODELS, MAIA_RATINGS } from 'src/constants/common'
import {
  STOCKFISH_DEBUG_RERUN_EVENT,
  STOCKFISH_DEBUG_RERUN_KEY,
} from 'src/constants/analysis'
import { GameNode, MaiaEvaluation } from 'src/types'
import { MaiaEngineContext, StockfishEngineContext } from 'src/contexts'
import { isPhone } from 'src/lib/engine/maiaDownloadPrompt'

/** Most ratings per Maia request (~0.55 s for 11 on a desktop). */
const MAIA_BATCH_SIZE = 11

/**
 * Shortest time between re-renders for Stockfish's updates. Each re-renders
 * the analysis page (50-85 ms once Maia's data is on screen), and Stockfish's
 * output is handled on the main thread, so rendering every depth slowed the
 * search itself 2-3 times.
 */
const STOCKFISH_RENDER_INTERVAL_MS = 150

/**
 * Wait after the position changes before starting Maia and Stockfish on it,
 * so holding an arrow key does not start them on every position passed. 50 ms
 * still skips key-repeat positions; at 0 ms ten quick presses each started an
 * inference, and the last position's moves came later.
 */
const ANALYSIS_DELAY_MS = 50

export const useEngineAnalysis = (
  currentNode: GameNode | null,
  inProgressAnalyses: Set<string>,
  currentMaiaModel: string,
  setAnalysisState: React.Dispatch<React.SetStateAction<number>>,
  targetDepth = 18,
  enabled = true,
  // false: Maia only. Stockfish isn't run (the analysis settings' "Off").
  stockfishEnabled = true,
  // false while full-game analysis moves through the game by itself.
  isLiveAnalysis = true,
) => {
  const maia = useContext(MaiaEngineContext)
  const stockfish = useContext(StockfishEngineContext)
  const [stockfishDebugRerunToken, setStockfishDebugRerunToken] = useState(0)
  const lastConsumedStockfishRerunTokenRef = useRef(0)

  const readRerunTokenFromStorage = () => {
    if (typeof window === 'undefined') return 0
    const raw = window.localStorage.getItem(STOCKFISH_DEBUG_RERUN_KEY)
    const parsed = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(parsed) ? parsed : 0
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onDebugRerun = () => {
      const token = readRerunTokenFromStorage() || Date.now()
      setStockfishDebugRerunToken(token)
    }

    setStockfishDebugRerunToken(readRerunTokenFromStorage())
    window.addEventListener(STOCKFISH_DEBUG_RERUN_EVENT, onDebugRerun)

    const intervalId = window.setInterval(() => {
      const token = readRerunTokenFromStorage()
      setStockfishDebugRerunToken((prev) => (token > prev ? token : prev))
    }, 500)

    return () => {
      window.removeEventListener(STOCKFISH_DEBUG_RERUN_EVENT, onDebugRerun)
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !window.location.pathname.startsWith('/analysis')) return
    return startAnalysisTiming({ isPhone: isPhone() })
  }, [enabled])

  // Timed before the engine effects below, for the position they start on.
  useEffect(() => {
    // Full-game analysis moves through the game by itself.
    if (!currentNode || !enabled || !isLiveAnalysis) return
    analysisPositionShown(currentNode.fen)
  }, [currentNode, enabled, isLiveAnalysis])

  async function inferenceMaiaModel(
    board: Chess,
    models: string[],
    signal: AbortSignal,
  ): Promise<{
    [key: string]: MaiaEvaluation
  }> {
    if (!maia.maia) {
      throw new Error('Maia engine not initialized')
    }

    const ratings = models.map(
      (model) => MAIA_RATINGS[MAIA_MODELS.indexOf(model)],
    )
    const { result } = await maia.maia.batchEvaluateMaia3(
      Array(ratings.length).fill(board.fen()),
      ratings,
      ratings,
      { signal },
    )

    const maiaEvaluations: { [key: string]: MaiaEvaluation } = {}
    models.forEach((model, index) => {
      maiaEvaluations[model] = result[index]
    })

    return maiaEvaluations
  }

  async function fetchOpeningBook(board: Chess) {
    const bookMoves = await fetchOpeningBookMoves(board.fen())

    return bookMoves
  }

  useEffect(() => {
    if (!currentNode || !enabled) return

    const board = new Chess(currentNode.fen)
    const nodeFen = currentNode.fen

    let maiaCancelled = false
    // Drops this position's Maia request if the user moves on before it
    // reaches the Maia worker (requests otherwise pile up while paging).
    const maiaController = new AbortController()

    // The selected rating first (one position, ~0.1 s on a desktop), so its
    // moves show at once. Then, on a desktop, every 400 points from 600 to
    // 2600, from which the moves-by-rating chart is drawn (the ratings in
    // between interpolated), the rest of every 200 points, and those in
    // between; on a phone every 200 points and no more (each rating takes
    // ~0.22 s there, ~0.05 s on a desktop; every 400 points first drew the
    // chart ~0.9 s sooner on an emulated phone, but Stockfish reached depth 12
    // ~0.5 s later, as the chart redraws for its changing top moves through
    // more of its search). Each stage is one
    // request, so a newer position never waits long behind it, and is added
    // as it arrives, keeping what the node already has.
    const ratings = (keep: (index: number) => boolean) =>
      MAIA_MODELS.filter((model, i) => keep(i) && model !== currentMaiaModel)
    const selected = MAIA_MODELS.includes(currentMaiaModel)
      ? [currentMaiaModel]
      : []
    const stages = isPhone()
      ? [selected, ratings((i) => i % 2 === 0)]
      : [
          selected,
          ratings((i) => i % 4 === 0),
          ratings((i) => i % 4 === 2),
          ratings((i) => i % 2 === 1),
        ]

    const attemptMaiaAnalysis = async () => {
      const hasAllModelAnalysis = stages.every((stage) =>
        stage.every((model) => !!currentNode?.analysis.maia?.[model]),
      )
      if (
        !currentNode ||
        hasAllModelAnalysis ||
        inProgressAnalyses.has(nodeFen)
      )
        return

      // Runs again when the model arrives.
      if (maia.status === 'no-cache' || maia.status === 'downloading') return

      // Add retry logic for Maia initialization
      let retries = 0
      const maxRetries = 30 // 3 seconds with 100ms intervals

      while (retries < maxRetries && maia.status !== 'ready') {
        await new Promise((resolve) => setTimeout(resolve, 100))
        retries++
      }

      if (maia.status !== 'ready') {
        console.warn('Maia not ready after waiting, skipping analysis')
        return
      }

      inProgressAnalyses.add(nodeFen)

      try {
        const openingBookPromise =
          currentNode.moveNumber <= 5
            ? fetchOpeningBook(board)
            : Promise.resolve(null)

        for (const stage of stages) {
          const missing = stage.filter(
            (model) => !currentNode.analysis.maia?.[model],
          )
          if (missing.length === 0) continue

          let maiaEvaluations: { [key: string]: MaiaEvaluation } = {}
          try {
            for (let i = 0; i < missing.length; i += MAIA_BATCH_SIZE) {
              Object.assign(
                maiaEvaluations,
                await inferenceMaiaModel(
                  board,
                  missing.slice(i, i + MAIA_BATCH_SIZE),
                  maiaController.signal,
                ),
              )
            }
          } catch (error) {
            if (maiaController.signal.aborted) return
            throw error
          }

          if (maiaCancelled) return

          const openingBookMoves = await openingBookPromise

          if (openingBookMoves && currentNode.moveNumber <= 5) {
            const analysis: { [key: string]: MaiaEvaluation } = {}
            for (const model of missing) {
              const policySource = Object.keys(openingBookMoves[model] || {})
                .length
                ? openingBookMoves[model]
                : maiaEvaluations[model].policy

              const sortedPolicy = Object.entries(policySource).sort(
                ([, a], [, b]) => (b as number) - (a as number),
              )

              analysis[model] = {
                value: maiaEvaluations[model].value,
                policy: Object.fromEntries(
                  sortedPolicy,
                ) as MaiaEvaluation['policy'],
              }
            }
            maiaEvaluations = analysis
          }
          currentNode.addMaiaAnalysis(
            { ...currentNode.analysis.maia, ...maiaEvaluations },
            currentMaiaModel,
          )
          analysisMaiaStage(nodeFen, stages.indexOf(stage))
          if (stage === stages[0]) {
            setAnalysisState((state) => state + 1)
          } else {
            // The other ratings only feed the moves-by-rating chart: render
            // them as a transition, in short slices, so that Stockfish's
            // messages (handled on the main thread) are not held up.
            startTransition(() => setAnalysisState((state) => state + 1))
          }
        }
      } finally {
        inProgressAnalyses.delete(nodeFen)
      }
    }

    const timeoutId = setTimeout(() => {
      attemptMaiaAnalysis()
    }, ANALYSIS_DELAY_MS)

    return () => {
      maiaCancelled = true
      maiaController.abort()
      clearTimeout(timeoutId)
    }
  }, [
    maia.status,
    currentNode,
    currentMaiaModel,
    inProgressAnalyses,
    maia,
    setAnalysisState,
    enabled,
  ])

  useEffect(() => {
    if (!currentNode || !enabled || !stockfishEnabled) return

    const shouldForceStockfishRerun =
      stockfishDebugRerunToken > lastConsumedStockfishRerunTokenRef.current
    if (shouldForceStockfishRerun) {
      lastConsumedStockfishRerunTokenRef.current = stockfishDebugRerunToken
    }

    if (
      currentNode.analysis.stockfish &&
      currentNode.analysis.stockfish?.depth >= targetDepth &&
      !currentNode.analysis.stockfish.partial &&
      !shouldForceStockfishRerun
    )
      return

    let cancelled = false

    // Add retry logic for Stockfish initialization
    const attemptStockfishAnalysis = async () => {
      // Wait longer for Stockfish to be ready on first load / slower devices.
      let retries = 0
      // 40 seconds with 100ms intervals: after reloads on an iPhone, Stockfish
      // may wait up to 27 s for memory to be released.
      const maxRetries = 400

      while (retries < maxRetries && !stockfish.isReady() && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        retries++
      }

      if (cancelled || !stockfish.isReady()) {
        if (!cancelled && stockfish.status === 'error') {
          console.warn('Stockfish not ready after waiting, skipping analysis')
        }
        return
      }

      const chess = new Chess(currentNode.fen)
      const legalMoves = new Set(
        chess
          .moves({ verbose: true })
          .map((move) => `${move.from}${move.to}${move.promotion || ''}`),
      )
      const playedMove = currentNode.mainChild?.move
      const forcedCandidateMoves =
        playedMove && legalMoves.has(playedMove) ? [playedMove] : []

      // Maia's likely moves (95% of its policy). Stockfish reads them again
      // when it reaches the phases that use them, so a policy that arrives
      // during the search (usually ~0.3 s after a move) is used without
      // restarting the search.
      const readMaiaCandidates = () => {
        const maiaPolicy = currentNode.analysis.maia?.[currentMaiaModel]?.policy
        const maiaCandidateMoves: string[] = []

        if (maiaPolicy) {
          let cumulative = 0
          const sortedMaiaMoves = Object.entries(maiaPolicy)
            .filter(([, prob]) => Number.isFinite(prob) && prob > 0)
            .sort(([, a], [, b]) => b - a)

          for (const [move, prob] of sortedMaiaMoves) {
            if (!legalMoves.has(move)) continue
            maiaCandidateMoves.push(move)
            cumulative += prob
            if (cumulative >= 0.95) {
              break
            }
          }
        }

        return { maiaCandidateMoves, maiaPolicy }
      }

      const evaluationStream = stockfish.streamEvaluations(
        chess.fen(),
        chess.moves().length,
        targetDepth,
        {
          ...readMaiaCandidates(),
          forcedCandidateMoves,
          getMaiaCandidates: readMaiaCandidates,
        },
      )

      if (evaluationStream && !cancelled) {
        const nodeForAnalysis = currentNode // Capture the node reference
        let lastRenderAt = 0
        let pendingRender: ReturnType<typeof setTimeout> | null = null
        const render = () => {
          pendingRender = null
          lastRenderAt = performance.now()
          // A transition renders in short slices, so the engine's messages
          // are handled in between instead of waiting for the whole page.
          startTransition(() => setAnalysisState((state) => state + 1))
        }
        try {
          for await (const evaluation of evaluationStream) {
            if (
              cancelled ||
              !nodeForAnalysis ||
              nodeForAnalysis !== currentNode
            ) {
              break
            }
            nodeForAnalysis.addStockfishAnalysis(evaluation, currentMaiaModel)
            analysisStockfishUpdate(nodeForAnalysis.fen, evaluation)
            // The first update renders at once, later ones at most every
            // STOCKFISH_RENDER_INTERVAL_MS (the last one always renders).
            const wait =
              lastRenderAt + STOCKFISH_RENDER_INTERVAL_MS - performance.now()
            if (wait <= 0) render()
            else if (pendingRender === null) {
              pendingRender = setTimeout(render, wait)
            }
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Stockfish evaluation error:', error)
          }
        }
      }
    }

    const timeoutId = setTimeout(() => {
      if (cancelled) return
      attemptStockfishAnalysis()
    }, ANALYSIS_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [
    currentNode,
    stockfish,
    currentMaiaModel,
    setAnalysisState,
    targetDepth,
    stockfishDebugRerunToken,
    currentNode?.mainChild?.move,
    enabled,
    stockfishEnabled,
  ])
}
