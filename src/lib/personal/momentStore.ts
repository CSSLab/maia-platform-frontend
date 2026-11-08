import { KeyMoment } from './keyMoments'
import { readJson, writeJson } from './storage'

/**
 * The key moments found in the visitor's games, kept in this browser so a
 * game is analysed once, and so "Practice your mistakes" has positions to
 * draw from. Only positions and moves are kept, no names.
 */
export interface GameMoments {
  gameId: string
  /** Where the game opens in analysis: lichess, play, hand or brain. */
  gameType: string
  color: 'white' | 'black'
  moments: KeyMoment[]
  usedMaia: boolean
  opponentRating?: number
  savedAt: number
}

const KEY = 'maia.gameMoments.v1'
// The most recent games kept.
const MAX_GAMES = 30

type Store = Record<string, GameMoments>

const read = (): Store => {
  const store = readJson<Store>('local', KEY)
  return store && typeof store === 'object' ? store : {}
}

export const loadGameMoments = (gameId: string): GameMoments | null =>
  read()[gameId] ?? null

export const saveGameMoments = (entry: GameMoments) => {
  const store = read()
  store[entry.gameId] = entry
  const kept = Object.values(store)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_GAMES)
  writeJson('local', KEY, Object.fromEntries(kept.map((g) => [g.gameId, g])))
}

export const allGameMoments = (): GameMoments[] =>
  Object.values(read()).sort((a, b) => b.savedAt - a.savedAt)

/** Where a moment opens in analysis: the position before the move. */
export const momentHref = (
  game: Pick<GameMoments, 'gameId' | 'gameType'>,
  moment: Pick<KeyMoment, 'moveIndex'>,
) => `/analysis/${game.gameId}/${game.gameType}?ply=${moment.moveIndex - 1}`
