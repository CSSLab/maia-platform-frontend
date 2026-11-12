import { act, renderHook } from '@testing-library/react'
import { PlayGameConfig } from 'src/types'
import { ServerGame, serverGameStart } from 'src/lib/serverGames'
import { useHandBrainController } from './useHandBrainController'

const sendServerMove = jest.fn()
const sendServerPiece = jest.fn()
const resignServerGame = jest.fn()
const fetchMaiaMove = jest.fn()
const logGameMove = jest.fn()
const incrementStats = jest.fn()
const updateRating = jest.fn()

jest.mock('src/lib/analytics', () => ({
  trackPlayGameStarted: jest.fn(),
  trackPlayGameFirstMoves: jest.fn(),
  trackPlayGameEnded: jest.fn(),
}))
const playMoveSound = jest.fn()
jest.mock('src/hooks/useSound', () => ({
  useSound: () => ({
    playMoveSound: (...args: unknown[]) => playMoveSound(...args),
  }),
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
    sendServerPiece: (...args: unknown[]) => sendServerPiece(...args),
    resignServerGame: (...args: unknown[]) => resignServerGame(...args),
    flagServerGame: jest.fn(),
    skipDelayServerGame: jest.fn(),
  }
})

const config = (isBrain: boolean): PlayGameConfig => ({
  player: 'white',
  timeControl: 'unlimited',
  maiaVersion: 'maia_kdd_1500',
  maiaPartnerVersion: 'maia_kdd_1900',
  playType: 'handAndBrain',
  isBrain,
  sampleMoves: true,
})

const serverGame = (fields: Partial<ServerGame> = {}): ServerGame => ({
  game_id: 'g1',
  game_type: 'hand',
  maia_partner_name: 'maia_kdd_1900',
  partner_piece: null,
  brain_moves: [],
  player_move: null,
  player_color: 'white',
  maia_name: 'maia_kdd_1500',
  time_control: 'unlimited',
  sample_moves: true,
  practice: false,
  fen: '',
  moves: [],
  move_times: [],
  ply: 0,
  to_move: 'white',
  state: 'not_over',
  winner: '',
  clock: null,
  bot_move: null,
  rating: null,
  ...fields,
})

const start = (game: ServerGame, isBrain: boolean) => {
  const gameConfig = config(isBrain)
  return renderHook(() =>
    useHandBrainController(
      game.game_id,
      gameConfig,
      false,
      serverGameStart(game, gameConfig),
      game,
      jest.fn(),
    ),
  )
}

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}

describe('hand and brain in a game the server holds', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    for (const mock of [
      playMoveSound,
      sendServerMove,
      sendServerPiece,
      resignServerGame,
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

  it("hand: the brain's piece comes from the server, and only it can be moved", async () => {
    const { result } = start(serverGame({ partner_piece: 'n' }), false)
    await settle()
    expect(result.current.selectedPiece).toBe('n')
    // Only knight moves are offered.
    expect(new Set(result.current.availableMoves.map((m) => m.from))).toEqual(
      new Set(['b1', 'g1']),
    )

    sendServerMove.mockResolvedValue(
      serverGame({
        moves: ['g1f3', 'd7d5'],
        move_times: [0, 0],
        ply: 2,
        partner_piece: 'p',
        brain_moves: ['n'],
        bot_move: { uci: 'd7d5', ply: 1, delay: 0 },
      }),
    )
    await act(async () => {
      await result.current.makePlayerMove('g1f3')
    })
    await settle()
    expect(sendServerMove).toHaveBeenCalledWith(
      'g1',
      0,
      'g1f3',
      expect.any(Number),
      true,
    )
    expect(result.current.moveList).toEqual(['g1f3', 'd7d5'])
    // The next piece is the brain's again.
    expect(result.current.selectedPiece).toBe('p')
    // The browser asks no Maia for anything itself.
    expect(fetchMaiaMove).not.toHaveBeenCalled()
    expect(logGameMove).not.toHaveBeenCalled()
  })

  it('brain: the player names a piece, and the server answers with the move and the reply', async () => {
    const { result } = start(serverGame({ game_type: 'brain' }), true)
    await settle()
    expect(result.current.selectedPiece).toBeUndefined()
    // The brain makes no moves itself.
    expect(result.current.availableMoves).toEqual([])

    sendServerPiece.mockResolvedValue(
      serverGame({
        game_type: 'brain',
        moves: ['g1f3', 'd7d5'],
        move_times: [1200, 0],
        ply: 2,
        brain_moves: ['n'],
        player_move: { uci: 'g1f3', ply: 0 },
        bot_move: { uci: 'd7d5', ply: 1, delay: 0 },
      }),
    )
    await act(async () => {
      await result.current.selectPiece('n')
    })
    expect(sendServerPiece).toHaveBeenCalledWith(
      'g1',
      0,
      'n',
      expect.any(Number),
      true,
    )
    await settle()
    // The hand's move is on the board at once; the opponent's reply follows
    // a moment later, so that each is seen and heard (thinking time is off,
    // and both came in one answer).
    expect(result.current.moveList).toEqual(['g1f3'])
    expect(playMoveSound).toHaveBeenCalledTimes(1)
    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(result.current.moveList).toEqual(['g1f3', 'd7d5'])
    expect(playMoveSound).toHaveBeenCalledTimes(2)
    expect(result.current.selectedPiece).toBeUndefined()
    expect(result.current.playerActive).toBe(true)
    expect(fetchMaiaMove).not.toHaveBeenCalled()
  })

  it('resigns on the server, and counts the game', async () => {
    const { result } = start(serverGame({ partner_piece: 'p' }), false)
    resignServerGame.mockResolvedValue(
      serverGame({
        state: 'resign',
        winner: 'black',
        rating: {
          player_elo: 1470,
          opponent_elo: 1500,
          player_provisional: false,
        },
      }),
    )
    act(() => result.current.resign())
    await settle()
    expect(result.current.game.termination?.type).toBe('resign')
    expect(result.current.selectedPiece).toBeUndefined()
    expect(updateRating).toHaveBeenCalledWith(1470, false)
    expect(incrementStats).toHaveBeenCalledWith(1, 0)
  })
})
