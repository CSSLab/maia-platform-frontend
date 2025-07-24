import PostHogClient from '../../src/lib/posthog'

// Mock PostHog
jest.mock('posthog-node', () => ({
  PostHog: jest.fn().mockImplementation((key, options) => ({
    key,
    options,
    capture: jest.fn(),
    flush: jest.fn(),
  })),
}))

describe('PostHog Client', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should create PostHog client with environment variables', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key'
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://test.posthog.com'

    const { PostHog } = jest.requireMock('posthog-node')
    const client = PostHogClient()

    expect(PostHog).toHaveBeenCalledWith('test-key', {
      host: 'https://test.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    })
    expect(client).toBeDefined()
  })

  it('should create client with correct configuration', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'production-key'
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://app.posthog.com'

    const { PostHog } = jest.requireMock('posthog-node')
    PostHogClient()

    expect(PostHog).toHaveBeenCalledWith('production-key', {
      host: 'https://app.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    })
  })

  it('should handle undefined environment variables', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST

    const { PostHog } = jest.requireMock('posthog-node')
    PostHogClient()

    expect(PostHog).toHaveBeenCalledWith(undefined, {
      host: undefined,
      flushAt: 1,
      flushInterval: 0,
    })
  })

  it('should use flushAt=1 for immediate flushing', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key'

    const { PostHog } = jest.requireMock('posthog-node')
    PostHogClient()

    expect(PostHog).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        flushAt: 1,
      }),
    )
  })

  it('should use flushInterval=0 for immediate flushing', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key'

    const { PostHog } = jest.requireMock('posthog-node')
    PostHogClient()

    expect(PostHog).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        flushInterval: 0,
      }),
    )
  })

  it('should return a PostHog instance with expected methods', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key'

    const client = PostHogClient()

    expect(client).toHaveProperty('capture')
    expect(client).toHaveProperty('flush')
  })

  it('should create new instance on each call', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key'

    const client1 = PostHogClient()
    const client2 = PostHogClient()

    expect(client1).not.toBe(client2)
  })

  it('should handle empty string environment variables', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = ''
    process.env.NEXT_PUBLIC_POSTHOG_HOST = ''

    const { PostHog } = jest.requireMock('posthog-node')
    PostHogClient()

    expect(PostHog).toHaveBeenCalledWith('', {
      host: '',
      flushAt: 1,
      flushInterval: 0,
    })
  })
})
