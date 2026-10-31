# Site loading and responsiveness

Notes for the `claude/loading-perf-8f7807` branch: first the analysis page
(`/analysis/<lichessGameId>/lichess`), then the rest of the site. Measured on
2026-10-30 and 31 against `main` (a6e52f5).

## How it was measured

- Production builds (`next build && next start`) of `main` and of this branch,
  side by side on ada, in headless Chromium 130 (Playwright), 1600×1000.
- `scripts/perf/analysis-probe.mjs` records, in page time, when the board,
  Stockfish's first depth label, depth 18 and Maia's move list appear on the
  analysis page, with requests, workers and long tasks; `summarize.py` builds
  the tables. `scripts/perf/page-probe.mjs` measures any route (first and
  largest contentful paint, blocking time, main-thread time, JavaScript).
- **The browser's HTTP cache is on.** Playwright turns it off while any
  request route is set, and the first version of this file was measured that
  way: its "warm" runs re-downloaded every script and WASM file (ONNX
  Runtime's 11.8 MB included). The probe now sets no routes (`--proxy`) and
  `scripts/perf/stub-proxy.mjs`, in front of the server, does the stubbing
  instead. That is why the numbers below differ from the earlier version.
- **Warm**: a profile that has visited before (scripts, Maia model, Stockfish
  nets cached), as for a returning visitor. **Cold**: an empty profile, where
  the probe clicks "Download Maia-3" when asked (about 2 s in); assets come
  from localhost, so downloads are faster than over a real network.
- **Cores**: 8 (a laptop), by overriding `navigator.hardwareConcurrency`, and
  160 (what ada reports).
- The backend's stored analysis (`get_engine_analysis`) is shared by all
  visitors and already holds both test games, so the stub keeps the request
  (and its latency) but answers 404, as for a game nobody has analysed.
  Uploads (`store_engine_analysis`) and PostHog are stubbed; Google Analytics'
  hosts are unresolvable.
- Games: G3MXUHW9 (blitz, 51 plies) and YQC4zrpR (bullet, 103 plies).
  Paging: jump to the end, jump to 15%, 8 steps with → every 2.5 s, 10 presses
  150 ms apart, a jump to 85%, back to the start.
- ada is a shared 160-core machine, so single runs vary by ±0.1–0.3 s; the
  campaigns ran on separate cores (`taskset`).
- To repeat (Playwright is not a dependency of this repo):

  ```bash
  node scripts/perf/stub-proxy.mjs 3020 3000 &
  node scripts/perf/analysis-probe.mjs G3MXUHW9 --base http://localhost:3020 --profile /tmp/p --cores 8 --proxy --paging --out results/paging-new-G3MXUHW9-c8-r1.json
  node scripts/perf/page-probe.mjs http://localhost:3020 /tmp/p2 / --cores 8 --reps 3
  python3 scripts/perf/summarize.py results
  ```

## Results

### Analysis page

Medians, `main` → branch, both games, 8 and 160 cores:

- **Board on screen:** warm 1.36–1.84 → 0.55–0.60 s; cold 1.68–2.09 →
  0.82–0.88 s.
- **Maia's moves:** warm 3.74–3.87 → 2.27–2.41 s after navigation; cold (with
  the 44 MB download) 6.73–7.21 → 3.56–3.73 s; 1.49–1.56 → 0.29–0.31 s after
  each move; 8.4–8.8 → 0.29–0.59 s after 10 quick presses.
- **Stockfish after a move:** first depth 0.74–1.67 → 0.18–0.19 s; steps
  reaching depth 12 within 2.6 s: 0–4 of 16 → 16 of 16. After a jump, depth
  18 at 1.2–2.0 s; within the 6 s before the next action it was not reached
  on 3–5 of 6 jumps on `main`, 0–2 on the branch.
- **Stockfish on the first position:** depth 18 at 6.4–6.6 s warm (`main`:
  10.3–10.8 s, or never). The first depth label shows about when it did on
  `main` (2.05–2.22 s against 1.72–2.25 s; see "Stockfish's first depth").
- **Reliability:** `main`'s Stockfish set-up failed and started again in 5 of
  28 runs; the branch's in none. Paging froze Stockfish 4 times on `main`.
- **JavaScript on a first visit:** 853 → 665 KB.

#### Load (seconds after navigation; median, range in brackets)

Warm (returning visitor):

| game     | cores | build  | runs | board shown      | first SF depth   | SF d18              | Maia moves shown | JS transferred (KB) | SF retries |
| -------- | ----- | ------ | ---- | ---------------- | ---------------- | ------------------- | ---------------- | ------------------- | ---------- |
| G3MXUHW9 | 8     | main   | 3    | 1.36 (1.34–1.37) | 1.72 (1.64–1.78) | 10.77               | 3.74 (3.64–3.78) | 0                   | 0          |
| G3MXUHW9 | 8     | branch | 3    | 0.58 (0.58–0.59) | 2.17 (2.05–2.23) | 6.46 (5.88–6.81)    | 2.38 (2.36–2.55) | 0                   | 0          |
| G3MXUHW9 | 160   | main   | 3    | 1.50 (1.38–1.65) | 1.85 (1.61–1.96) | 10.28 (10.16–10.41) | 3.76 (3.54–3.82) | 0                   | 0          |
| G3MXUHW9 | 160   | branch | 3    | 0.57 (0.54–6.79) | 2.22 (2.08–7.02) | 6.54 (6.24–11.45)   | 2.41 (2.33–7.37) | 0                   | 0          |
| YQC4zrpR | 8     | main   | 3    | 1.72 (1.71–1.89) | 2.11 (1.90–2.53) | 10.53 (10.50–10.55) | 3.83 (3.75–3.87) | 0                   | 1          |
| YQC4zrpR | 8     | branch | 3    | 0.55 (0.50–0.58) | 2.05 (1.89–2.14) | 6.42 (6.13–6.57)    | 2.28 (2.22–2.42) | 0                   | 0          |
| YQC4zrpR | 160   | main   | 3    | 1.84 (1.68–2.08) | 2.25 (1.98–2.60) | –                   | 3.87 (3.86–3.94) | 0                   | 2          |
| YQC4zrpR | 160   | branch | 3    | 0.60 (0.50–0.60) | 2.15 (2.11–2.18) | 6.64 (6.58–6.76)    | 2.27 (2.23–2.35) | 0                   | 0          |

Cold (first visit; "Maia moves shown" includes clicking Download at ~2 s and
the 44 MB model from localhost):

| game     | cores | build  | runs | board shown      | first SF depth   | SF d18           | Maia moves shown | JS transferred (KB) | SF retries |
| -------- | ----- | ------ | ---- | ---------------- | ---------------- | ---------------- | ---------------- | ------------------- | ---------- |
| G3MXUHW9 | 8     | main   | 2    | 1.68 (1.63–1.74) | 2.66 (2.52–2.79) | 6.65             | 6.73 (6.73–6.73) | 853                 | 0          |
| G3MXUHW9 | 8     | branch | 2    | 0.84 (0.74–0.93) | 2.91 (2.85–2.96) | 6.89 (6.84–6.95) | 3.56 (3.50–3.62) | 665                 | 0          |
| G3MXUHW9 | 160   | main   | 2    | 1.80 (1.78–1.82) | 2.41 (2.37–2.44) | 6.56 (6.52–6.60) | 6.82 (6.81–6.83) | 853                 | 0          |
| G3MXUHW9 | 160   | branch | 2    | 0.88 (0.88–0.89) | 2.99 (2.99–2.99) | 6.83 (6.66–6.99) | 3.70 (3.63–3.77) | 665                 | 0          |
| YQC4zrpR | 8     | main   | 2    | 1.96 (1.89–2.02) | 2.35 (2.09–2.61) | 6.38 (6.08–6.68) | 6.99 (6.92–7.07) | 853                 | 0          |
| YQC4zrpR | 8     | branch | 2    | 0.82 (0.70–0.94) | 2.70 (2.65–2.75) | 7.12 (6.94–7.29) | 3.73 (3.65–3.80) | 665                 | 0          |
| YQC4zrpR | 160   | main   | 2    | 2.09 (2.06–2.12) | 2.33 (2.27–2.40) | 6.52 (6.50–6.55) | 7.21 (7.17–7.25) | 853                 | 0          |
| YQC4zrpR | 160   | branch | 2    | 0.88 (0.84–0.93) | 2.72 (2.55–2.90) | 6.63 (6.21–7.06) | 3.70 (3.60–3.79) | 665                 | 0          |

"SF d18" is on the first position: "–" means no run reached it, a single
value that one run did. "SF retries" counts runs where Stockfish's set-up
failed and started again (fixed by 34486b0). In one branch run (G3MXUHW9,
160 cores) Lichess took 6.5 s to send the PGN, hence that row's upper
ranges. The few "blocked by COEP" console errors are Google Analytics'
`googletagmanager.com/a` beacon image, which the site's COEP header blocks
whenever GA sends it, on `main` too.

#### Paging (warm; seconds after the key press or click; two runs pooled, 16 steps and 6 jumps each)

| game     | cores | build  | runs | Maia shown after a step (median, max) | first SF depth after a step (median, max) | steps with SF d12 within 2.6 s | Maia after 10 rapid presses | jumps: Maia / SF d12 / SF d18 (median)   | SF froze |
| -------- | ----- | ------ | ---- | ------------------------------------- | ----------------------------------------- | ------------------------------ | --------------------------- | ---------------------------------------- | -------- |
| G3MXUHW9 | 8     | main   | 2    | 1.53, 1.61                            | 1.67, 2.43 (1 of 16 none)                 | 0 of 16                        | 8.83                        | 1.61 / 0.90 / 4.00 (5/6 none)            | 0        |
| G3MXUHW9 | 8     | branch | 2    | 0.30, 0.35                            | 0.18, 0.22                                | 16 of 16                       | 0.29                        | 0.35 / 0.85 / 1.91 (2/6 none)            | 0        |
| G3MXUHW9 | 160   | main   | 2    | 1.56, 1.73                            | 0.74, 1.88 (2 of 16 none)                 | 1 of 16                        | 8.41                        | 1.57 / 0.90 / 4.46 (3/6 none)            | 0        |
| G3MXUHW9 | 160   | branch | 2    | 0.31, 0.35                            | 0.19, 0.21                                | 16 of 16                       | 0.29                        | 0.34 / 0.99 / 2.00 (2/6 none)            | 0        |
| YQC4zrpR | 8     | main   | 2    | 1.49, 1.67                            | 0.75, 2.70 (1 of 16 none)                 | 4 of 16                        | 8.51                        | 1.51 / 0.71 (2/6 none) / 1.37 (3/6 none) | 2        |
| YQC4zrpR | 8     | branch | 2    | 0.29, 0.35                            | 0.18, 0.21                                | 16 of 16                       | 0.29                        | 0.29 / 0.50 / 1.33                       | 0        |
| YQC4zrpR | 160   | main   | 2    | 1.51, 1.62                            | 1.38, 2.67                                | 4 of 16                        | 8.51                        | 1.53 / 0.71 (2/6 none) / 1.54 (3/6 none) | 2        |
| YQC4zrpR | 160   | branch | 2    | 0.30, 0.42                            | 0.18, 0.22                                | 16 of 16                       | 0.59                        | 0.29 / 0.49 / 1.18                       | 0        |

"none" counts outputs that never came before the next action. "SF froze"
counts positions where the depth label stopped below 14 for over 3.5 s.

#### Stockfish's first depth

On the first position the label shows about when it did on `main`. On the
branch the engine has its nets at ~0.95 s and answers its first command at
~1.9 s: the difference is Stockfish decoding its 75 MB net (0.74 s,
whatever the page does) and its own start-up. Creating the engine before the
page renders, and rendering Maia's first result as an interruptible
transition, both left that unchanged.

### Other pages

Returning visitor, medians of 3–5 loads (ms; "main-thread" is Chrome's task
time during the load and the seconds after it):

| page                    |               | first paint | largest paint | blocking time | main-thread | note                                                                                    |
| ----------------------- | ------------- | ----------- | ------------- | ------------- | ----------- | --------------------------------------------------------------------------------------- |
| / (8 s)                 | main → branch | 249 → 258   | 249 → 258     | 462 → 272     | 5611 → 2226 | the page now goes idle once its counters finish, instead of keeping ~55% of a core busy |
| /play/maia              | main → branch | 160 → 160   | 1859 → 1120   | 19 → 8        | 614 → 501   | one game started instead of two                                                         |
| /puzzles                | main → branch | 174 → 167   | 1786 → 1666   | 85 → 56       | 1528 → 1304 | next puzzle 1.94–1.99 → 0.19–0.22 s after Next Puzzle                                   |
| /analysis (header link) | main → branch |             |               |               |             | game board shown 1.31–1.68 → 1.04–1.07 s after navigating to /analysis                  |

First visit (fresh browser), medians of 3 loads (4 for the home page):

| page                       | JS transferred (KB) | first paint (ms) | blocking time (ms) |
| -------------------------- | ------------------- | ---------------- | ------------------ |
| /                          | 925 → 737           | 472 → 426        | 662 → 508          |
| /analysis/G3MXUHW9/lichess | 964 → 778           | 356 → 302        | 406 → 209          |
| /puzzles                   | 955 → 757           | 284 → 375        | 264 → 126          |
| /drills                    | 955 → 759           | 360 → 312        | 275 → 203          |
| /leaderboard               | 929 → 733           | 359 → 302        | 174 → 60           |
| /blog/maia-v1              | 929 → 759           | 528 → 388        | 129 → 85           |

First Load JS (gzip, from `next build`): /settings and /leaderboard
600 → 321 kB, /blog/[id] 600 → 343, /play/maia 604 → 356, /turing 601 → 349,
/puzzles 606 → 478, the analysis page 610 → 493, /drills 716 → 626, the home
page 343 → 291 kB; shared by all pages 357 → 305 kB.

## What changed

| commit                    | change                                                                                                                                                                                                                                                                              | effect                                                                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7dc2502                   | Stockfish: a superseded run no longer detaches the new run's listener; an abandoned search is stopped before MultiPV is reset; a new run always sends `stop`                                                                                                                        | On `main` the first position froze at d14–17 once Maia's result arrived, and some positions never got past d9 when paging (no eval bar). After a move the next search waited up to 2.5 s behind the old one. Now: d18 on the first position, first depth ~0.3 s after each move |
| d371e75                   | Maia: requests queue on the main thread, one in flight; stale ones are dropped (ported from 6ba0cf2 on `human-bar`, without its priorities)                                                                                                                                         | Maia after 10 rapid presses: 7.9–10.4 s → 1.75 s                                                                                                                                                                                                                                |
| a3b81ca                   | Stockfish starts 4 pthread workers instead of one per reported core                                                                                                                                                                                                                 | At 160 cores: 160 → 4 workers; pool ready 530 → 150–200 ms; renderer memory 1350–1480 → 1050 MB                                                                                                                                                                                 |
| eedf3a6                   | The Lichess PGN is fetched while the account loads; the stored analysis is fetched with the game, not after it, and shown as soon as it arrives                                                                                                                                     | Board ~0.1–0.2 s earlier; with stored analysis arriving 1 s late, it shows at 2.7 s instead of 3.5–3.7 s                                                                                                                                                                        |
| 4acbb36                   | Maia runs the selected rating first (~0.1 s), then the other 20 in two batches; only complete rating sets are saved to the backend                                                                                                                                                  | Maia's moves 0.36–0.42 s after each move (was 1.5–1.7 s), ~1.3 s earlier on load                                                                                                                                                                                                |
| ee6faa0                   | `maia.ts` no longer imports onnxruntime-web (only used for `Tensor`)                                                                                                                                                                                                                | `_app` chunk 292 → 188 kB gzip; first-load JS of every page −103 kB (analysis page 711 → 608 kB)                                                                                                                                                                                |
| 34486b0                   | Stockfish: renew the WASM heap view before copying the nets                                                                                                                                                                                                                         | The copy failed on 3 of 26 test loads ("offset is out of bounds"), which re-downloaded the 78 MB of nets and started a second engine                                                                                                                                            |
| 74782ed                   | Stockfish: a superseded run returns before its multi-PV phase touches the engine                                                                                                                                                                                                    | Without it, a run superseded right after screening (e.g. on the last position, which has no played move to deepen) took the new run's `readyok`, and the new run froze (1 of 4 paging runs)                                                                                     |
| 780ac64                   | Stockfish takes up Maia's candidate moves when it reaches the phases that use them, instead of the page restarting the analysis when Maia's policy arrives                                                                                                                          | With Maia's answer at ~0.4 s the restart had thrown away the first search: depth 12 after a jump 1.4–2.1 s (was 0.8–0.9 s on `main`). First position d18 8.7–9.4 → 6.9–7.4 s                                                                                                    |
| 8239866                   | While Stockfish streams, the page re-renders at most every 150 ms (as React transitions); the moves-by-rating charts re-render only when their data changes; legal moves with SAN are cached per position                                                                           | Each re-render had been a 50–85 ms main-thread task, which slowed the search (it is fed through the main thread). No long tasks during a jump; depth 12 after jumps back to `main`'s or better                                                                                  |
| 137cb89, 74782ed          | Tests (`npm test` found none before)                                                                                                                                                                                                                                                | 16 tests now; the Stockfish ones fail on `main`                                                                                                                                                                                                                                 |
| 226a7f6                   | The analysis page builds a Lichess game from its PGN in the browser instead of waiting for `analyze_user_game` (which is still sent, unread, in case the backend records it). FENs as python-chess writes them; variants and set-up positions still go to the backend               | Board on a return visit 1.33–1.76 → 0.59–0.68 s. Same FENs, moves, SAN, players and result as the backend for 45 Lichess games                                                                                                                                                  |
| 123da37                   | The tournament game list is fetched once per analysis page load, not twice                                                                                                                                                                                                          | One 41 KB request less                                                                                                                                                                                                                                                          |
| 3c2c65b                   | `"sideEffects": ["*.css", …]` in `package.json`, so webpack drops the modules a page doesn't use from barrels such as `src/components`                                                                                                                                              | First Load JS: /settings and /leaderboard 600 → 321 kB, /blog/[id] 600 → 343, analysis page 610 → 493, home 343 → 320 kB. Every route renders as before (screenshots within 0.02%)                                                                                              |
| 3b7c0ee                   | The Maia worker starts ONNX Runtime (with a one-node model) while it reads the 44 MB model from IndexedDB                                                                                                                                                                           | Maia ready 2.04 → 1.75 s after navigation, its moves 2.50 → 2.28 s                                                                                                                                                                                                              |
| 38ec490                   | react-joyride (the first-visit tours) loads only when a tour starts                                                                                                                                                                                                                 | `_app` 165 → 136 kB gzip on every page; the tour appears at the same time                                                                                                                                                                                                       |
| 3179c1f                   | Maia and Stockfish start 50 ms after the position changes, not 100                                                                                                                                                                                                                  | After a step: Maia 0.36 → 0.30 s, first Stockfish depth 0.27 → 0.21 s, depth 12 2.02 → 1.88 s; Maia after 10 quick presses 0.49 → 0.24 s                                                                                                                                        |
| 0bac57e                   | A small inline script in the page's HTML (new `_document.tsx`) starts the Lichess PGN request before the app's JavaScript has loaded                                                                                                                                                | PGN in at ~0.23 s instead of ~0.67 s; board 0.66–0.74 → 0.58–0.64 s                                                                                                                                                                                                             |
| ff5c180                   | The same script starts the account request, on every page                                                                                                                                                                                                                           | Account 0.26 → 0.13 s; analysis board 0.57 → 0.48 s. First visits to /turing, /play/maia and /play/hb no longer land on the "sign up for the beta" page (see below)                                                                                                             |
| b55d7ef, 3495708, 878e935 | Home page: the game carousel slides with a CSS animation instead of `scrollBy(0.5)` every 20 ms; the stats counters stop springing once their rounded number is final; an unused 3-second state update that re-rendered 36 boards is gone                                           | The page no longer draws ~50 frames a second, each costing ~10 ms of compositing for the 36 small boards' ~1100 piece layers: main thread idle once the counters finish (~5 s) instead of ~55% busy for as long as the page is open; 5.7 → 3.9 s busy in the first 8 s          |
| 5fcb2df                   | /play/maia and /play/hb start their game once the router has the URL's query                                                                                                                                                                                                        | One `start_game` per visit instead of two (the first, with default settings, was abandoned); board 1.82–1.92 → 1.14–1.19 s                                                                                                                                                      |
| 8aac80c                   | /puzzles requests the next puzzle as soon as the current one's result is logged                                                                                                                                                                                                     | Next puzzle 1.94–1.99 → 0.19–0.22 s after pressing Next Puzzle (`new_puzzle` itself takes 1.6 s on the backend)                                                                                                                                                                 |
| 46ba1fe, a6d0ae3          | The header's leaderboard badge and /leaderboard share one `auth/leaderboard` request; /analysis fetches the user's play games once                                                                                                                                                  | One request instead of two on /leaderboard, one instead of three on /analysis                                                                                                                                                                                                   |
| facc72e                   | `analysis-probe.mjs --proxy`, `stub-proxy.mjs` and `page-probe.mjs`: measurements with the browser's HTTP cache on (see "How it was measured")                                                                                                                                      | —                                                                                                                                                                                                                                                                               |
| 2bb82ee, 6df5d6a          | Home page: the board grid is no longer rebuilt 100 ms after it comes into view (every time it does), and its 36 boards are drawn with chessground's elements and styles but without a chessground instance each, so pieces are placed by `left`/`top` and get no compositing layers | Home page vs `main`: blocking time 462 → 272 ms, main-thread time in the first 8 s 5.6 → 2.2 s (layerize 2.7 → 0.14 s); with the grid in view 10.4 → 3.5 s over 15 s. The grid's screenshots match `main`'s at four window sizes                                                |

## Things you will notice

- **First visits to /turing, /play/maia and /play/hb** now show the page. On
  `main` a new visitor's page requests (`turing/new_game`, …) went out before
  the account request had created their guest session, got a 401, and sent
  them to "Sign up for the beta"; a second visit showed the page.
- **The home page's game carousel moves in Chrome.** It moved by
  `scrollBy(0.5)`, which Chrome rounds to nothing, so on maiachess.com it
  stands still in Chrome; it now slides at the intended 25 px/s everywhere.
- **/play/maia and /play/hb create one game per visit**; `main` also created
  an abandoned one with the default settings (Maia 1100, white).
- **Promotions** in a Lichess game keep their piece in the move (`a7a8q`), as
  Stockfish and Maia write moves; `analyze_user_game` dropped it.

## Looked at, not changed

- **More Stockfish threads.** 2–3 threads made depth 12 after a step ~13%
  faster but jumps no faster, delayed the first depth on load, and make the
  search non-deterministic.
- **A larger Stockfish hash** (64 or 128 MB instead of 16): no faster.
- **Reading Stockfish's nets earlier**, while its module starts (twice, in
  both rounds): the reads finished at the same time.
- **Decoding Stockfish's net faster.** The 0.74 s is Stockfish decoding the
  LEB128-compressed big net; an uncompressed copy would double the 75 MB read.
- **ONNX graph optimisation.** Creating Maia's session takes ~0.9 s, ~0.3 s
  of it optimising the graph; `'basic'` skips that but changes move logits by
  up to 0.047, so it is left for you to decide.
- **A warm-up inference** after Maia's session is created: ORT runs much of
  it synchronously, so Maia's moves came 0.2 s later.
- **Google Analytics with `lazyOnload`** (gtag.js is 326 KB, and runs while
  the analysis board renders): the board came ~40 ms sooner, but GA would
  miss very short visits.
- **Starting Web Audio when idle** (`AudioContext` costs ~50 ms at start-up
  on every page): main-thread time only moved, and blocking time on /drills
  rose as much as it fell on the home page.
- **Lazy-loading the analysis page's charts** (recharts, ~50 ms to render at
  load): their empty axes would appear a moment after the board.
- **The backend.** `puzzle/new_puzzle` takes ~1.6 s on every call (hidden
  for every puzzle after the first by 8aac80c), and Lichess's
  `/api/broadcast` ~1.2 s on /broadcast.

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
  staged run in `stockfish.ts` and `StockfishStreamOptions`; 3179c1f replaces
  the two `100` ms delays in `useEngineAnalysis.ts` with `ANALYSIS_DELAY_MS`;
  3b7c0ee adds a few lines at the top of `public/maia-worker.js`. `human-bar`
  doesn't touch those parts.
