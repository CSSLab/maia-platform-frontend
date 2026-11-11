/** @type {import('next').NextConfig} */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const withTM = require('next-transpile-modules')(['@react-chess/chessground'])
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createHash } = require('node:crypto')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { readdirSync, readFileSync } = require('node:fs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { join } = require('node:path')

// The engines' files in public/ (Stockfish, ONNX Runtime and the Maia worker)
// keep their names when they change, so the site asks for them under a folder
// named after their contents, /v/<hash>/, which a browser can keep for a year.
// With a short cache time they were asked for again on every visit: the
// host's cache reports them as already hours old (its Age header), and a
// browser takes that off the time it may keep them.
const ENGINE_FILES = ['stockfish', 'ort', 'maia-worker.js']
const engineFilesVersion = (() => {
  const hash = createHash('sha256')
  const add = (path) => {
    const full = join(__dirname, 'public', path)
    let names
    try {
      names = readdirSync(full).sort()
    } catch {
      hash.update(path).update(readFileSync(full))
      return
    }
    for (const name of names) add(join(path, name))
  }
  ENGINE_FILES.forEach(add)
  return hash.digest('hex').slice(0, 12)
})()

module.exports = withTM({
  reactStrictMode: false,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_ENGINE_FILES_VERSION: engineFilesVersion,
  },
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
        // Any version is served the current files: only the version in the
        // site's own code changes which files a browser keeps.
        source: '/v/:version/:dir(stockfish|ort)/:file',
        destination: '/:dir/:file',
      },
      {
        source: '/v/:version/maia-worker.js',
        destination: '/maia-worker.js',
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
        // The engines' files at their own addresses, which the site now asks
        // for only under /v/<version>/ (above): for pages opened before that.
        source: '/:dir(ort|stockfish)/:path*',
        headers: [
          {
            // For ten minutes a visit uses its copy without asking: the
            // Stockfish script was asked for three times on each page.
            key: 'Cache-Control',
            value: 'public, max-age=600, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/v/:version/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Icons, pieces and sounds, which hardly ever change, are used for a
        // day without asking: every request counts towards the host's bill,
        // even one answered "not modified".
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // The app manifest and the Google Analytics script were asked for on
        // every page load.
        source:
          '/:file(favicon.png|maia-ios-icon.png|maia.png|maia-no-bg.png|manifest.webmanifest|analytics.js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // So was the service worker. It is now checked for an update from the
        // browser's cache (registered with updateViaCache: 'all'), so a
        // changed one is picked up within a day.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      {
        source: '/:file(maia-worker.js)',
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
