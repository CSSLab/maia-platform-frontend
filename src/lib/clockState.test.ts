import {
  buildClockState,
  CLOCK_STATE_EVENT,
  publishClockState,
} from './clockState'

const base = {
  timeControl: '5+3',
  whiteClock: 300000,
  blackClock: 300000,
  initialClock: 300000,
  incrementSeconds: 3,
  lastMoveTime: 0,
  movesPlayed: 0,
  toPlay: 'white' as const,
  now: 1000,
}

describe('buildClockState', () => {
  it('has no running clock before the game starts', () => {
    expect(buildClockState(base)).toEqual({
      version: 1,
      whiteRemainingMs: 300000,
      blackRemainingMs: 300000,
      whiteInitialMs: 300000,
      blackInitialMs: 300000,
      incrementMs: 3000,
      remainingAtMs: 1000,
      turnColor: 'white',
      activeColor: null,
      lifecycle: 'not_started',
      result: null,
    })
  })

  it('is ongoing after the first move, but no clock runs until both have moved', () => {
    const state = buildClockState({ ...base, movesPlayed: 1, toPlay: 'black' })
    expect(state.lifecycle).toBe('ongoing')
    expect(state.activeColor).toBeNull()
  })

  it('runs the side to move, counted from the last move', () => {
    const state = buildClockState({
      ...base,
      movesPlayed: 2,
      lastMoveTime: 500,
      whiteClock: 290000,
    })
    expect(state.activeColor).toBe('white')
    expect(state.remainingAtMs).toBe(500)
    expect(state.whiteRemainingMs).toBe(290000)
  })

  it('never runs a clock in unlimited games', () => {
    const state = buildClockState({
      ...base,
      timeControl: 'unlimited',
      movesPlayed: 4,
      lastMoveTime: 500,
    })
    expect(state.activeColor).toBeNull()
    expect(state.turnColor).toBe('white')
  })

  it('reports the result once the game is over', () => {
    const over = (winner: 'white' | 'black' | 'none') =>
      buildClockState({
        ...base,
        movesPlayed: 4,
        lastMoveTime: 500,
        toPlay: null,
        termination: { result: '', winner, type: 'rules' },
      })
    expect(over('white')).toMatchObject({
      lifecycle: 'finished',
      result: 'white_wins',
      activeColor: null,
      turnColor: null,
    })
    expect(over('black').result).toBe('black_wins')
    expect(over('none').result).toBe('draw')
  })
})

describe('publishClockState', () => {
  it('sets the global and sends an event, and clears both', () => {
    const listener = jest.fn()
    window.addEventListener(CLOCK_STATE_EVENT, listener)
    const state = buildClockState(base)

    publishClockState(state)
    expect(window.__MaiaClockState).toBe(state)
    expect(listener.mock.calls[0][0].detail).toBe(state)

    publishClockState(null)
    expect('__MaiaClockState' in window).toBe(false)
    expect(listener.mock.calls[1][0].detail).toBeNull()

    window.removeEventListener(CLOCK_STATE_EVENT, listener)
  })
})
