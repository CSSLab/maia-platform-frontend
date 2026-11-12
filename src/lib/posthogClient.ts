import type { PostHog } from 'posthog-js'
import { looksAutomated } from 'src/lib/looksAutomated'

type Properties = Record<string, unknown>

// PostHog's browser code (~170 KB) loads once the page has drawn
// (loadPostHog, from _app) rather than with Next's start-up code. Events
// tracked before then wait here and are sent once it has loaded.
const MAX_PENDING = 100
const pending: [string, Properties | undefined, Date][] = []
let client: PostHog | null = null
let loading: Promise<void> | null = null

const registered: Properties = {}

/** Sent with every event from now on, and on later visits. */
export const registerProperties = (properties: Properties) => {
  Object.assign(registered, properties)
  client?.register(properties)
}

export const capture = (event: string, properties?: Properties) => {
  if (client) {
    client.capture(event, properties)
  } else if (pending.length < MAX_PENDING) {
    pending.push([event, properties, new Date()])
  }
}

export const loadPostHog = () => {
  // Crawlers, link scanners and test scripts aren't visitors: without
  // PostHog their events stay in `pending` and are never sent.
  if (looksAutomated()) return Promise.resolve()
  loading ??= Promise.all([
    import('posthog-js'),
    import('src/lib/posthog-browser-config'),
  ])
    .then(([{ default: posthog }, { browserPostHogConfig }]) => {
      // The settings instrumentation-client.ts used, which initialised
      // PostHog before the app ran.
      posthog.init(
        process.env.NEXT_PUBLIC_POSTHOG_KEY as string,
        browserPostHogConfig,
      )
      client = posthog
      // Left over from the Maia download prompt experiment (Nov 2026), which
      // registered it for good.
      posthog.unregister('maia_prompt_variant')
      posthog.register(registered)
      // Sent with the time they happened.
      for (const [event, properties, timestamp] of pending.splice(0)) {
        posthog.capture(event, properties, { timestamp })
      }
    })
    .catch((error) => {
      loading = null
      console.error('Failed to load PostHog:', error)
    })
  return loading
}
