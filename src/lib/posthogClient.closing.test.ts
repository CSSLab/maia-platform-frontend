jest.mock('src/lib/looksAutomated', () => ({ looksAutomated: () => true }))

import { whenPageCloses } from './posthogClient'

it('runs what is to be tracked as the page closes, until removed', () => {
  const handler = jest.fn()
  const remove = whenPageCloses(handler)
  window.dispatchEvent(new Event('pagehide'))
  expect(handler).toHaveBeenCalledTimes(1)

  remove()
  window.dispatchEvent(new Event('pagehide'))
  expect(handler).toHaveBeenCalledTimes(1)
})
