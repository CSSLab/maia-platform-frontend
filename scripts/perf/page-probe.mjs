// Page-load metrics for any route (see LOADING.md): first and largest
// contentful paint, total blocking time (long tasks in the first 5 s, beyond
// 50 ms each), main-thread script and task time (Chrome's Performance
// metrics) and JavaScript transferred. Prints one JSON line per load.
//
//   node scripts/perf/page-probe.mjs BASE PROFILE_DIR|- ROUTE [--cores N]
//        [--reps N] [--settle MS] [--ls key=value,...] [--tbt-window MS]
//        [--mobile] [--slowdown N] [--net 4g|slow4g|DOWN_KBPS,UP_KBPS,LATENCY_MS]
//
// PROFILE_DIR is a persistent browser profile (a returning visitor: run once
// to fill it, then measure); "-" is a fresh browser each load (first visit).
// BASE should be scripts/perf/stub-proxy.mjs in front of the server.
// --mobile, --net and --slowdown emulate a phone as in analysis-probe.mjs.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const args = process.argv.slice(2)
const [base, prof, route] = args
const opt = (n, d) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : d
}
const reps = Number(opt('--reps', '1')),
  settle = Number(opt('--settle', '3000')),
  cores = opt('--cores', null),
  tbtWindow = Number(opt('--tbt-window', '5000')),
  mobile = args.includes('--mobile'),
  slowdown = Number(opt('--slowdown', '1'))
const NETS = { '4g': [9000, 1500, 150], slow4g: [1474.56, 675, 562.5] }
const netArg = opt('--net', null)
const net = netArg ? (NETS[netArg] ?? netArg.split(',').map(Number)) : null
const PHONE = {
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
}
const launch = async () => {
  // "-": a new empty profile each time (cpu-slowdown.py finds the browser by it)
  const dir =
    prof === '-' ? fs.mkdtempSync(path.join(os.tmpdir(), 'page-probe-')) : prof
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: true,
    ...(mobile ? PHONE : { viewport: { width: 1600, height: 1000 } }),
    args: [
      '--host-resolver-rules=MAP www.google-analytics.com ~NOTFOUND, MAP region1.google-analytics.com ~NOTFOUND',
    ],
  })
  let slower = null
  if (slowdown > 1) {
    slower = spawn(
      'python3',
      [
        path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          'cpu-slowdown.py',
        ),
        dir,
        String(slowdown),
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    )
    await new Promise((resolve) => slower.stdout.once('data', resolve))
  }
  return {
    ctx,
    close: async () => {
      if (slower) {
        slower.kill('SIGTERM')
        await new Promise((resolve) => slower.on('exit', resolve))
      }
      await ctx.close()
      if (prof === '-') fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
for (let r = 0; r < reps; r++) {
  const { ctx, close } = await launch()
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem(
        'maia-completed-tours',
        JSON.stringify([
          'analysis',
          'play',
          'train',
          'openingDrill',
          'turing',
          'handBrain',
        ]),
      )
    } catch (e) {}
    window.__pp = { lcp: 0, fcp: 0, long: [] }
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__pp.lcp = e.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (e.name === 'first-contentful-paint') window.__pp.fcp = e.startTime
    }).observe({ type: 'paint', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        window.__pp.long.push([Math.round(e.startTime), Math.round(e.duration)])
    }).observe({ type: 'longtask', buffered: true })
  })
  if (opt('--ls', null))
    await ctx.addInitScript(
      (kv) => {
        try {
          for (const [k, v] of kv) localStorage.setItem(k, v)
        } catch (e) {}
      },
      opt('--ls', '')
        .split(',')
        .map((x) => x.split('=')),
    )
  if (cores)
    await ctx.addInitScript(
      (n) =>
        Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
          get: () => n,
        }),
      Number(cores),
    )
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Performance.enable')
  if (net) {
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (net[0] * 1000) / 8,
      uploadThroughput: (net[1] * 1000) / 8,
      latency: net[2],
    })
  }
  let js = 0
  page.on('requestfinished', async (req) => {
    if (/\.js(\?|$)/.test(req.url())) {
      const s = await req.sizes().catch(() => null)
      js += s?.responseBodySize || 0
    }
  })
  await page.goto(base + route, { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(settle)
  const m = Object.fromEntries(
    (await cdp.send('Performance.getMetrics')).metrics.map((x) => [
      x.name,
      x.value,
    ]),
  )
  const pp = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    return {
      ...window.__pp,
      dcl: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd,
    }
  })
  const tbt = pp.long
    .filter(([t]) => t < tbtWindow)
    .reduce((a, [, d]) => a + Math.max(0, d - 50), 0)
  console.log(
    JSON.stringify({
      ls: opt('--ls', ''),
      route,
      fcp: Math.round(pp.fcp),
      lcp: Math.round(pp.lcp),
      dcl: Math.round(pp.dcl),
      load: Math.round(pp.load),
      tbt,
      longs: pp.long.length,
      script: Math.round(m.ScriptDuration * 1000),
      task: Math.round(m.TaskDuration * 1000),
      jsKB: Math.round(js / 1024),
    }),
  )
  await page.waitForTimeout(500)
  await close()
}
