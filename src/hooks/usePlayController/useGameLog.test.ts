import { act, renderHook } from '@testing-library/react'
import {
  GameOverState,
  LOG_EVERY_PLIES,
  hasUnsentMoves,
  shouldLogGame,
  useGameLog,
} from './useGameLog'

describe('shouldLogGame', () => {
  it('sends every LOG_EVERY_PLIES half-moves, not each one', () => {
    const sent = []
    for (let plies = 1; plies <= LOG_EVERY_PLIES * 3; plies++) {
      if (shouldLogGame(plies, 'not_over', null)) sent.push(plies)
    }
    expect(sent).toEqual([
      LOG_EVERY_PLIES,
      LOG_EVERY_PLIES * 2,
      LOG_EVERY_PLIES * 3,
    ])
  })

  it('sends a game that has ended, at any length', () => {
    expect(shouldLogGame(7, 'resign', null)).toBe(true)
    expect(shouldLogGame(0, 'time', null)).toBe(true)
  })

  it('does not send the same thing twice', () => {
    expect(
      shouldLogGame(LOG_EVERY_PLIES, 'not_over', `${LOG_EVERY_PLIES}/not_over`),
    ).toBe(false)
    expect(shouldLogGame(31, 'rules', '31/rules')).toBe(false)
  })

  it('has moves to send when the page goes until they are sent', () => {
    expect(hasUnsentMoves(3, 'not_over', null)).toBe(true)
    expect(hasUnsentMoves(3, 'not_over', '3/not_over')).toBe(false)
    expect(hasUnsentMoves(0, 'not_over', null)).toBe(false)
    expect(hasUnsentMoves(9, 'resign', null)).toBe(false)
  })
})

describe('useGameLog', () => {
  let visibility: DocumentVisibilityState = 'visible'

  beforeEach(() => {
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
  })

  const setup = (gameId = 'g1') => {
    const calls: [string, number, GameOverState, boolean][] = []
    const props = { gameId, plies: 0, state: 'not_over' as GameOverState }
    const hook = renderHook(
      (p: typeof props) =>
        useGameLog({
          ...p,
          send: (leaving) => calls.push([p.gameId, p.plies, p.state, leaving]),
        }),
      { initialProps: props },
    )
    const play = (next: Partial<typeof props>) => {
      Object.assign(props, next)
      hook.rerender({ ...props })
    }
    return { calls, play, hook }
  }

  it('sends a 45-half-move game three times instead of 45', () => {
    const { calls, play } = setup()
    for (let plies = 1; plies <= 45; plies++) play({ plies })
    play({ state: 'resign' })
    expect(calls).toEqual([
      ['g1', 20, 'not_over', false],
      ['g1', 40, 'not_over', false],
      ['g1', 45, 'resign', false],
    ])
  })

  it('sends the moves not yet sent when the page is hidden', () => {
    const { calls, play } = setup()
    for (let plies = 1; plies <= 7; plies++) play({ plies })
    act(() => {
      visibility = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // Hidden again with nothing new: nothing more.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(calls).toEqual([['g1', 7, 'not_over', true]])
  })

  it('sends the moves not yet sent when the page is left', () => {
    const { calls, play } = setup()
    play({ plies: 3 })
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(calls).toEqual([['g1', 3, 'not_over', true]])
  })

  it('sends the game being left for another one', () => {
    const { calls, play } = setup()
    play({ plies: 5 })
    play({ gameId: 'g2', plies: 0 })
    play({ plies: 1 })
    expect(calls).toEqual([['g1', 5, 'not_over', true]])
  })

  it('sends the game when its page closes', () => {
    const { calls, play, hook } = setup()
    play({ plies: 4 })
    hook.unmount()
    expect(calls).toEqual([['g1', 4, 'not_over', true]])
  })

  it('waits for the game to have an id', () => {
    const { calls, play } = setup('')
    play({ state: 'resign' })
    expect(calls).toEqual([])
    play({ gameId: 'g1' })
    expect(calls).toEqual([['g1', 0, 'resign', false]])
  })
})
