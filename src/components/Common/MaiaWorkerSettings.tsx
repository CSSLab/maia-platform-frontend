import { useEffect, useState } from 'react'
import {
  getMaiaWorkerSettings,
  maxMaiaWorkers,
  MAIA_WORKER_SETTINGS_EVENT,
  saveMaiaWorkerSettings,
} from 'src/lib/engine/workerSettings'
import {
  DRILL_REVIEW_DEPTH_EVENT,
  DrillReviewDepth,
  getDrillReviewDepth,
  saveDrillReviewDepth,
} from 'src/lib/engine/drillReviewSettings'

interface Props {
  id: string
  showDrillDepth?: boolean
}

export const MaiaWorkerSettings = ({ id, showDrillDepth = false }: Props) => {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(getMaiaWorkerSettings)
  const [drillDepth, setDrillDepth] = useState(getDrillReviewDepth)
  const [maxWorkers, setMaxWorkers] = useState(4)

  useEffect(() => {
    setMaxWorkers(maxMaiaWorkers(navigator.hardwareConcurrency))
    setSettings(getMaiaWorkerSettings())
    setDrillDepth(getDrillReviewDepth())
    const sync = () => setSettings(getMaiaWorkerSettings())
    const syncDepth = () => setDrillDepth(getDrillReviewDepth())
    window.addEventListener(MAIA_WORKER_SETTINGS_EVENT, sync)
    window.addEventListener(DRILL_REVIEW_DEPTH_EVENT, syncDepth)
    return () => {
      window.removeEventListener(MAIA_WORKER_SETTINGS_EVENT, sync)
      window.removeEventListener(DRILL_REVIEW_DEPTH_EVENT, syncDepth)
    }
  }, [])

  const change = (enabled: boolean, count: number) => {
    const next = { enabled, count }
    setSettings(next)
    saveMaiaWorkerSettings(next)
  }

  return (
    <div className="rounded border border-glass-border bg-glass p-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-primary"
      >
        Advanced performance settings
        <span className="material-symbols-outlined text-base">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && (
        <div
          id={`${id}-options`}
          className="mt-3 space-y-2 text-xs text-secondary"
        >
          <label className="flex items-center gap-2 text-primary">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => change(e.target.checked, settings.count)}
              className="accent-human-4"
            />
            Parallel Maia analysis
          </label>
          <label htmlFor={`${id}-count`} className="block">
            Analysis workers: {settings.enabled ? settings.count : 1}
          </label>
          <input
            id={`${id}-count`}
            type="range"
            min="1"
            max={maxWorkers}
            value={Math.min(settings.count, maxWorkers)}
            disabled={!settings.enabled || maxWorkers === 1}
            onChange={(e) => change(settings.enabled, Number(e.target.value))}
            className="w-full accent-human-4 disabled:opacity-50"
          />
          <p>
            Up to {maxWorkers} on this device. Used for local analysis in game
            reviews and drills. This controls Maia only; Stockfish loads and
            searches separately.
          </p>
          {showDrillDepth && (
            <div className="border-t border-glass-border pt-2">
              <label htmlFor={`${id}-depth`} className="block text-primary">
                Stockfish drill review
              </label>
              <select
                id={`${id}-depth`}
                value={drillDepth}
                onChange={(event) => {
                  const depth = Number(event.target.value) as DrillReviewDepth
                  setDrillDepth(depth)
                  saveDrillReviewDepth(depth)
                }}
                className="edge-dark-select mt-1 w-full rounded border border-glass-border bg-glass p-2 text-primary"
              >
                <option value={18}>Thorough (depth 18)</option>
                <option value={12}>Faster (depth 12)</option>
              </select>
              <p className="mt-1">
                Faster review searches less deeply and may change move ratings.
                Model loading time is unaffected.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
