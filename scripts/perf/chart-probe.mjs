// Moving through a game one move at a time (see LOADING.md): per move, Maia's
// requests (batch sizes) and results, the visible moves-by-rating chart's
// curve changes (first change, first after Maia's last result) and the
// Stockfish depth label (d12, d18) on the new position. Starts 12 quick moves
// into the game, then steps 8 times, 14 s apart on the phone, 5 s on desktop.
//
//   node scripts/perf/chart-probe.mjs BASE PROFILE phone|desk GAME OUT.json [STEPS] [WAIT_MS]
//
// BASE is scripts/perf/stub-proxy.mjs in front of `next start`; PROFILE a
// browser profile that already has the Maia model (analysis-probe.mjs --cold
// fills one). phone: the phone of analysis-probe.mjs --mobile --net 4g
// --slowdown 4.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const [base, prof, mode, game, out, stepsArg, waitArg] = process.argv.slice(2)
const phone = mode === 'phone'
const steps = Number(stepsArg || 8)
const wait = Number(waitArg || (phone ? 14000 : 5000))
const ctx = await chromium.launchPersistentContext(prof, {
  headless: true,
  ...(phone
    ? {
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      }
    : { viewport: { width: 1600, height: 1000 } }),
  args: [
    '--host-resolver-rules=MAP www.google-analytics.com ~NOTFOUND, MAP region1.google-analytics.com ~NOTFOUND',
  ],
})
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('maia-completed-tours', JSON.stringify(['analysis']))
  } catch (e) {}
  const T = (window.__t = {
    posts: [],
    results: [],
    curve: [],
    keys: [],
    tl: [],
  })
  const now = () => performance.now()
  const W = window.Worker
  window.Worker = class extends W {
    constructor(u, o) {
      super(u, o)
      if (!String(u).includes('maia-worker')) return
      this.addEventListener('message', (e) => {
        if (e.data?.type === 'inference-result') T.results.push(now())
      })
      const post = this.postMessage.bind(this)
      this.postMessage = (m, ...rest) => {
        if (m?.type === 'inference') T.posts.push({ t: now(), n: m.batchSize })
        return post(m, ...rest)
      }
    }
  }
  document.addEventListener('keydown', () => T.keys.push(now()), true)
  document.addEventListener(
    'click',
    (e) => {
      if (e.isTrusted) T.keys.push(now())
    },
    true,
  )
  const hash = (s) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return h
  }
  let lastCurve = ''
  let lastKey = ''
  const tick = () => {
    const chart = [
      ...document.querySelectorAll('#analysis-moves-by-rating'),
    ].find((c) => c.offsetParent !== null)
    const d = chart
      ? [...chart.querySelectorAll('path.recharts-area-curve')]
          .map((p) => p.getAttribute('d'))
          .join('|')
      : ''
    if (d && d !== lastCurve) {
      T.curve.push(now())
      lastCurve = d
    }
    const board = document.querySelector('cg-board')
    const pieces = board
      ? [...board.querySelectorAll('piece')]
          .filter((p) => !p.classList.contains('fading'))
          .map(
            (p) =>
              `${p.cgKey}:${p.className.replace(/\b(anim|dragging|fading|ghost)\b/g, '').trim()}`,
          )
          .sort()
          .join(',')
      : ''
    let depth = null
    const hl = [...document.querySelectorAll('#analysis-highlight')].find(
      (c) => c.offsetParent !== null,
    )
    if (hl)
      for (const s of hl.querySelectorAll('span')) {
        const m = /^d(\d+)$/.exec(s.textContent.trim())
        if (m) depth = Number(m[1])
      }
    const key = `${hash(pieces)}|${depth}`
    if (key !== lastKey) {
      lastKey = key
      T.tl.push({ t: now(), pos: hash(pieces), depth })
    }
    requestAnimationFrame(tick)
  }
  addEventListener('DOMContentLoaded', () => requestAnimationFrame(tick))
})
const page = ctx.pages()[0]
let slower = null
if (phone) {
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 9000 * 125,
    uploadThroughput: 1500 * 125,
    latency: 150,
  })
  // A second CDP session turns Playwright's touch emulation off.
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 1,
  })
}
if (phone) {
  const script = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'cpu-slowdown.py',
  )
  slower = spawn('python3', [script, prof, '4'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await new Promise((r) => slower.stdout.once('data', r))
}
await page.goto(`${base}/analysis/${game}/lichess`, { waitUntil: 'load' })
await page.waitForTimeout(phone ? 45000 : 12000)
const device = await page.evaluate(() => ({
  coarse: matchMedia('(pointer: coarse)').matches,
  touch: navigator.maxTouchPoints,
  sw: screen.width,
  sh: screen.height,
}))
console.log('device', JSON.stringify(device))
// Start a few moves in, past the opening book.
const nextBox = phone
  ? await page
      .getByRole('button', { name: 'Next move', exact: true })
      .first()
      .boundingBox()
  : null
const next = () =>
  phone
    ? page.touchscreen.tap(
        nextBox.x + nextBox.width / 2,
        nextBox.y + nextBox.height / 2,
      )
    : page.keyboard.press('ArrowRight')
for (let k = 0; k < 12; k++) {
  await next()
  await page.waitForTimeout(120)
}
await page.waitForTimeout(phone ? 14000 : 5000)
const startKeys = await page.evaluate(() => window.__t.keys.length)
for (let k = 0; k < steps; k++) {
  await next()
  await page.waitForTimeout(wait)
}
const t = await page.evaluate(() => window.__t)
const rows = []
for (let i = startKeys; i < t.keys.length; i++) {
  const k = t.keys[i]
  const end = t.keys[i + 1] ?? Infinity
  const rel = (xs) =>
    xs.filter((x) => x > k && x < end).map((x) => Math.round(x - k))
  const posts = t.posts.filter((p) => p.t > k && p.t < end).map((p) => p.n)
  const results = rel(t.results)
  const curve = rel(t.curve)
  const before = t.tl.filter((e) => e.t <= k).at(-1)
  const win = t.tl.filter((e) => e.t > k && e.t < end && e.pos !== before?.pos)
  const at = (pred) => {
    const e = win.find(pred)
    return e ? Math.round(e.t - k) : null
  }
  const lastResult = results.at(-1)
  rows.push({
    posts,
    results,
    curveFrames: curve.length,
    chartFirst: curve[0] ?? null,
    chartAfterLast:
      lastResult == null ? null : (curve.find((c) => c >= lastResult) ?? null),
    sfD12: at((e) => e.depth >= 12),
    sfD18: at((e) => e.depth >= 18),
    maxDepth: Math.max(0, ...win.map((e) => e.depth ?? 0)),
  })
}
fs.writeFileSync(
  out,
  JSON.stringify({ base, mode, game, device, wait, rows }, null, 1),
)
for (const [i, r] of rows.entries())
  console.log(
    `step ${i + 1}: batches [${r.posts}] results ${r.results.join(',')} | chart first ${r.chartFirst} after-last ${r.chartAfterLast} (${r.curveFrames} frames) | d12 ${r.sfD12} d18 ${r.sfD18} max ${r.maxDepth}`,
  )
console.log('device', JSON.stringify(device))
if (slower) {
  slower.kill('SIGTERM')
  await new Promise((r) => slower.on('exit', r))
}
await ctx.close()
