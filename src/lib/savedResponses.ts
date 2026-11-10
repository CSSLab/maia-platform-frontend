/**
 * Answers from the backend kept for a while in this browser, so that asking
 * again soon doesn't make another request. Every request through the site's
 * host (Vercel) is billed, and some answers hardly change: the site's game
 * counts, the leaderboard, an opening position's book moves.
 *
 * Kept in memory and in localStorage, so they last across reloads and are
 * shared by tabs. Without localStorage (a private window, blocked storage),
 * they last until the page is left.
 */
type Entry = { at: number; value: unknown }

export const savedResponses = <T>({
  name,
  maxAgeMs,
  maxEntries = 1,
}: {
  name: string
  maxAgeMs: number
  maxEntries?: number
}) => {
  const storageKey = `maia.saved.${name}`
  let entries: Record<string, Entry> | null = null

  const load = () => {
    if (entries) return entries
    entries = {}
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      if (stored && typeof stored === 'object') entries = stored
    } catch {
      // Unreadable or unavailable: start empty.
    }
    return entries as Record<string, Entry>
  }

  const isFresh = (entry: Entry | undefined, now: number) =>
    !!entry && now - entry.at >= 0 && now - entry.at < maxAgeMs

  return {
    /** The saved answer for `key`, if it is recent enough. */
    get(key: string): T | undefined {
      const entry = load()[key]
      return isFresh(entry, Date.now()) ? (entry.value as T) : undefined
    },

    set(key: string, value: T) {
      const now = Date.now()
      const kept = Object.entries(load())
        .filter(([k, entry]) => k !== key && isFresh(entry, now))
        .sort(([, a], [, b]) => b.at - a.at)
        .slice(0, maxEntries - 1)
      entries = Object.fromEntries([[key, { at: now, value }], ...kept])
      try {
        localStorage.setItem(storageKey, JSON.stringify(entries))
      } catch {
        // Full or unavailable: kept in memory only.
      }
    },
  }
}
