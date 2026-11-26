import {
  readChallengeTallies,
  recordChallengeResult,
} from './challengeProgress'

describe('challenge results in this browser', () => {
  beforeEach(() => window.localStorage.clear())

  it('counts tries, the levels beaten and the best win, each game once', () => {
    recordChallengeResult('wch-r1', 'g1', 'loss', 1500, 30)
    recordChallengeResult('wch-r1', 'g2', 'draw', 1500, 41)
    recordChallengeResult('wch-r1', 'g3', 'win', 2000, 25)
    recordChallengeResult('wch-r1', 'g3', 'win', 2000, 25)
    recordChallengeResult('wch-r1', 'g4', 'win', 1000, 12)
    recordChallengeResult('wch-r1', 'g6', 'win', 2000, 19)
    recordChallengeResult('wch-r2', 'g5', 'loss', 600, 8)
    expect(readChallengeTallies()).toEqual({
      'wch-r1': {
        tries: 5,
        wins: 3,
        draws: 1,
        beaten: [1000, 2000],
        // The highest level beaten, in the fewest moves.
        best: { outcome: 'win', passed: true, level: 2000, moves: 19 },
        last: { outcome: 'win', passed: true, level: 2000, moves: 19 },
        history: 'ldppp',
      },
      'wch-r2': {
        tries: 1,
        wins: 0,
        draws: 0,
        beaten: [],
        last: { outcome: 'loss', passed: false, level: 600, moves: 8 },
        history: 'l',
      },
    })
  })

  it('counts a draw as a pass where the challenge says so', () => {
    recordChallengeResult('wch-r3', 'g1', 'draw', 1500, 40, true)
    expect(readChallengeTallies()['wch-r3']).toMatchObject({
      beaten: [1500],
      best: { outcome: 'draw', passed: true, level: 1500, moves: 40 },
    })
  })

  it('starts empty when what is stored is unreadable', () => {
    window.localStorage.setItem('maia-challenge-results', '{not json')
    expect(readChallengeTallies()).toEqual({})
  })
})
