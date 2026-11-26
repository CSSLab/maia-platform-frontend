/*
 * The visitor's own results in position challenges (the WCh Maia
 * Challenge), kept in this browser: how many times they tried each one, how
 * it went, and which Maia levels they beat. Recorded by the play page when
 * a challenge game ends, so a win counts even if they never go back.
 */
const KEY = 'maia-challenge-results'
/** The games already counted, so a game is counted once. */
const SEEN = 40
/** The tries kept, for the share card's row of marks. */
const HISTORY = 30

export type ChallengeOutcome = 'win' | 'draw' | 'loss'

export interface ChallengeGame {
  outcome: ChallengeOutcome
  /** Whether it passed the challenge (a win, or a draw where that's enough). */
  passed?: boolean
  /** The Maia level played. */
  level?: number
  /** The player's own moves in the game. */
  moves?: number
}

export interface ChallengeTally {
  tries: number
  wins: number
  draws: number
  /** The Maia levels passed, lowest first. */
  beaten: number[]
  /** The best pass: the highest level, and the fewest moves at it. */
  best?: ChallengeGame
  /** The last game played. */
  last?: ChallengeGame
  /** Every try in order, a letter each: p passed, d drew (not a pass), l lost. */
  history?: string
}

interface Stored {
  tallies: Record<string, ChallengeTally>
  games: string[]
}

const read = (): Stored => {
  try {
    const raw = window.localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as Partial<Stored>) : {}
    return {
      tallies: v.tallies && typeof v.tallies === 'object' ? v.tallies : {},
      games: Array.isArray(v.games) ? v.games : [],
    }
  } catch {
    return { tallies: {}, games: [] }
  }
}

export const readChallengeTallies = (): Record<string, ChallengeTally> => {
  if (typeof window === 'undefined') return {}
  const { tallies } = read()
  return Object.fromEntries(
    Object.entries(tallies).map(([k, t]) => [
      k,
      { ...t, beaten: Array.isArray(t.beaten) ? t.beaten : [] },
    ]),
  )
}

/** Whether win `a` is better than win `b`: a higher level, else fewer moves. */
const better = (a: ChallengeGame, b: ChallengeGame | undefined) =>
  !b ||
  (a.level ?? 0) > (b.level ?? 0) ||
  ((a.level ?? 0) === (b.level ?? 0) && (a.moves ?? 1e9) < (b.moves ?? 1e9))

/** Counts a finished challenge game once (by its game id). */
export const recordChallengeResult = (
  challengeId: string,
  gameId: string,
  outcome: ChallengeOutcome,
  level?: number,
  moves?: number,
  /** Whether it passed; a win, unless the caller says otherwise. */
  passed: boolean = outcome === 'win',
) => {
  if (typeof window === 'undefined') return
  const s = read()
  if (s.games.includes(gameId)) return
  const t = s.tallies[challengeId] ?? {
    tries: 0,
    wins: 0,
    draws: 0,
    beaten: [],
  }
  const beaten = Array.isArray(t.beaten) ? t.beaten : []
  const game: ChallengeGame = { outcome, passed, level, moves }
  s.tallies[challengeId] = {
    tries: t.tries + 1,
    wins: t.wins + (outcome === 'win' ? 1 : 0),
    draws: t.draws + (outcome === 'draw' ? 1 : 0),
    beaten:
      passed && level && !beaten.includes(level)
        ? [...beaten, level].sort((a, b) => a - b)
        : beaten,
    best: passed && better(game, t.best) ? game : t.best,
    last: game,
    history:
      `${t.history ?? ''}${passed ? 'p' : outcome === 'draw' ? 'd' : 'l'}`.slice(
        -HISTORY,
      ),
  }
  s.games = [...s.games, gameId].slice(-SEEN)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Storage is full or off: the result just isn't kept.
  }
}
