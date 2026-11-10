import { GameNode, GameTree } from 'src/types'
import { gameTreeToPgn, graftVariations, parsePgnWithVariations } from './pgn'

/**
 * Where you were in an analysis, kept for this tab.
 *
 * A browser closes a tab it has kept in the background for a while to free
 * memory (Chrome's Memory Saver; on phones, the system), and opens the page
 * again when you come back to it. That was most of
 * analysis_page_ended_unexpectedly, and you came back to the start of the
 * game, with the lines you had tried gone. The moves you added and the move
 * you were on are kept when the page goes into the background or is left,
 * and put back when the same page opens again in the tab.
 *
 * Session storage belongs to the tab and outlives the browser closing the
 * page, which is what this needs, and nothing else sees it.
 */

const STORAGE_KEY = 'maia.analysisPlace'
// A long game with many lines is a few tens of kB.
const MAX_PGN_LENGTH = 200_000

interface Place {
  // The game's type and id (see placeKey).
  game: string
  // The tree with every move added, as PGN.
  pgn: string
  // The moves from the start to the move on show.
  moves: string[]
}

const movesTo = (node: GameNode) => {
  const moves: string[] = []
  for (let at: GameNode | null = node; at?.move; at = at.parent) {
    moves.unshift(at.move)
  }
  return moves
}

/** The game a place belongs to. */
export const placeKey = (game: { type: string; id: string }) =>
  `${game.type}/${game.id}`

/** Keeps the tree's moves and the move on show, for the game. */
export const saveAnalysisPlace = (
  game: string,
  tree: GameTree,
  node: GameNode,
) => {
  try {
    const pgn = gameTreeToPgn(tree, {})
    if (pgn.length > MAX_PGN_LENGTH) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    const place: Place = { game, pgn, moves: movesTo(node) }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(place))
  } catch {
    // Without session storage the page opens at the start, as it did.
  }
}

const readPlace = (): Place | null => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const place = JSON.parse(raw)
    if (
      typeof place?.game !== 'string' ||
      typeof place.pgn !== 'string' ||
      !Array.isArray(place.moves)
    ) {
      return null
    }
    return place
  } catch {
    return null
  }
}

/**
 * Puts back the moves kept for the game into its tree, and returns the move
 * that was on show (null when nothing was kept for this game). The
 * moves kept are added to the game's own, so a game that changed since keeps
 * its moves and gains the ones that still fit.
 */
export const restoreAnalysisPlace = (
  game: string,
  tree: GameTree,
): GameNode | null => {
  const place = readPlace()
  if (!place || place.game !== game) return null

  const parsed = parsePgnWithVariations(place.pgn)
  if (parsed) graftVariations(tree, parsed.tree)

  let node = tree.getRoot()
  for (const move of place.moves) {
    const next = node.children.find((child) => child.move === move)
    if (!next) break
    node = next
  }
  return node
}

/**
 * Whether the page on show came from loading the page at `path` (a reload, or
 * the browser opening a tab again), not from moving between pages in the app.
 */
export const openedByPageLoad = (path: string) => {
  try {
    const navigation = performance.getEntriesByType?.('navigation')[0]
    return !!navigation && new URL(navigation.name).pathname === path
  } catch {
    return false
  }
}
