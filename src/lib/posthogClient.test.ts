const posthog = {
  init: jest.fn(),
  register: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
  get_property: jest.fn(),
  get_distinct_id: jest.fn(),
}
jest.mock('posthog-js', () => ({ __esModule: true, default: posthog }))
jest.mock('src/lib/posthog-browser-config', () => ({
  browserPostHogConfig: {},
}))

import {
  capture,
  identifyUser,
  loadPostHog,
  resetUser,
} from 'src/lib/posthogClient'

describe('posthogClient', () => {
  it('sends what waited for PostHog in order, then directly', async () => {
    capture('a')
    identifyUser('id1', { is_lichess_linked: false })
    capture('b')
    await loadPostHog()
    const order = [
      ...posthog.capture.mock.calls.map((c, i) => [
        posthog.capture.mock.invocationCallOrder[i],
        c[0],
      ]),
      ...posthog.identify.mock.calls.map((c, i) => [
        posthog.identify.mock.invocationCallOrder[i],
        `identify:${c[0]}`,
      ]),
    ]
      .sort((x, y) => (x[0] as number) - (y[0] as number))
      .map((x) => x[1])
    expect(order).toEqual(['a', 'identify:id1', 'b'])

    // Another account in this browser: starts afresh.
    posthog.get_property.mockReturnValue('identified')
    posthog.get_distinct_id.mockReturnValue('id1')
    identifyUser('id2')
    expect(posthog.reset).toHaveBeenCalledTimes(1)
    expect(posthog.identify).toHaveBeenLastCalledWith(
      'id2',
      undefined,
      undefined,
    )

    // The same account again: no reset.
    posthog.get_distinct_id.mockReturnValue('id2')
    identifyUser('id2', { is_lichess_linked: true })
    expect(posthog.reset).toHaveBeenCalledTimes(1)

    resetUser()
    expect(posthog.reset).toHaveBeenCalledTimes(2)
  })
})
