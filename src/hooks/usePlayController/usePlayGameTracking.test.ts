import { renderHook } from '@testing-library/react'
import { PlayGameConfig, Termination } from 'src/types'
import {
  trackPlayGameEnded,
  trackPlayGameFirstMoves,
  trackPlayGameStarted,
} from 'src/lib/analytics'
import { usePlayGameTracking } from './usePlayGameTracking'

jest.mock('src/lib/analytics', () => ({
  trackPlayGameStarted: jest.fn(),
  trackPlayGameFirstMoves: jest.fn(),
  trackPlayGameEnded: jest.fn(),
}))

const config: PlayGameConfig = {
  player: 'white',
  timeControl: '5+3',
  maiaVersion: 'maia_kdd_1500',
  playType: 'againstMaia',
  isBrain: false,
  sampleMoves: true,
}

const win: Termination = { result: '1-0', winner: 'white', type: 'rules' }
const loss: Termination = { result: '0-1', winner: 'black', type: 'resign' }
const draw: Termination = { result: '1/2-1/2', winner: 'none', type: 'rules' }

interface Props {
  id: string
  moveCount: number
  termination?: Termination
}

const setup = (id: string, gameConfig = config) =>
  renderHook(
    ({ id, moveCount, termination }: Props) =>
      usePlayGameTracking(id, gameConfig, moveCount, termination),
    { initialProps: { id, moveCount: 0 } as Props },
  )

describe('usePlayGameTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('waits for a game id before tracking the start', () => {
    const { rerender } = setup('')
    expect(trackPlayGameStarted).not.toHaveBeenCalled()

    rerender({ id: 'game-1', moveCount: 0 })
    expect(trackPlayGameStarted).toHaveBeenCalledTimes(1)
    expect(trackPlayGameStarted).toHaveBeenCalledWith(
      'game-1',
      'vs_maia',
      'maia_kdd_1500',
      'white',
      '5+3',
      false,
      false,
      false,
    )
  })

  it('tracks each game once, and a new id as a new game', () => {
    const { rerender } = setup('game-1')
    rerender({ id: 'game-1', moveCount: 1 })
    expect(trackPlayGameStarted).toHaveBeenCalledTimes(1)

    rerender({ id: 'game-2', moveCount: 0 })
    expect(trackPlayGameStarted).toHaveBeenCalledTimes(2)
  })

  it('tracks hand and brain games by their type', () => {
    setup('game-1', { ...config, playType: 'handAndBrain', isBrain: true })
    expect(trackPlayGameStarted).toHaveBeenCalledWith(
      'game-1',
      'hand_and_brain',
      'maia_kdd_1500',
      'white',
      '5+3',
      false,
      true,
      false,
    )
  })

  it('tracks first moves once both sides have moved', () => {
    const { rerender } = setup('game-1')
    rerender({ id: 'game-1', moveCount: 1 })
    expect(trackPlayGameFirstMoves).not.toHaveBeenCalled()

    rerender({ id: 'game-1', moveCount: 2 })
    rerender({ id: 'game-1', moveCount: 3 })
    expect(trackPlayGameFirstMoves).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['win', win, 'rules'],
    ['loss', loss, 'resign'],
    ['draw', draw, 'rules'],
  ] as const)('tracks a %s once', (result, termination, reason) => {
    const { rerender } = setup('game-1')
    rerender({ id: 'game-1', moveCount: 40, termination })
    rerender({ id: 'game-1', moveCount: 40, termination: { ...termination } })

    expect(trackPlayGameEnded).toHaveBeenCalledTimes(1)
    expect(trackPlayGameEnded).toHaveBeenCalledWith(
      'game-1',
      'vs_maia',
      'maia_kdd_1500',
      result,
      reason,
      40,
      expect.any(Number),
    )
  })

  it('tracks the end again after the same game is reset and replayed', () => {
    const { rerender } = setup('game-1')
    rerender({ id: 'game-1', moveCount: 10, termination: win })
    rerender({ id: 'game-1', moveCount: 0 })
    rerender({ id: 'game-1', moveCount: 12, termination: loss })

    expect(trackPlayGameEnded).toHaveBeenCalledTimes(2)
  })
})
