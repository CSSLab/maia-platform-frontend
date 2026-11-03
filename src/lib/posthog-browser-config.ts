import {
  COPY_AUTOCAPTURE_EVENT,
  type CaptureResult,
  type PostHogConfig,
} from 'posthog-js'

const dropAutocaptureEvents = (event: CaptureResult | null) => {
  if (!event) {
    return event
  }

  if (
    event.event === '$autocapture' ||
    event.event === COPY_AUTOCAPTURE_EVENT
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
  capture_exceptions: true,
  capture_performance: {
    web_vitals: true,
    // LCP is sent by src/lib/largestContentfulPaint, which starts before
    // PostHog has loaded.
    web_vitals_allowed_metrics: ['FCP', 'CLS', 'INP'],
    network_timing: false,
  },
  before_send: dropAutocaptureEvents,
}
