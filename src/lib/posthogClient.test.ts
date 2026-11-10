jest.mock('src/lib/looksAutomated', () => ({ looksAutomated: () => true }))
jest.mock('posthog-js', () => {
  throw new Error('PostHog should not load for an automated browser')
})

import { capture, loadPostHog } from './posthogClient'

describe('loadPostHog', () => {
  it("doesn't load PostHog in a browser run by a program", async () => {
    // Loading it would fail (mocked above) and log the failure.
    const failed = jest.spyOn(console, 'error').mockImplementation(() => {})
    capture('$pageview')
    await expect(loadPostHog()).resolves.toBeUndefined()
    expect(failed).not.toHaveBeenCalled()
  })
})
