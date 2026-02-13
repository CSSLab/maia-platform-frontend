/** @type {import('next').NextConfig} */

module.exports = {
  reactStrictMode: false,
  output: 'standalone',
  transpilePackages: ['@react-chess/chessground', 'chessground'],
  async rewrites() {
    return [
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
}
