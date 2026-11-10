// Regenerates the `cpLookup` table in src/lib/analysis.ts from the original
// empirical table (commit 7feac8c5, the only version of the raw data in the
// repo; the source game data is not available here).
//
// Defects in the raw table:
//   - '0.0' is synthetic: it is exactly the mean of '-0.1' and '0.1' (to the
//     last bit; no other bin is), i.e. the bin was missing and was filled in.
//   - '0.1' sits below both neighbouring branches, so -0.1 -> 0.1 is nearly
//     flat (+0.26%/bin) and 0.1 -> 0.2 jumps +3.69%.
//   - Sampling noise (~0.3%/bin) and 10 inversions where the table decreases.
//
// Method:
//   1. Drop '0.0' and '0.1' as unreliable.
//   2. Local-linear regression (tricube kernel, bandwidth 0.5 pawns) over the
//      remaining bins, evaluated at every bin. This removes noise and fills
//      the dropped bins without the end bias of a plain moving average.
//   3. Isotonic regression (pool-adjacent-violators) so the curve never
//      decreases, then a 1e-6 nudge to break any ties.
//
// Usage: node scripts/smooth-cplookup.mjs [--check]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const RAW_COMMIT = '7feac8c5'
const RAW_PATH = 'src/utils/stockfish/index.ts'
const TARGET = new URL('../src/lib/analysis.ts', import.meta.url).pathname
const DROP = new Set(['0.0', '0.1'])
const BANDWIDTH = 0.5

const rowRe = /'(-?\d+\.\d)':\s*([\d.]+)/g
const raw = execFileSync('git', ['show', `${RAW_COMMIT}:${RAW_PATH}`], {
  encoding: 'utf8',
})
const rows = [...raw.matchAll(rowRe)].map(([, k, v]) => [k, Number(v)])
if (rows.length !== 201)
  throw new Error(`expected 201 bins, got ${rows.length}`)
const keys = rows.map(([k]) => k)
const xs = keys.map(Number)
const ys = rows.map(([, v]) => v)

const tricube = (u) => (Math.abs(u) >= 1 ? 0 : (1 - Math.abs(u) ** 3) ** 3)

const localLinear = (x0) => {
  let sw = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0
  xs.forEach((x, i) => {
    if (DROP.has(keys[i])) return
    const w = tricube((x - x0) / BANDWIDTH)
    if (w === 0) return
    const dx = x - x0
    sw += w
    sx += w * dx
    sy += w * ys[i]
    sxx += w * dx * dx
    sxy += w * dx * ys[i]
  })
  // Intercept of the weighted least-squares line centred at x0.
  return (sxx * sy - sx * sxy) / (sw * sxx - sx * sx)
}

const pava = (vals) => {
  const blocks = []
  for (const v of vals) {
    blocks.push({ mean: v, n: 1 })
    while (blocks.length > 1 && blocks.at(-2).mean > blocks.at(-1).mean) {
      const b = blocks.pop()
      const a = blocks.pop()
      blocks.push({
        mean: (a.mean * a.n + b.mean * b.n) / (a.n + b.n),
        n: a.n + b.n,
      })
    }
  }
  return blocks.flatMap((b) => Array(b.n).fill(b.mean))
}

const smoothed = pava(xs.map(localLinear))
for (let i = 1; i < smoothed.length; i++) {
  if (smoothed[i] <= smoothed[i - 1]) smoothed[i] = smoothed[i - 1] + 1e-6
}
const rounded = smoothed.map((v) => Number(v.toFixed(6)))

// ---- report ----
const inversions = (a) => a.slice(1).filter((v, i) => v <= a[i]).length
const steps = (a) => a.slice(1).map((v, i) => v - a[i])
const pct = (v) => `${(v * 100).toFixed(2)}%`.padStart(7)
const kept = ys.filter((_, i) => !DROP.has(keys[i]))
const keptNew = rounded.filter((_, i) => !DROP.has(keys[i]))
const resid = kept.map((v, i) => keptNew[i] - v)
console.log(`inversions: raw ${inversions(ys)}, new ${inversions(rounded)}`)
console.log(
  `largest step: raw ${pct(Math.max(...steps(ys)))}, new ${pct(Math.max(...steps(rounded)))}`,
)
console.log(
  `|new - raw| on kept bins: mean ${pct(resid.reduce((a, r) => a + Math.abs(r), 0) / resid.length)}, max ${pct(Math.max(...resid.map(Math.abs)))}`,
)
console.log(
  `endpoints: -10.0 ${ys[0].toFixed(4)} -> ${rounded[0].toFixed(4)}, +10.0 ${ys[200].toFixed(4)} -> ${rounded[200].toFixed(4)}`,
)
console.log('\n  bin    raw     step    new     step')
for (let i = 94; i <= 106; i++) {
  console.log(
    `${keys[i].padStart(5)}  ${ys[i].toFixed(4)} ${pct(ys[i] - ys[i - 1])}  ${rounded[i].toFixed(4)} ${pct(rounded[i] - rounded[i - 1])}`,
  )
}

if (process.argv.includes('--check')) process.exit(0)

const tableRe =
  /(export const cpLookup: Record<string, number> = \{\n)[\s\S]*?(\n\})/
const src = fs.readFileSync(TARGET, 'utf8')
if (!tableRe.test(src)) throw new Error('cpLookup table not found in target')
const body = keys.map((k, i) => `  '${k}': ${rounded[i]},`).join('\n')
fs.writeFileSync(TARGET, src.replace(tableRe, `$1${body}$2`))
console.log(`\nwrote ${keys.length} bins to src/lib/analysis.ts`)
