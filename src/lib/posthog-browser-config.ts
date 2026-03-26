import { COPY_AUTOCAPTURE_EVENT, type CaptureResult, type PostHogConfig } from 'posthog-js'

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
  | 'autocapture'
  | 'before_send'
  | 'capture_pageleave'
  | 'capture_pageview'
  | 'capture_performance'
  | 'defaults'
> = {
  defaults: '2025-05-24',
  autocapture: false,
  capture_pageview: true,
  capture_pageleave: false,
  capture_performance: false,
  before_send: dropAutocaptureEvents,
}
