import { PlayGameConfig } from 'src/types'
import {
  UnfinishedGame,
  canResume,
  clearUnfinishedGame,
  loadUnfinishedGame,
  sameGameSettings,
  saveUnfinishedGame,
} from './unfinishedGame'

const config = (overrides: Partial<PlayGameConfig> = {}): PlayGameConfig => ({
  player: 'white',
  timeControl: 'unlimited',
  maiaVersion: 'maia_kdd_1500',
  playType: 'againstMaia',
  isBrain: false,
  sampleMoves: true,
  ...overrides,
})

const game = (overrides: Partial<UnfinishedGame> = {}): UnfinishedGame => ({
  id: 'abc',
  config: config(),
  moves: ['e2e4', 'e7e5'],
  moveTimes: [0, 0],
  whiteClock: 0,
  blackClock: 0,
  savedAt: Date.now(),
  ...overrides,
})

describe('unfinished games', () => {
  beforeEach(() => window.localStorage.clear())

  it('keeps unlimited and practice games only', () => {
    expect(canResume(config())).toBe(true)
    expect(canResume(config({ timeControl: '5+0', practice: true }))).toBe(true)
    expect(canResume(config({ timeControl: '5+0' }))).toBe(false)
    expect(canResume(config({ playType: 'handAndBrain' }))).toBe(false)
  })

  it('saves, loads and clears a game', () => {
    saveUnfinishedGame(game())
    expect(loadUnfinishedGame()?.id).toBe('abc')

    clearUnfinishedGame('other')
    expect(loadUnfinishedGame()?.id).toBe('abc')

    clearUnfinishedGame('abc')
    expect(loadUnfinishedGame()).toBeNull()
  })

  it('forgets games that are too old or have no moves', () => {
    saveUnfinishedGame(game({ savedAt: Date.now() - 15 * 24 * 3600 * 1000 }))
    expect(loadUnfinishedGame()).toBeNull()

    saveUnfinishedGame(game({ moves: [] }))
    expect(loadUnfinishedGame()).toBeNull()
  })

  it('matches games by the settings in the address', () => {
    expect(sameGameSettings(config(), config({ sampleMoves: false }))).toBe(
      true,
    )
    expect(sameGameSettings(config(), config({ player: 'black' }))).toBe(false)
    expect(sameGameSettings(config(), config({ practice: true }))).toBe(false)
  })
})
