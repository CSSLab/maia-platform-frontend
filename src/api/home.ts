import { buildUrl } from './utils'
import { savedResponses } from 'src/lib/savedResponses'

// The home page's game counts: asked for on each visit and every five minutes
// while it is open. Within five minutes of the last answer, in any tab, that
// answer is used.
const savedStats = savedResponses<unknown>({
  name: 'globalStats',
  maxAgeMs: 5 * 60 * 1000,
})

export const getGlobalStats = async () => {
  const saved = savedStats.get('all')
  if (saved !== undefined) return saved

  const res = await fetch(buildUrl('auth/global_stats'))
  const data = await res.json()
  if (res.ok) savedStats.set('all', data)

  return data
}
