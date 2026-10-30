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

Medians, `main` → branch, warm cache, both games, 8 and 160 reported cores
(full tables below):

- **Board on screen:** 1.86–2.42 → 1.56–2.09 s.
- **Maia's moves:** 5.3–5.8 → 4.0–4.5 s after navigation; 1.6 → 0.36–0.38 s
  after each move; 9.1–9.5 → 0.5–0.6 s after 10 rapid key presses.
- **Stockfish after a move:** first depth 0.4–1.5 → 0.24–0.26 s (worst step
  2.5 → 0.32 s). Steps reaching depth 12 within 2.6 s: 2–3 of 16 → 14–15 of 16.
- **Stockfish after a jump:** depth 12 0.86–1.03 → 0.62–1.01 s (on `main` 1
  of 6 jumps never got there, in three of the four setups); depth 18
  3.8–4.5 → 1.2–2.3 s.
- **Stockfish on the first position:** d18 at 6.5–7.5 s in every run. On
  `main` it froze at d14–16 in all 12 warm runs. On a cold first visit,
  6.6–7.6 s (reached in 6 of 8 runs) → 6.5–7.5 s (8 of 8).
- **Frozen positions while paging:** 3 on `main`, none on the branch.
- **JavaScript:** 1039 → 910 KB transferred on the analysis page; `_app`
  292 → 188 kB gzip on every page. With 160 cores `main` transferred 2103 KB,
  because each of its 160 Stockfish workers loads a 7 KB chunk.

### Load (seconds after navigation; median of 3 warm / 2 cold runs, range in brackets)

#### Warm (returning visitor)

| game     | cores | build  | runs | board shown      | first SF depth   | SF d18           | Maia moves shown | JS transferred (KB) | SF retries |
| -------- | ----- | ------ | ---- | ---------------- | ---------------- | ---------------- | ---------------- | ------------------- | ---------- |
| G3MXUHW9 | 8     | main   | 3    | 1.86 (1.70–1.91) | 2.29 (2.11–2.35) | –                | 5.61 (5.44–5.73) | 1039                | 0          |
| G3MXUHW9 | 8     | branch | 3    | 1.62 (1.60–1.64) | 2.20 (2.18–2.23) | 6.90 (6.88–7.13) | 4.17 (4.14–4.22) | 910                 | 0          |
| G3MXUHW9 | 160   | main   | 3    | 1.95 (1.89–2.01) | 2.48 (2.36–2.83) | –                | 5.77 (5.72–6.00) | 2103                | 0          |
| G3MXUHW9 | 160   | branch | 3    | 1.56 (1.50–1.58) | 2.05 (1.72–2.12) | 6.53 (6.32–6.53) | 3.99 (3.85–4.04) | 910                 | 0          |
| YQC4zrpR | 8     | main   | 3    | 2.17 (2.07–2.21) | 2.43 (2.28–2.46) | –                | 5.31 (5.11–5.31) | 1039                | 0          |
| YQC4zrpR | 8     | branch | 3    | 2.09 (2.08–2.22) | 2.32 (2.30–2.54) | 7.45 (6.94–7.66) | 4.45 (4.29–4.46) | 910                 | 0          |
| YQC4zrpR | 160   | main   | 3    | 2.42 (2.37–2.42) | 2.76 (2.68–2.77) | –                | 5.63 (5.45–6.03) | 2103                | 0          |
| YQC4zrpR | 160   | branch | 3    | 1.99 (1.97–2.03) | 2.21 (2.18–2.26) | 6.84 (6.71–6.94) | 3.99 (3.83–4.14) | 910                 | 0          |

#### Cold (first visit; "Maia moves shown" includes clicking Download at ~2 s and a 44 MB download from localhost)

| game     | cores | build  | runs | board shown      | first SF depth   | SF d18           | Maia moves shown | JS transferred (KB) | SF retries |
| -------- | ----- | ------ | ---- | ---------------- | ---------------- | ---------------- | ---------------- | ------------------- | ---------- |
| G3MXUHW9 | 8     | main   | 2    | 1.97 (1.94–2.00) | 2.79 (2.69–2.89) | 7.16             | 7.21 (6.95–7.47) | 1039                | 0          |
| G3MXUHW9 | 8     | branch | 2    | 1.99 (1.90–2.08) | 2.72 (2.60–2.85) | 7.03 (7.01–7.05) | 5.93 (5.76–6.10) | 910                 | 0          |
| G3MXUHW9 | 160   | main   | 2    | 2.23 (2.22–2.25) | 3.07 (2.66–3.48) | 7.59             | 7.69 (7.62–7.75) | 2103                | 0          |
| G3MXUHW9 | 160   | branch | 2    | 1.66 (1.65–1.68) | 2.61 (2.28–2.95) | 6.58 (6.22–6.94) | 5.65 (5.55–5.75) | 910                 | 0          |
| YQC4zrpR | 8     | main   | 2    | 2.04 (1.99–2.08) | 2.52 (2.35–2.70) | 6.59 (6.40–6.78) | 7.09 (7.05–7.13) | 1039                | 0          |
| YQC4zrpR | 8     | branch | 2    | 2.20 (2.12–2.28) | 2.85 (2.82–2.88) | 7.47 (7.10–7.84) | 6.11 (6.06–6.15) | 910                 | 0          |
| YQC4zrpR | 160   | main   | 2    | 2.32 (2.25–2.39) | 2.80 (2.62–2.98) | 6.86 (6.68–7.04) | 7.38 (7.17–7.58) | 2103                | 0          |
| YQC4zrpR | 160   | branch | 2    | 1.98 (1.96–2.01) | 2.47 (2.29–2.65) | 6.51 (6.42–6.61) | 5.78 (5.73–5.84) | 910                 | 0          |

"SF d18" is on the first position: "–" means no run reached it, and a single
value means one of the two cold runs did. "SF retries" counts runs where
Stockfish's setup failed and started over (see 34486b0). "JS transferred"
counts all `_next` scripts, including the chunk each Stockfish worker loads.

### Paging (warm; seconds after the key press or click; two runs pooled, 16 steps and 6 jumps each)

| game     | cores | build  | runs | Maia shown after a step (median, max) | first SF depth after a step (median, max) | steps with SF d12 within 2.6 s | Maia after 10 rapid presses | jumps: Maia / SF d12 / SF d18 (median)   | SF froze |
| -------- | ----- | ------ | ---- | ------------------------------------- | ----------------------------------------- | ------------------------------ | --------------------------- | ---------------------------------------- | -------- |
| G3MXUHW9 | 8     | main   | 2    | 1.58, 1.72                            | 1.45, 1.80 (1 of 16 none)                 | 3 of 16                        | 9.14                        | 1.66 / 0.92 (1/6 none) / 4.47 (2/6 none) | 1        |
| G3MXUHW9 | 8     | branch | 2    | 0.38, 0.46                            | 0.24, 0.28                                | 15 of 16                       | 0.51                        | 0.37 / 0.95 / 2.25 (2/6 none)            | 0        |
| G3MXUHW9 | 160   | main   | 2    | 1.57, 1.74                            | 0.67, 1.85 (4 of 16 none)                 | 2 of 16                        | 9.24                        | 1.65 / 1.03 / 4.37 (4/6 none)            | 0        |
| G3MXUHW9 | 160   | branch | 2    | 0.37, 0.40                            | 0.25, 0.28                                | 14 of 16                       | 0.59                        | 0.37 / 1.01 / 2.01 (2/6 none)            | 0        |
| YQC4zrpR | 8     | main   | 2    | 1.56, 1.75                            | 0.92, 2.54                                | 2 of 16                        | 9.50                        | 1.62 / 0.86 (1/6 none) / 4.24 (2/6 none) | 1        |
| YQC4zrpR | 8     | branch | 2    | 0.38, 0.41                            | 0.26, 0.29                                | 14 of 16                       | 0.53                        | 0.39 / 0.62 / 1.24 (1/6 none)            | 0        |
| YQC4zrpR | 160   | main   | 2    | 1.58, 1.74                            | 0.37, 2.32                                | 3 of 16                        | 9.18                        | 1.61 / 0.87 (1/6 none) / 3.79 (2/6 none) | 1        |
| YQC4zrpR | 160   | branch | 2    | 0.36, 0.40                            | 0.25, 0.32                                | 15 of 16                       | 0.51                        | 0.36 / 0.66 / 1.40 (1/6 none)            | 0        |

"none" counts jumps where that output never came before the next action (6 s
later). "SF froze" counts positions where the depth label stopped below 14 for
more than 3.5 s while the position was on screen.

## What changed

| commit           | change                                                                                                                                                                                                    | effect (headless, 8 cores unless noted)                                                                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7dc2502          | Stockfish: a superseded run no longer detaches the new run's listener; an abandoned search is stopped before MultiPV is reset; a new run always sends `stop`                                              | On `main` the first position froze at d14–17 once Maia's result arrived, and some positions never got past d9 when paging (no eval bar). After a move the next search waited up to 2.5 s behind the old one. Now: d18 on the first position, first depth ~0.3 s after each move |
| d371e75          | Maia: requests queue on the main thread, one in flight; stale ones are dropped (ported from 6ba0cf2 on `human-bar`, without its priorities)                                                               | Maia after 10 rapid presses: 7.9–10.4 s → 1.75 s                                                                                                                                                                                                                                |
| a3b81ca          | Stockfish starts 4 pthread workers instead of one per reported core                                                                                                                                       | At 160 cores: 160 → 4 workers; pool ready 530 → 150–200 ms; renderer memory 1350–1480 → 1050 MB                                                                                                                                                                                 |
| eedf3a6          | The Lichess PGN is fetched while the account loads; the stored analysis is fetched with the game, not after it, and shown as soon as it arrives                                                           | Board ~0.1–0.2 s earlier; with stored analysis arriving 1 s late, it shows at 2.7 s instead of 3.5–3.7 s                                                                                                                                                                        |
| 4acbb36          | Maia runs the selected rating first (~0.1 s), then the other 20 in two batches; only complete rating sets are saved to the backend                                                                        | Maia's moves 0.36–0.42 s after each move (was 1.5–1.7 s), ~1.3 s earlier on load                                                                                                                                                                                                |
| ee6faa0          | `maia.ts` no longer imports onnxruntime-web (only used for `Tensor`)                                                                                                                                      | `_app` chunk 292 → 188 kB gzip; first-load JS of every page −103 kB (analysis page 711 → 608 kB)                                                                                                                                                                                |
| 34486b0          | Stockfish: renew the WASM heap view before copying the nets                                                                                                                                               | The copy failed on 3 of 26 test loads ("offset is out of bounds"), which re-downloaded the 78 MB of nets and started a second engine                                                                                                                                            |
| 74782ed          | Stockfish: a superseded run returns before its multi-PV phase touches the engine                                                                                                                          | Without it, a run superseded right after screening (e.g. on the last position, which has no played move to deepen) took the new run's `readyok`, and the new run froze (1 of 4 paging runs)                                                                                     |
| 780ac64          | Stockfish takes up Maia's candidate moves when it reaches the phases that use them, instead of the page restarting the analysis when Maia's policy arrives                                                | With Maia's answer at ~0.4 s the restart had thrown away the first search: depth 12 after a jump 1.4–2.1 s (was 0.8–0.9 s on `main`). First position d18 8.7–9.4 → 6.9–7.4 s                                                                                                    |
| 8239866          | While Stockfish streams, the page re-renders at most every 150 ms (as React transitions); the moves-by-rating charts re-render only when their data changes; legal moves with SAN are cached per position | Each re-render had been a 50–85 ms main-thread task, which slowed the search (it is fed through the main thread). No long tasks during a jump; depth 12 after jumps back to `main`'s or better                                                                                  |
| 137cb89, 74782ed | Tests (`npm test` found none before)                                                                                                                                                                      | 9 tests; the Stockfish ones fail on `main`                                                                                                                                                                                                                                      |

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
- **Making Stockfish wait for Maia's policy** before starting. The first
  depth came 0.3 s later, and depth 12 hardly sooner; 780ac64 does better.
- **Smaller items.** react-joyride (~75 KB) loads on every page. The move
  sound's `AudioContext` takes ~60 ms of main thread at start-up. Stockfish's
  screening search (all moves to depth 10) is most of the time to depth 12
  and slows when the main thread is busy (40% busy: +0.2–0.7 s).

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
- 780ac64 and 8239866 change the Stockfish effect in `useEngineAnalysis.ts`, the
  staged run in `stockfish.ts` and `StockfishStreamOptions`; `human-bar` doesn't
  touch those parts.
