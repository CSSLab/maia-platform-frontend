// Proxy in front of a local `next start`, for analysis-probe.mjs --proxy and
// page-probe.mjs (see LOADING.md). It does what the probe's Playwright routes
// do, without turning off the browser's HTTP cache: stored engine analysis
// is answered 404 after the real request (keeping its latency), as for a
// game nobody has analysed; analysis uploads and /ingest (PostHog) are
// swallowed.
//
//   node scripts/perf/stub-proxy.mjs LISTEN_PORT SERVER_PORT [--with-cache]
import http from 'node:http'

const [listen, upstream] = process.argv.slice(2).map(Number)
const withCache = process.argv.includes('--with-cache')
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 })

http
  .createServer((req, res) => {
    if (req.url.includes('/analysis/store_engine_analysis/')) {
      req.resume()
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end('{}')
    }
    if (req.url.startsWith('/ingest/')) {
      req.resume()
      res.writeHead(204)
      return res.end()
    }
    const stub =
      !withCache && req.url.includes('/analysis/get_engine_analysis/')
    const up = http.request(
      {
        host: '127.0.0.1',
        port: upstream,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${upstream}` },
        agent,
      },
      (upRes) => {
        if (stub) {
          upRes.resume()
          upRes.on('end', () => {
            res.writeHead(404, { 'content-type': 'application/json' })
            res.end('{}')
          })
          return
        }
        res.writeHead(upRes.statusCode, upRes.headers)
        upRes.pipe(res)
      },
    )
    up.on('error', () => {
      res.writeHead(502)
      res.end()
    })
    req.pipe(up)
  })
  .listen(listen, '127.0.0.1', () =>
    console.log(`stub proxy on ${listen} -> ${upstream}`),
  )
