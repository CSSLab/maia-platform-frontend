import {
  COPY_AUTOCAPTURE_EVENT,
  type CaptureResult,
  type PostHogConfig,
} from 'posthog-js'

const EXTENSION_URL =
  /^(chrome|moz|safari|safari-web|ms-browser)-extension:\/\//

type ExceptionList = {
  stacktrace?: { frames?: { filename?: string }[] }
}[]

/**
 * An error thrown only by browser extensions' code, not the site's. Extensions
 * run on the page, so PostHog catches their errors too: one extension sent
 * 2,000 a week ("Cannot read properties of undefined (reading 'M_ID')"), each
 * a request through /ingest. An error with any frame from the site is kept.
 */
const isExtensionError = (event: CaptureResult) => {
  if (event.event !== '$exception') return false
  const list = event.properties?.$exception_list as ExceptionList | undefined
  const frames = list?.flatMap((e) => e.stacktrace?.frames ?? []) ?? []
  return (
    frames.length > 0 &&
    frames.every((f) => !!f.filename && EXTENSION_URL.test(f.filename))
  )
}

export const dropUnwantedEvents = (event: CaptureResult | null) => {
  if (!event) {
    return event
  }

  if (
    event.event === '$autocapture' ||
    event.event === COPY_AUTOCAPTURE_EVENT ||
    isExtensionError(event)
  ) {
    return null
  }

  return event
}

export const browserPostHogConfig: Pick<
  PostHogConfig,
  | 'api_host'
  | 'autocapture'
  | 'before_send'
  | 'capture_exceptions'
  | 'capture_pageleave'
  | 'capture_pageview'
  | 'capture_performance'
  | 'defaults'
  | 'disable_session_recording'
  | 'enable_heatmaps'
  | 'request_queue_config'
  | 'ui_host'
> = {
  // Through the rewrites in next.config.js, so ad blockers don't drop events.
  api_host: '/ingest',
  ui_host: 'https://us.posthog.com',
  defaults: '2025-05-24',
  autocapture: false,
  // Also records navigation within the app, not just full page loads.
  capture_pageview: 'history_change',
  capture_pageleave: false,
  // Both are switched on in PostHog's project settings, and each sends data
  // through /ingest every few seconds while a page is in use, which the
  // site's host counts as a request each time. Heatmaps sent about 500,000
  // points a day, most of the 200,000 /ingest requests. Replays stopped on
  // Oct 30 when the month's free recordings ran out, but would start again
  // with the next month's. Neither is used; turn one on here if it is needed,
  // for a sample of visits.
  enable_heatmaps: false,
  disable_session_recording: true,
  capture_exceptions: true,
  // Events are sent together in one request each time this passes, and each
  // request through /ingest is billed: at the default 3 s, about 65,000 a day
  // for 67,000 events. 5 s is the most PostHog allows; what is waiting is
  // still sent when the page is left.
  request_queue_config: { flush_interval_ms: 5000 },
  capture_performance: {
    web_vitals: true,
    // LCP is sent by src/lib/largestContentfulPaint, which starts before
    // PostHog has loaded.
    web_vitals_allowed_metrics: ['FCP', 'CLS', 'INP'],
    network_timing: false,
  },
  before_send: dropUnwantedEvents,
}
