import { GameTree } from 'src/types'
import { MistakePosition } from 'src/types/analysis'
import { extractPlayerMistakes } from './analysis'

/**
 * Learn from mistakes keeps the list of a player's mistakes from the first
 * time a game is reviewed, so that reviewing the same game again goes through
 * the same mistakes.
 *
 * A move is a mistake when its win-rate loss, from Stockfish's analysis of the
 * position before it, passes a fixed threshold. Learn mode only asks for depth
 * 12 there, but a position keeps the deepest analysis it has had: browsing the
 * game afterwards (at depth 18 by default), or a cached deeper analysis, swaps
 * in a deeper search, and a move near a threshold can cross it either way. A
 * user saw 4 mistakes in a game, then 3 on the next review.
 *
 * Classifying at one fixed depth instead would need the depth-12 analysis of
 * each position kept alongside the deeper one the board shows (a position only
 * holds its deepest), and Stockfish's search isn't exactly reproducible across
 * runs anyway, so the list could still change. Keeping the first list is
 * simpler and makes the guarantee exact: the same moves give the same
 * mistakes, in this browser.
 *
 * The list is keyed by the game's moves rather than its id, so it holds for a
 * game however it was opened, and a game whose moves changed (a custom game
 * edited and saved again) gets a new list.
 */

const STORAGE_KEY = 'maia-learn-from-mistakes-v1'
// The most recent games kept; older ones are reviewed afresh.
const MAX_STORED_GAMES = 100

interface StoredMistakes {
  mistakes: MistakePosition[]
  savedAt: number
}

type MistakeStore = Record<string, StoredMistakes>

// A short, stable hash (FNV-1a, 32 bits) so a key doesn't hold a whole game.
const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export const mistakesKey = (
  gameTree: GameTree,
  playerColor: 'white' | 'black',
): string => {
  const moves = gameTree.toMoveArray()
  const text = [gameTree.getRoot().fen, ...moves].join(' ')
  // The move count is kept in the clear so that a hash collision would also
  // need games of the same length.
  return `${playerColor}:${moves.length}:${hash(text)}`
}

const readStore = (): MistakeStore => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeStore = (store: MistakeStore) => {
  try {
    const entries = Object.entries(store)
      .sort(([, a], [, b]) => b.savedAt - a.savedAt)
      .slice(0, MAX_STORED_GAMES)
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(entries)),
    )
  } catch {
    // Storage full or unavailable: the list just isn't kept.
  }
}

/**
 * Whether a kept list still fits the game: each mistake's move is still at
 * its place in the main line, after the same position.
 */
const fitsGame = (gameTree: GameTree, mistakes: MistakePosition[]) => {
  const mainLine = gameTree.getMainLine()
  return mistakes.every((mistake) => {
    const node = mainLine[mistake.moveIndex]
    return (
      !!node &&
      node.move === mistake.playedMove &&
      node.parent?.fen === mistake.fen
    )
  })
}

export const loadStoredMistakes = (
  gameTree: GameTree,
  playerColor: 'white' | 'black',
): MistakePosition[] | null => {
  const entry = readStore()[mistakesKey(gameTree, playerColor)]
  if (!entry || !Array.isArray(entry.mistakes)) return null
  return fitsGame(gameTree, entry.mistakes) ? entry.mistakes : null
}

export const storeMistakes = (
  gameTree: GameTree,
  playerColor: 'white' | 'black',
  mistakes: MistakePosition[],
) => {
  const store = readStore()
  store[mistakesKey(gameTree, playerColor)] = {
    mistakes,
    savedAt: Date.now(),
  }
  writeStore(store)
}

/**
 * The player's mistakes in the game: the list from its first review when there
 * is one, or else the mistakes found now, which are kept for next time.
 */
export const getStablePlayerMistakes = (
  gameTree: GameTree,
  playerColor: 'white' | 'black',
): MistakePosition[] => {
  const stored = loadStoredMistakes(gameTree, playerColor)
  if (stored) return stored

  const mistakes = extractPlayerMistakes(gameTree, playerColor)
  storeMistakes(gameTree, playerColor, mistakes)
  return mistakes
}
