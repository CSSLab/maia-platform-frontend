import { act, renderHook, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { resignServerGame } from 'src/api/serverGames'
import { isAppHydrated } from 'src/components/Common/PageShell'
import { ServerGame } from 'src/lib/serverGames'
import { PlayGameConfig } from 'src/types'
import { useGameInProgressQuestion } from './useGameInProgressQuestion'

jest.mock('src/api/serverGames', () => ({ resignServerGame: jest.fn() }))
jest.mock('src/components/Common/PageShell', () => ({
  isAppHydrated: jest.fn(),
}))
jest.mock('src/lib/analytics', () => ({
  trackGameInProgressPromptAnswered: jest.fn(),
}))
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn() },
}))

const resign = resignServerGame as jest.Mock
const hydrated = isAppHydrated as jest.Mock

const ENDGAME = '8/8/8/4k3/8/8/4K3/7R w - - 0 1'

const game: ServerGame = {
  game_id: 'abc123',
  game_type: 'play',
  player_color: 'white',
  maia_name: 'maia_kdd_1500',
  time_control: '3+0',
  sample_moves: false,
  practice: false,
  fen: ENDGAME,
  moves: [],
  move_times: [],
  ply: 22,
  to_move: 'white',
  state: 'not_over',
  winner: '',
  clock: null,
  bot_move: null,
  rating: null,
}

// The address asks for the game in progress.
const same: PlayGameConfig = {
  playType: 'againstMaia',
  player: 'white',
  maiaVersion: 'maia_kdd_1500',
  timeControl: '3+0',
  isBrain: false,
  sampleMoves: false,
  startFen: ENDGAME,
}
// The address asks for a game from another position.
const other: PlayGameConfig = {
  ...same,
  startFen: '8/8/8/4k3/8/8/4K3/7Q w - - 0 1',
}

// How the browser says the page was opened.
const openedBy = (type: string, pageLoad = true) => {
  hydrated.mockReturnValue(!pageLoad)
  Object.defineProperty(window.performance, 'getEntriesByType', {
    configurable: true,
    value: () => [{ type }],
  })
}

describe('useGameInProgressQuestion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('goes on with the game on a reload, or when the browser brings the page back', () => {
    for (const type of ['reload', 'back_forward']) {
      openedBy(type)
      const { result } = renderHook(() => useGameInProgressQuestion())
      expect(result.current.mustAsk(game, same, true)).toBe(false)
    }
  })

  it('goes on with the game when reached by a click in the site (Continue)', () => {
    openedBy('navigate', false)
    const { result } = renderHook(() => useGameInProgressQuestion())
    expect(result.current.mustAsk(game, same, true)).toBe(false)
  })

  it('asks when a link is followed, even to a game with the same settings', () => {
    openedBy('navigate')
    const { result } = renderHook(() => useGameInProgressQuestion())
    expect(result.current.mustAsk(game, same, true)).toBe(true)
    // Only for the page's first game: later ones are started in the site.
    expect(result.current.mustAsk(game, same, false)).toBe(false)
  })

  it('asks whenever the game in progress is not the one asked for', () => {
    for (const [type, pageLoad] of [
      ['reload', true],
      ['back_forward', true],
      ['navigate', false],
    ] as const) {
      openedBy(type, pageLoad)
      const { result } = renderHook(() => useGameInProgressQuestion())
      expect(result.current.mustAsk(game, other, false)).toBe(true)
    }
  })

  it('goes on with the game where the browser cannot say how the page was opened', () => {
    hydrated.mockReturnValue(false)
    Object.defineProperty(window.performance, 'getEntriesByType', {
      configurable: true,
      value: undefined,
    })
    const { result } = renderHook(() => useGameInProgressQuestion())
    expect(result.current.mustAsk(game, same, true)).toBe(false)
  })

  it('continues the game in progress when that is the answer', () => {
    openedBy('navigate')
    const continueIt = jest.fn()
    const startNew = jest.fn()
    const { result } = renderHook(() => useGameInProgressQuestion())
    act(() =>
      result.current.ask({ game, askedFor: false, continueIt, startNew }),
    )
    expect(result.current.question?.game).toBe(game)

    act(() => result.current.continueIt())
    expect(continueIt).toHaveBeenCalledTimes(1)
    expect(resign).not.toHaveBeenCalled()
    expect(startNew).not.toHaveBeenCalled()
    expect(result.current.question).toBeUndefined()
  })

  it('resigns the game in progress, then starts the new one', async () => {
    openedBy('navigate')
    resign.mockResolvedValue({ ...game, state: 'resign', winner: 'black' })
    const continueIt = jest.fn()
    const startNew = jest.fn()
    const { result } = renderHook(() => useGameInProgressQuestion())
    act(() =>
      result.current.ask({ game, askedFor: false, continueIt, startNew }),
    )

    act(() => result.current.startNew())
    expect(resign).toHaveBeenCalledWith('abc123')
    expect(result.current.resigning).toBe(true)
    // Not before the game is resigned: the server would answer with it again.
    expect(startNew).not.toHaveBeenCalled()

    await waitFor(() => expect(startNew).toHaveBeenCalledTimes(1))
    expect(continueIt).not.toHaveBeenCalled()
    expect(result.current.question).toBeUndefined()
    expect(result.current.resigning).toBe(false)
  })

  it('keeps asking if the game could not be resigned', async () => {
    openedBy('navigate')
    resign.mockRejectedValue(new Error('offline'))
    const startNew = jest.fn()
    const { result } = renderHook(() => useGameInProgressQuestion())
    act(() =>
      result.current.ask({
        game,
        askedFor: false,
        continueIt: jest.fn(),
        startNew,
      }),
    )

    act(() => result.current.startNew())
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(startNew).not.toHaveBeenCalled()
    expect(result.current.question?.game).toBe(game)
    await waitFor(() => expect(result.current.resigning).toBe(false))
  })
})
