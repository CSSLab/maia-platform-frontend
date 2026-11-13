import {
  fetchGameMove,
  fetchPlayPlayerStats,
  MoveRequestError,
  retryUnlessRejected,
  startGame,
  startGameWithRetry,
} from './play'

const respond = (status: number, body: unknown) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch
}

describe('fetchGameMove', () => {
  it("returns Maia's move", async () => {
    respond(200, { top_move: 'e2e4', move_delay: 0.4 })
    await expect(fetchGameMove([])).resolves.toEqual({
      top_move: 'e2e4',
      move_delay: 0.4,
    })
  })

  it('sends the clocks, increment included', async () => {
    respond(200, { top_move: 'e2e4', move_delay: 0.4 })
    await fetchGameMove(['e2e4'], 'maia_kdd_1500', null, null, 600, 412.5, 5)
    const url = new URL(
      (global.fetch as jest.Mock).mock.calls[0][0],
      'https://example.com',
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      maia_name: 'maia_kdd_1500',
      initial_clock: '600',
      increment: '5',
      current_clock: '412.5',
      maia_version: 'maia3',
    })
  })

  it('throws, with the status, when the server rejects the request', async () => {
    respond(400, { detail: 'Illegal move order given' })
    const error = await fetchGameMove(['e2e5']).catch((e) => e)
    expect(error).toBeInstanceOf(MoveRequestError)
    expect(error.status).toBe(400)
    expect(error.message).toBe("Maia's move: HTTP 400 Illegal move order given")
    expect(retryUnlessRejected(error)).toBe(false)
  })

  it('throws, and is retried, when the server fails', async () => {
    respond(500, null)
    const error = await fetchGameMove([]).catch((e) => e)
    expect(error).toBeInstanceOf(MoveRequestError)
    expect(retryUnlessRejected(error)).toBe(true)
  })

  it('throws when the answer has no move', async () => {
    respond(200, {})
    await expect(fetchGameMove([])).rejects.toBeInstanceOf(MoveRequestError)
  })

  it('retries a failed connection', () => {
    expect(retryUnlessRejected(new TypeError('Failed to fetch'))).toBe(true)
  })
})

const reply = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })

describe('startGame', () => {
  const start = (retried = false) =>
    (retried ? startGameWithRetry : startGame)(
      'white',
      'maia_kdd_600',
      'play',
      true,
      'unlimited',
    )

  it("returns the new game's id", async () => {
    respond(200, { game_id: 'abc', opponent_elo: 1500 })
    await expect(start()).resolves.toEqual({
      gameId: 'abc',
      opponentElo: 1500,
    })
  })

  it('throws, with the status, when the server fails', async () => {
    respond(502, null)
    const error = await start().catch((e) => e)
    expect(error).toBeInstanceOf(MoveRequestError)
    expect(error.status).toBe(502)
  })

  it('retries a dropped connection until the game starts', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockReturnValueOnce(reply(503, null))
      .mockReturnValueOnce(reply(200, { game_id: 'abc', opponent_elo: 1500 }))
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(start(true)).resolves.toMatchObject({ gameId: 'abc' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry a request the server rejected', async () => {
    // 401 twice: fetchAsGuest's retry after the account request, which
    // answers 401 too (its body is not read).
    const fetchMock = jest.fn().mockImplementation(() => reply(401, {}))
    global.fetch = fetchMock as unknown as typeof fetch

    const error = await start(true).catch((e) => e)
    expect(error).toBeInstanceOf(MoveRequestError)
    expect(error.status).toBe(401)
    // start_game, the account request, start_game again: once only.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('fetchPlayPlayerStats', () => {
  // play/get_player_stats (CSSLab/maia-platform-backend#293).
  const STATS = {
    play_games_played: 3,
    hand_games_played: 40,
    brain_games_played: 0,
    play_won: 1,
    play_drawn: 0,
    hand_won: 22,
    hand_drawn: 3,
    brain_won: 0,
    brain_drawn: 0,
    play_elo: 1540,
    hand_elo: 1610,
    brain_elo: 1500,
  }

  it('reads whether each rating is provisional', async () => {
    respond(200, {
      ...STATS,
      play_provisional: true,
      hand_provisional: false,
      brain_provisional: true,
    })
    expect(await fetchPlayPlayerStats()).toMatchObject({
      playElo: 1540,
      playProvisional: true,
      handElo: 1610,
      handProvisional: false,
      brainElo: 1500,
      brainProvisional: true,
    })
  })

  it('takes a rating as settled when the backend does not say', async () => {
    respond(200, STATS)
    expect(await fetchPlayPlayerStats()).toMatchObject({
      playProvisional: false,
      handProvisional: false,
      brainProvisional: false,
    })
  })
})
