import { fetchAsGuest, requestAccount } from './guest'

const reply = (status: number, body: unknown = {}) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response)

describe('fetchAsGuest', () => {
  afterEach(() => {
    delete window.__account
  })

  it('gets the guest cookie and asks again after a 401', async () => {
    const calls: string[] = []
    let hasCookie = false
    global.fetch = jest.fn((url: string) => {
      calls.push(url)
      if (url.endsWith('auth/account')) {
        hasCookie = true
        return reply(200, { client_id: 'guest' })
      }
      return reply(hasCookie ? 200 : 401)
    }) as unknown as typeof fetch

    const res = await fetchAsGuest('/api/v1/play/start_game')
    expect(res.status).toBe(200)
    expect(calls).toEqual([
      '/api/v1/play/start_game',
      '/api/v1/auth/account',
      '/api/v1/play/start_game',
    ])
  })

  it("waits for the page's own account request instead of starting another", async () => {
    let resolveEarly: (data: { client_id: string }) => void = () => undefined
    window.__account = new Promise((resolve) => (resolveEarly = resolve))
    const calls: string[] = []
    let hasCookie = false
    global.fetch = jest.fn((url: string) => {
      calls.push(url)
      return reply(hasCookie ? 200 : 401)
    }) as unknown as typeof fetch

    const pending = fetchAsGuest('/api/v1/puzzle/new_puzzle')
    await new Promise((r) => setTimeout(r, 0))
    hasCookie = true
    resolveEarly({ client_id: 'guest' })
    expect((await pending).status).toBe(200)
    expect(calls).not.toContain('/api/v1/auth/account')
  })

  it('asks only once more, and leaves other answers as they are', async () => {
    global.fetch = jest.fn(() => reply(401)) as unknown as typeof fetch
    expect((await fetchAsGuest('/api/v1/turing/new_game')).status).toBe(401)
    expect(global.fetch).toHaveBeenCalledTimes(3)

    global.fetch = jest.fn(() => reply(404)) as unknown as typeof fetch
    expect((await fetchAsGuest('/api/v1/turing/new_game')).status).toBe(404)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('shares one account request between callers', async () => {
    global.fetch = jest.fn(() =>
      reply(200, { client_id: 'guest' }),
    ) as unknown as typeof fetch
    await Promise.all([requestAccount(), requestAccount()])
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
