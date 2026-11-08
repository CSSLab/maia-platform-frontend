import { renderHook } from '@testing-library/react'
import { PlayGameConfig, Termination } from 'src/types'
import {
  trackMaiaMoveLatency,
  trackPlayFirstMove,
  trackPlayGameAbandoned,
  trackPlayGameEnded,
  trackPlayGameFirstMoves,
  trackPlayGameStarted,
} from 'src/lib/analytics'
import { noteOpponentChoice } from 'src/lib/opponentChoice'
import { usePlayGameTracking } from './usePlayGameTracking'

jest.mock('src/lib/analytics', () => ({
  playGameProperties:
    jest.requireActual('src/lib/analytics').playGameProperties,
  trackPlayGameStarted: jest.fn(),
  trackPlayFirstMove: jest.fn(),
  trackPlayGameFirstMoves: jest.fn(),
  trackMaiaMoveLatency: jest.fn(),
  trackPlayGameEnded: jest.fn(),
  trackPlayGameAbandoned: jest.fn(),
}))
jest.mock('src/api/play', () => ({ MAIA_PLAY_MODEL_VERSION: 'maia3' }))

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

const game = (id: string, type = 'play') => ({
  game_id: id,
  game_type: type === 'play' ? 'vs_maia' : 'hand_and_brain',
  is_brain: type === 'brain',
  maia_name: 'maia_kdd_1500',
  maia_version: 'maia_kdd_1500',
  maia_model: 'maia3',
})

interface Props {
  id: string
  moveCount: number
  termination?: Termination
}

const setup = (
  id: string,
  gameConfig = config,
  options: { resumed?: boolean; simulateMaiaTime?: boolean } = {},
  moveCount = 0,
) =>
  renderHook(
    ({ id, moveCount, termination }: Props) =>
      usePlayGameTracking(id, gameConfig, moveCount, termination, options),
    { initialProps: { id, moveCount } as Props },
  )

describe('usePlayGameTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Math, 'random').mockReturnValue(0.5)
  })
  afterEach(() => jest.restoreAllMocks())

  it('waits for a game id before tracking the start', () => {
    const { rerender } = setup('')
    expect(trackPlayGameStarted).not.toHaveBeenCalled()

    rerender({ id: 'game-1', moveCount: 0 })
    expect(trackPlayGameStarted).toHaveBeenCalledTimes(1)
    expect(trackPlayGameStarted).toHaveBeenCalledWith(game('game-1'), {
      time_control: '5+3',
      player_color: 'white',
      was_default_opponent: false,
      opponent_choice: 'unknown',
      custom_position: false,
      practice: false,
      resumed: false,
      logged_in: false,
    })
  })

  it('records how the opponent was picked', () => {
    noteOpponentChoice('maia_kdd_1500', 'preselected')
    setup('game-1')
    expect(trackPlayGameStarted).toHaveBeenCalledWith(
      game('game-1'),
      expect.objectContaining({
        was_default_opponent: true,
        opponent_choice: 'preselected',
      }),
    )
  })

  it('tracks each game once, and a new id as a new game', () => {
    const { rerender } = setup('game-1')
    rerender({ id: 'game-1', moveCount: 1 })
    expect(trackPlayGameStarted).toHaveBeenCalledTimes(1)

    rerender({ id: 'game-2', moveCount: 0 })
    expect(trackPlayGameStarted).toHaveBeenCalledTimes(2)
    expect(trackPlayGameAbandoned).toHaveBeenCalledWith(
      game('game-1'),
      1,
      expect.any(Number),
      'new_game',
      false,
    )
  })

  it('tracks hand and brain games by their type', () => {
    setup('game-1', {
      ...config,
      playType: 'handAndBrain',
      isBrain: true,
      maiaPartnerVersion: 'maia_kdd_1100',
    })
    expect(trackPlayGameStarted).toHaveBeenCalledWith(
      game('game-1', 'brain'),
      expect.objectContaining({ maia_partner_name: 'maia_kdd_1100' }),
    )
  })

  it('tracks the first move, by either side', () => {
    const { rerender } = setup('game-1')
    rerender({ id: 'game-1', moveCount: 1 })
    rerender({ id: 'game-1', moveCount: 2 })
    expect(trackPlayFirstMove).toHaveBeenCalledTimes(1)
    expect(trackPlayFirstMove).toHaveBeenCalledWith(
      game('game-1'),
      'human',
      expect.any(Number),
    )

    jest.clearAllMocks()
    const asBlack = setup('game-2', { ...config, player: 'black' })
    asBlack.rerender({ id: 'game-2', moveCount: 1 })
    expect(trackPlayFirstMove).toHaveBeenCalledWith(
      game('game-2'),
      'maia',
      expect.any(Number),
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

  it("times Maia's first three replies, then about one in ten", () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000)
    const { rerender } = setup('game-1', config, { simulateMaiaTime: true })
    for (let ply = 1; ply <= 10; ply++) {
      now.mockReturnValue(1000 + ply * 100)
      rerender({ id: 'game-1', moveCount: ply })
    }
    // Maia's moves are the even plies, each 100 ms after the visitor's.
    expect(trackMaiaMoveLatency).toHaveBeenCalledTimes(3)
    expect(trackMaiaMoveLatency).toHaveBeenNthCalledWith(
      1,
      game('game-1'),
      2,
      100,
      1,
      true,
    )

    // A random draw under 10% sends a later one.
    jest.clearAllMocks()
    ;(Math.random as jest.Mock).mockReturnValue(0.05)
    now.mockReturnValue(5000)
    rerender({ id: 'game-1', moveCount: 11 })
    now.mockReturnValue(5250)
    rerender({ id: 'game-1', moveCount: 12 })
    expect(trackMaiaMoveLatency).toHaveBeenCalledWith(
      game('game-1'),
      12,
      250,
      0.1,
      true,
    )
  })

  it('times Maia moving first from the start of the game', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000)
    const { rerender } = setup('game-1', { ...config, player: 'black' })
    now.mockReturnValue(1800)
    rerender({ id: 'game-1', moveCount: 1 })
    expect(trackMaiaMoveLatency).toHaveBeenCalledWith(
      game('game-1'),
      1,
      800,
      1,
      false,
    )
  })

  it('sends no first move for a game continued with moves in it', () => {
    const { rerender } = setup('game-1', config, { resumed: true }, 6)
    rerender({ id: 'game-1', moveCount: 7 })
    expect(trackPlayFirstMove).not.toHaveBeenCalled()
    expect(trackPlayGameFirstMoves).not.toHaveBeenCalled()
    expect(trackPlayGameStarted).toHaveBeenCalledWith(
      game('game-1'),
      expect.objectContaining({ resumed: true }),
    )
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
      game('game-1'),
      result,
      reason,
      40,
      expect.any(Number),
    )
  })

  it('tracks a game left for another page, once, and not one that ended', () => {
    const left = setup('game-1')
    left.rerender({ id: 'game-1', moveCount: 3 })
    left.unmount()
    expect(trackPlayGameAbandoned).toHaveBeenCalledTimes(1)
    expect(trackPlayGameAbandoned).toHaveBeenCalledWith(
      game('game-1'),
      3,
      expect.any(Number),
      'unmount',
      false,
    )

    jest.clearAllMocks()
    const ended = setup('game-2')
    ended.rerender({ id: 'game-2', moveCount: 20, termination: win })
    ended.unmount()
    expect(trackPlayGameAbandoned).not.toHaveBeenCalled()
  })

  it('tracks a closed tab, once', () => {
    const { unmount } = setup('game-1', { ...config, timeControl: 'unlimited' })
    window.dispatchEvent(new Event('pagehide'))
    unmount()
    expect(trackPlayGameAbandoned).toHaveBeenCalledTimes(1)
    // Unlimited games can be continued in this browser.
    expect(trackPlayGameAbandoned).toHaveBeenCalledWith(
      game('game-1'),
      0,
      expect.any(Number),
      'pagehide',
      true,
    )
  })
})
