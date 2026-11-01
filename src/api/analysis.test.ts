import { fetchPgnOfLichessGame } from './analysis'

const PGN =
  '[Event "rated blitz game"]\n[Site "https://lichess.org/game/W2114ZgI"]\n\n1. b3 e5 0-1\n'
const BATCH_URL =
  'https://lichess.org/api/games/export/_ids?clocks=true&evals=true&opening=true'

const reply = (body: string, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    text: () => Promise.resolve(body),
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
      'https://lichess.org/game/export/W2114ZgI',
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
})
