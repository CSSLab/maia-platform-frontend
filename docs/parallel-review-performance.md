# Parallel Maia analysis in reviews

## Why this exists

Each review position requests Maia predictions for 21 rating levels. The
existing `Maia` engine sent those 21 inputs as one ONNX batch to one dedicated
Web Worker. Splitting the batch across a small pool lets independent ONNX
sessions use more CPU cores. Results are reassembled in the original rating
order, so move probabilities and win estimates keep their existing meaning.

Dedicated **Web Workers** are used here. A Service Worker handles fetch and
offline lifecycle events; it is not the right owner for long-running model
inference. The project already runs Maia inference in a Web Worker, so the
pool extends the current design instead of introducing a new execution model.
See [MDN on dedicated Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
and [MDN on Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

The review Options panel contains an Advanced performance settings section.
The drill selection screen and live drill controls expose the same worker
control before a drill review starts. The Stockfish drill review choice keeps
depth 18 by default or permits a faster depth 12 review; shallower searches can
change move classifications. The depth 12 option was not included in the Maia
inference benchmark below.
Parallel analysis can be switched off, and the count can be set from 1 to the
device limit. The default is two workers when at least three logical cores are
reported, otherwise one. At most four workers are allowed, with one reported
core reserved for the UI and Stockfish. If core information is unavailable,
the fallback limit is two. Additional workers are created only when an analysis
batch needs them. Each worker holds a separate copy of the 44 MB model and an
ONNX session, so raising the count increases memory use. If a secondary worker
fails, its batch chunk is retried on the primary worker. If a secondary session
does not start within five seconds, analysis proceeds with the workers already
ready. Disabling parallel
analysis keeps the original single-worker path.

Match moves still come from the `play/get_move` backend endpoint. Browser
workers cannot shorten that server request; this setting applies to local
review and drill inference only.

Stockfish loads two NNUE weight files separately from the Maia worker pool.
On the local check, the larger file was about 75 MB and took 141 seconds to
download from the remote host. The weights are cached in IndexedDB after
download. The loading toast now shows whether it is checking the cache,
downloading weights, loading weights, or starting the engine. The Maia worker
count does not shorten this initial download or Stockfish search.

## Project fit and checks

This follows the project's existing React context and `Maia` engine structure,
keeps the worker script under `public/`, and uses the existing IndexedDB model
cache. No server endpoint or chess result format changes. The code is TypeScript
checked and linted. Jest tests cover device limits, persisted settings,
parallel result ordering, single-worker equivalence, failed secondary retry,
and malformed batch inputs. The Playwright browser test loads a review, uses
the real model, checks that two workers receive inference requests, and checks
setting persistence and the device cap.

ONNX Runtime may also use WASM threads within a worker on cross-origin-isolated
pages. The worker count is deliberately capped because more sessions can
increase both CPU contention and memory use; see [ONNX Runtime's threading
guidance](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html).

Run locally:

```bash
npm test -- --runInBand
npm run test:browser
npx tsc --noEmit
```

Install Chromium with `npx playwright install chromium` if it is not already
available. To use an existing Chrome installation, set
`PLAYWRIGHT_CHROME_EXECUTABLE=/path/to/chrome`.

## Performance report

Correction: an earlier draft used 21 copies of rating 1500 and empty board
tensors. Those inputs do not represent a review, so its timings were discarded.
The measurements below replace that comparison.

Re-measured on 2026-10-04 in headless Chrome 153 on Linux, with 32 logical cores
reported and cross-origin isolation enabled. The benchmark uses the actual
Maia-3 ONNX model, ten legal positions from a Ruy Lopez opening, and the same
21 rating inputs per position as review: 600 through 2600 in steps of 100.
Black-to-move positions are mirrored and piece channels are encoded as in the
review preprocessor. It times warm inference only; board preprocessing,
Stockfish, rendering, and model initialization are excluded. All four workers
are warmed before timing, and the worker-count order rotates between three
runs. The median is shown. Reproduce the full samples with
`node scripts/benchmark-maia-workers.mjs` while the development server is
running on port 3107.

To inspect the feature locally, run `npm run dev -- --hostname 0.0.0.0 --port
3107` and open `http://localhost:3107`. In a completed review, expand
**Options → Advanced performance settings** to switch parallel Maia analysis
on or off and choose a worker count.

Local verification on 2026-10-04: `/drills` returned HTTP 200 from the local
development server; all 10 Jest tests, the Playwright review-worker browser
test (1/1), and `tsc --noEmit` passed using the installed Chrome executable.

| Review workload | 1 worker | 2 workers | 4 workers | 2 worker gain | 4 worker gain |
| --- | ---: | ---: | ---: | ---: | ---: |
| One position, 21 ratings | 483 ms | 315 ms | 222 ms | 1.53× | 2.18× |
| Five positions, 105 ratings | 2,340 ms | 1,402 ms | 1,154 ms | 1.67× | 2.03× |
| Ten positions, 210 ratings | 4,745 ms | 2,610 ms | 2,334 ms | 1.82× | 2.03× |

Raw samples in table order: one worker `[489, 483, 463]`,
`[2317, 2371, 2340]`, `[4603, 4856, 4745]`; two workers
`[312, 316, 315]`, `[1402, 1617, 1348]`, `[2607, 2835, 2610]`;
four workers `[223, 219, 222]`, `[1128, 1171, 1154]`,
`[2334, 2327, 2804]` milliseconds. A preceding run on the same day measured
488/353/235 ms for one position, 2,424/1,621/1,243 ms for five positions,
and 5,000/3,443/2,858 ms for ten positions (one/two/four workers). These are
single-device observations, not guaranteed gains across devices or complete
reviews.

The first worker reached ready status in 2,235 ms in this run. That includes
loading the model from the local browser cache or development server; extra
worker initialization is excluded from the warm timings. Whole-review wall
time can improve less because Stockfish search, opening-book requests, React
rendering, and model loading are not accelerated by this pool. Low-core and
memory-constrained devices may run better with one worker; the setting allows
that choice. Match performance is intentionally outside this report because
matches use the backend move service.

For all ten sampled positions and all 21 rating levels, the maximum difference
between the one-worker and two- or four-worker move and value logits was **0**.
The worker split changed throughput in this run, not the Maia predictions.
