import { fetchGameMove, MoveRequestError, retryUnlessRejected } from './play'

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
