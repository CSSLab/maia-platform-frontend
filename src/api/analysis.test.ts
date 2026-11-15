import {
  fetchAnalyzedMaiaGame,
  fetchAnalyzedWorldChampionshipGame,
  fetchPgnOfLichessGame,
  GameLoadError,
  isGameNotFound,
} from './analysis'

const PGN =
  '[Event "rated blitz game"]\n[Site "https://lichess.org/game/W2114ZgI"]\n\n1. b3 e5 0-1\n'
const BATCH_URL =
  'https://lichess.org/api/games/export/_ids?clocks=true&evals=true&opening=true'

const reply = (body: string, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
  })

let fetchMock: jest.Mock

beforeEach(() => {
  fetchMock = jest.fn()
  globalThis.fetch = fetchMock
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('fetchPgnOfLichessGame', () => {
  it('returns the single-game export when Lichess serves it', async () => {
    fetchMock.mockReturnValueOnce(reply(PGN))

    await expect(fetchPgnOfLichessGame('W2114ZgI')).resolves.toBe(PGN)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://lichess.org/game/export/W2114ZgI?clocks=true&evals=true&opening=true',
    )
  })

  it('falls back to the export by id when the redirect fails CORS', async () => {
    // An older game redirects anonymous clients to /signup, which has no CORS
    // headers, so the browser rejects the fetch.
    fetchMock
      .mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')))
      .mockReturnValueOnce(reply(PGN))

    await expect(fetchPgnOfLichessGame('W2114ZgI')).resolves.toBe(PGN)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe(BATCH_URL)
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: 'W2114ZgI',
    })
  })

  it('falls back when the single-game export is not OK', async () => {
    fetchMock.mockReturnValueOnce(reply('Too many requests', 429))
    fetchMock.mockReturnValueOnce(reply(PGN))

    await expect(fetchPgnOfLichessGame('W2114ZgI')).resolves.toBe(PGN)
    expect(fetchMock.mock.calls[1][0]).toBe(BATCH_URL)
  })

  it('uses the early request instead of a new single-game export', async () => {
    await expect(
      fetchPgnOfLichessGame('W2114ZgI', Promise.resolve(PGN)),
    ).resolves.toBe(PGN)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back when the early request failed', async () => {
    fetchMock.mockReturnValueOnce(reply(PGN))

    await expect(
      fetchPgnOfLichessGame(
        'W2114ZgI',
        Promise.reject(new TypeError('Failed to fetch')),
      ),
    ).resolves.toBe(PGN)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(BATCH_URL)
  })

  it('reports a game Lichess does not have as not found', async () => {
    // Lichess answers 404 for the single game, and an empty 200 by ids.
    fetchMock.mockReturnValueOnce(reply('', 404)).mockReturnValueOnce(reply(''))

    const error = await fetchPgnOfLichessGame('notarealgame').catch((e) => e)
    expect(error).toBeInstanceOf(GameLoadError)
    expect(isGameNotFound(error)).toBe(true)
  })

  it('reports a failing export by id as a server error', async () => {
    fetchMock
      .mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')))
      .mockReturnValueOnce(reply('', 503))

    const error = await fetchPgnOfLichessGame('W2114ZgI').catch((e) => e)
    expect(error).toEqual(new GameLoadError(503))
    expect(isGameNotFound(error)).toBe(false)
  })
})

describe('game requests to the Maia server', () => {
  it('reports a rejected world championship game as not found', async () => {
    fetchMock.mockReturnValueOnce(reply('{"detail":"bad id"}', 422))

    const error = await fetchAnalyzedWorldChampionshipGame([
      'notarealgame',
      '1',
    ]).catch((e) => e)
    expect(isGameNotFound(error)).toBe(true)
  })

  it('tells the games of a world championship match apart', async () => {
    // The server sends the match's id for each of its games.
    const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const AFTER_E4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const body = JSON.stringify({
      id: '0KNdpNQd',
      termination: { result: '1/2-1/2', winner: 'none' },
      white_player: { name: 'Schlechter, Carl', rating: 0 },
      black_player: { name: 'Lasker, Emanuel', rating: 0 },
      maia_versions: [],
      maia_evals: {},
      stockfish_evals: [],
      move_maps: [[]],
      game_states: [
        { fen: START, last_move: 'None', last_move_san: null, check: false },
        { fen: AFTER_E4, last_move: 'e2e4', last_move_san: 'e4', check: false },
      ],
    })
    fetchMock.mockReturnValueOnce(reply(body)).mockReturnValueOnce(reply(body))

    const second = await fetchAnalyzedWorldChampionshipGame(['0KNdpNQd', '2'])
    const tenth = await fetchAnalyzedWorldChampionshipGame(['0KNdpNQd', '10'])
    expect([second.id, second.gameIndex]).toEqual(['0KNdpNQd', '2'])
    expect([tenth.id, tenth.gameIndex]).toEqual(['0KNdpNQd', '10'])
    expect(fetchMock.mock.calls[0][0]).toContain(
      'analysis/analysis_list/0KNdpNQd/2',
    )
  })

  it('reports a server failure for a Maia game as not a missing game', async () => {
    fetchMock.mockReturnValueOnce(reply('{}', 500))

    const error = await fetchAnalyzedMaiaGame('abc', 'play').catch((e) => e)
    expect(error).toEqual(new GameLoadError(500))
    expect(isGameNotFound(error)).toBe(false)
  })

  describe('whose stored game it is', () => {
    const storedGame = (extra: object) =>
      JSON.stringify({
        termination: { result: '*', winner: 'none', type: 'unterminated' },
        white_player: { name: 'alice' },
        black_player: { name: 'maia_kdd_1100' },
        created_time: '2026-11-01T12:00:00',
        maia_versions: [],
        maia_evals: {},
        move_maps: [],
        game_states: [
          {
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            last_move: null,
            last_move_san: null,
            check: false,
          },
        ],
        ...extra,
      })

    it('marks someone else’s game, opened by its link, as not yours', async () => {
      fetchMock.mockReturnValueOnce(reply(storedGame({ is_owner: false })))
      const game = await fetchAnalyzedMaiaGame('a1b2c3d4-e5f', 'play')
      expect(game.isOwner).toBe(false)
      expect(game.whitePlayer.name).toBe('alice')
    })

    it('marks your own game as yours', async () => {
      fetchMock.mockReturnValueOnce(reply(storedGame({ is_owner: true })))
      const game = await fetchAnalyzedMaiaGame('a1b2c3d4-e5f', 'play')
      expect(game.isOwner).toBe(true)
    })

    it('takes a reply without is_owner, from an older server, as yours', async () => {
      fetchMock.mockReturnValueOnce(reply(storedGame({})))
      const game = await fetchAnalyzedMaiaGame('custom_a1b2c3d4e5f6', 'custom')
      expect(game.isOwner).toBe(true)
    })
  })

  describe('when a stored game was played', () => {
    const storedGame = (extra: object) =>
      JSON.stringify({
        termination: { result: '1-0', winner: 'white', type: 'resign' },
        white_player: { name: 'alice' },
        black_player: { name: 'maia_kdd_1100' },
        maia_versions: [],
        maia_evals: {},
        move_maps: [],
        game_states: [
          {
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            last_move: null,
            last_move_san: null,
            check: false,
          },
        ],
        ...extra,
      })
    const load = async (extra: object) => {
      fetchMock.mockReturnValueOnce(reply(storedGame(extra)))
      return fetchAnalyzedMaiaGame('a1b2c3d4-e5f', 'play')
    }

    it('reads a time without a zone, as older servers send it, as UTC', async () => {
      const game = await load({ created_time: '2026-11-01T12:00:00.051000' })
      expect(game.createdAt).toBe(Date.UTC(2026, 10, 1, 12, 0, 0, 51))
      expect(game.endedAt).toBeNull()
    })

    it('reads the start and the end a newer server sends', async () => {
      const game = await load({
        created_time: '2026-11-01T12:00:00.051Z',
        ended_time: '2026-11-01T12:07:30Z',
      })
      expect(game.createdAt).toBe(Date.UTC(2026, 10, 1, 12, 0, 0, 51))
      expect(game.endedAt).toBe(Date.UTC(2026, 10, 1, 12, 7, 30))
    })

    it('has no time for a game stored without one', async () => {
      for (const extra of [
        {},
        { created_time: null, ended_time: null },
        { created_time: '????.??.??' },
        { created_time: '' },
      ]) {
        const game = await load(extra)
        expect(game.createdAt).toBeNull()
        expect(game.endedAt).toBeNull()
        // And its Maia is still named, as a current one.
        expect(game.blackPlayer.name).toBe('Maia-3 1100')
      }
    })
  })

  it('treats a network failure as not a missing game', () => {
    expect(isGameNotFound(new TypeError('Failed to fetch'))).toBe(false)
  })
})
