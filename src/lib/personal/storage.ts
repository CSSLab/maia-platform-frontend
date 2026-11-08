/**
 * localStorage and sessionStorage, each read and write wrapped: storage can
 * be unavailable (private windows, blocked site data) or full, and these
 * features then work for the page's lifetime from memory instead.
 */
type Area = 'local' | 'session'

const memory: Record<Area, Map<string, string>> = {
  local: new Map(),
  session: new Map(),
}

const area = (which: Area): Storage | null => {
  try {
    return which === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export const readJson = <T>(which: Area, key: string): T | null => {
  let raw: string | null
  const storage = area(which)
  try {
    if (!storage) throw new Error('no storage')
    raw = storage.getItem(key)
  } catch {
    // Unavailable: what this page kept in memory.
    raw = memory[which].get(key) ?? null
  }
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const writeJson = (which: Area, key: string, value: unknown) => {
  const raw = JSON.stringify(value)
  const storage = area(which)
  try {
    if (!storage) throw new Error('no storage')
    storage.setItem(key, raw)
    memory[which].delete(key)
  } catch {
    // Unavailable or full: kept in memory for this page.
    memory[which].set(key, raw)
  }
}

/** The local calendar day, as YYYY-MM-DD. */
export const localDay = (time = Date.now()) => {
  const date = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The day before a YYYY-MM-DD day. */
export const previousDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y, m - 1, d - 1).getTime())
}
