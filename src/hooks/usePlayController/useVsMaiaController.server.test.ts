import { act, renderHook } from '@testing-library/react'
import { PlayGameConfig } from 'src/types'
import { ServerGame, serverGameStart } from 'src/lib/serverGames'
import { useVsMaiaPlayController } from './useVsMaiaController'

const sendServerMove = jest.fn()
const resignServerGame = jest.fn()
const flagServerGame = jest.fn()
const takeBackServerGame = jest.fn()
const addTimeServerGame = jest.fn()
const fetchMaiaMove = jest.fn()
const logGameMove = jest.fn()
const incrementStats = jest.fn()
const updateRating = jest.fn()

jest.mock('src/lib/analytics', () => ({
  trackPlayGameStarted: jest.fn(),
  trackPlayGameFirstMoves: jest.fn(),
  trackPlayGameEnded: jest.fn(),
}))
jest.mock('src/hooks/useSound', () => ({
  useSound: () => ({ playMoveSound: jest.fn() }),
}))
jest.mock('src/hooks/useStats', () => ({
  useStats: () => [{ rating: 1500 }, incrementStats, updateRating],
}))
jest.mock('src/components/Common/maiaMoveFailedToast', () => ({
  dismissMaiaMoveFailedToast: jest.fn(),
  reportMaiaMoveFailed: jest.fn(),
}))
jest.mock('src/api', () => ({
  fetchMaiaMove: (...args: unknown[]) => fetchMaiaMove(...args),
  logGameMove: (...args: unknown[]) => logGameMove(...args),
  fetchPlayPlayerStats: jest.fn(),
}))
jest.mock('src/api/serverGames', () => {
  class ServerGameConflict extends Error {
    constructor(
      readonly code: string,
      readonly game: unknown,
    ) {
      super(code)
    }
  }
  return {
    ServerGameConflict,
    sendServerMove: (...args: unknown[]) => sendServerMove(...args),
    resignServerGame: (...args: unknown[]) => resignServerGame(...args),
    flagServerGame: (...args: unknown[]) => flagServerGame(...args),
    takeBackServerGame: (...args: unknown[]) => takeBackServerGame(...args),
    addTimeServerGame: (...args: unknown[]) => addTimeServerGame(...args),
    sendServerPiece: jest.fn(),
  }
})

const config = (overrides: Partial<PlayGameConfig> = {}): PlayGameConfig => ({
  player: 'white',
  timeControl: '5+3',
  maiaVersion: 'maia_kdd_1500',
  playType: 'againstMaia',
  isBrain: false,
  sampleMoves: true,
  ...overrides,
})

const serverGame = (fields: Partial<ServerGame> = {}): ServerGame => ({
  game_id: 'g1',
  game_type: 'play',
  player_color: 'white',
  maia_name: 'maia_kdd_1500',
  time_control: '5+3',
  sample_moves: true,
  practice: false,
  fen: '',
  moves: [],
  move_times: [],
  ply: 0,
  to_move: 'white',
  state: 'not_over',
  winner: '',
  clock: {
    white_ms: 300000,
    black_ms: 300000,
    increment_ms: 3000,
    running: null,
    since_ms: 0,
  },
  bot_move: null,
  rating: null,
  ...fields,
})

const start = (
  game: ServerGame,
  gameConfig = config(),
  onResync = jest.fn(),
  simulate = true,
) =>
  renderHook(() =>
    useVsMaiaPlayController(
      game.game_id,
      gameConfig,
      simulate,
      serverGameStart(game, gameConfig),
      game,
      onResync,
    ),
  )

// Lets the mocked requests' promises settle, then the effects they cause.
const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}

describe('playing a game the server holds', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-11-11T12:00:00Z'))
    for (const mock of [
      sendServerMove,
      resignServerGame,
      flagServerGame,
      takeBackServerGame,
      addTimeServerGame,
      fetchMaiaMove,
      logGameMove,
      incrementStats,
      updateRating,
    ]) {
      mock.mockReset()
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("sends the player's move and shows Maia's reply after its delay", async () => {
    const { result } = start(serverGame())
    sendServerMove.mockResolvedValue(
      serverGame({
        moves: ['e2e4', 'e7e5'],
        move_times: [4000, 1500],
        ply: 2,
        clock: {
          white_ms: 300000,
          black_ms: 300000,
          increment_ms: 3000,
          running: 'white',
          since_ms: -1500,
        },
        bot_move: { uci: 'e7e5', ply: 1, delay: 1.5 },
      }),
    )

    act(() => {
      jest.advanceTimersByTime(4000)
    })
    await act(async () => {
      await result.current.makePlayerMove('e2e4')
    })
    // Shown at once, before the server has answered.
    expect(result.current.moveList).toEqual(['e2e4'])
    expect(result.current.playerActive).toBe(false)
    expect(sendServerMove).toHaveBeenCalledWith('g1', 0, 'e2e4', 4000, false)

    await settle()
    // Maia is still "thinking".
    expect(result.current.moveList).toEqual(['e2e4'])
    act(() => {
      jest.advanceTimersByTime(1500)
    })
    expect(result.current.moveList).toEqual(['e2e4', 'e7e5'])
    expect(result.current.playerActive).toBe(true)
    expect(result.current.whiteClock).toBe(300000)
    expect(result.current.blackClock).toBe(300000)

    // The browser never asks for Maia's move or reports the game itself.
    expect(fetchMaiaMove).not.toHaveBeenCalled()
    expect(logGameMove).not.toHaveBeenCalled()
  })

  it("counts the player's thinking time from when Maia's move appeared", async () => {
    const { result } = start(serverGame())
    sendServerMove.mockResolvedValueOnce(
      serverGame({
        moves: ['e2e4', 'e7e5'],
        ply: 2,
        bot_move: { uci: 'e7e5', ply: 1, delay: 2 },
      }),
    )
    await act(async () => {
      await result.current.makePlayerMove('e2e4')
    })
    await settle()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    sendServerMove.mockResolvedValueOnce(serverGame({ ply: 4 }))
    act(() => {
      jest.advanceTimersByTime(7000)
    })
    await act(async () => {
      await result.current.makePlayerMove('g1f3')
    })
    expect(sendServerMove).toHaveBeenLastCalledWith(
      'g1',
      2,
      'g1f3',
      7000,
      false,
    )
  })

  it("plays Maia's first move when the player is black", async () => {
    const game = serverGame({
      player_color: 'black',
      moves: ['e2e4'],
      move_times: [1000],
      ply: 1,
      to_move: 'black',
      bot_move: { uci: 'e2e4', ply: 0, delay: 1 },
    })
    const { result } = start(game, config({ player: 'black' }))
    expect(result.current.moveList).toEqual([])
    expect(result.current.playerActive).toBe(false)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current.moveList).toEqual(['e2e4'])
    expect(result.current.playerActive).toBe(true)
    expect(sendServerMove).not.toHaveBeenCalled()
  })

  it('picks a game up with its moves and the clocks as they read now', () => {
    const game = serverGame({
      moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
      move_times: [1000, 1000, 1000, 1000],
      ply: 4,
      clock: {
        white_ms: 290000,
        black_ms: 295000,
        increment_ms: 3000,
        running: 'white',
        since_ms: 20000,
      },
    })
    const { result } = start(game)
    expect(result.current.moveList).toEqual(game.moves)
    expect(result.current.playerActive).toBe(true)
    // The player's clock has been running for 20 s.
    expect(result.current.whiteClock).toBe(270000)
    expect(result.current.blackClock).toBe(295000)
    expect(result.current.lastMoveTime).toBeGreaterThan(0)
  })

  it('ends the game when the server says so, and counts it once', async () => {
    const { result } = start(serverGame())
    sendServerMove.mockResolvedValue(
      serverGame({
        moves: ['f2f3', 'e7e5'],
        ply: 2,
        state: 'rules',
        winner: 'black',
        bot_move: { uci: 'e7e5', ply: 1, delay: 0 },
        rating: {
          player_elo: 1480,
          opponent_elo: 1500,
          player_provisional: true,
        },
      }),
    )
    await act(async () => {
      await result.current.makePlayerMove('f2f3')
    })
    await settle()
    expect(result.current.moveList).toEqual(['f2f3', 'e7e5'])
    expect(result.current.game.termination).toEqual({
      result: '0-1',
      winner: 'black',
      type: 'rules',
    })
    expect(result.current.playerActive).toBe(false)
    expect(updateRating).toHaveBeenCalledWith(1480, true)
    expect(incrementStats).toHaveBeenCalledTimes(1)
    expect(incrementStats).toHaveBeenCalledWith(1, 0)
  })

  it('does not end a game the server says is still going', async () => {
    // Fool's mate on the board, but the server has the last word.
    const game = serverGame({
      moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
      move_times: [0, 0, 0, 0],
      ply: 4,
    })
    const { result } = start(game)
    expect(result.current.game.termination).toBeUndefined()
  })

  it('resigns on the server', async () => {
    const { result } = start(serverGame())
    resignServerGame.mockResolvedValue(
      serverGame({
        state: 'resign',
        winner: 'black',
        rating: {
          player_elo: 1500,
          opponent_elo: 1500,
          player_provisional: false,
        },
      }),
    )
    act(() => result.current.resign())
    await settle()
    expect(resignServerGame).toHaveBeenCalledWith('g1')
    expect(result.current.game.termination?.type).toBe('resign')
    expect(result.current.game.termination?.winner).toBe('black')
  })

  it('asks the server when the clock runs out here, and takes its clocks if it disagrees', async () => {
    const game = serverGame({
      time_control: '1+0',
      moves: ['e2e4', 'e7e5'],
      move_times: [0, 0],
      ply: 2,
      clock: {
        white_ms: 2000,
        black_ms: 60000,
        increment_ms: 0,
        running: 'white',
        since_ms: 0,
      },
    })
    // The server gave back some lag: 3 s are left on its clock.
    flagServerGame.mockResolvedValue({
      ...game,
      clock: { ...game.clock!, white_ms: 3000, since_ms: 0 },
    })
    const { result } = start(game, config({ timeControl: '1+0' }))
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    await settle()
    expect(flagServerGame).toHaveBeenCalledWith('g1')
    expect(result.current.game.termination).toBeUndefined()
    expect(result.current.whiteClock).toBe(3000)

    // When it agrees, the game is lost on time.
    flagServerGame.mockResolvedValue({
      ...game,
      state: 'time',
      winner: 'black',
      clock: { ...game.clock!, white_ms: 0, running: null },
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    await settle()
    expect(result.current.game.termination).toEqual({
      result: '0-1',
      winner: 'black',
      type: 'time',
    })
  })

  it('starts again from the server when the game is not where this page thought', async () => {
    const { ServerGameConflict } = jest.requireMock('src/api/serverGames')
    const onResync = jest.fn()
    const { result } = start(serverGame(), config(), onResync)
    const current = serverGame({ moves: ['d2d4', 'd7d5'], ply: 2 })
    sendServerMove.mockRejectedValue(
      new ServerGameConflict('out_of_sync', current),
    )
    await act(async () => {
      await result.current.makePlayerMove('e2e4')
    })
    await settle()
    expect(onResync).toHaveBeenCalledWith(current)
  })

  it('takes a move back and adds time on the server, in a practice game', async () => {
    const practice = serverGame({
      practice: true,
      moves: ['e2e4', 'e7e5'],
      move_times: [0, 0],
      ply: 2,
      clock: {
        white_ms: 300000,
        black_ms: 300000,
        increment_ms: 3000,
        running: 'white',
        since_ms: 0,
      },
    })
    const onResync = jest.fn()
    const { result } = start(practice, config({ practice: true }), onResync)
    expect(result.current.canTakeBack).toBe(true)

    // The board is drawn again from the server's game after a takeback.
    const takenBack = serverGame({ practice: true })
    takeBackServerGame.mockResolvedValue(takenBack)
    act(() => result.current.takeBack())
    await settle()
    expect(takeBackServerGame).toHaveBeenCalledWith('g1')
    expect(onResync).toHaveBeenCalledWith(takenBack)

    // More time: the clocks are the server's.
    addTimeServerGame.mockResolvedValue({
      ...practice,
      clock: { ...practice.clock!, white_ms: 315000 },
    })
    act(() => result.current.addTime(15000))
    await settle()
    expect(addTimeServerGame).toHaveBeenCalledWith('g1')
    expect(result.current.whiteClock).toBe(315000)
    expect(result.current.moveList).toEqual(['e2e4', 'e7e5'])
  })

  it('asks for an instant reply when thinking time is off', async () => {
    const { result } = start(serverGame(), config(), jest.fn(), false)
    sendServerMove.mockResolvedValue(
      serverGame({
        moves: ['e2e4', 'e7e5'],
        ply: 2,
        bot_move: { uci: 'e7e5', ply: 1, delay: 0 },
      }),
    )
    await act(async () => {
      await result.current.makePlayerMove('e2e4')
    })
    await settle()
    expect(sendServerMove).toHaveBeenCalledWith('g1', 0, 'e2e4', 0, true)
    // No delay: the reply is on the board as soon as it arrives.
    expect(result.current.moveList).toEqual(['e2e4', 'e7e5'])
  })
})
