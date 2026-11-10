import { capture } from 'src/lib/posthogClient'

// The page's Largest Contentful Paint, sent as the $web_vitals event PostHog's
// web-vitals code sends, with the same rules: the last paint before the first
// click or key press, or before the page is hidden. PostHog loads after the
// page has drawn (src/lib/posthogClient) and its own LCP waited for a click
// after that, so visitors who chose a side on /play at once sent none; this
// starts before the app does (instrumentation-client.ts).
const GOOD = 2500
const POOR = 4000

type Navigation = PerformanceNavigationTiming & { activationStart?: number }
type DocumentState = Document & {
  prerendering?: boolean
  wasDiscarded?: boolean
}

export const reportLargestContentfulPaint = () => {
  if (
    typeof PerformanceObserver === 'undefined' ||
    !PerformanceObserver.supportedEntryTypes?.includes(
      'largest-contentful-paint',
    )
  ) {
    return
  }
  const doc = document as DocumentState
  // Paints after the page is first hidden don't count.
  let hiddenAt =
    doc.visibilityState === 'hidden' && !doc.prerendering ? 0 : Infinity
  // The page that loaded: the app may have moved on by the time this is sent.
  const { href, pathname } = location
  let last: LargestContentfulPaint | undefined
  let done = false

  const take = (entries: PerformanceEntryList) => {
    for (const entry of entries) {
      if (entry.startTime < hiddenAt) last = entry as LargestContentfulPaint
    }
  }
  const observer = new PerformanceObserver((list) => take(list.getEntries()))

  const finish = () => {
    if (done) return
    done = true
    take(observer.takeRecords())
    observer.disconnect()
    removeEventListener('keydown', onInput, true)
    removeEventListener('click', onInput, true)
    removeEventListener('visibilitychange', onVisibilityChange, true)
    if (!last) return

    const navigation = performance.getEntriesByType?.('navigation')[0] as
      | Navigation
      | undefined
    const activationStart = navigation?.activationStart ?? 0
    const value = Math.max(last.startTime - activationStart, 0)
    const navigationType =
      doc.prerendering || activationStart > 0
        ? 'prerender'
        : doc.wasDiscarded
          ? 'restore'
          : (navigation?.type.replace(/_/g, '-') ?? 'navigate')
    capture('$web_vitals', {
      $web_vitals_LCP_value: value,
      $web_vitals_LCP_event: {
        name: 'LCP',
        value,
        delta: value,
        rating:
          value > POOR ? 'poor' : value > GOOD ? 'needs-improvement' : 'good',
        entries: [last.toJSON()],
        id: `v4-${Date.now()}-${Math.floor(8999999999999 * Math.random()) + 1e12}`,
        navigationType,
        $current_url: href,
        timestamp: Date.now(),
      },
      $current_url: href,
      $pathname: pathname,
    })
  }

  // Once the click's own work is done, as web-vitals does.
  const onInput = () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(finish)
    } else {
      setTimeout(finish, 0)
    }
  }
  const onVisibilityChange = (event: Event) => {
    if (doc.visibilityState !== 'hidden') return
    hiddenAt = Math.min(hiddenAt, event.timeStamp)
    finish()
  }

  observer.observe({ type: 'largest-contentful-paint', buffered: true })
  addEventListener('keydown', onInput, true)
  addEventListener('click', onInput, true)
  addEventListener('visibilitychange', onVisibilityChange, true)
}
