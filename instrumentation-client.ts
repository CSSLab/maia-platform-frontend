import posthog from 'posthog-js'

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST as string,
  defaults: '2025-05-24',
})
