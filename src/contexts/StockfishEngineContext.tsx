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
import {
  STOCKFISH_DEBUG_RERUN_EVENT,
  STOCKFISH_DEBUG_RERUN_KEY,
} from 'src/constants/analysis'
import Engine from 'src/lib/engine/stockfish'

const STOCKFISH_LOADING_TOAST_DELAY_MS = 800
const STOCKFISH_DEBUG_LOADING_KEY = 'maia.stockfishDebugLoading'
const SF_STRATEGY_KEY = 'maia.stockfishMoveMapStrategy'
const SF_DIAGNOSTICS_KEY = 'maia.stockfishDiagnostics'
const SF_DEBUG_PANEL_KEY = 'maia.stockfishDebugPanel'

const SF_STRATEGIES: StockfishMoveMapStrategy[] = [
  'staged-root-probe',
  'multipv-all',
  'searchmoves-all',
]

const isTruthy = (value: string | null | undefined): boolean => {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const isStockfishDebugLoadingEnabled = (): boolean => {
  if (typeof window !== 'undefined') {
    try {
      const localValue = window.localStorage.getItem(
        STOCKFISH_DEBUG_LOADING_KEY,
      )
      if (localValue !== null) return isTruthy(localValue)
    } catch {
      // ignore localStorage access failures
    }
  }

  return isTruthy(process.env.NEXT_PUBLIC_STOCKFISH_DEBUG_LOADING)
}

const getStockfishLoadingLabel = (
  engine: Engine | null,
  debugLoadingEnabled: boolean,
): string => {
  if (!debugLoadingEnabled) {
    return 'Loading Stockfish...'
  }

  if (!engine) return 'Loading Stockfish...'

  switch (engine.initializationPhase) {
    case 'checking-cache':
      return 'Checking local Stockfish cache...'
    case 'downloading-nnue':
      return 'Downloading Stockfish model weights...'
    case 'loading-nnue':
      return 'Loading Stockfish from local cache...'
    case 'loading-module':
      return 'Starting Stockfish engine...'
    default:
      return 'Loading Stockfish...'
  }
}

let sharedClientStockfishEngine: Engine | null = null

const getOrCreateStockfishEngine = (): Engine => {
  if (typeof window === 'undefined') {
    return new Engine()
  }

  if (
    !sharedClientStockfishEngine ||
    (sharedClientStockfishEngine.initializationError &&
      !sharedClientStockfishEngine.ready &&
      !sharedClientStockfishEngine.initializing)
  ) {
    sharedClientStockfishEngine = new Engine()
  }

  return sharedClientStockfishEngine
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

const formatMaiaProb = (value?: number): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${(value * 100).toFixed(1)}%`
}

const formatSelectedBy = (value?: 'sf-top' | 'maia-95' | 'both'): string => {
  if (!value) return '-'
  if (value === 'sf-top') return 'SF top-K'
  if (value === 'maia-95') return 'Maia 95%'
  return 'Both'
}

type MoveTableSortKey =
  | 'move'
  | 'cp'
  | 'depth'
  | 'phase'
  | 'selectedBy'
  | 'mateIn'
  | 'maiaProb'

type MoveTableSort = {
  key: MoveTableSortKey
  direction: 'asc' | 'desc'
}

type ComparisonTableSortKey =
  | 'move'
  | 'thisCp'
  | 'gtCp'
  | 'diff'
  | 'thisDepth'
  | 'gtDepth'
  | 'phase'
  | 'maiaProb'

type ComparisonTableSort = {
  key: ComparisonTableSortKey
  direction: 'asc' | 'desc'
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
  const [strategy, setStrategy] =
    useState<StockfishMoveMapStrategy>('staged-root-probe')
  const [runs, setRuns] = useState<StockfishEvaluation[]>([])
  const [selectedRunKey, setSelectedRunKey] = useState<string | null>(null)
  const [moveTableSort, setMoveTableSort] = useState<MoveTableSort>({
    key: 'cp',
    direction: 'desc',
  })
  const [comparisonTableSort, setComparisonTableSort] =
    useState<ComparisonTableSort>({
      key: 'diff',
      direction: 'desc',
    })

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
        'staged-root-probe'
      setStrategy(
        SF_STRATEGIES.includes(strategyRaw as StockfishMoveMapStrategy)
          ? (strategyRaw as StockfishMoveMapStrategy)
          : 'staged-root-probe',
      )

      const diagnosticsOn = isTruthy(
        window.localStorage.getItem(SF_DIAGNOSTICS_KEY) ??
          window.localStorage.getItem('stockfishDiagnostics') ??
          (process.env.NEXT_PUBLIC_STOCKFISH_DIAGNOSTICS || null),
      )
      setDiagnosticsEnabled(diagnosticsOn)

      const buffer = (window as WindowWithSfDiagnostics)
        .__maiaStockfishDiagnostics
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

    if (
      !selectedRunKey ||
      !runs.some((run) => getRunKey(run) === selectedRunKey)
    ) {
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
      new Set([
        ...Object.keys(selectedMoves),
        ...Object.keys(groundTruthMoves),
      ]),
    )

    return allMoves.map((move) => {
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
        maiaProb: s?.maiaProb,
      }
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

  const toggleMoveTableSort = useCallback((key: MoveTableSortKey) => {
    setMoveTableSort((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        }
      }
      return { key, direction: 'desc' }
    })
  }, [])

  const sortedMoveRows = useMemo(() => {
    const rows = Object.entries(selectedRun?.diagnostics?.moves || {}).map(
      ([move, info]) => ({
        move,
        info,
      }),
    )

    const directionMultiplier = moveTableSort.direction === 'asc' ? 1 : -1
    const textValue = (value?: string) => value || ''
    const numericValue = (value?: number) =>
      typeof value === 'number' && Number.isFinite(value)
        ? value
        : Number.NEGATIVE_INFINITY

    return rows.sort((a, b) => {
      let cmp = 0
      switch (moveTableSort.key) {
        case 'move':
          cmp = a.move.localeCompare(b.move)
          break
        case 'cp':
          cmp = numericValue(a.info.cp) - numericValue(b.info.cp)
          break
        case 'depth':
          cmp = numericValue(a.info.depth) - numericValue(b.info.depth)
          break
        case 'phase':
          cmp = textValue(a.info.phase).localeCompare(textValue(b.info.phase))
          break
        case 'selectedBy':
          cmp = textValue(a.info.selectedBy).localeCompare(
            textValue(b.info.selectedBy),
          )
          break
        case 'mateIn':
          cmp = numericValue(a.info.mateIn) - numericValue(b.info.mateIn)
          break
        case 'maiaProb':
          cmp = numericValue(a.info.maiaProb) - numericValue(b.info.maiaProb)
          break
      }

      if (cmp === 0) {
        return a.move.localeCompare(b.move)
      }
      return cmp * directionMultiplier
    })
  }, [selectedRun, moveTableSort])

  const sortIndicator = useCallback(
    (key: MoveTableSortKey) => {
      if (moveTableSort.key !== key) return '↕'
      return moveTableSort.direction === 'asc' ? '↑' : '↓'
    },
    [moveTableSort],
  )

  const toggleComparisonTableSort = useCallback(
    (key: ComparisonTableSortKey) => {
      setComparisonTableSort((prev) => {
        if (prev.key === key) {
          return {
            key,
            direction: prev.direction === 'asc' ? 'desc' : 'asc',
          }
        }
        return { key, direction: 'desc' }
      })
    },
    [],
  )

  const sortedComparisonRows = useMemo(() => {
    const rows = [...comparisonRows]
    const directionMultiplier = comparisonTableSort.direction === 'asc' ? 1 : -1
    const textValue = (value?: string) => value || ''
    const numericValue = (value?: number) =>
      typeof value === 'number' && Number.isFinite(value)
        ? value
        : Number.NEGATIVE_INFINITY

    return rows.sort((a, b) => {
      let cmp = 0
      switch (comparisonTableSort.key) {
        case 'move':
          cmp = a.move.localeCompare(b.move)
          break
        case 'thisCp':
          cmp = numericValue(a.selectedCp) - numericValue(b.selectedCp)
          break
        case 'gtCp':
          cmp = numericValue(a.groundTruthCp) - numericValue(b.groundTruthCp)
          break
        case 'diff':
          cmp = numericValue(a.absDiff) - numericValue(b.absDiff)
          break
        case 'thisDepth':
          cmp = numericValue(a.selectedDepth) - numericValue(b.selectedDepth)
          break
        case 'gtDepth':
          cmp =
            numericValue(a.groundTruthDepth) - numericValue(b.groundTruthDepth)
          break
        case 'phase':
          cmp = textValue(a.phase).localeCompare(textValue(b.phase))
          break
        case 'maiaProb':
          cmp = numericValue(a.maiaProb) - numericValue(b.maiaProb)
          break
      }

      if (cmp === 0) {
        return a.move.localeCompare(b.move)
      }
      return cmp * directionMultiplier
    })
  }, [comparisonRows, comparisonTableSort])

  const comparisonSortIndicator = useCallback(
    (key: ComparisonTableSortKey) => {
      if (comparisonTableSort.key !== key) return '↕'
      return comparisonTableSort.direction === 'asc' ? '↑' : '↓'
    },
    [comparisonTableSort],
  )

  const updateStrategy = useCallback(
    (nextStrategy: StockfishMoveMapStrategy) => {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(SF_STRATEGY_KEY, nextStrategy)
      setStrategy(nextStrategy)
    },
    [],
  )

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

  const triggerRerun = useCallback(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STOCKFISH_DEBUG_RERUN_KEY, `${Date.now()}`)
    window.dispatchEvent(
      new CustomEvent(STOCKFISH_DEBUG_RERUN_EVENT, {
        detail: { ts: Date.now() },
      }),
    )
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
      <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white/95 shadow-2xl backdrop-blur">
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
          <div className="space-y-3 overflow-y-auto p-3">
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
                  <button
                    type="button"
                    onClick={triggerRerun}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                    title="Force re-analyze the currently selected board node"
                  >
                    Re-run current node
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
                            {d?.strategy || 'unknown'} d
                            {d?.targetDepth ?? run.depth}
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
                      {selectedRun.model_move} (
                      {formatCp(selectedRun.model_optimal_cp)})
                    </div>
                    <div>
                      <span className="font-medium">Moves:</span>{' '}
                      {Object.keys(selectedRun.diagnostics.moves || {}).length}/
                      {selectedRun.diagnostics.legalMoveCount}
                    </div>
                    <div>
                      <span className="font-medium">Final@target:</span>{' '}
                      {selectedRun.diagnostics.moveCounts?.finalAtTargetDepth ??
                        '-'}
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
                  {Object.entries(selectedRun.diagnostics.phaseTimesMs || {})
                    .length ? (
                    Object.entries(
                      selectedRun.diagnostics.phaseTimesMs || {},
                    ).map(([phase, ms]) => (
                      <span
                        key={phase}
                        className="rounded bg-zinc-100 px-2 py-1 text-zinc-700"
                      >
                        {phase}: {formatMs(ms)}
                      </span>
                    ))
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
                  Ground-truth comparison (vs latest `searchmoves-all` same
                  FEN/depth)
                </div>
                {comparisonSummary && (
                  <div className="text-xs text-zinc-600">
                    MAE {comparisonSummary.mae.toFixed(1)} cp | Max{' '}
                    {comparisonSummary.max} cp | n=
                    {comparisonSummary.comparedMoves}
                  </div>
                )}
              </div>
              {!comparableGroundTruth ? (
                <div className="text-xs text-zinc-500">
                  No matching `searchmoves-all` run found for this FEN/target
                  depth.
                </div>
              ) : (
                <div className="max-h-56 overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-zinc-500">
                        <th className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() => toggleComparisonTableSort('move')}
                          >
                            Move {comparisonSortIndicator('move')}
                          </button>
                        </th>
                        <th className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() => toggleComparisonTableSort('thisCp')}
                          >
                            This cp {comparisonSortIndicator('thisCp')}
                          </button>
                        </th>
                        <th className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() => toggleComparisonTableSort('gtCp')}
                          >
                            GT cp {comparisonSortIndicator('gtCp')}
                          </button>
                        </th>
                        <th className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() => toggleComparisonTableSort('diff')}
                          >
                            |diff| {comparisonSortIndicator('diff')}
                          </button>
                        </th>
                        <th className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() =>
                              toggleComparisonTableSort('thisDepth')
                            }
                          >
                            Depth {comparisonSortIndicator('thisDepth')}
                          </button>
                        </th>
                        <th className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() => toggleComparisonTableSort('gtDepth')}
                          >
                            GT d {comparisonSortIndicator('gtDepth')}
                          </button>
                        </th>
                        <th className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() => toggleComparisonTableSort('phase')}
                          >
                            Phase {comparisonSortIndicator('phase')}
                          </button>
                        </th>
                        <th className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() =>
                              toggleComparisonTableSort('maiaProb')
                            }
                          >
                            Maia prob {comparisonSortIndicator('maiaProb')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedComparisonRows.map((row) => (
                        <tr key={row.move} className="border-t border-zinc-100">
                          <td className="px-1 py-1 font-mono text-zinc-800">
                            {row.move}
                          </td>
                          <td className="px-1 py-1">
                            {formatCp(row.selectedCp)}
                          </td>
                          <td className="px-1 py-1">
                            {formatCp(row.groundTruthCp)}
                          </td>
                          <td className="px-1 py-1">
                            {typeof row.absDiff === 'number'
                              ? row.absDiff
                              : '-'}
                          </td>
                          <td className="px-1 py-1">
                            {row.selectedDepth ?? '-'}
                          </td>
                          <td className="px-1 py-1">
                            {row.groundTruthDepth ?? '-'}
                          </td>
                          <td className="px-1 py-1">{row.phase || '-'}</td>
                          <td className="px-1 py-1">
                            {formatMaiaProb(row.maiaProb)}
                          </td>
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
                      <th className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => toggleMoveTableSort('move')}
                        >
                          Move {sortIndicator('move')}
                        </button>
                      </th>
                      <th className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => toggleMoveTableSort('cp')}
                        >
                          CP {sortIndicator('cp')}
                        </button>
                      </th>
                      <th className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => toggleMoveTableSort('depth')}
                        >
                          Depth {sortIndicator('depth')}
                        </button>
                      </th>
                      <th className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => toggleMoveTableSort('phase')}
                        >
                          Phase {sortIndicator('phase')}
                        </button>
                      </th>
                      <th className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => toggleMoveTableSort('selectedBy')}
                        >
                          Selected by {sortIndicator('selectedBy')}
                        </button>
                      </th>
                      <th className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => toggleMoveTableSort('mateIn')}
                        >
                          Mate {sortIndicator('mateIn')}
                        </button>
                      </th>
                      <th className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => toggleMoveTableSort('maiaProb')}
                        >
                          Maia prob {sortIndicator('maiaProb')}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMoveRows.map(({ move, info }) => (
                      <tr key={move} className="border-t border-zinc-100">
                        <td className="px-1 py-1 font-mono text-zinc-800">
                          {move}
                        </td>
                        <td className="px-1 py-1">{formatCp(info.cp)}</td>
                        <td className="px-1 py-1">{info.depth}</td>
                        <td className="px-1 py-1">{info.phase || '-'}</td>
                        <td className="px-1 py-1">
                          {formatSelectedBy(info.selectedBy)}
                        </td>
                        <td className="px-1 py-1">
                          {typeof info.mateIn === 'number' ? info.mateIn : '-'}
                        </td>
                        <td className="px-1 py-1">
                          {formatMaiaProb(info.maiaProb)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500">
              Global switches are stored in localStorage and apply to all
              client-side Stockfish analysis using this shared engine provider.
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
  if (!engineRef.current) {
    engineRef.current = getOrCreateStockfishEngine()
  }
  const [status, setStatus] = useState<StockfishStatus>(() => {
    if (engineRef.current?.initializationError) return 'error'
    return engineRef.current?.ready ? 'ready' : 'loading'
  })
  const [error, setError] = useState<string | null>(
    () => engineRef.current?.initializationError ?? null,
  )
  const [debugLoadingEnabled] = useState<boolean>(() =>
    isStockfishDebugLoadingEnabled(),
  )
  const [loadingLabel, setLoadingLabel] = useState<string>(() =>
    getStockfishLoadingLabel(engineRef.current, debugLoadingEnabled),
  )
  const toastId = useRef<string | null>(null)
  const loadingToastTimerRef = useRef<number | null>(null)

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
      const engine = engineRef.current
      if (!engine) return

      setLoadingLabel((prev) => {
        const next = getStockfishLoadingLabel(engine, debugLoadingEnabled)
        return prev === next ? prev : next
      })

      if (engine.initializationError) {
        setStatus('error')
        setError(engine.initializationError)
      } else if (engine.ready) {
        setStatus('ready')
        setError(null)
      } else {
        setStatus('loading')
      }
    }

    checkEngineStatus()
    const interval = setInterval(checkEngineStatus, 100)

    return () => clearInterval(interval)
  }, [debugLoadingEnabled])

  // Toast notifications for Stockfish engine status
  useEffect(() => {
    return () => {
      if (
        loadingToastTimerRef.current !== null &&
        typeof window !== 'undefined'
      ) {
        window.clearTimeout(loadingToastTimerRef.current)
        loadingToastTimerRef.current = null
      }
      if (toastId.current) {
        toast.dismiss(toastId.current)
        toastId.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') {
      if (typeof window === 'undefined') {
        return
      }

      if (toastId.current) {
        toastId.current = toast.loading(loadingLabel, { id: toastId.current })
        return
      }

      if (loadingToastTimerRef.current !== null) {
        return
      }

      loadingToastTimerRef.current = window.setTimeout(() => {
        loadingToastTimerRef.current = null
        if (!toastId.current && engineRef.current && !engineRef.current.ready) {
          toastId.current = toast.loading(
            getStockfishLoadingLabel(engineRef.current, debugLoadingEnabled),
          )
        }
      }, STOCKFISH_LOADING_TOAST_DELAY_MS)
      return
    }

    if (
      loadingToastTimerRef.current !== null &&
      typeof window !== 'undefined'
    ) {
      window.clearTimeout(loadingToastTimerRef.current)
      loadingToastTimerRef.current = null
    }

    if (status === 'ready') {
      // Only show a success toast when we previously showed a loading toast.
      if (toastId.current) {
        toast.success('Loaded Stockfish! Engine is ready', {
          id: toastId.current,
        })
        toastId.current = null
      }
    } else if (status === 'error') {
      const message = error
        ? `Failed to load Stockfish engine: ${error}`
        : 'Failed to load Stockfish engine'
      if (toastId.current) {
        toast.error(message, {
          id: toastId.current,
        })
        toastId.current = null
      } else {
        toast.error(message)
      }
    }
  }, [status, error, loadingLabel, debugLoadingEnabled])

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
