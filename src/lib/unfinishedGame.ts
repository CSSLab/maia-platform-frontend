import { PlayGameConfig } from 'src/types'

/**
 * The visitor's unfinished game against Maia, kept in this browser so that it
 * can be continued after the tab was closed or refreshed. Only unlimited and
 * practice games are kept: a rated game with clocks has to be played in one
 * sitting (paused clocks would let a player stop to look things up).
 *
 * The backend still has the game as unfinished (each move is sent to it), so
 * a continued game goes on with the same id. Starting another game resigns
 * it there, so this is cleared then too.
 */
export interface UnfinishedGame {
  id: string
  config: PlayGameConfig
  moves: string[]
  moveTimes: number[]
  // Each clock's time left (ms) at the last move; they're paused while away.
  whiteClock: number
  blackClock: number
  savedAt: number
}

const UNFINISHED_GAME_KEY = 'maia-unfinished-game'

// Older games aren't offered: the backend may well have ended them since
// (any game started elsewhere, on another device, resigns them).
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

export const canResume = (config: PlayGameConfig) =>
  config.playType === 'againstMaia' &&
  (config.timeControl === 'unlimited' || !!config.practice)

/** The settings that identify a game in /play/maia's address. */
const configKey = (config: PlayGameConfig) =>
  JSON.stringify([
    config.player,
    config.maiaVersion,
    config.timeControl,
    config.startFen || '',
    !!config.practice,
  ])

export const sameGameSettings = (a: PlayGameConfig, b: PlayGameConfig) =>
  configKey(a) === configKey(b)

export const loadUnfinishedGame = (): UnfinishedGame | null => {
  try {
    const stored = window.localStorage.getItem(UNFINISHED_GAME_KEY)
    if (!stored) return null
    const game = JSON.parse(stored) as UnfinishedGame
    const valid =
      typeof game?.id === 'string' &&
      Array.isArray(game.moves) &&
      game.moves.length > 0 &&
      Date.now() - game.savedAt < MAX_AGE_MS &&
      canResume(game.config)
    if (!valid) {
      window.localStorage.removeItem(UNFINISHED_GAME_KEY)
      return null
    }
    return game
  } catch {
    return null
  }
}

export const saveUnfinishedGame = (game: UnfinishedGame) => {
  try {
    window.localStorage.setItem(UNFINISHED_GAME_KEY, JSON.stringify(game))
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
}

/** Forgets the kept game (`id`: only if it's that one). */
export const clearUnfinishedGame = (id?: string) => {
  try {
    if (id !== undefined) {
      const stored = window.localStorage.getItem(UNFINISHED_GAME_KEY)
      if (!stored || (JSON.parse(stored) as UnfinishedGame).id !== id) return
    }
    window.localStorage.removeItem(UNFINISHED_GAME_KEY)
  } catch {
    // As above.
  }
}
