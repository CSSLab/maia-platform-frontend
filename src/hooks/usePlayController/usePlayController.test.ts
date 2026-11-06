import { act, renderHook } from '@testing-library/react'
import { PlayGameConfig } from 'src/types'
import { usePlayController } from './usePlayController'

jest.mock('src/lib/analytics', () => ({
  trackPlayGameStarted: jest.fn(),
  trackPlayGameFirstMoves: jest.fn(),
  trackPlayGameEnded: jest.fn(),
}))

const config = (overrides: Partial<PlayGameConfig> = {}): PlayGameConfig => ({
  player: 'white',
  timeControl: '5+0',
  maiaVersion: 'maia_kdd_1500',
  playType: 'againstMaia',
  isBrain: false,
  sampleMoves: true,
  ...overrides,
})

const play = (
  result: { current: ReturnType<typeof usePlayController> },
  moves: string[],
) => {
  for (const move of moves) {
    act(() => result.current.addMoveWithTime(move, 0))
  }
}

describe('usePlayController takebacks (practice games)', () => {
  it('takes back the player move and Maia reply, back to the player', () => {
    const { result } = renderHook(() =>
      usePlayController('game', config({ practice: true })),
    )
    play(result, ['e2e4', 'e7e5', 'g1f3', 'b8c6'])
    expect(result.current.playerActive).toBe(true)
    expect(result.current.canTakeBack).toBe(true)

    act(() => result.current.takeBack())

    expect(result.current.moveList).toEqual(['e2e4', 'e7e5'])
    expect(result.current.playerActive).toBe(true)
  })

  it("takes back just the player's move while Maia is to move", () => {
    const { result } = renderHook(() =>
      usePlayController('game', config({ practice: true })),
    )
    play(result, ['e2e4', 'e7e5', 'g1f3'])
    expect(result.current.playerActive).toBe(false)

    act(() => result.current.takeBack())

    expect(result.current.moveList).toEqual(['e2e4', 'e7e5'])
    expect(result.current.playerActive).toBe(true)
  })

  it('has nothing to take back before the player has moved', () => {
    const { result } = renderHook(() =>
      usePlayController('game', config({ practice: true, player: 'black' })),
    )
    play(result, ['e2e4'])
    expect(result.current.canTakeBack).toBe(false)
  })

  it('offers no takebacks or extra time outside practice', () => {
    const { result } = renderHook(() => usePlayController('game', config()))
    play(result, ['e2e4', 'e7e5'])
    expect(result.current.canTakeBack).toBe(false)
    expect(result.current.canAddTime).toBe(false)

    act(() => result.current.takeBack())
    expect(result.current.moveList).toEqual(['e2e4', 'e7e5'])
  })
})

describe('usePlayController extra time (practice games)', () => {
  it("adds to the player's clock only", () => {
    const { result } = renderHook(() =>
      usePlayController('game', config({ practice: true })),
    )
    act(() => result.current.addTime(15_000))
    expect(result.current.whiteClock).toBe(5 * 60_000 + 15_000)
    expect(result.current.blackClock).toBe(5 * 60_000)
  })

  it('is not offered in unlimited games', () => {
    const { result } = renderHook(() =>
      usePlayController(
        'game',
        config({ practice: true, timeControl: 'unlimited' }),
      ),
    )
    expect(result.current.canAddTime).toBe(false)
  })
})
