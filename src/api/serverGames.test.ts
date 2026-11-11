import {
  ServerGameConflict,
  addTimeServerGame,
  createServerGame,
  fetchCurrentServerGame,
  sendServerMove,
  sendServerPiece,
  takeBackServerGame,
} from './serverGames'
import { MoveRequestError } from './play'

const state = (fields: Record<string, unknown> = {}) => ({
  game_id: 'abc123',
  moves: [],
  state: 'not_over',
  ...fields,
})

const answer = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response

describe('games the server holds: requests', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('starts a game with its settings', async () => {
    fetchMock.mockResolvedValue(answer(201, state()))
    const created = await createServerGame({
      playerColor: 'black',
      maiaVersion: 'maia_kdd_1500',
      timeControl: '5+3',
      sampleMoves: true,
      startFen: undefined,
      instant: false,
    })
    expect(created).toEqual({ game: state(), inProgress: false })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/play/games')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      game_type: 'play',
      player_color: 'black',
      maia_name: 'maia_kdd_1500',
      practice: false,
      time_control: '5+3',
      sample_moves: true,
      fen: null,
      instant: false,
    })
  })

  it('starts a hand or brain game with its partner', async () => {
    fetchMock.mockResolvedValue(answer(201, state()))
    await createServerGame({
      gameType: 'brain',
      playerColor: 'white',
      maiaVersion: 'maia_kdd_1500',
      maiaPartnerVersion: 'maia_kdd_1900',
      timeControl: 'unlimited',
      sampleMoves: true,
      instant: true,
    })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      game_type: 'brain',
      player_color: 'white',
      maia_name: 'maia_kdd_1500',
      maia_friendly_name: 'maia_kdd_1900',
      time_control: 'unlimited',
      sample_moves: true,
      fen: null,
      instant: true,
    })
  })

  it('names a piece in a brain game, and asks for takebacks and time', async () => {
    fetchMock.mockResolvedValue(answer(200, state()))
    await sendServerPiece('abc123', 2, 'n', 900, false)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/play/games/abc123/moves')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      ply: 2,
      piece: 'n',
      think_ms: 900,
      instant: false,
    })
    await takeBackServerGame('abc123')
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/v1/play/games/abc123/takeback',
    )
    await addTimeServerGame('abc123')
    expect(fetchMock.mock.calls[2][0]).toBe(
      '/api/v1/play/games/abc123/add_time',
    )
  })

  it('is given the game in progress instead of a new one', async () => {
    const open = state({ game_id: 'open-game', moves: ['e2e4', 'e7e5'] })
    fetchMock.mockResolvedValue(
      answer(409, { code: 'game_in_progress', game: open }),
    )
    const created = await createServerGame({
      playerColor: 'white',
      maiaVersion: 'maia_kdd_1500',
      timeControl: '5+3',
      sampleMoves: true,
      instant: false,
    })
    expect(created).toEqual({ game: open, inProgress: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("sends a move with its ply and the player's thinking time", async () => {
    fetchMock.mockResolvedValue(answer(200, state({ moves: ['e2e4', 'e7e5'] })))
    await sendServerMove('abc123', 0, 'e2e4', 3400, true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/play/games/abc123/moves')
    expect(JSON.parse(init.body)).toEqual({
      ply: 0,
      move: 'e2e4',
      think_ms: 3400,
      instant: true,
    })
  })

  it('sends a move again when the connection drops, and not when it is refused', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(answer(502, null))
      .mockResolvedValueOnce(answer(200, state({ moves: ['e2e4', 'e7e5'] })))
    const game = await sendServerMove('abc123', 0, 'e2e4', 100, false)
    expect(game.moves).toEqual(['e2e4', 'e7e5'])
    expect(fetchMock).toHaveBeenCalledTimes(3)

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(answer(400, { detail: 'not a legal move' }))
    await expect(
      sendServerMove('abc123', 2, 'e2e5', 100, false),
    ).rejects.toBeInstanceOf(MoveRequestError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a game that has moved on, with where it is', async () => {
    const current = state({ moves: ['e2e4', 'e7e5'] })
    fetchMock.mockResolvedValue(
      answer(409, { code: 'out_of_sync', game: current }),
    )
    const error = await sendServerMove('abc123', 4, 'g1f3', 100, false).catch(
      (e) => e,
    )
    expect(error).toBeInstanceOf(ServerGameConflict)
    expect(error.code).toBe('out_of_sync')
    expect(error.game).toEqual(current)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('asks for the game in progress', async () => {
    fetchMock.mockResolvedValue(answer(200, { game: null }))
    expect(await fetchCurrentServerGame()).toBeNull()
    fetchMock.mockResolvedValue(answer(200, { game: state() }))
    expect(await fetchCurrentServerGame()).toEqual(state())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/play/games/current')
  })
})
