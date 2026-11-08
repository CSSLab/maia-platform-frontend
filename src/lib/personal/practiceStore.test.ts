import { KeyMoment } from './keyMoments'
import { GameMoments, saveGameMoments } from './momentStore'
import {
  isDayComplete,
  loadPracticeDay,
  loadStreak,
  practicePool,
  recordAnswer,
} from './practiceStore'

const moment = (moveIndex: number, winrateLoss: number): KeyMoment => ({
  moveIndex,
  fen: 'fen',
  playedMove: 'e2e4',
  playedSan: 'e4',
  bestMove: 'd2d4',
  bestSan: 'd4',
  winrateLoss,
  kind: winrateLoss >= 0.1 ? 'blunder' : 'inaccuracy',
  moveLabel: '1.',
})

const game = (
  gameId: string,
  moments: KeyMoment[],
  savedAt = 1,
): GameMoments => ({
  gameId,
  gameType: 'lichess',
  color: 'white',
  moments,
  usedMaia: false,
  savedAt,
})

const answer = { correct: true, attempts: 1, answer: 'd2d4' }

describe('practice days', () => {
  beforeEach(() => window.localStorage.clear())

  it("takes each game's biggest mistake in turn, keeps them for the day", () => {
    saveGameMoments(game('a', [moment(3, 0.06), moment(9, 0.3)]))
    saveGameMoments(game('b', [moment(5, 0.2), moment(7, 0.08)], 2))
    const day = loadPracticeDay(undefined, '2026-11-08')
    // The most recent game first, then the next; then their second ones.
    expect(day.positions.map((p) => p.id)).toEqual(['b:5', 'a:9', 'b:7'])

    saveGameMoments(game('c', [moment(4, 0.9)], 3))
    expect(
      loadPracticeDay(undefined, '2026-11-08').positions.map((p) => p.id),
    ).toEqual(['b:5', 'a:9', 'b:7'])
  })

  it('leaves out mistakes Maia says players at that level miss', () => {
    const seenBy = (bestShare: number) => ({
      maia: { rating: 1500, bestShare, playedShare: 0.3 },
    })
    saveGameMoments(
      game('a', [
        { ...moment(3, 0.5), ...seenBy(0.04) },
        { ...moment(5, 0.3), ...seenBy(0.1) },
        moment(7, 0.2),
      ]),
    )
    expect(practicePool().map((p) => p.id)).toEqual(['a:5', 'a:7'])
  })

  it("puts a just-played game's mistakes first, keeping answered ones", () => {
    saveGameMoments(
      game('a', [moment(3, 0.5), moment(9, 0.3), moment(11, 0.2)]),
    )
    let day = loadPracticeDay(undefined, '2026-11-08')
    day = recordAnswer(day, 'a:3', answer, '2026-11-08').day
    const played = game('p', [moment(6, 0.07)], 5)
    saveGameMoments(played)
    day = loadPracticeDay(played, '2026-11-08')
    expect(day.positions.map((p) => p.id)).toEqual(['a:3', 'p:6', 'a:9'])
  })

  it('counts a streak of completed days, shown from two', () => {
    const play = (today: string, ids: string[]) => {
      saveGameMoments(
        game(
          today,
          ids.map((_, i) => moment(i + 1, 0.2)),
        ),
      )
      let day = loadPracticeDay(undefined, today)
      let result
      for (const p of day.positions) {
        result = recordAnswer(day, p.id, answer, today)
        day = result.day
      }
      expect(isDayComplete(day)).toBe(true)
      return result?.streak
    }
    expect(play('2026-11-06', ['x', 'y', 'z'])?.days).toBe(1)
    expect(play('2026-11-07', ['x', 'y', 'z'])?.days).toBe(2)
    expect(loadStreak('2026-11-08').days).toBe(2)
    // A day missed: the streak starts again.
    expect(loadStreak('2026-11-09').days).toBe(0)
    expect(play('2026-11-09', ['x', 'y', 'z'])?.days).toBe(1)
  })

  it('never offers a position again once answered', () => {
    saveGameMoments(game('a', [moment(3, 0.5)]))
    let day = loadPracticeDay(undefined, '2026-11-08')
    day = recordAnswer(day, 'a:3', answer, '2026-11-08').day
    expect(loadPracticeDay(undefined, '2026-11-09').positions).toEqual([])
  })

  it('works without storage', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    saveGameMoments(game('m', [moment(3, 0.5)]))
    const day = loadPracticeDay(undefined, '2026-11-08')
    expect(day.positions.map((p) => p.id)).toEqual(['m:3'])
    expect(recordAnswer(day, 'm:3', answer, '2026-11-08').streak.days).toBe(1)
    jest.restoreAllMocks()
  })
})
