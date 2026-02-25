import React, {
  ReactNode,
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from 'react'
import toast from 'react-hot-toast'
import {
  StockfishStatus,
  StockfishEngine,
  StockfishEvaluation,
  StockfishMoveMapStrategy,
} from 'src/types'
import Engine from 'src/lib/engine/stockfish'

const SF_STRATEGY_KEY = 'maia.stockfishMoveMapStrategy'
const SF_DIAGNOSTICS_KEY = 'maia.stockfishDiagnostics'
const SF_DEBUG_PANEL_KEY = 'maia.stockfishDebugPanel'

const SF_STRATEGIES: StockfishMoveMapStrategy[] = [
  'multipv-all',
  'staged-root-probe',
  'searchmoves-all',
]

const isTruthy = (value: string | null | undefined): boolean => {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const getRunKey = (run: StockfishEvaluation): string => {
  const diagnostics = run.diagnostics
  if (!diagnostics) {
    return `${run.depth}:${run.model_move}:${Object.keys(run.cp_vec).length}`
  }
  return `${diagnostics.positionId}:${diagnostics.strategy}:${diagnostics.targetDepth}`
}

const formatMs = (value?: number): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${Math.round(value)} ms`
}

const formatCp = (value?: number): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return value > 0 ? `+${value}` : `${value}`
}

const summarizeFen = (fen?: string): string => {
  if (!fen) return '-'
  return fen.split(' ').slice(0, 2).join(' ')
}

type WindowWithSfDiagnostics = Window & {
  __maiaStockfishDiagnostics?: StockfishEvaluation[]
}

const StockfishDebugPanel: React.FC = () => {
  const [enabled, setEnabled] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(false)
  const [strategy, setStrategy] = useState<StockfishMoveMapStrategy>('multipv-all')
  const [runs, setRuns] = useState<StockfishEvaluation[]>([])
  const [selectedRunKey, setSelectedRunKey] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const sync = () => {
      const panelOn = isTruthy(
        window.localStorage.getItem(SF_DEBUG_PANEL_KEY) ??
          (process.env.NEXT_PUBLIC_STOCKFISH_DEBUG_PANEL || null),
      )
      setEnabled(panelOn)

      const strategyRaw =
        window.localStorage.getItem(SF_STRATEGY_KEY) ??
        window.localStorage.getItem('stockfishMoveMapStrategy') ??
        process.env.NEXT_PUBLIC_STOCKFISH_MOVE_MAP_STRATEGY ??
        'multipv-all'
      setStrategy(
        SF_STRATEGIES.includes(strategyRaw as StockfishMoveMapStrategy)
          ? (strategyRaw as StockfishMoveMapStrategy)
          : 'multipv-all',
      )

      const diagnosticsOn = isTruthy(
        window.localStorage.getItem(SF_DIAGNOSTICS_KEY) ??
          window.localStorage.getItem('stockfishDiagnostics') ??
          (process.env.NEXT_PUBLIC_STOCKFISH_DIAGNOSTICS || null),
      )
      setDiagnosticsEnabled(diagnosticsOn)

      const buffer = (window as WindowWithSfDiagnostics).__maiaStockfishDiagnostics
      setRuns([...(buffer || [])].reverse())
    }

    sync()
    const interval = window.setInterval(sync, 500)
    window.addEventListener('storage', sync)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    if (!runs.length) {
      setSelectedRunKey(null)
      return
    }

    if (!selectedRunKey || !runs.some((run) => getRunKey(run) === selectedRunKey)) {
      setSelectedRunKey(getRunKey(runs[0]))
    }
  }, [runs, selectedRunKey])

  const selectedRun = useMemo(() => {
    if (!selectedRunKey) return runs[0]
    return runs.find((run) => getRunKey(run) === selectedRunKey) || runs[0]
  }, [runs, selectedRunKey])

  const comparableGroundTruth = useMemo(() => {
    if (!selectedRun?.diagnostics) return null
    return (
      runs.find((run) => {
        if (run === selectedRun) return false
        const d = run.diagnostics
        if (!d) return false
        return (
          d.strategy === 'searchmoves-all' &&
          d.fen === selectedRun.diagnostics?.fen &&
          d.targetDepth === selectedRun.diagnostics?.targetDepth
        )
      }) || null
    )
  }, [runs, selectedRun])

  const comparisonRows = useMemo(() => {
    if (!selectedRun) return []

    const selectedMoves = selectedRun.diagnostics?.moves || {}
    const groundTruthMoves = comparableGroundTruth?.diagnostics?.moves || {}
    const allMoves = Array.from(
      new Set([...Object.keys(selectedMoves), ...Object.keys(groundTruthMoves)]),
    )

    return allMoves
      .map((move) => {
        const s = selectedMoves[move]
        const g = groundTruthMoves[move]
        const absDiff =
          typeof s?.cp === 'number' && typeof g?.cp === 'number'
            ? Math.abs(s.cp - g.cp)
            : undefined
        return {
          move,
          selectedCp: s?.cp,
          groundTruthCp: g?.cp,
          absDiff,
          selectedDepth: s?.depth,
          groundTruthDepth: g?.depth,
          phase: s?.phase,
          mateIn: s?.mateIn,
        }
      })
      .sort((a, b) => {
        const diffA = a.absDiff ?? -1
        const diffB = b.absDiff ?? -1
        if (diffB !== diffA) return diffB - diffA
        return (b.selectedCp ?? -Infinity) - (a.selectedCp ?? -Infinity)
      })
  }, [selectedRun, comparableGroundTruth])

  const comparisonSummary = useMemo(() => {
    const diffs = comparisonRows
      .map((row) => row.absDiff)
      .filter((v): v is number => typeof v === 'number')
    if (!diffs.length) return null
    const mae = diffs.reduce((sum, v) => sum + v, 0) / diffs.length
    const max = Math.max(...diffs)
    return { mae, max, comparedMoves: diffs.length }
  }, [comparisonRows])

  const updateStrategy = useCallback((nextStrategy: StockfishMoveMapStrategy) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SF_STRATEGY_KEY, nextStrategy)
    setStrategy(nextStrategy)
  }, [])

  const updateDiagnosticsFlag = useCallback((nextValue: boolean) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SF_DIAGNOSTICS_KEY, nextValue ? '1' : '0')
    setDiagnosticsEnabled(nextValue)
  }, [])

  const clearRuns = useCallback(() => {
    if (typeof window === 'undefined') return
    ;(window as WindowWithSfDiagnostics).__maiaStockfishDiagnostics = []
    setRuns([])
  }, [])

  const hidePanel = useCallback(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SF_DEBUG_PANEL_KEY, '0')
    setEnabled(false)
  }, [])

  if (!enabled) {
    return null
  }

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-[1000] w-[min(92vw,560px)]">
      <div className="rounded-xl border border-zinc-300 bg-white/95 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Stockfish Debug
            </div>
            <div className="truncate text-sm text-zinc-700">
              {statusLabel(selectedRun)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
            >
              {collapsed ? 'Open' : 'Collapse'}
            </button>
            <button
              type="button"
              onClick={hidePanel}
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
            >
              Hide
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                Strategy (global)
                <select
                  value={strategy}
                  onChange={(e) =>
                    updateStrategy(e.target.value as StockfishMoveMapStrategy)
                  }
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900"
                >
                  {SF_STRATEGIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-1 text-xs text-zinc-600">
                <span>Controls</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={diagnosticsEnabled}
                      onChange={(e) => updateDiagnosticsFlag(e.target.checked)}
                    />
                    Console logs
                  </label>
                  <button
                    type="button"
                    onClick={clearRuns}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                  >
                    Clear runs
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded border border-zinc-200 p-2">
                <div className="mb-1 text-xs font-medium text-zinc-700">
                  Recent runs ({runs.length})
                </div>
                <div className="max-h-40 space-y-1 overflow-auto">
                  {runs.length === 0 && (
                    <div className="text-xs text-zinc-500">
                      No diagnostics yet. Run analysis on any supported page.
                    </div>
                  )}
                  {runs.map((run) => {
                    const key = getRunKey(run)
                    const d = run.diagnostics
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedRunKey(key)}
                        className={`block w-full rounded border px-2 py-1 text-left text-xs ${
                          selectedRunKey === key
                            ? 'border-red-300 bg-red-50'
                            : 'border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-zinc-800">
                            {d?.strategy || 'unknown'} d{d?.targetDepth ?? run.depth}
                          </span>
                          <span className="text-zinc-500">
                            {formatMs(d?.totalTimeMs)}
                          </span>
                        </div>
                        <div className="truncate text-zinc-500">
                          {summarizeFen(d?.fen)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded border border-zinc-200 p-2">
                <div className="mb-1 text-xs font-medium text-zinc-700">
                  Selected summary
                </div>
                {selectedRun?.diagnostics ? (
                  <div className="space-y-1 text-xs text-zinc-700">
                    <div>
                      <span className="font-medium">Strategy:</span>{' '}
                      {selectedRun.diagnostics.strategy}
                    </div>
                    <div>
                      <span className="font-medium">Timing:</span>{' '}
                      {formatMs(selectedRun.diagnostics.totalTimeMs)}
                    </div>
                    <div>
                      <span className="font-medium">Best:</span>{' '}
                      {selectedRun.model_move} ({formatCp(selectedRun.model_optimal_cp)})
                    </div>
                    <div>
                      <span className="font-medium">Moves:</span>{' '}
                      {Object.keys(selectedRun.diagnostics.moves || {}).length}/
                      {selectedRun.diagnostics.legalMoveCount}
                    </div>
                    <div>
                      <span className="font-medium">Final@target:</span>{' '}
                      {selectedRun.diagnostics.moveCounts?.finalAtTargetDepth ?? '-'}
                    </div>
                    <div>
                      <span className="font-medium">Screened/Deepened:</span>{' '}
                      {selectedRun.diagnostics.moveCounts?.screened ?? 0}/
                      {selectedRun.diagnostics.moveCounts?.deepened ?? 0}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">Select a run.</div>
                )}
              </div>
            </div>

            {selectedRun?.diagnostics && (
              <div className="rounded border border-zinc-200 p-2">
                <div className="mb-1 text-xs font-medium text-zinc-700">
                  Phase timings
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(selectedRun.diagnostics.phaseTimesMs || {}).length ? (
                    Object.entries(selectedRun.diagnostics.phaseTimesMs || {}).map(
                      ([phase, ms]) => (
                        <span
                          key={phase}
                          className="rounded bg-zinc-100 px-2 py-1 text-zinc-700"
                        >
                          {phase}: {formatMs(ms)}
                        </span>
                      ),
                    )
                  ) : (
                    <span className="text-zinc-500">
                      Not broken out for this strategy/depth snapshot.
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="rounded border border-zinc-200 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-zinc-700">
                  Ground-truth comparison (vs latest `searchmoves-all` same FEN/depth)
                </div>
                {comparisonSummary && (
                  <div className="text-xs text-zinc-600">
                    MAE {comparisonSummary.mae.toFixed(1)} cp | Max{' '}
                    {comparisonSummary.max} cp | n={comparisonSummary.comparedMoves}
                  </div>
                )}
              </div>
              {!comparableGroundTruth ? (
                <div className="text-xs text-zinc-500">
                  No matching `searchmoves-all` run found for this FEN/target depth.
                </div>
              ) : (
                <div className="max-h-56 overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-zinc-500">
                        <th className="px-1 py-1">Move</th>
                        <th className="px-1 py-1">This cp</th>
                        <th className="px-1 py-1">GT cp</th>
                        <th className="px-1 py-1">|diff|</th>
                        <th className="px-1 py-1">Depth</th>
                        <th className="px-1 py-1">GT d</th>
                        <th className="px-1 py-1">Phase</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row) => (
                        <tr key={row.move} className="border-t border-zinc-100">
                          <td className="px-1 py-1 font-mono text-zinc-800">
                            {row.move}
                          </td>
                          <td className="px-1 py-1">{formatCp(row.selectedCp)}</td>
                          <td className="px-1 py-1">{formatCp(row.groundTruthCp)}</td>
                          <td className="px-1 py-1">
                            {typeof row.absDiff === 'number' ? row.absDiff : '-'}
                          </td>
                          <td className="px-1 py-1">{row.selectedDepth ?? '-'}</td>
                          <td className="px-1 py-1">{row.groundTruthDepth ?? '-'}</td>
                          <td className="px-1 py-1">{row.phase || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded border border-zinc-200 p-2">
              <div className="mb-1 text-xs font-medium text-zinc-700">
                Selected run moves/evals
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-zinc-500">
                      <th className="px-1 py-1">Move</th>
                      <th className="px-1 py-1">CP</th>
                      <th className="px-1 py-1">Depth</th>
                      <th className="px-1 py-1">Phase</th>
                      <th className="px-1 py-1">Mate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedRun?.diagnostics?.moves || {})
                      .sort(([, a], [, b]) => b.cp - a.cp)
                      .map(([move, info]) => (
                        <tr key={move} className="border-t border-zinc-100">
                          <td className="px-1 py-1 font-mono text-zinc-800">{move}</td>
                          <td className="px-1 py-1">{formatCp(info.cp)}</td>
                          <td className="px-1 py-1">{info.depth}</td>
                          <td className="px-1 py-1">{info.phase || '-'}</td>
                          <td className="px-1 py-1">
                            {typeof info.mateIn === 'number' ? info.mateIn : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500">
              Global switches are stored in localStorage and apply to all client-side
              Stockfish analysis using this shared engine provider.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const statusLabel = (run?: StockfishEvaluation): string => {
  if (!run?.diagnostics) return 'No diagnostic snapshots yet'
  const d = run.diagnostics
  return `${d.strategy} • d${run.depth}/${d.targetDepth} • ${formatMs(
    d.totalTimeMs,
  )} • ${d.legalMoveCount} legal`
}

export const StockfishEngineContext = React.createContext<StockfishEngine>({
  streamEvaluations: () => {
    throw new Error(
      'poorly provided StockfishEngineContext, missing streamEvaluations',
    )
  },
  stopEvaluation: () => {
    throw new Error(
      'poorly provided StockfishEngineContext, missing stopEvaluation',
    )
  },
  isReady: () => {
    throw new Error('poorly provided StockfishEngineContext, missing isReady')
  },
  status: 'loading',
  error: null,
})

export const StockfishEngineContextProvider: React.FC<{
  children: ReactNode
}> = ({ children }: { children: ReactNode }) => {
  const engineRef = useRef<Engine | null>(null)
  const [status, setStatus] = useState<StockfishStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const toastId = useRef<string | null>(null)

  if (!engineRef.current) {
    engineRef.current = new Engine()
  }

  const streamEvaluations = useCallback(
    (
      fen: string,
      legalMoveCount: number,
      depth?: number,
      options?: Parameters<StockfishEngine['streamEvaluations']>[3],
    ) => {
      if (!engineRef.current) {
        console.error('Engine not initialized')
        return null
      }
      return engineRef.current.streamEvaluations(
        fen,
        legalMoveCount,
        depth,
        options,
      )
    },
    [],
  )

  const stopEvaluation = useCallback(() => {
    engineRef.current?.stopEvaluation()
  }, [])

  const isReady = useCallback(() => {
    return engineRef.current?.ready ?? false
  }, [])

  useEffect(() => {
    const checkEngineStatus = () => {
      if (engineRef.current?.ready) {
        setStatus('ready')
        setError(null)
      } else if (engineRef.current && !engineRef.current.ready) {
        setStatus('loading')
      }
    }

    checkEngineStatus()
    const interval = setInterval(checkEngineStatus, 100)

    return () => clearInterval(interval)
  }, [])

  // Toast notifications for Stockfish engine status
  useEffect(() => {
    return () => {
      toast.dismiss()
    }
  }, [])

  useEffect(() => {
    if (status === 'loading' && !toastId.current) {
      toastId.current = toast.loading('Loading Stockfish Engine...')
    } else if (status === 'ready') {
      if (toastId.current) {
        toast.success('Loaded Stockfish! Engine is ready', {
          id: toastId.current,
        })
        toastId.current = null
      } else {
        toast.success('Loaded Stockfish! Engine is ready')
      }
    } else if (status === 'error') {
      if (toastId.current) {
        toast.error('Failed to load Stockfish engine', {
          id: toastId.current,
        })
        toastId.current = null
      } else {
        toast.error('Failed to load Stockfish engine')
      }
    }
  }, [status])

  const contextValue = useMemo(
    () => ({
      streamEvaluations,
      stopEvaluation,
      isReady,
      status,
      error,
    }),
    [streamEvaluations, stopEvaluation, isReady, status, error],
  )

  return (
    <StockfishEngineContext.Provider value={contextValue}>
      {children}
      <StockfishDebugPanel />
    </StockfishEngineContext.Provider>
  )
}
