import { reportLargestContentfulPaint } from 'src/lib/largestContentfulPaint'

// Next runs this before the app starts; PostHog loads once the page has drawn
// (src/lib/posthogClient).
reportLargestContentfulPaint()
