declare module 'posthog-node' {
  export interface PostHogOptions {
    host?: string
    flushAt?: number
    flushInterval?: number
  }

  export class PostHog {
    constructor(apiKey: string, options?: PostHogOptions)
  }
}
