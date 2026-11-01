// Games against Maia are stored with the opponent as "maia_kdd_<rating>" and
// no reliable model (the backend records every game as maia1), so the model
// is told by when the game was played: the play pages moved from Maia-1 to
// Maia-2 on 2025-07-12 (#49) and to Maia-3 on 2026-02-09 (555a92d).
const MAIA_2_FROM = Date.parse('2025-07-12T16:35:00Z')
const MAIA_3_FROM = Date.parse('2026-02-09T09:42:00Z')

// The backend sends times in UTC without a zone, with microseconds.
const parseUtc = (time: string) => {
  const iso = time.replace(/(\.\d{3})\d+/, '$1')
  return Date.parse(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : `${iso}Z`)
}

export const getMaiaModelVersion = (createdTime?: string | null) => {
  const time = createdTime ? parseUtc(createdTime) : NaN
  if (Number.isNaN(time) || time >= MAIA_3_FROM) return 'Maia-3'
  return time >= MAIA_2_FROM ? 'Maia-2' : 'Maia-1'
}

// "maia_kdd_1100" → "Maia-3 1100", or Maia-2/Maia-1 for older games.
export const formatMaiaName = (maiaName: string, createdTime?: string | null) =>
  maiaName.replace(/maia_kdd_/i, `${getMaiaModelVersion(createdTime)} `)
