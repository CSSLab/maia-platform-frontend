import { KeyMoment } from './keyMoments'
import { GameMoments, allGameMoments } from './momentStore'
import { localDay, previousDay, readJson, writeJson } from './storage'

/**
 * "Practice your mistakes": three positions a day from the visitor's own
 * mistakes, with the day's progress and a streak of days completed, kept in
 * this browser (in memory when storage is unavailable).
 */
export const POSITIONS_PER_DAY = 3
export const ATTEMPTS_PER_POSITION = 2
// The streak shows from this many days in a row.
export const STREAK_SHOWN_FROM = 2

export interface PracticePosition extends KeyMoment {
  id: string
  gameId: string
  gameType: string
  color: 'white' | 'black'
  opponentRating?: number
}

export interface PracticeAnswer {
  correct: boolean
  attempts: number
  answer: string
}

export interface PracticeDay {
  day: string
  positions: PracticePosition[]
  answers: Record<string, PracticeAnswer>
}

export interface PracticeStreak {
  lastDay: string
  days: number
}

const DAY_KEY = 'maia.practiceDay.v1'
const STREAK_KEY = 'maia.practiceStreak.v1'
const SEEN_KEY = 'maia.practiceSeen.v1'
const MAX_SEEN = 300

export const positionId = (gameId: string, moment: KeyMoment) =>
  `${gameId}:${moment.moveIndex}`

const toPositions = (game: GameMoments): PracticePosition[] =>
  game.moments.map((moment) => ({
    ...moment,
    id: positionId(game.gameId, moment),
    gameId: game.gameId,
    gameType: game.gameType,
    color: game.color,
    opponentRating: game.opponentRating,
  }))

const seenIds = () => new Set(readJson<string[]>('local', SEEN_KEY) ?? [])

const markSeen = (ids: string[]) => {
  const seen = [...seenIds(), ...ids]
  writeJson('local', SEEN_KEY, Array.from(new Set(seen)).slice(-MAX_SEEN))
}

/**
 * Positions not practised before, `first` (a game just played) first, then
 * the biggest mistakes of the most recent games.
 */
export const practicePool = (first?: GameMoments): PracticePosition[] => {
  const seen = seenIds()
  const games = allGameMoments().filter((g) => g.gameId !== first?.gameId)
  const fromFirst = first ? toPositions(first) : []
  const rest = games
    .flatMap(toPositions)
    .sort((a, b) => b.winrateLoss - a.winrateLoss)
  return [...fromFirst, ...rest].filter((p) => !seen.has(p.id))
}

export const loadStreak = (today = localDay()): PracticeStreak => {
  const streak = readJson<PracticeStreak>('local', STREAK_KEY)
  if (!streak || typeof streak.days !== 'number')
    return { lastDay: '', days: 0 }
  // Broken if neither today nor yesterday was completed.
  if (streak.lastDay !== today && streak.lastDay !== previousDay(today)) {
    return { lastDay: streak.lastDay, days: 0 }
  }
  return streak
}

/**
 * Today's positions: chosen on the day's first visit and kept for the day,
 * except that positions not yet answered make way for `first`'s (a game just
 * played, opened from its end).
 */
export const loadPracticeDay = (
  first?: GameMoments,
  today = localDay(),
): PracticeDay => {
  const kept = readJson<PracticeDay>('local', DAY_KEY)
  const keptToday =
    kept && kept.day === today && Array.isArray(kept.positions) ? kept : null
  const answered = keptToday
    ? keptToday.positions.filter((p) => keptToday.answers[p.id])
    : []
  const needsFill =
    !keptToday ||
    keptToday.positions.length < POSITIONS_PER_DAY ||
    (!!first &&
      answered.length < POSITIONS_PER_DAY &&
      !keptToday.positions.some((p) => p.gameId === first.gameId))
  if (keptToday && !needsFill) return keptToday

  const taken = new Set(answered.map((p) => p.id))
  const fill = practicePool(first)
    .filter((p) => !taken.has(p.id))
    .slice(0, POSITIONS_PER_DAY - answered.length)
  const day: PracticeDay = {
    day: today,
    positions: [...answered, ...fill],
    answers: keptToday?.answers ?? {},
  }
  writeJson('local', DAY_KEY, day)
  return day
}

/** Every position of the day answered (a day may have fewer than three). */
export const isDayComplete = (day: PracticeDay) =>
  day.positions.length > 0 && day.positions.every((p) => day.answers[p.id])

/**
 * Records a position's final answer. Returns the streak, counted when the
 * day's last position is answered.
 */
export const recordAnswer = (
  day: PracticeDay,
  id: string,
  answer: PracticeAnswer,
  today = localDay(),
): { day: PracticeDay; streak: PracticeStreak; completedNow: boolean } => {
  const wasComplete = isDayComplete(day)
  const next: PracticeDay = {
    ...day,
    answers: { ...day.answers, [id]: answer },
  }
  writeJson('local', DAY_KEY, next)
  markSeen([id])
  let streak = loadStreak(today)
  const completedNow = !wasComplete && isDayComplete(next)
  if (completedNow && streak.lastDay !== today) {
    streak = {
      lastDay: today,
      days: streak.lastDay === previousDay(today) ? streak.days + 1 : 1,
    }
    writeJson('local', STREAK_KEY, streak)
  }
  return { day: next, streak, completedNow }
}
