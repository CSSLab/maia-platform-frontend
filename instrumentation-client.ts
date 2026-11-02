import posthog from 'posthog-js'
import { browserPostHogConfig } from 'src/lib/posthog-browser-config'

posthog.init(
  process.env.NEXT_PUBLIC_POSTHOG_KEY as string,
  browserPostHogConfig,
)
