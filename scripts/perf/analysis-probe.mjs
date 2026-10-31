// Loading and paging probe for the analysis page (see LOADING.md).
//
//   node scripts/perf/analysis-probe.mjs <lichessGameId> [--base http://localhost:3000]
//        [--profile DIR] [--cold] [--cores N] [--paging] [--with-cache]
//        [--cache-delay MS] [--proxy] [--out result.json] [--label name]
//
// Needs Playwright with Chromium (not a dependency of this repo), e.g.
// `npm i --no-save playwright && npx playwright install chromium`.
//
// An init script records, in page time (ms since navigation start):
//  - every DOM change of: the main board's pieces (position signature), the
//    Stockfish depth label ("d18") and the Maia move list in #analysis-highlight;
//  - Worker creations (Stockfish's pthread pool) and the Maia worker's
//    messages (inference requests and results);
//  - main-thread long tasks, and the keys and clicks used for paging.
// The analysis cache upload (store_engine_analysis) is stubbed so runs never
// write to the shared backend cache, and analytics hits are blocked.
// Playwright turns the browser's HTTP cache off while any route is set, so
// with --proxy the probe sets none: --base is then scripts/perf/stub-proxy.mjs
// in front of the server, which does the stubbing, and Google Analytics'
// hosts are made unresolvable. Use --proxy for warm (returning visitor) runs.
// --cold starts from an empty profile (and clicks "Download Maia-3");
// otherwise the profile keeps the Maia model and the NNUE nets cached.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const gameId = args[0]
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const flag = (name) => args.includes(name)
const base = opt('--base', 'http://localhost:3000')
const profile = path.resolve(opt('--profile', './profile'))
const cores = opt('--cores', null)
const cold = flag('--cold')
const paging = flag('--paging')
const out = opt('--out', null)
const label = opt('--label', '')
const settleMs = Number(opt('--settle', '8000'))
const proxy = flag('--proxy')

if (cold) fs.rmSync(profile, { recursive: true, force: true })

const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  viewport: { width: 1600, height: 1000 },
  args: proxy
    ? [
        '--host-resolver-rules=MAP www.google-analytics.com ~NOTFOUND, MAP region1.google-analytics.com ~NOTFOUND',
      ]
    : [],
})
await context.addInitScript(() => {
  try {
    localStorage.setItem('maia-completed-tours', JSON.stringify(['analysis']))
  } catch (e) {}
})
if (cores) {
  await context.addInitScript((n) => {
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
      get: () => n,
    })
  }, Number(cores))
}
await context.addInitScript(() => {
  const lp = (window.__lp = {
    tl: [],
    w: [],
    m: [],
    ev: [],
    errors: [],
    loaded: [],
    long: [],
  })
  const now = () => Math.round(performance.now() * 10) / 10
  const OrigWorker = window.Worker
  window.Worker = class extends OrigWorker {
    constructor(url, opts) {
      super(url, opts)
      const u = String(url)
      lp.w.push({
        t: now(),
        u: u.split('/').pop().slice(0, 40),
        name: opts?.name,
      })
      if (opts?.name === 'em-pthread') {
        this.addEventListener('message', (e) => {
          if (e.data?.cmd === 'loaded') lp.loaded.push(now())
        })
      }
      if (u.includes('maia-worker')) {
        const post = this.postMessage.bind(this)
        this.postMessage = (msg, tr) => {
          lp.m.push({
            t: now(),
            d: 'out',
            type: msg?.type,
            id: msg?.id,
            n: msg?.batchSize,
          })
          return post(msg, tr)
        }
        this.addEventListener('message', (e) =>
          lp.m.push({
            t: now(),
            d: 'in',
            type: e.data?.type,
            id: e.data?.id,
            status: e.data?.status,
          }),
        )
      }
    }
  }
  const hash = (s) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return h
  }
  let last = ''
  const snap = () => {
    const board = document.querySelector('cg-board')
    const pieces = board ? Array.from(board.querySelectorAll('piece')) : []
    const pos = pieces.length
      ? hash(
          pieces
            .filter((p) => !p.classList.contains('fading'))
            .map(
              (p) =>
                `${p.cgKey}:${p.className.replace(/\b(anim|dragging|fading|ghost)\b/g, '').trim()}`,
            )
            .sort()
            .join(','),
        )
      : 0
    const hl = document.querySelector('#analysis-highlight')
    let depth = null
    let maia = ''
    if (hl) {
      for (const s of hl.querySelectorAll('span')) {
        const m = /^d(\d+)$/.exec(s.textContent.trim())
        if (m) depth = Number(m[1])
      }
      maia = Array.from(hl.querySelectorAll('button.text-human-1'))
        .map((b) => b.textContent.trim())
        .join(' ')
    }
    const key = `${pos}|${depth}|${maia}|${!!hl}`
    if (key !== last) {
      last = key
      lp.tl.push({ t: now(), pos, depth, maia, hl: !!hl, n: pieces.length })
    }
  }
  const start = () => {
    new MutationObserver(snap).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    snap()
  }
  if (document.documentElement) start()
  else document.addEventListener('DOMContentLoaded', start)
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        lp.long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) })
    }).observe({ type: 'longtask', buffered: true })
  } catch (e) {}
  document.addEventListener(
    'keydown',
    (e) => lp.ev.push({ t: now(), k: e.key }),
    true,
  )
  document.addEventListener(
    'click',
    () => lp.ev.push({ t: now(), k: 'click' }),
    true,
  )
  window.addEventListener('error', (e) =>
    lp.errors.push(String(e.message).slice(0, 200)),
  )
})

if (!proxy) {
  // Keep test runs out of the backend analysis cache and out of GA.
  await context.route('**/analysis/store_engine_analysis/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await context.route(
    /google-analytics\.com|googletagmanager\.com\/(g\/)?collect|\/ingest\//,
    (route) => route.fulfill({ status: 204, body: '' }),
  )
  // The backend's analysis cache is shared by all visitors, and earlier test
  // runs filled it for the test games. By default the probe keeps the request
  // (and its latency) but answers 404, as for a game nobody has analysed yet,
  // so the engines do the work. --with-cache leaves the real answer.
  if (flag('--with-cache') && opt('--cache-delay', null)) {
    // Real cached analysis, answered later than the game (a large cache entry).
    const delay = Number(opt('--cache-delay', '0'))
    await context.route('**/analysis/get_engine_analysis/**', async (route) => {
      const response = await route.fetch()
      await new Promise((r) => setTimeout(r, delay))
      await route.fulfill({ response })
    })
  }
  if (!flag('--with-cache')) {
    await context.route('**/analysis/get_engine_analysis/**', async (route) => {
      await route.fetch().catch(() => null)
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: '{}',
      })
    })
  }
}

const page = context.pages()[0] ?? (await context.newPage())
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300))
  if (m.type() === 'warning' && /stockfish|nnue|maia/i.test(m.text()))
    consoleErrors.push(`warn: ${m.text().slice(0, 300)}`)
})
page.on('pageerror', (err) =>
  consoleErrors.push(`pageerror: ${err.message.slice(0, 300)}`),
)

const wall0 = Date.now()
await page.goto(`${base}/analysis/${gameId}/lichess`, {
  waitUntil: 'commit',
  timeout: 120000,
})

const lp = () => page.evaluate(() => window.__lp)
const pageNow = () => page.evaluate(() => performance.now())

// First visit: the Maia model is not cached, so the page asks to download it.
let downloadClickedAt = null
const deadline = Date.now() + Number(opt('--first-limit', '60000'))
while (Date.now() < deadline) {
  const s = await page.evaluate(() => {
    const tl = window.__lp?.tl ?? []
    const l = tl[tl.length - 1]
    return { depth: l?.depth ?? null, maia: l?.maia ?? '' }
  })
  if (downloadClickedAt === null) {
    const btn = page.getByRole('button', { name: /Download Maia/ })
    if (
      (await btn.count()) > 0 &&
      (await btn
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      downloadClickedAt = await pageNow()
      await btn.first().click()
    }
  }
  if (s.maia && s.depth !== null && s.depth >= 18) break
  await page.waitForTimeout(100)
}
// Let the first position finish (both engines) before paging.
const firstDone = Date.now()
while (Date.now() - firstDone < settleMs) {
  const d = await page.evaluate(() => window.__lp.tl.at(-1)?.depth ?? 0)
  if (d >= 18) break
  await page.waitForTimeout(200)
}

const timings = await page.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0]
  const r = performance.getEntriesByType('resource').map((e) => ({
    name: e.name.replace(location.origin, ''),
    start: Math.round(e.startTime),
    end: Math.round(e.responseEnd),
    kb: Math.round((e.transferSize || 0) / 1024),
    type: e.initiatorType,
  }))
  return {
    ttfb: Math.round(n.responseStart),
    dcl: Math.round(n.domContentLoadedEventEnd),
    load: Math.round(n.loadEventEnd),
    r,
  }
})

const findRes = (re) => timings.r.find((e) => re.test(e.name))
const L0 = await lp()
const tl0 = L0.tl
const firstWhere = (pred, list = tl0) => list.find(pred)?.t ?? null
const result = {
  label,
  gameId,
  cores: cores
    ? Number(cores)
    : await page.evaluate(() => navigator.hardwareConcurrency),
  cold,
  downloadClickedAt: downloadClickedAt && Math.round(downloadClickedAt),
  ttfb: timings.ttfb,
  dcl: timings.dcl,
  load: timings.load,
  jsKB: timings.r
    .filter((e) => /_next\/static\/.*\.js/.test(e.name))
    .reduce((a, e) => a + e.kb, 0),
  scriptsEnd: Math.max(
    ...timings.r
      .filter((e) => /_next\/static\/.*\.js/.test(e.name))
      .map((e) => e.end),
  ),
  account: findRes(/auth\/account/)?.end ?? null,
  lichess: findRes(/lichess\.org\/game\/export/) ?? null,
  analyze: findRes(/analyze_user_game/) ?? null,
  cache: findRes(/get_engine_analysis/) ?? null,
  board: firstWhere((e) => e.n > 0 && e.hl),
  sfFirst: firstWhere((e) => e.depth !== null),
  sfD12: firstWhere((e) => e.depth >= 12),
  sfD18: firstWhere((e) => e.depth >= 18),
  maiaFirst: firstWhere((e) => !!e.maia),
  maiaReady: L0.m.find((m) => m.d === 'in' && m.status === 'ready')?.t ?? null,
  maiaFirstPost: L0.m.find((m) => m.type === 'inference')?.t ?? null,
  maiaFirstResult: L0.m.find((m) => m.type === 'inference-result')?.t ?? null,
  pthreads: L0.w.filter((w) => w.name === 'em-pthread').length,
  pthreadsLastAt: L0.w.filter((w) => w.name === 'em-pthread').at(-1)?.t ?? null,
  pthreadFirstAt: L0.w.find((w) => w.name === 'em-pthread')?.t ?? null,
  poolReady: L0.loaded.length ? Math.max(...L0.loaded) : null,
  workers: L0.w
    .filter((w) => w.name !== 'em-pthread')
    .map((w) => `${w.u}@${w.t}`),
}

// Main-thread long tasks (>50 ms) up to the first Maia output, and in total.
result.longTasksToMaia = L0.long
  .filter((e) => e.t < (result.maiaFirst ?? Infinity))
  .reduce((a, e) => a + e.d, 0)
result.longTasks = L0.long.length
const fmt = (v) => (v === null || v === undefined ? '-' : Math.round(v))
console.log(
  `[${label}] ${gameId} cores=${result.cores} ${cold ? 'COLD' : 'warm'} | ttfb ${fmt(result.ttfb)} dcl ${fmt(result.dcl)} scripts ${fmt(result.scriptsEnd)} (${result.jsKB} KB) account ${fmt(result.account)}` +
    ` lichess ${fmt(result.lichess?.start)}-${fmt(result.lichess?.end)} analyze ${fmt(result.analyze?.start)}-${fmt(result.analyze?.end)} cache ${fmt(result.cache?.start)}-${fmt(result.cache?.end)}`,
)
console.log(
  `[${label}]   board ${fmt(result.board)} | SF first ${fmt(result.sfFirst)} d12 ${fmt(result.sfD12)} d18 ${fmt(result.sfD18)} | Maia shown ${fmt(result.maiaFirst)} (model ready ${fmt(result.maiaReady)}, 1st req ${fmt(result.maiaFirstPost)} -> ${fmt(result.maiaFirstResult)})` +
    ` | long tasks ${result.longTasks} (${result.longTasksToMaia} ms before Maia) | pthreads ${result.pthreads} (${fmt(result.pthreadFirstAt)}-${fmt(result.pthreadsLastAt)}, all loaded ${fmt(result.poolReady)})${downloadClickedAt ? ` | download clicked ${fmt(downloadClickedAt)}` : ''}`,
)

// ---------------------------------------------------------------- paging
// A fixed script of navigation actions; the timeline is analysed afterwards.
// For each measured action: ms from the key/click to the new position's board,
// Maia move list, first Stockfish depth, and depth 12 / 18 (null = not before
// the next action).
const pagingResults = []
if (paging) {
  const actions = []
  const evNow = async () => (await lp()).ev.at(-1).t
  const act = async (name, fn, waitMs, measured = true) => {
    await fn()
    const t = await evNow()
    if (measured) actions.push({ name, t })
    else actions.push({ name, t, skip: true })
    await page.waitForTimeout(waitMs)
  }
  const cells = page.locator('div.col-span-2.h-7.cursor-pointer')
  const nCells = await cells.count()
  const clickPly = (frac) => () =>
    cells.nth(Math.min(nCells - 1, Math.floor(nCells * frac))).click()
  await act(
    'jump to end (ArrowDown)',
    () => page.keyboard.press('ArrowDown'),
    6000,
  )
  await act(
    `jump to ply ${Math.floor(nCells * 0.15) + 1} (click)`,
    clickPly(0.15),
    6000,
  )
  for (let k = 1; k <= 8; k++)
    await act(
      `step ${k} (2.5 s pace)`,
      () => page.keyboard.press('ArrowRight'),
      2500,
    )
  for (let k = 1; k <= 10; k++) {
    await act(
      k < 10 ? `rapid ${k}` : 'after 10 rapid presses',
      () => page.keyboard.press('ArrowRight'),
      k < 10 ? 150 : 12000,
      k === 10,
    )
  }
  await act(
    `jump to ply ${Math.floor(nCells * 0.85) + 1} (click)`,
    clickPly(0.85),
    8000,
  )
  await act(
    'start position (ArrowUp)',
    () => page.keyboard.press('ArrowUp'),
    6000,
  )

  const L = await lp()
  const tl = L.tl
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]
    if (a.skip) continue
    const tNext = actions[i + 1]?.t ?? Infinity
    const before = tl.filter((e) => e.t <= a.t).at(-1)
    const early = tl.filter(
      (e) => e.t > a.t && e.t < Math.min(a.t + 600, tNext) && e.n > 0,
    )
    const final = early.length ? early.at(-1).pos : before?.pos
    const firstFinal = tl.find((e) => e.t > a.t && e.pos === final)
    const win = tl.filter(
      (e) => e.t >= (firstFinal?.t ?? a.t) && e.t < tNext && e.pos === final,
    )
    const at = (pred) => {
      const e = win.find(pred)
      return e ? Math.round(e.t - a.t) : null
    }
    const r = {
      name: a.name,
      board:
        firstFinal && final !== before?.pos
          ? Math.round(firstFinal.t - a.t)
          : null,
      maia: at((e) => !!e.maia),
      sf: at((e) => e.depth !== null),
      sfD12: at((e) => e.depth >= 12),
      sfD18: at((e) => e.depth >= 18),
      windowMs: Number.isFinite(tNext) ? Math.round(tNext - a.t) : null,
    }
    pagingResults.push(r)
    console.log(
      `[${label}]   ${r.name.padEnd(26)} board ${fmt(r.board)}  Maia ${fmt(r.maia)}  SF first ${fmt(r.sf)}  d12 ${fmt(r.sfD12)}  d18 ${fmt(r.sfD18)}  (window ${fmt(r.windowMs)})`,
    )
  }
  result.maiaRequests = L.m.filter((m) => m.type === 'inference').length
  result.maiaResults = L.m.filter((m) => m.type === 'inference-result').length
  console.log(
    `[${label}]   Maia worker: ${result.maiaRequests} requests sent, ${result.maiaResults} results`,
  )
}

result.paging = pagingResults
result.consoleErrors = consoleErrors
result.wallMs = Date.now() - wall0
if (consoleErrors.length)
  console.log(
    `[${label}]   console errors (${consoleErrors.length}):`,
    consoleErrors.slice(0, 5),
  )
if (out) {
  const L = await lp()
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        ...result,
        timeline: L.tl,
        maiaMsgs: L.m,
        events: L.ev,
        longTasks: L.long,
        workersAll: L.w.length,
        resources: timings.r,
      },
      null,
      1,
    ),
  )
}
await page.waitForTimeout(cold ? 15000 : 3000) // let IndexedDB writes (Maia model, NNUE) finish
await context.close()
