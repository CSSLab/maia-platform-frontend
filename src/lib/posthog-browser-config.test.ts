import type { CaptureResult } from 'posthog-js'
import { dropUnwantedEvents } from './posthog-browser-config'

const exception = (...filenames: (string | undefined)[]) =>
  ({
    uuid: 'u',
    event: '$exception',
    properties: {
      $exception_list: [
        {
          type: 'TypeError',
          value: "Cannot read properties of undefined (reading 'M_ID')",
          stacktrace: { frames: filenames.map((filename) => ({ filename })) },
        },
      ],
    },
  }) as unknown as CaptureResult

describe('dropUnwantedEvents', () => {
  it('drops errors thrown only by browser extensions', () => {
    expect(
      dropUnwantedEvents(
        exception(
          'chrome-extension://eppiocemhmnlbhjplcgkofciiegomcon/executors/200.js',
          'moz-extension://abc/content.js',
        ),
      ),
    ).toBeNull()
  })

  it("keeps an error with a frame from the site's own code", () => {
    const event = exception(
      'chrome-extension://abc/content.js',
      'https://www.maiachess.com/_next/static/chunks/pages/play/maia.js',
    )
    expect(dropUnwantedEvents(event)).toBe(event)
  })

  it('keeps errors with no stack, or frames with no file', () => {
    const noStack = exception()
    expect(dropUnwantedEvents(noStack)).toBe(noStack)
    const noFile = exception(undefined)
    expect(dropUnwantedEvents(noFile)).toBe(noFile)
  })

  it('still drops autocapture and keeps other events', () => {
    expect(
      dropUnwantedEvents({ event: '$autocapture' } as CaptureResult),
    ).toBeNull()
    const pageview = { event: '$pageview' } as CaptureResult
    expect(dropUnwantedEvents(pageview)).toBe(pageview)
  })
})
