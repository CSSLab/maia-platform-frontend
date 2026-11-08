import type { PostHog } from 'posthog-js'

type Properties = Record<string, unknown>

// PostHog's browser code (~170 KB) loads once the page has drawn
// (loadPostHog, from _app) rather than with Next's start-up code. Events
// tracked before then, and who the visitor is, wait here and are sent once it
// has loaded, in the order they happened.
const MAX_PENDING = 100
type PendingCall =
  | { kind: 'capture'; event: string; properties?: Properties; at: Date }
  | { kind: 'identify'; id: string; set?: Properties; setOnce?: Properties }
  | { kind: 'reset' }
const pending: PendingCall[] = []
let client: PostHog | null = null
let loading: Promise<void> | null = null

const registered: Properties = {}

/** Sent with every event from now on, and on later visits. */
export const registerProperties = (properties: Properties) => {
  Object.assign(registered, properties)
  client?.register(properties)
}

// With localStorage 'maia.analyticsDebug' set to '1', every capture (and
// identify and reset) is also logged to the console, to check what a page
// sends.
let debugLogging: boolean | undefined
const logCapture = (event: string, properties?: Properties) => {
  if (debugLogging === undefined) {
    try {
      debugLogging = window.localStorage.getItem('maia.analyticsDebug') === '1'
    } catch {
      debugLogging = false
    }
  }
  if (debugLogging) console.info('[analytics]', event, properties ?? {})
}

const queue = (call: PendingCall) => {
  // Who the visitor is is always kept: the events after it belong to them.
  if (call.kind !== 'capture' || pending.length < MAX_PENDING) {
    pending.push(call)
  }
}

export const capture = (event: string, properties?: Properties) => {
  logCapture(event, properties)
  if (client) {
    client.capture(event, properties)
  } else {
    queue({ kind: 'capture', event, properties, at: new Date() })
  }
}

/**
 * Sends a capture with `sendBeacon`, so that it still leaves when the tab is
 * closing (pagehide). Before PostHog has loaded there is nothing to send it
 * with, and it waits like any other event (it's lost if the tab closes).
 */
export const captureOnExit = (event: string, properties?: Properties) => {
  logCapture(event, properties)
  if (client) {
    client.capture(event, properties, { transport: 'sendBeacon' })
  } else {
    queue({ kind: 'capture', event, properties, at: new Date() })
  }
}

const applyIdentify = (
  posthog: PostHog,
  id: string,
  set?: Properties,
  setOnce?: Properties,
) => {
  // A browser that was someone else (signed out, or signed in to another
  // account) starts afresh rather than being merged into them.
  if (
    posthog.get_property('$user_state') === 'identified' &&
    posthog.get_distinct_id() !== id
  ) {
    posthog.reset()
  }
  posthog.identify(id, set, setOnce)
}

/**
 * The visitor is this account (the backend's client_id): their events from
 * here on, and this browser's earlier anonymous ones, go to that person.
 */
export const identifyUser = (
  id: string,
  set?: Properties,
  setOnce?: Properties,
) => {
  logCapture('$identify', { distinct_id: id, $set: set, $set_once: setOnce })
  if (client) applyIdentify(client, id, set, setOnce)
  else queue({ kind: 'identify', id, set, setOnce })
}

/** Signed out: later events are no longer this person's. */
export const resetUser = () => {
  logCapture('$reset')
  if (client) client.reset()
  else queue({ kind: 'reset' })
}

export const loadPostHog = () => {
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
      posthog.register(registered)
      // Sent with the time they happened.
      for (const call of pending.splice(0)) {
        if (call.kind === 'capture') {
          posthog.capture(call.event, call.properties, { timestamp: call.at })
        } else if (call.kind === 'identify') {
          applyIdentify(posthog, call.id, call.set, call.setOnce)
        } else {
          posthog.reset()
        }
      }
    })
    .catch((error) => {
      loading = null
      console.error('Failed to load PostHog:', error)
    })
  return loading
}
