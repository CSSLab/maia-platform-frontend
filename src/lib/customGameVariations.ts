import { GameTree } from 'src/types'
import { graftVariations, hasVariations, parsePgnWithVariations } from './pgn'

/**
 * The variations of an imported PGN, kept in this browser by custom game id.
 *
 * The backend stores a custom game's main line only (the import sends it just
 * the main line, which is what its PGN parser is known to take), and the
 * analysis tree is built from what it sends back, so an imported game's
 * variations would be lost. The PGN is kept here when it has any, and they
 * are added back to the tree each time the game is opened, as the page does
 * with the result of an imported PGN. Opened in another browser, the game has
 * its main line only.
 */

const STORAGE_KEY = 'maia_custom_pgn_variations'
// The most recent imports kept, and the largest PGN kept (a long study
// chapter is a few tens of kB).
const MAX_STORED_GAMES = 50
const MAX_PGN_LENGTH = 200_000

interface StoredVariations {
  pgn: string
  savedAt: number
}

const readStore = (): Record<string, StoredVariations> => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeStore = (store: Record<string, StoredVariations>) => {
  try {
    const entries = Object.entries(store)
      .sort(([, a], [, b]) => b.savedAt - a.savedAt)
      .slice(0, MAX_STORED_GAMES)
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(entries)),
    )
  } catch {
    // Storage full or unavailable: the game opens with its main line only.
  }
}

/** Keeps the PGN's variations for the custom game, if it has any. */
export const saveImportedVariations = (gameId: string, pgn: string) => {
  if (!gameId || pgn.length > MAX_PGN_LENGTH) return
  const parsed = parsePgnWithVariations(pgn)
  if (!parsed || !hasVariations(parsed.tree)) return

  const store = readStore()
  store[gameId] = { pgn, savedAt: Date.now() }
  writeStore(store)
}

/**
 * Adds the kept variations of the custom game to its tree. Returns the
 * number of moves added.
 */
export const applyImportedVariations = (
  gameId: string,
  tree: GameTree,
): number => {
  const stored = readStore()[gameId]
  if (!stored?.pgn) return 0
  const parsed = parsePgnWithVariations(stored.pgn)
  return parsed ? graftVariations(tree, parsed.tree) : 0
}

export const forgetImportedVariations = (gameId: string) => {
  const store = readStore()
  if (!(gameId in store)) return
  delete store[gameId]
  writeStore(store)
}
