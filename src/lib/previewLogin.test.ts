import {
  fetchLoginOriginProof,
  isVercelPreview,
  lichessLoginUrl,
} from './previewLogin'

const LOGIN = '/api/v1/auth/lichess_login'

describe('lichessLoginUrl', () => {
  it('is the login as before without a proof', () => {
    expect(
      lichessLoginUrl(LOGIN, 'https://www.maiachess.com/analysis?x=1'),
    ).toBe(
      `${LOGIN}?redirect_url=${encodeURIComponent('https://www.maiachess.com/analysis?x=1')}`,
    )
    expect(lichessLoginUrl(LOGIN, 'https://a/', null)).toBe(
      `${LOGIN}?redirect_url=${encodeURIComponent('https://a/')}`,
    )
  })

  it('carries a preview proof, escaped', () => {
    expect(lichessLoginUrl(LOGIN, 'https://p.vercel.app/', 'ab-c_d.e+f')).toBe(
      `${LOGIN}?redirect_url=${encodeURIComponent('https://p.vercel.app/')}&origin_proof=ab-c_d.e%2Bf`,
    )
  })
})

describe('isVercelPreview', () => {
  const before = process.env.NEXT_PUBLIC_VERCEL_ENV
  afterEach(() => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = before
  })

  it('is true only on preview builds', () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
    expect(isVercelPreview()).toBe(true)
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
    expect(isVercelPreview()).toBe(false)
    delete process.env.NEXT_PUBLIC_VERCEL_ENV
    expect(isVercelPreview()).toBe(false)
  })
})

describe('fetchLoginOriginProof', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
  })

  const answer = (status: number, body: unknown) =>
    jest.fn().mockResolvedValue({ ok: status === 200, json: async () => body })

  it('returns the proof the route signs', async () => {
    global.fetch = answer(200, { proof: 'body.sig' }) as unknown as typeof fetch
    await expect(fetchLoginOriginProof()).resolves.toBe('body.sig')
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      '/api/login-origin',
    )
  })

  it('is null when the route has none, answers oddly or fails', async () => {
    global.fetch = answer(404, {
      detail: 'Not found',
    }) as unknown as typeof fetch
    await expect(fetchLoginOriginProof()).resolves.toBeNull()
    global.fetch = answer(200, { proof: 7 }) as unknown as typeof fetch
    await expect(fetchLoginOriginProof()).resolves.toBeNull()
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('offline')) as unknown as typeof fetch
    await expect(fetchLoginOriginProof()).resolves.toBeNull()
  })
})
