/** @type {import('next').NextConfig} */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const withTM = require('next-transpile-modules')(['@react-chess/chessground'])

module.exports = withTM({
  reactStrictMode: false,
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/openings',
        destination: '/drills',
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        // The original site's prediction visualizer, still embedded by a
        // Microsoft Research blog post (see public/maia-viz/index.html).
        source: '/maia-viz{/}?',
        destination: '/maia-viz/index.html',
      },
      {
        source: '/api/:path*',
        destination: 'https://dock2.csslab.ca/api/:path*',
      },
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ]
  },
  async headers() {
    return [
      {
        // Files in public/ that are not content-hashed: ONNX Runtime and
        // Stockfish (loaded one after another when the engines start), the
        // Maia worker, the analytics script and icons. Served with max-age=0
        // and must-revalidate, every visit waited for a request to the server
        // for each before using its cached copy. A returning visitor now uses
        // the cached copy at once and the browser refreshes it in the
        // background, so a changed file is used from the following visit.
        source: '/:dir(ort|stockfish|assets)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/:file(maia-worker.js|analytics.js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ]
  },
  skipTrailingSlashRedirect: true,
})
