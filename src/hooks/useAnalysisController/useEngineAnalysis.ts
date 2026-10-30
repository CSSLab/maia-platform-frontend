import { Chess } from 'chess.ts'
import { fetchOpeningBookMoves } from 'src/api'
import { useEffect, useContext, useRef, useState } from 'react'
import { MAIA_MODELS, MAIA_RATINGS } from 'src/constants/common'
import {
  STOCKFISH_DEBUG_RERUN_EVENT,
  STOCKFISH_DEBUG_RERUN_KEY,
} from 'src/constants/analysis'
import { GameNode, MaiaEvaluation } from 'src/types'
import { MaiaEngineContext, StockfishEngineContext } from 'src/contexts'

/** Ratings per Maia request after the selected one (~0.5 s for 10). */
const MAIA_BATCH_SIZE = 10

export const useEngineAnalysis = (
  currentNode: GameNode | null,
  inProgressAnalyses: Set<string>,
  currentMaiaModel: string,
  setAnalysisState: React.Dispatch<React.SetStateAction<number>>,
  targetDepth = 18,
  enabled = true,
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

    const attemptMaiaAnalysis = async () => {
      const hasAllModelAnalysis = MAIA_MODELS.every(
        (model) => !!currentNode?.analysis.maia?.[model],
      )
      if (
        !currentNode ||
        hasAllModelAnalysis ||
        inProgressAnalyses.has(nodeFen)
      )
        return

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

        // The selected rating first (one position, ~0.1 s), so its moves
        // show at once; then the other ratings (~0.05 s each), in batches
        // so that a newer position never waits long behind them. They are
        // added together, keeping what the node already has.
        const others = MAIA_MODELS.filter((model) => model !== currentMaiaModel)
        const stages = [
          MAIA_MODELS.includes(currentMaiaModel) ? [currentMaiaModel] : [],
          others,
        ]
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
          setAnalysisState((state) => state + 1)
        }
      } finally {
        inProgressAnalyses.delete(nodeFen)
      }
    }

    // Delay Maia analysis to prevent rapid fire when moving quickly
    const timeoutId = setTimeout(() => {
      attemptMaiaAnalysis()
    }, 100)

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
    if (!currentNode || !enabled) return

    const shouldForceStockfishRerun =
      stockfishDebugRerunToken > lastConsumedStockfishRerunTokenRef.current
    if (shouldForceStockfishRerun) {
      lastConsumedStockfishRerunTokenRef.current = stockfishDebugRerunToken
    }

    if (
      currentNode.analysis.stockfish &&
      currentNode.analysis.stockfish?.depth >= targetDepth &&
      !shouldForceStockfishRerun
    )
      return

    let cancelled = false

    // Add retry logic for Stockfish initialization
    const attemptStockfishAnalysis = async () => {
      // Wait longer for Stockfish to be ready on first load / slower devices.
      let retries = 0
      const maxRetries = 120 // 12 seconds with 100ms intervals

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
            setAnalysisState((state) => state + 1)
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Stockfish evaluation error:', error)
          }
        }
      }
    }

    // Delay Stockfish analysis to prevent rapid fire when moving quickly
    const timeoutId = setTimeout(() => {
      if (cancelled) return
      attemptStockfishAnalysis()
    }, 100)

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
  ])
}
