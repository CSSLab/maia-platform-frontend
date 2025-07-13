import { PostHog } from 'posthog-js'

let posthogInstance: PostHog | null = null

export const initPostHog = (): PostHog | null => {
  if (typeof window === 'undefined') return null

  try {
    if (!posthogInstance) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { default: posthog } = require('posthog-js')

      const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
      if (!apiKey) {
        console.warn('PostHog API key not found')
        return null
      }

      posthog.init(apiKey, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
        capture_pageviews: true,
        capture_pageleaves: true,
        loaded: (_posthogLoaded: PostHog) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('PostHog loaded')
          }
        },
      })

      posthogInstance = posthog
    }

    return posthogInstance
  } catch (error) {
    console.error('Failed to initialize PostHog:', error)
    return null
  }
}

export const getPostHog = (): PostHog | null => {
  if (typeof window === 'undefined') return null
  return posthogInstance || initPostHog()
}
