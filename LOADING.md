# Analysis page loading and paging

Notes for the `claude/loading-perf-8f7807` branch, which makes
`/analysis/<lichessGameId>/lichess` load and respond faster. Measured on
2026-10-30.

## How it was measured

- Production builds (`next build && next start`) of `main` (a6e52f5) and of
  this branch, side by side on ada.
- Headless Chromium 130 (Playwright), 1600×1000 window, driven by
  `scripts/perf/analysis-probe.mjs`. It records, in page time, when the board,
  the first Stockfish depth label, depth 18 and Maia's move list appear, plus
  the requests, workers and long tasks. `scripts/perf/summarize.py` builds the
  tables.
- **Warm**: a persistent profile that already holds the Maia model, the NNUE
  nets and the HTTP cache (a returning visitor). **Cold**: an empty profile,
  where the probe clicks "Download Maia-3" when the dialog appears (about 2 s
  in). Assets come from localhost, so cold downloads are much faster here than
  over a real network; the NNUE nets come from GitHub as in production.
- **Cores**: 8 (a laptop), set by overriding `navigator.hardwareConcurrency`,
  and 160 (what ada reports).
- The backend's stored analysis (`get_engine_analysis`) is shared by all
  visitors, and both test games were already in it. The probe still makes the
  request (keeping its latency) but answers 404, so the engines do the work,
  as for a game nobody has analysed. Uploads (`store_engine_analysis`) are
  stubbed so the runs leave the cache alone.
- Games: G3MXUHW9 (1800 blitz, 51 plies) and YQC4zrpR (bullet, 103 plies).
- Paging (warm): jump to the end, jump to 15% of the game, 8 steps with →
  every 2.5 s, 10 presses 150 ms apart, a jump to 85%, back to the start.
- ada is a shared 160-core machine (load average 40–50 during the runs), so
  single runs vary by ±0.2–0.3 s.
- To repeat a run against a local server (one result file per run; see the
  probe's header for options), then build the tables:

  ```bash
  node scripts/perf/analysis-probe.mjs G3MXUHW9 --base http://localhost:3000 --profile /path/to/profile --cores 8 --paging --out results/paging-new-G3MXUHW9-c8.json
  python3 scripts/perf/summarize.py results
  ```

## Results

Medians, `main` → branch, with 8 reported cores and a warm cache unless
noted (all four configurations in the tables below):

- **Board on screen:** 1.86 → 1.64 s (G3MXUHW9), 2.17 → 1.99 s (YQC4zrpR).
  With 160 cores: 1.95 → 1.58 s and 2.42 → 2.18 s.
- **Maia's moves:** 5.3–5.6 → 3.9 s after navigation, and 1.5–1.6 → 0.36–0.38 s
  after each move. After 10 rapid key presses: 8.7–9.4 s → 0.3–0.7 s.
- **Stockfish, first depth after a move:** median 0.9–1.5 → 0.21–0.23 s
  (worst step 1.8–2.5 → 0.25–0.27 s). Steps reaching depth 12 within 2.6 s:
  1–2 of 8 → 6–7 of 8.
- **Stockfish on the first position:** reached d18 in 12 of 12 warm runs (at
  8.5–9.5 s). On `main` it froze at d14–16 in all 12. While paging, the depth
  stopped below 14 on 2 positions on `main` and none on the branch.
- **JavaScript:** 1039 → 910 KB transferred on the analysis page; `_app` 292 →
  188 kB gzip on every page. With 160 cores, `main` transferred 2103 KB,
  because each of its 160 Stockfish workers loads a 7 KB chunk.

Two things got slower:

- **Depth 12 after a jump**, in 3 of 4 configurations (G3: 0.84–0.89 →
  1.41–1.56 s; YQ, 8 cores: 0.97 → 1.19 s; YQ, 160 cores went 1.66 → 1.19 s).
  On `main`, Maia's policy arrives ~1.6 s after a jump, so the first search
  reaches depth 14 before the policy restarts it. On the branch the policy
  comes at ~0.4 s, so the first depth 14 already includes the deepening of
  Maia's candidate moves.
- **d18 on a cold first visit** (6.6–7.6 → 10.4–10.8 s). On `main`, d18 was
  reached in 6 of 8 cold runs; Maia's result came after it at ~7 s, so nothing
  was restarted. On the branch, Maia's result arrives mid-search at ~5.8 s and
  restarts the search.

A faster Maia makes the existing restart-on-Maia-policy cost more visible.
Changing that is a change to the analysis algorithm (see "Looked at, not
changed").

### Load (seconds after navigation; median of 3 warm / 2 cold runs, range in brackets)

#### Warm (returning visitor)

| game     | cores | build  | runs | board shown      | first SF depth   | SF d18           | Maia moves shown | JS transferred (KB) | SF retries |
| -------- | ----- | ------ | ---- | ---------------- | ---------------- | ---------------- | ---------------- | ------------------- | ---------- |
| G3MXUHW9 | 8     | main   | 3    | 1.86 (1.70–1.91) | 2.29 (2.11–2.35) | –                | 5.61 (5.44–5.73) | 1039                | 0          |
| G3MXUHW9 | 8     | branch | 3    | 1.64 (1.62–1.69) | 2.38 (1.88–2.61) | 9.40 (9.36–9.53) | 3.94 (3.94–4.28) | 910                 | 0          |
| G3MXUHW9 | 160   | main   | 3    | 1.95 (1.89–2.01) | 2.48 (2.36–2.83) | –                | 5.77 (5.72–6.00) | 2103                | 0          |
| G3MXUHW9 | 160   | branch | 3    | 1.58 (1.48–1.66) | 2.15 (1.96–2.25) | 9.20 (8.79–9.42) | 4.16 (3.84–4.19) | 910                 | 0          |
| YQC4zrpR | 8     | main   | 3    | 2.17 (2.07–2.21) | 2.43 (2.28–2.46) | –                | 5.31 (5.11–5.31) | 1039                | 0          |
| YQC4zrpR | 8     | branch | 3    | 1.99 (1.96–2.02) | 2.22 (2.19–2.23) | 8.71 (8.50–8.76) | 3.87 (3.84–3.93) | 910                 | 0          |
| YQC4zrpR | 160   | main   | 3    | 2.42 (2.37–2.42) | 2.76 (2.68–2.77) | –                | 5.63 (5.45–6.03) | 2103                | 0          |
| YQC4zrpR | 160   | branch | 3    | 2.18 (2.13–2.18) | 2.40 (2.35–2.49) | 8.91 (8.69–9.09) | 4.01 (3.94–4.09) | 910                 | 0          |

#### Cold (first visit; "Maia moves shown" includes clicking Download at ~2 s and a 44 MB download from localhost)

| game     | cores | build  | runs | board shown      | first SF depth   | SF d18              | Maia moves shown | JS transferred (KB) | SF retries |
| -------- | ----- | ------ | ---- | ---------------- | ---------------- | ------------------- | ---------------- | ------------------- | ---------- |
| G3MXUHW9 | 8     | main   | 2    | 1.97 (1.94–2.00) | 2.79 (2.69–2.89) | 7.16                | 7.21 (6.95–7.47) | 1039                | 0          |
| G3MXUHW9 | 8     | branch | 2    | 1.91 (1.89–1.93) | 2.68 (2.64–2.71) | 10.81 (10.65–10.96) | 5.68 (5.63–5.73) | 910                 | 0          |
| G3MXUHW9 | 160   | main   | 2    | 2.23 (2.22–2.25) | 3.07 (2.66–3.48) | 7.59                | 7.69 (7.62–7.75) | 2103                | 0          |
| G3MXUHW9 | 160   | branch | 2    | 1.80 (1.75–1.85) | 2.67 (2.43–2.92) | 10.73 (10.54–10.93) | 5.80 (5.61–6.00) | 910                 | 0          |
| YQC4zrpR | 8     | main   | 2    | 2.04 (1.99–2.08) | 2.52 (2.35–2.70) | 6.59 (6.40–6.78)    | 7.09 (7.05–7.13) | 1039                | 0          |
| YQC4zrpR | 8     | branch | 2    | 1.99 (1.92–2.07) | 2.73 (2.65–2.81) | 10.43 (10.35–10.52) | 5.89 (5.77–6.02) | 910                 | 0          |
| YQC4zrpR | 160   | main   | 2    | 2.32 (2.25–2.39) | 2.80 (2.62–2.98) | 6.86 (6.68–7.04)    | 7.38 (7.17–7.58) | 2103                | 0          |
| YQC4zrpR | 160   | branch | 2    | 1.98 (1.96–2.01) | 2.47 (2.24–2.70) | 10.62 (10.49–10.75) | 5.89 (5.87–5.92) | 910                 | 0          |

"SF d18" is on the first position: "–" means no run reached it, and a single
value means one of the two cold runs did. "SF retries" counts runs where
Stockfish's setup failed and started over (see 34486b0). "JS transferred"
counts all `_next` scripts, including the chunk each Stockfish worker loads.

### Paging (warm; seconds after the key press or click; one run each)

| game     | cores | build  | Maia shown, 8 steps (median, max) | first SF depth, 8 steps (median, max) | steps with SF d12 within 2.6 s | Maia after 10 rapid presses | jumps: Maia / SF d12 (median) | SF froze |
| -------- | ----- | ------ | --------------------------------- | ------------------------------------- | ------------------------------ | --------------------------- | ----------------------------- | -------- |
| G3MXUHW9 | 8     | main   | 1.56, 1.68                        | 1.47, 1.76                            | 1 of 8                         | 8.69                        | 1.67 / 0.84                   | 1        |
| G3MXUHW9 | 8     | branch | 0.38, 0.43                        | 0.23, 0.27                            | 6 of 8                         | 0.31                        | 0.43 / 1.56                   | 0        |
| G3MXUHW9 | 160   | main   | 1.55, 1.58                        | 0.91, 1.66 (1 of 8 none)              | 1 of 8                         | 8.63                        | 1.62 / 0.89                   | 0        |
| G3MXUHW9 | 160   | branch | 0.37, 0.41                        | 0.23, 0.27                            | 7 of 8                         | 0.41                        | 0.41 / 1.41                   | 0        |
| YQC4zrpR | 8     | main   | 1.52, 1.65                        | 0.92, 2.54                            | 1 of 8                         | 8.97                        | 1.63 / 0.97                   | 0        |
| YQC4zrpR | 8     | branch | 0.36, 0.40                        | 0.21, 0.25                            | 7 of 8                         | 0.32                        | 0.37 / 1.19                   | 0        |
| YQC4zrpR | 160   | main   | 1.64, 1.74                        | 0.37, 2.32                            | 2 of 8                         | 9.43                        | 1.62 / 1.66                   | 1        |
| YQC4zrpR | 160   | branch | 0.37, 0.40                        | 0.21, 0.26                            | 7 of 8                         | 0.66                        | 0.35 / 1.19                   | 0        |

"SF froze" counts positions where the depth label stopped below 14 for more
than 3.5 s while the position was on screen.

## What changed

| commit           | change                                                                                                                                                       | effect (headless, 8 cores unless noted)                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7dc2502          | Stockfish: a superseded run no longer detaches the new run's listener; an abandoned search is stopped before MultiPV is reset; a new run always sends `stop` | On `main` the first position froze at d14–17 once Maia's result arrived, and some positions never got past d9 when paging (no eval bar). After a move the next search waited up to 2.5 s behind the old one. Now: d18 on the first position, first depth ~0.3 s after each move |
| d371e75          | Maia: requests queue on the main thread, one in flight; stale ones are dropped (ported from 6ba0cf2 on `human-bar`, without its priorities)                  | Maia after 10 rapid presses: 7.9–10.4 s → 1.75 s                                                                                                                                                                                                                                |
| a3b81ca          | Stockfish starts 4 pthread workers instead of one per reported core                                                                                          | At 160 cores: 160 → 4 workers; pool ready 530 → 150–200 ms; renderer memory 1350–1480 → 1050 MB                                                                                                                                                                                 |
| eedf3a6          | The Lichess PGN is fetched while the account loads; the stored analysis is fetched with the game, not after it, and shown as soon as it arrives              | Board ~0.1–0.2 s earlier; with stored analysis arriving 1 s late, it shows at 2.7 s instead of 3.5–3.7 s                                                                                                                                                                        |
| 4acbb36          | Maia runs the selected rating first (~0.1 s), then the other 20 in two batches; only complete rating sets are saved to the backend                           | Maia's moves 0.36–0.42 s after each move (was 1.5–1.7 s), ~1.3 s earlier on load                                                                                                                                                                                                |
| ee6faa0          | `maia.ts` no longer imports onnxruntime-web (only used for `Tensor`)                                                                                         | `_app` chunk 292 → 188 kB gzip; first-load JS of every page −103 kB (analysis page 711 → 608 kB)                                                                                                                                                                                |
| 34486b0          | Stockfish: renew the WASM heap view before copying the nets                                                                                                  | The copy failed on 3 of 26 test loads ("offset is out of bounds"), which re-downloaded the 78 MB of nets and started a second engine                                                                                                                                            |
| 74782ed          | Stockfish: a superseded run returns before its multi-PV phase touches the engine                                                                             | Without it, a run superseded right after screening (e.g. on the last position, which has no played move to deepen) took the new run's `readyok`, and the new run froze (1 of 4 paging runs)                                                                                     |
| 137cb89, 74782ed | Tests (`npm test` found none before)                                                                                                                         | 9 tests; the Stockfish ones fail on `main`                                                                                                                                                                                                                                      |

## Looked at, not changed

- **ONNX graph optimisation.** The Maia session spends ~0.3 s optimising the
  model on every load. `graphOptimizationLevel: 'basic'` or `'disabled'` skips
  that with the same inference speed, but changes move logits by up to 0.047
  compared with the current `'all'` (`'basic'`, `'extended'` and `'disabled'`
  agree exactly). That's a change to Maia's numbers, so it's left for you to
  decide.
- **The rest of Maia's startup.** On a warm load the model is ready ~3.7 s after
  navigation: worker start ~0.6 s, IndexedDB read 0.1–0.15 s, ONNX Runtime's
  WASM backend 1.2–1.7 s, model load 0.85 s.
- **`analyze_user_game`.** For a Lichess game the page could build the move
  tree from the PGN it already has and show the board ~0.5 s earlier. But that
  would replace a backend call whose side effects (if any) I didn't check.
- **Earlier NNUE loading** (prefetching the nets while the engine module
  loads). It brought the engine's readiness forward ~0.3 s on a cold visit, but
  the engine was already ready before the board in every run, so first output
  didn't move. Sharing loads as `human-bar` does would also keep the 75 MB net
  in memory for 60 s, so it's not included.
- **Keeping Stockfish's hash when the analysis restarts for the same
  position** (after Maia's policy arrives). No measurable gain.
- **Making Stockfish wait for Maia's policy** (now ~0.4 s after a move) so the
  analysis isn't restarted. The first depth came 0.3 s later and depth 12
  hardly sooner: most of the time goes into the screening search of every
  move, not into the restart.
- **Smaller items.** Recharts renders ~70 ms on the first render and again on
  every Stockfish update. react-joyride (~75 KB) loads on every page. The move
  sound's `AudioContext` takes ~60 ms of main thread at start-up.

## Rebasing `human-bar`

- d371e75 makes the same change to `useEngineAnalysis.ts` as 6ba0cf2, and its
  `maia.ts` part is 6ba0cf2 without the priority levels. When rebasing 6ba0cf2,
  keep its priorities in `maia.ts` and take this branch's `useEngineAnalysis.ts`
  (4acbb36 changed the Maia effect further).
- `stockfish.ts`: this branch doesn't touch `loadNnueModel` or `setupStockfish`'s
  signature. It changes the `createInstance()` call lines (pool cap) and the
  `setNnueBuffer` lines; a6edbdf's hunks should apply.
- Because of a3b81ca, `human-bar`'s second engine also starts 4 workers instead
  of one per core.
