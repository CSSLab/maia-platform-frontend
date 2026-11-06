import { act, render, renderHook } from '@testing-library/react'

import { BroadcastGame, GameTree } from 'src/types'
import { BroadcastClock, useBroadcastClocks } from './BroadcastClock'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// A main line of e4 e5 Nf3, and the game as the broadcast sent it.
const setup = (game: Partial<BroadcastGame>) => {
  const tree = new GameTree(START)
  const e4 = tree
    .getRoot()
    .addChild(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      'e2e4',
      'e4',
      true,
    )
  const e5 = e4.addChild(
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    'e7e5',
    'e5',
    true,
  )
  const nf3 = e5.addChild(
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    'g1f3',
    'Nf3',
    true,
  )
  const broadcastGame = {
    moves: ['e4', 'e5', 'Nf3'],
    moveClocks: [5400, 5390, 5300],
    result: '*',
    ...game,
  } as BroadcastGame
  return { broadcastGame, nodes: { e4, e5, nf3 } }
}

describe('useBroadcastClocks', () => {
  it('shows the clocks after the moves up to the position viewed', () => {
    const { broadcastGame, nodes } = setup({})
    const { result } = renderHook(() =>
      useBroadcastClocks(broadcastGame, nodes.e4),
    )
    expect(result.current).toMatchObject({ white: 5400, running: null })
    expect(result.current.black).toBeUndefined()
  })

  it("runs the side to move's clock at the latest position of a live game", () => {
    const { broadcastGame, nodes } = setup({ lastMoveReceivedAt: 1000 })
    const { result } = renderHook(() =>
      useBroadcastClocks(broadcastGame, nodes.nf3),
    )
    expect(result.current).toMatchObject({
      white: 5300,
      black: 5390,
      running: 'black',
      runningSince: 1000,
    })
  })

  it('stops the clocks once the game is over, or away from its end', () => {
    const over = setup({ lastMoveReceivedAt: 1000, result: '1-0' })
    expect(
      renderHook(() => useBroadcastClocks(over.broadcastGame, over.nodes.nf3))
        .result.current.running,
    ).toBeNull()

    const live = setup({ lastMoveReceivedAt: 1000 })
    expect(
      renderHook(() => useBroadcastClocks(live.broadcastGame, live.nodes.e5))
        .result.current.running,
    ).toBeNull()
  })

  it('takes the clocks of the main-line position a side line left', () => {
    const { broadcastGame, nodes } = setup({})
    const sideLine = nodes.e5.addChild(
      'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2',
      'f1c4',
      'Bc4',
      false,
    )
    const { result } = renderHook(() =>
      useBroadcastClocks(broadcastGame, sideLine),
    )
    expect(result.current).toMatchObject({ white: 5400, black: 5390 })
  })
})

describe('BroadcastClock', () => {
  afterEach(() => jest.useRealTimers())

  it('counts a running clock down from when the move arrived', () => {
    jest.useFakeTimers()
    jest.setSystemTime(100_000)
    const { container } = render(
      <BroadcastClock
        clocks={{
          white: 5300,
          black: 65,
          running: 'black',
          runningSince: 100_000,
        }}
        color="black"
      />,
    )
    expect(container.textContent).toBe('1:05')
    act(() => {
      jest.advanceTimersByTime(10_000)
    })
    expect(container.textContent).toBe('0:55')
  })

  it('shows nothing for a player without a clock', () => {
    const { container } = render(
      <BroadcastClock clocks={{ running: null }} color="white" />,
    )
    expect(container.textContent).toBe('')
  })
})
