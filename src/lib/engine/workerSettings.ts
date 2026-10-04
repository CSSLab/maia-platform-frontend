export interface MaiaWorkerSettings {
  enabled: boolean
  count: number
}

export const MAIA_WORKER_SETTINGS_KEY = 'maia-worker-settings'
export const MAIA_WORKER_SETTINGS_EVENT = 'maia-worker-settings-changed'

// Each worker loads its own 44 MB model and ONNX session. Keep a core free for
// the board and Stockfish, and cap memory use on machines with many cores.
export const maxMaiaWorkers = (logicalCores?: number): number =>
  Math.min(4, Math.max(1, (logicalCores ?? 3) - 1))

export const defaultMaiaWorkers = (logicalCores?: number): number =>
  Math.min(2, maxMaiaWorkers(logicalCores))

export const readMaiaWorkerSettings = (
  logicalCores?: number,
  storage?: Pick<Storage, 'getItem'>,
): MaiaWorkerSettings => {
  const max = maxMaiaWorkers(logicalCores)
  const fallback = { enabled: true, count: defaultMaiaWorkers(logicalCores) }
  try {
    const raw = storage?.getItem(MAIA_WORKER_SETTINGS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      count: Number.isInteger(parsed.count)
        ? Math.min(max, Math.max(1, parsed.count))
        : fallback.count,
    }
  } catch {
    return fallback
  }
}

export const getMaiaWorkerSettings = (): MaiaWorkerSettings => {
  if (typeof window === 'undefined') return readMaiaWorkerSettings()
  try {
    return readMaiaWorkerSettings(
      navigator.hardwareConcurrency,
      window.localStorage,
    )
  } catch {
    return readMaiaWorkerSettings(navigator.hardwareConcurrency)
  }
}

export const saveMaiaWorkerSettings = (settings: MaiaWorkerSettings): void => {
  if (typeof window === 'undefined') return
  const count = Math.min(
    maxMaiaWorkers(navigator.hardwareConcurrency),
    Math.max(1, Math.trunc(settings.count) || 1),
  )
  const normalized = { enabled: settings.enabled, count }
  try {
    window.localStorage.setItem(
      MAIA_WORKER_SETTINGS_KEY,
      JSON.stringify(normalized),
    )
    window.dispatchEvent(new CustomEvent(MAIA_WORKER_SETTINGS_EVENT))
  } catch {
    // Private browsing or storage quota must not prevent a game from starting.
  }
}
