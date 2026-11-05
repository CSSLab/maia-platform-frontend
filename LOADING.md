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
- Phone runs (an emulated mid-range Android phone) are described in "On a
  phone" below.
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

First Load JS (gzip, from `next build` of `main` and of this branch):
/settings and /leaderboard 702 → 292 kB, /blog/[id] 703 → 314, /play/maia
706 → 327, /turing 704 → 320, /puzzles 708 → 449, the analysis page
712 → 464, /drills 818 → 597, the home page 446 → 291 kB; shared by all pages
460 → 305 kB. (An earlier version of this line compared against the first
round of this branch rather than `main`.) Pages load more chunks after the
first load, hence the smaller differences in JavaScript transferred.

### On a phone

**How.** The same probes with `--mobile --slowdown 4 --net 4g`:

- **Screen:** 412×915 CSS pixels at 2.625 device pixels per pixel (a Pixel
  7-size Android phone), touch and a mobile user agent, so the analysis page
  uses its mobile layout; paging taps the ‹ › buttons and the move strip.
  8 cores reported.
- **CPU:** every thread of the page's renderer process runs at a quarter of
  its speed. That is the factor Lighthouse and PageSpeed Insights use for
  their mobile score (a mid-range Android phone; recent iPhones and flagship
  Androids are several times faster). Chrome's own CPU throttling only slows
  the main thread and leaves Stockfish's and Maia's workers at full speed, so
  `scripts/perf/cpu-slowdown.py` pauses the whole process for 15 ms of every
  20 instead (a JavaScript loop ran 4.1–4.4 times slower).
- **Network:** 4G as 9 Mbit/s down, 1.5 up and 150 ms per request (Chrome's
  network emulation); some first visits also on Lighthouse's Slow 4G
  (1.6 Mbit/s, 562 ms).
- ada was busy with other jobs (load 50–110 of 160) while these ran, so
  absolute times are noisy; the two builds alternated run by run. The
  analysis page's warm and paging runs used the branch before 4fe06c3 (which
  changes when ONNX Runtime starts; no difference on desktop) and 022c3c5
  (the home page); first visits to pages with Maia, and the home page, were
  measured again after them.

**Analysis page** (seconds; medians; `main` → branch):

|                                                   | G3MXUHW9                        | YQC4zrpR                         |
| ------------------------------------------------- | ------------------------------- | -------------------------------- |
| Board on screen, warm (3 runs)                    | 6.92 → 4.04                     | 5.70 → 3.72                      |
| Maia's moves, warm                                | 27.7 → 13.3                     | 17.4 → 10.3                      |
| Main-thread long tasks before Maia's moves, warm  | 10.5 → 5.8                      | 6.0 → 4.2                        |
| Board on screen, first visit (2 runs)             | 9.12 → 6.11                     | 8.41 → 6.48                      |
| Maia's moves after a step (16 steps, 2.5 s apart) | never shown → 2.38 (on 9 of 16) | never shown → 1.60 (on 13 of 16) |
| Maia's moves after 10 quick taps                  | never shown → 1.97              | never shown → 1.57               |
| Maia's moves after a jump (6)                     | never shown → 1.78              | 5.56 (on 3 of 6) → 1.10          |
| Stockfish's first depth after a step              | 1.81 (on 8 of 16) → 1.03        | 1.08 (on 8 of 16) → 0.95         |
| Stockfish's depth when the next step comes        | 1 → 4                           | 2 → 5                            |
| JavaScript on a first visit (in the first ~25 s)  | 721 → 486 KB                    | 721 → 486 KB                     |

On `main` a phone falls behind while paging: Maia's requests (all ratings at
once, 10–12 s each) pile up, and in the G3MXUHW9 runs only 9–11 of 22 were
answered by the end of the run. Stockfish's first depth on the first position came at 77–83 s on both
builds; see "Stockfish's nets on a phone" below.

**Other pages** (seconds, KB; medians; `main` → branch; "warm" is a returning
visitor on 4G, blocking time is counted over 15 s):

| visit          | page                       | loads | first paint | largest paint | blocking time | main-thread  | JS (KB)   |
| -------------- | -------------------------- | ----- | ----------- | ------------- | ------------- | ------------ | --------- |
| warm           | /                          | 6+6   | 0.49 → 0.72 | 0.82 → 0.72   | 6.15 → 4.32   | 8.92 → 8.48  |           |
| warm           | /play/maia                 | 3+3   | 0.56 → 0.56 | 0.56 → 0.58   | 1.65 → 1.25   | 3.54 → 3.04  |           |
| warm           | /puzzles                   | 3+3   | 0.60 → 0.62 | 0.60 → 0.68   | 2.64 → 2.23   | 5.63 → 5.32  |           |
| warm           | /leaderboard               | 3+3   | 0.54 → 0.58 | 2.51 → 2.40   | 1.33 → 0.84   | 2.46 → 2.16  |           |
| warm           | /drills                    | 3+3   | 0.52 → 0.60 | 0.62 → 0.60   | 2.72 → 2.35   | 5.65 → 5.57  |           |
| first, 4G      | /                          | 3+3   | 0.81 → 0.79 | 0.81 → 0.79   | 7.60 → 5.27   | 15.19 → 8.82 | 922 → 730 |
| first, 4G      | /analysis/G3MXUHW9/lichess | 3+3   | 0.82 → 0.68 | 0.82 → 0.78   | 5.18 → 4.31   | 7.01 → 6.45  | 838 → 604 |
| first, 4G      | /puzzles                   | 3+3   | 0.72 → 0.74 | 0.72 → 0.74   | 4.74 → 3.86   | 7.04 → 6.43  | 834 → 589 |
| first, 4G      | /drills                    | 3+3   | 0.62 → 0.68 | 0.62 → 0.68   | 4.14 → 3.62   | 6.35 → 5.75  | 943 → 735 |
| first, 4G      | /leaderboard               | 3+3   | 0.58 → 0.64 | 3.87 → 2.61   | 2.51 → 1.27   | 3.82 → 2.32  | 802 → 411 |
| first, 4G      | /blog/maia-v1              | 3+3   | 1.05 → 0.87 | 1.05 → 0.87   | 2.66 → 1.74   | 5.34 → 4.74  | 802 → 428 |
| first, 4G      | /play/maia                 | 3+3   | 0.62 → 0.64 | 3.64 → 0.64   | 2.02 → 1.38   | 3.48 → 2.99  | 805 → 439 |
| first, Slow 4G | /                          | 2+2   | 2.08 → 1.61 | 2.08 → 1.61   | 5.26 → 3.71   | 14.61 → 6.74 | 924 → 732 |
| first, Slow 4G | /analysis/G3MXUHW9/lichess | 2+2   | 1.90 → 1.64 | 15.36 → 17.68 | 5.08 → 3.81   | 8.44 → 7.64  | 838 → 604 |
| first, Slow 4G | /leaderboard               | 2+2   | 1.90 → 1.55 | 8.91 → 5.68   | 2.03 → 1.18   | 3.40 → 2.41  | 802 → 411 |

- **/puzzles:** the next puzzle shows 5.26 (4.84–5.48) → 2.07 (2.04–2.14) s
  after tapping Next Puzzle.
- **Home page, returning visit:** first paint is later on the branch in three
  of four sets of loads (by 0.1–0.25 s), and the largest paint (the hero
  text) about the same or earlier. Probably, with smaller scripts from the
  cache, the page hydrates before the browser's first paint, so nothing
  paints ahead of the hero text. Single loads range 0.34–0.97 s on both
  builds.
- **Analysis page, first visit on Slow 4G:** the board is drawn sooner, but
  the largest paint is the board re-laid out when the 1.1 MB Material
  Symbols icon font arrives, and that arrives later (17.0–18.1 s against
  14.2 s): the branch starts the Stockfish nets' 78 MB download ~3 s sooner,
  and it shares the slow link with the font. On 4G the font arrives at the
  same time on both (2.5–2.8 s). 65fc6a8 (below) makes the font 29 KB.

#### The icon font and the home page's lower sections

65fc6a8 asks Google Fonts for only the 82 Material Symbols the site shows
(29 KB instead of 1.1 MB; the site hides icons until the font has loaded),
and 21d7dc1 draws the home page's lower boards and charts when they come
near the screen. First visits on the phone, medians of 3, `main` / branch
before 65fc6a8 / with it (seconds):

| network | page                       | icons visible        | largest paint        | load event           |
| ------- | -------------------------- | -------------------- | -------------------- | -------------------- |
| Slow 4G | /                          | 14.26 / 13.58 / 4.92 | 2.15 / 1.81 / 1.79   | 13.94 / 13.28 / 4.26 |
| Slow 4G | /analysis/G3MXUHW9/lichess | 14.56 / 17.68 / 5.78 | 14.76 / 18.01 / 1.56 | 14.40 / 17.36 / 5.44 |
| Slow 4G | /leaderboard               | 12.88 / 11.02 / 4.60 | 9.26 / 5.98 / 5.41   | 12.68 / 10.86 / 4.28 |
| 4G      | /                          | 2.90 / 2.64 / 2.50   | 0.87 / 0.89 / 0.81   | 8.98 / 7.12 / 1.74   |
| 4G      | /analysis/G3MXUHW9/lichess | 2.84 / 2.50 / 2.10   | 0.64 / 0.62 / 0.62   | 3.30 / 2.92 / 1.74   |
| 4G      | /leaderboard               | 2.88 / 2.66 / 1.82   | 3.33 / 2.74 / 2.75   | 2.68 / 2.46 / 1.54   |

Icons now show as soon as the page's scripts have run. The home page on the
phone, `main` / with 65fc6a8 / with 21d7dc1 too (medians; 6 returning
visits, 3 first visits on 4G):

|                      | returning visit    | first visit         |
| -------------------- | ------------------ | ------------------- |
| blocking time (15 s) | 4.21 / 2.89 / 1.93 | 5.18 / 3.53 / 2.96  |
| main-thread time     | 8.71 / 6.00 / 4.78 | 13.65 / 7.02 / 5.99 |
| largest paint        | 0.65 / 0.63 / 0.63 | 0.81 / 0.75 / 0.75  |

#### Paging on the phone after 3bf9e38 and 86db02d

While paging, the page renders on every engine update. At full speed on a
phone-size page, 13 s of paging (8 steps) spent 336 ms preparing Maia's
inputs (the same position once per rating) and 144 ms in layouts forced by
framer-motion for the tab bars' underlines; 3bf9e38 and 86db02d remove
both, and d0c4931 another 41 ms of head updates. On the emulated phone,
branch before → after (2 runs per game; ada was quieter, load 15–20, than
for the first phone runs, so both columns are faster than the table above):

|                                                             | G3MXUHW9                | YQC4zrpR                               |
| ----------------------------------------------------------- | ----------------------- | -------------------------------------- |
| Maia's moves after a step (median, max)                     | 1.46, 3.06 → 1.41, 2.54 | 1.58, 2.56 (1 of 16 none) → 1.15, 2.34 |
| Stockfish's first depth after a step (median, max)          | 0.79, 1.58 → 0.64, 1.38 | 0.86, 1.98 → 0.69, 1.20                |
| Stockfish's depth when the next step comes (median, lowest) | 6, 3 → 7, 5             | 5, 3 → 7, 5                            |

Jumps and quick taps were within noise; desktop paging was unchanged (depth
12 after each step at 0.55–1.73 s on both).

#### Stockfish's nets on a phone

Stockfish reads its two nets (75 and 3.5 MB) from IndexedDB, and if that
takes over 1.5 s (`STOCKFISH_CACHE_LOOKUP_TIMEOUT_MS`, from 353d1d3, against
a Firefox hang) it downloads them again. Alone the read takes ~0.1 s on ada
and 0.4–0.8 s at a quarter speed, but during page load the main thread is
busy: on the emulated phone it took 3.8–7.8 s on `main` and 1.4–3.9 s on the
branch, so every warm and paging run (20 of 20, both builds) downloaded the
78 MB again, and Stockfish's first depth came at 77–83 s on 4G. A version
that starts the download after 1.5 s but keeps the cached copy if it arrives
first (and then cancels the download) used the cached nets in all 6 runs:
first depth at 12.3–18.6 s, depth 12 at 24.6–33.3 s, depth 18 at
40.2–56.8 s. That is bef0994.

#### Moving through a game on the phone: the chart and Stockfish

`scripts/perf/chart-probe.mjs` steps through 8 moves of each game (after 12
quick taps past the opening), 14 s per move on the phone and 5 s on a
desktop. It times Maia's results, the visible moves-by-rating chart's first
change and its first change after Maia's last result, and Stockfish's depth
label on the new position. The builds took turns, 3 runs per game. ada's
load was 6–53, so on the phone one position's depth 12 varied by a few
seconds between runs; builds are compared per position (16 positions, median
over runs).

A CPU profile of 8 moves on a phone-size page at full speed showed recharts
taking 2.0 s of the main thread and React 1.6 s. The moves-by-rating chart
drew 16–26 times per move: every update drew it twice (it copied its props
into state in an effect), and Stockfish's changing evaluations recolor
moves, which redrew the chart even for moves it does not show and before the
new position's data was in. 3c3bee3 brings that to 3–10 draws per move.
Stockfish's search slows while the main thread is busy, so that alone made
it faster on the phone. Then facd303 has the phone ask Maia for every 200
points in one request and stop there.

| Phone (seconds after a step; medians)            | 6297646 | 3c3bee3                  | facd303                  |
| ------------------------------------------------ | ------- | ------------------------ | ------------------------ |
| Chart first drawn                                | 4.31    | 4.01 (3.66 in round 2)   | 3.44                     |
| Chart complete                                   | 6.44    | 6.51 (5.87)              | 3.44                     |
| Stockfish's depth 12                             | 9.39    | 7.86 (6.61)              | 6.33                     |
| Depth 12 per position, against the column before | —       | 2.27 s sooner (on 16/16) | 0.35 s sooner (on 11/16) |

The first two columns are round 1 (6297646 is this branch before both);
the numbers in brackets and facd303 are round 2 (ada was quieter). Asking
for every 400 points first on the phone, as on the desktop, drew the chart
at 2.55 s and completed it at 3.61 s. But it delayed depth 12 by 0.69 s
against 3c3bee3 (14 of 16 positions; 0.49 s over all 6 runs): with the
chart drawn sooner, it redraws for Stockfish's changing top moves through
more of the search.

On the desktop (2 runs per game), the chart starts at 0.76, 0.72 and 0.48 s
in the three builds, and is complete at 1.23, 1.23 and 1.25 s. Stockfish's
depth 12 is at 1.19, 1.11 and 1.14 s, and depth 18 at 4.08, 4.05 and 3.98 s.

Before e6b6e79, the probes' phone had no touch: the CDP session opened for
network throttling turned Playwright's touch emulation off. The analysis
page's layout depends on the width only, so the earlier phone results are
unaffected; facd303's phone check needs touch.

### Round 2: after #319, #320 and #321 were merged

Measured against `main` at 325b85c, in local production builds behind
`scripts/perf/stub-proxy.mjs`.

**Returning visitors and files in `public/`.** Files there are not
content-hashed, so they are served with `max-age=0` (Vercel adds
`must-revalidate`). On every visit the browser asked the server before it
used its cached copy, and Maia's start loads several of them one after
another: the worker, ONNX Runtime's script, its module (once more per
thread) and its WebAssembly; Stockfish loads its WebAssembly. c17afbd serves
`/ort`, `/stockfish`, `/assets`, `maia-worker.js` and `analytics.js` with
`stale-while-revalidate` (7 days): the cached copy is used at once and
refreshed in the background, so a changed file is used from the following
visit. Through a proxy adding 150 ms per request (Chrome's network
throttling does not apply to workers), each of those files waited 155–490
ms for the server before and 0–2 ms after. With the CPU at a quarter speed,
the end-to-end difference (Maia's model ready at 6.9–7.5 s against 7.2–8.0
s) was within the run-to-run spread.

**/drills.** It loaded the most JavaScript of any page (First Load JS 602
kB) because `src/constants/endgames.json` (~480 KB, ~11,000 FENs) was
bundled in and normalised on every load, though only the selection window's
Endgames tab uses it. 8a1c793 loads it as a chunk of its own when that tab
is opened, pointed at, touched or focused (501 kB). On the emulated phone,
5 runs each:

| /drills, emulated phone                  | `main` | branch |
| ---------------------------------------- | ------ | ------ |
| First visit: JavaScript (KB)             | 728    | 641    |
| First visit: total blocking time (s)     | 3.22   | 2.75   |
| First visit: load (s)                    | 2.52   | 2.28   |
| Returning visit: total blocking time (s) | 2.03   | 1.57   |

Adding and starting an endgame drill gives the same position as on `main`.

**Desktop analysis page while paging.** Profiles of 8 moves, 3 s apart,
with source maps on both builds:

- The game list stays mounted next to the board and re-renders with the
  page on every engine update; each render of its selected tab's underline
  (a framer-motion `layoutId`) made framer-motion measure the page.
  0232ac5 memoises the tab: `measureScroll` 249–275 ms on `main`, none
  after.
- The Maia/Stockfish panel checked for checkmate (all legal moves) on every
  render; 58b7747 does it once per position (34–42 ms under the panel on
  `main`, none after).
- The sidebar rendered both its xl and its smaller layout, one hidden with
  CSS; 1c3af9a renders only the shown one once the width is known.

Together, against `main` measured alongside (3 runs each): main-thread busy
16% less, React 16% less, framer-motion about half.

**Every page: the tour's watcher.** The tour provider kept a
MutationObserver on the whole page that searched it for Maia's download
window on every DOM change (on the analysis page, every engine update),
though the result only matters while a tour runs. e6d0417 observes only then:
on the home page (returning visit, first 8 s at full speed) `querySelector`
took 36–39 ms on `main` and 0–8 ms after, main-thread busy 416–448 ms and
340–362 ms.

**Stockfish's cached nets on a phone, again.** Finding a cached net and
reading it (75 MB) shared bef0994's 1.5 s timeout, which guards against
IndexedDB never answering. On the emulated phone the read alone took 3–7 s
while the page loaded, so every returning visit also started downloading
both nets again (78 MB of data until the cached copy won) and the download
took CPU from the read. 7126951 keeps the 1.5 s timeout for finding the net
and gives a found net 20 s to be read. Returning visit, 4G and a
quarter-speed CPU, 6 runs each:

| Emulated phone, returning visit        | 81b5f57 | 7126951 |
| -------------------------------------- | ------- | ------- |
| Runs that started downloading the nets | 6 of 6  | 2 of 6  |
| Reading the big net (s)                | 3.2–6.8 | 1.2–4.8 |
| Stockfish's first depth (s, median)    | 13.7    | 11.9    |
| Stockfish's depth 12 (s, median)       | 25.5    | 23.9    |

In the 2 runs, finding the net itself took over 1.5 s.

**Finding the cached nets, counted in timer ticks.** In the runs where the
lookup still timed out, the page was busy with long tasks for nearly all of
the 1.5 s, and the answer came 0.04–0.5 s after the timeout: it had been
waiting behind that work. 31452ae counts the timeout in 100 ms timer ticks instead
of clock time. A tick held up by a long task counts as one, so a busy page
start no longer uses up the limit, and a cache that never answers is still
given up after 15 ticks (about 1.5 s on an idle page; longer in a
background tab, where timers fire once a second). Returning visit, 12 runs
each:

| Emulated phone, returning visit     | e33c4b3 | 31452ae |
| ----------------------------------- | ------- | ------- |
| Runs where the lookup timed out     | 5 of 12 | 0 of 12 |
| Stockfish's first depth (s, median) | 13.1    | 12.5    |
| Stockfish's depth 12 (s, median)    | 25.8    | 25.0    |
| Stockfish's depth 18 (s, median)    | 41.3    | 41.1    |

In the 5 runs the small net was fetched again in full and the big net's
download ran 3–5 s before the cached copy won. On a desktop (6 runs each)
the lookup never timed out either way; depth 12 came at 3.8 s in both and
depth 18 at 6.7 and 6.3 s.

Stockfish with the whole branch (`scripts/perf/chart-probe.mjs`, 2 runs per
game, 8 steps each): on a desktop depth 12 came 0.35 s sooner after a step
(± 0.09 s; sooner on 23 of 32 steps), and the depth reached before the next
step went from 15.03 to 15.28 on average. On the emulated phone it was
unchanged (0.14 ± 0.36 s sooner), reaching depth 12 on all 32 steps against
30 of 32 on `main`.

### Round 3: after #322 was merged

Measured against `main` at e56f6d0, in local production builds behind
`scripts/perf/stub-proxy.mjs`. This round also looked for things that make
the site look broken or unfinished: every route was opened as a new visitor
at phone (412 px) and desktop (1440 px) size, recording console errors,
failed requests, the server-rendered `<title>` and description, controls
without an accessible name, layout shift and a screenshot, and the source
was read for wording, links and error handling.

**Titles and descriptions in the server HTML.** Most pages rendered their
`<Head>` inside `AuthenticatedWrapper`, which renders nothing until the
account has loaded in the browser, or inside a loading state. The HTML of
/analysis (and every game), /drills, /puzzles, /turing, /leaderboard,
/broadcast, /settings and /profile had no `<title>` or description, so link
previews and crawlers saw an untitled page and the tab showed the URL while
the page loaded; production serves the same today. 38d4304 renders each
page's head outside those (a game or broadcast keeps a generic title until
it loads). A blog post's title read "Introducing Maia Platform v1<!-- --> –
Maia Chess" in the HTML (two JSX children); 9cd8ee1 makes it one string.

**Layout shift on desktop.** While a page loaded its data the footer showed
mid-screen and then jumped down; 95da846 had fixed this for phones only.
c635868 keeps the page area a screen tall at every size. Desktop first
visits, CLS:

| Page (desktop)   | `main` | branch |
| ---------------- | ------ | ------ |
| /broadcast       | 0.127  | 0.001  |
| /puzzles         | 0.049  | 0.001  |
| /leaderboard     | 0.027  | 0      |
| /turing          | 0.025  | 0      |
| /analysis/<game> | 0.025  | 0.001  |

/, /drills, /play, /blog and /candidates were unchanged (0–0.006).

**The AudioContext on every page.** The sound provider created an
AudioContext as every page loaded. A page's first one took 57–60 ms of the
main thread to create (home page, desktop size, 4 runs; 53–78 ms in the CPU
profile), four times that on a slow phone, and Chrome warned that it was not
allowed to start. 0aed6a5 still fetches the two sounds on load, but creates
the context just after the first pointer or key gesture has been answered on
screen, or for the first sound if one comes before, and 8157834 keeps it
suspended until a sound plays (created after a gesture it would start
running, keeping an audio thread busy with silence on pages that never play
one, like analysis; created on load it had stayed suspended). In /settings
the "Move Sound" test button plays as the first gesture on a page, and
"Capture Sound" after a click elsewhere; on the analysis page the context
stays suspended after a tap.

**Broken things fixed** (each checked in a local build):

- Signed-in users who opened or reloaded /settings or /profile were sent
  home: the pages checked for a Lichess account before the account had
  loaded (903191a).
- Links to older broadcasts (e.g. the 2026 Candidates, which /candidates
  linked to) showed "Loading..." forever, and a broadcast link opened the
  broadcast's default round, not the one in the URL: Round 10's link opened
  Round 1 (6cf2da3, 591f5ea).
- The leaderboard spun forever when its request failed (the backend
  answers 500 now and then); it now offers Retry (fc04dbe).
- Unknown URLs showed Next.js's unstyled 404 (4274479); unknown blog posts
  answered 200 with an empty page (8a9093f, 9cd8ee1).
- The home headline was cut off on every phone ("Human-like chess A" at 412
  px) and ran 22–137 px into the feature grid on tablets (281c0e6, abdf95b).
- Blog dates showed a day early west of UTC (8a9093f).
- /play/maia's and /play/hb's titles were replaced by the board's own
  ("Maia Chess - Play", description "Turing survey") once a game showed.
- When Lichess answered with an error object (an unknown user, a rate
  limit), the profile and analysis game lists threw on `data.pgn` (9cd8ee1).
- The analysis game list's World Championship tab showed "Play more
  games... ^. .^" under its games (46e45c0).

**Polish.** 31 controls had no accessible name (the board's flip and move
buttons on every board, the header's Discord icon); there are none now, and
the Maia model and broadcast round selects have labels (8dd059b, 27f05ce).
The desktop header's PLAY and MORE menus and the signed-in user's menu
opened on hover only, so keyboard users could not reach Play Maia, Hand and
Brain, Leaderboard, Blog, Profile, Settings or Log out; they now open on
focus and click and close when the focus leaves or on Escape (c7a4fd5). A
failed custom game import showed the HTTP status and the backend's raw
reply in a toast; it now says to check the PGN or FEN (d238090).
Wording fixes (46e45c0): "white was the bot" → "White", "44mb" → "44 MB",
"-%" → "–", "Logout" → "Log out", the footer's year and https link, the
mobile menu's close icon. It also changed "favourite" to "favorite", which
0fd3ef5 undid: the site uses Canadian spelling. `console.log` calls on every move (the move list
also walked the main line twice just to log it), drill move and broadcast
poll were removed (92ced56).

**After review:**

- The /401 page, where pages send visitors whenever a request to the Maia
  server fails, invited them to sign up for a beta that has ended. It now
  says the request failed and offers Try again (back to the page that
  failed), Go home, signing in with Lichess (when signed out) and Discord;
  signed-in visitors are no longer sent home from it (43dba6e).
- /candidates linked to the finished Candidates broadcasts and showed "Round
  10" as if the event were on. It now links to the top-tier (tier 5) Lichess
  broadcasts that are live, checked every 5 minutes on the server, or to
  the broadcast list when none is on (4819438).
- Model names are written with a hyphen everywhere: the home page, the
  drills dialog and the v1 blog post wrote "Maia 2" and "Maia 3" (441a1de).
  Rating models are named the same way (be4b6ea): the analysis model menus,
  play setup, clocks and drills said "Maia 1100" and now say "Maia-3
  1100". The footer's Lichess bots and the 2020 blog post are the original
  models, so they say "Maia-1 1100".
- Stored games name the model that played them (31abb1d). The play pages
  used Maia-1 until 2025-07-12 (#49) and Maia-2 until 2026-02-09 (555a92d);
  the backend records every game as `maia1`, so the game lists and the
  analysis page tell the model by the game's `created_time` (UTC). On one
  public profile's 320 games: 68 Maia-1, 127 Maia-2, 124 Maia-3, and the
  first games after 2026-02-09 09:42 UTC are at 600 and 2600, which only
  Maia-3 offers.
- Saved game names (bb90e63): favouriting a game saves its label as its
  name when none is typed, so many read "You vs. Maia 1100". The game lists
  show "Maia <rating>" in a played game's saved name as the model that
  played it; imported custom games keep their names.

Over all routes at both sizes, as a new visitor: controls without an
accessible name 31 → 0, form fields without a label 12 → 0, console messages
157 → 117 (the AudioContext warning was on every page; the rest come from
the local setup: no PostHog key, no Vercel Insights, Google Analytics
blocked), and no desktop page above 0.02 CLS.

Stockfish with the whole branch (`scripts/perf/chart-probe.mjs`, 8 steps
per run): on a desktop (2 runs per game, before 8157834) depth 12 came 0.07
s sooner after a step (± 0.07 s; sooner on 20 of 32 steps), and the depth
reached before the next step went from 16.31 to 16.53. On the emulated phone
(3 runs per game) depth 12 came 0.45 s sooner (± 0.31 s; sooner on 25 of 39
steps), it was reached on 43 of 48 steps against 41, and the depth before
the next step went from 13.75 to 13.98. Without 8157834 (the AudioContext
running after the first tap; 2 runs per game) the phone gave 0.36 ± 0.42 s
later, within noise.

### Round 4: after #324 was merged

Measured against `main` at ef23af3, in local production builds behind
`scripts/perf/stub-proxy.mjs`. Phone numbers are the emulated phone of
"On a phone" (412 px, 4G, every thread at a quarter speed), medians of 5
loads unless noted; "main-thread work" is Chrome's task time over the
load and the next 6 s. Lighthouse (phone settings) scored maiachess.com
41–70 before this round: /puzzles and /broadcast showed their main content
after ~24 s, and every page blocked the main thread for 0.9–3.5 s.

**Engines only where they're needed (8383bc0).** The /broadcast list
started Stockfish and Maia because `_app.tsx` matched any path containing
`/broadcast`, so a first visit downloaded Stockfish's 76 MB of nets to show
a list; it now starts no engine, and a round starts them when it opens. On
/drills and /puzzles, which need Stockfish only after a while, it now
starts once the page has loaded and the browser is idle
(`StockfishEngineContextProvider`'s `deferStart`). Phone, 15 s per load, 3
loads each:

| page, visit           | main-thread work | blocking time | main content | Stockfish starts |
| --------------------- | ---------------- | ------------- | ------------ | ---------------- |
| /broadcast, first     | 9.2 → 4.3 s      | 3.1 → 2.3 s   | 5.6 → 4.4 s  | 2.7 s → never    |
| /broadcast, returning | 5.1 → 3.7 s      | 1.3 → 1.8 s   | 3.9 → 3.7 s  | 1.1 s → never    |
| /drills, first        | 9.0 → 7.6 s      | 2.9 → 3.4 s   | —            | 3.4 → 5.6 s      |
| /drills, returning    | 5.0 → 3.9 s      | 2.0 → 1.1 s   | —            | 0.9 → 2.5 s      |
| /puzzles, first       | 9.5 → 9.5 s      | 3.7 → 3.6 s   | —            | 3.0 → 6.3 s      |
| /puzzles, returning   | 6.0 → 5.7 s      | 1.8 → 1.6 s   | —            | 1.0 → 1.8 s      |

Lighthouse on maiachess.com with Stockfish's nets blocked: /broadcast's main
content at 8.6 s instead of 24 s, and blocking time 1.0 s instead of
1.8–2.3 s. On a desktop, puzzles still show Stockfish's evaluation as soon
as a puzzle is given up, and a drill started right away has Stockfish ready
long before its first move.

**Engine code only on engine pages (017694c).** `_app.tsx` imported the
Stockfish, Maia and analysis-list providers, so every page downloaded and
ran both engines' code and Maia's move tables (111 KB, parsed on every
load). Engine pages now list the providers they need
(`src/contexts/pageProviders.ts`) and `_app` adds them. First Load JS
(gzip): shared by all pages 308 → 235 kB (`_app` 141 → 67 kB); home 295 →
235, /leaderboard 296 → 223, /blog 284 → 210, /turing 324 → 262, /play/maia
330 → 269 kB; engine pages unchanged. Phone: home, first visit,
main-thread work 11.0 → 7.9 s and JavaScript 636 → 474 KB; /turing,
returning, 2.8 → 2.2 s; /play, returning, 1.9 → 1.5 s; /blog within noise.
Going from the home page to analysis inside the app, Stockfish's first
number shows at the same time (0.76–1.0 s on both, desktop).

**Headings at once (1ab0ce1, 8fb8652).** The leaderboard and the broadcast
list rendered nothing, on the server too, until their data arrived (the
broadcast list also waited in `AuthenticatedWrapper` for the visitor's
session, though it asks only Lichess), then faded in from transparent. The
leaderboard now renders its heading, columns and note at once, with
placeholder rows until the rankings arrive (layout shift 0.0001); the
broadcast list renders its heading and a short note while Lichess answers.
Phone, main content: /leaderboard 3.2 → 0.9 s (first visit) and 1.8 → 0.8
s (returning), /broadcast 4.8 → 0.7 s (first visit). A first version
pulsed its 100 placeholder bars, which cost ~0.5 s of main-thread work on
the phone; they are static, and the leaderboard's main-thread work is now
the same as `main` (3.52 vs 3.53 s).

**The home page's counters (181412c, d6ef8b9).** The three stats counters
sprang from 0 to tens of millions, which took ~3 s to settle, re-laying out
the hero on every frame (their `duration` was ignored by the spring); 181412c
made them count up in 1.5 s. Desktop, home, main-thread work over the load
and 6 s: 2.65 → 2.04 s (every run lower). On the emulated phone no change:
there the main thread is saturated for ~10 s anyway and draws fewer frames.
d6ef8b9 shortens the count-up to 0.5 s.

**Not done: the app pages.** /puzzles, /drills, Bot or Not and analysis
also send only the header and footer: they wait for the visitor's session
(`AuthenticatedWrapper`) and for their data, and choose between the phone
and desktop layout in JavaScript after loading (`isMobile`, from the window
width), so a server-rendered shell would show the desktop layout on a phone
and then jump. Rendering their shell first needs that switch moved to CSS.

**Stockfish** with the whole branch (`scripts/perf/chart-probe.mjs`, 8
steps per run, the analysis page): on a desktop (2 runs per game) depth 12
came 0.04 s sooner after a step (± 0.05 s; sooner on 16 of 32 steps), and
the depth reached before the next step went from 16.66 to 16.88. On the
emulated phone (3 runs per game) depth 12 came 0.06 s sooner (± 0.22 s;
sooner on 27 of 47 steps), it was reached on 47 of 48 steps against 48, and
the depth before the next step went from 14.62 to 14.54.

**Lighthouse** (phone settings, local builds, medians of 3 runs; scores
vary by up to ~20 points between runs on client-rendered pages):

| page         | score   | main content  | blocking time |
| ------------ | ------- | ------------- | ------------- |
| home         | 58 → 67 | 3.9 → 2.8 s   | 2.33 → 2.32 s |
| /broadcast   | 43 → 71 | 23.9 → 3.1 s  | 2.13 → 1.02 s |
| /leaderboard | 52 → 73 | 6.0 → 2.8 s   | 1.13 → 0.99 s |
| /turing      | 51 → 64 | 5.9 → 3.5 s   | 1.10 → 0.94 s |
| /play        | 72 → 76 | 2.8 → 2.7 s   | 0.77 → 0.68 s |
| /blog        | 73 → 72 | 2.7 → 3.2 s   | 0.92 → 0.77 s |
| /drills      | 45 → 46 | 7.6 → 6.8 s   | 2.04 → 2.27 s |
| /puzzles     | 41 → 40 | 24.1 → 24.0 s | 2.47 → 2.87 s |

/puzzles keeps Lighthouse's 24 s: the puzzle shows after Stockfish's
download has started, so Lighthouse's simulated slow connection counts the
76 MB against it. On the emulated phone the puzzle shows at the same time
as on `main`.

### Round 5: shells for analysis, Bot or Not and the puzzles page

Measured against the round-4 branch at 4fe9b5b (before the rebase on #330 and
#332), as in round 4: local production builds behind
`scripts/perf/stub-proxy.mjs`, the emulated phone of "On a phone", medians of 5
loads. ada was busy with other users' work during the last runs (load 90–117 of
160), so times vary more than in earlier rounds; the comparisons alternate the
two builds load by load.

The analysis pages (`/analysis/<id>/...` and `/analysis`, which opens a
game), Bot or Not and /puzzles sent only the header and footer. They drew
nothing until the page's JavaScript had run; analysis and /puzzles also
waited for the visitor's session (`AuthenticatedWrapper`), and all waited for
their game or puzzle. Then `Loading` showed nothing for 1 s, an animated
loading board, and faded the page in. They choose their phone or desktop
layout in JavaScript from the window's width, which the server doesn't know.

Each now renders a shell, on the server too: the panels and titles, an empty
board and, where the page has them, the win-rate and eval bars, the arrow
legend, the compact blunder meter, the board controls and Bot or Not's guess
form, in their empty starting states and where the loaded page draws them.
The shell chooses the phone or desktop layout with a CSS media query at the
width the page uses (desktop from 1025 px; analysis from 1121 px), and the
board sizes the pages compute in JavaScript are the same formulas in CSS.
The game or puzzle then fills it in, without fading in. The empty board
(`EmptyBoard`) is chessground's own elements and coordinates, drawn with its
styles alone, and `_document` gives the body the visitor's saved board theme
before the first paint (`SettingsContext` did it once the app had loaded).

The board, its bars and labels, the tabs, the sidebar header and the blunder
meter are at the same place and size in the server's HTML, while the game is
held back, and once loaded: analysis at a Pixel 7 and seven desktop sizes
from 1200 × 800 to 2560 × 1440, Bot or Not and /puzzles at a Pixel 7 and 1440
× 900. Layout shift over the load is 0–0.003, from content filling in and the
"Loaded Stockfish" notice. At tablet widths (800 × 1100) the server's HTML
still differs: see "Not done".

**A first version slowed analysis on the phone.** React built the shell
while the session loaded, built a second one inside the page while the game
loaded, and both carried framer-motion bars, tabs and board controls in both
layouts: on first visits the game came ~0.5 s later and the main thread did
~0.7 s more. Now (`PageShell`) a shell rendered while the app hydrates keeps
the server's HTML as it is (an empty `dangerouslySetInnerHTML`, whose
children React neither renders nor hydrates); one rendered later, as after a
link within the app, renders only the layout for the window. The analysis
and puzzles pages keep one shell, beside `AuthenticatedWrapper`, until the
game or puzzle is on screen; the page reports it in a layout effect, so the
two are never painted together, and is memoized so that removing the shell
doesn't render it again.

Phone (base → branch):

| page, visit                     | page on screen | game fully visible | first paint   | main-thread work | blocking time |
| ------------------------------- | -------------- | ------------------ | ------------- | ---------------- | ------------- |
| analysis game, first            | 6.2 → 0.94 s   | 7.3 → 6.0 s        | 0.80 → 0.94 s | 7.9 → 8.3 s      | 4.7 → 5.4 s   |
| analysis game, returning        | 2.2 → 0.72 s   | 3.7 → 3.1 s        | 0.60 → 0.72 s | 5.7 → 5.8 s      | 1.9 → 2.0 s   |
| /analysis (opens a game), first | 7.6 → 0.68 s   | 8.4 → 9.0 s        | 0.60 → 0.68 s | 7.1 → 7.7 s      | 3.6 → 3.9 s   |
| /analysis, returning            | 8.7 → 0.82 s   | 10.0 → 8.7 s       | 0.68 → 0.82 s | 9.9 → 10.0 s     | 5.6 → 4.8 s   |
| Bot or Not, first               | 3.6 → 0.71 s   | 4.0 → 4.0 s        | 0.62 → 0.71 s | 3.2 → 3.4 s      | 1.7 → 2.1 s   |
| Bot or Not, returning           | 2.5 → 0.60 s   | 3.0 → 2.7 s        | 0.54 → 0.60 s | 2.3 → 2.4 s      | 1.1 → 1.1 s   |
| /puzzles, first                 | 4.9 → 0.77 s   | 6.1 → 6.3 s        | 0.66 → 0.77 s | 6.2 → 6.9 s      | 3.2 → 4.2 s   |
| /puzzles, returning             | 3.6 → 0.54 s   | 5.1 → 4.5 s        | 0.71 → 0.54 s | 6.0 → 6.0 s      | 2.6 → 2.8 s   |

Desktop, the game fully visible: analysis game 1.02 → 0.65 s, /analysis
2.04 → 1.59 s, Bot or Not 1.79 → 1.45 s, /puzzles 2.45 → 2.14 s (sooner in
19 of 20 paired loads); main-thread work the same or lower; first paint
0.02–0.07 s later.

"Page on screen" is when the page's own layout is first on screen: before,
when the loaded page went in; now, the first paint, which has the shell.
"Game fully visible" is when the board has pieces and is fully opaque. The
game or puzzle waits for the same requests as before (on /puzzles mostly
`new_puzzle`, ~1.6 s on the backend), but the old fade-in took 0.3–0.5 s
after the page went in on a desktop and up to 1.2 s on the slow phone, so it
is now fully visible sooner or at the same time, except first visits to
/puzzles (6.1 → 6.3 s, sooner in 2 of 5 paired loads) and to /analysis (8.4
→ 9.0 s, sooner in 2 of 5). The time the pieces first went into the page,
which ignores the fade, varied between runs on phones' first visits from 0.3
s sooner to 1 s later. On the phone the first paint is up to 0.15 s later
(it draws the shell; with the empty board hidden it painted 0.1 s sooner),
and first visits to analysis and /puzzles do 0.4–0.7 s more main-thread
work, which on a fast CPU is 0.1–0.2 s; returning visits and desktops don't.

Chrome's largest-contentful-paint time ("main content") is the shell's on
the phone (Bot or Not 4.1 → 0.8 s, analysis ~0.8–1.0 s), but on /puzzles and
on desktops it now comes when the content fills in (/puzzles 0.6 → 5.8 s,
analysis on a desktop 0.2 → 0.7 s): that content came at the same time
before, but faded in from transparent, which Chrome doesn't count, so it
reported an earlier, smaller element. Lighthouse (phone settings, local
builds, medians of 3): analysis 64 → 63 (main content 2.9 → 3.5 s, speed
index 3.16 → 3.14 s), Bot or Not 54 → 76 (main content 5.9 → 2.8 s, blocking
time 0.95 → 0.67 s), /puzzles 42 → 43 (main content 24 s on both:
Stockfish's download, as in round 4).

**Stockfish** (`scripts/perf/chart-probe.mjs`, 8 steps per run, the analysis
page; the final build, 2 runs per game on a desktop, 3 on the phone): on a
desktop depth 12 came 0.01 s later after a step (± 0.03 s; sooner on 18 of
32 steps) and the depth reached before the next step went from 16.91 to
16.84; on the phone depth 12 came 0.19 s later (± 0.28 s; sooner on 21 of 46
steps), 46 of 48 steps reached it against 48, and the depth before the next
step went from 14.62 to 14.38. All four phone comparisons this round (one
with only `_document`'s theme line changed on the analysis page) put depth
12 later, by 0.04–0.34 s, each within its spread, and all ran the base build
first in each pair. A run with the order swapped was swamped by other users'
work on ada (depth 12 reached on 17 of 24 steps on both builds), so whether
that is the order or the branch is not settled; nothing the branch changes
runs while the page steps through a game.

**/play, after choosing a side (3c00156).** The game page's code was fetched
only after the click, on the emulated phone behind the prefetches of the
header's links (/play/maia's chunk was requested 0.36 s after the click),
then `play/start_game` took ~0.57 s on the backend, and the game faded in
over 0.4 s. The setup dialog now prefetches the game page as it opens, and
/play/maia shows the game as soon as it is ready. From the click until the
game is fully visible (4 runs each, against the rest of round 5): phone
1.98–2.35 → 1.42–1.57 s, desktop 1.32–1.70 → 0.99–1.14 s; the fade is ~0.4 s
of it, the prefetch ~0.2 s on the phone. A whole first visit to /play on the
phone, until the game is on screen: ~4.6 → ~3.9 s.

**Where an analysis visit's time goes** (emulated phone with Chrome's own 4x
CPU throttling, first visit, source-mapped profile): the game and the
session are fetched by 0.65 s, but the main thread is busy until the game
shows at ~2.8–3.4 s: ~1 s parsing and compiling ~1.5 MB of JavaScript (463
KB compressed) and the page, ~0.5 s running modules' top-level code, ~0.35 s
React building the page, then chess.ts (the game), chessground,
framer-motion and Google Analytics. The largest parts of the page's
JavaScript: recharts with its d3 helpers ~320 KB (the sidebar's charts),
posthog-js 167 KB (on every page), react-dom 126 KB, framer-motion 118 KB.
Measured with that throttling instead of pausing the browser process, the
shells don't add main-thread work on analysis: over the first 10 s 6.6 → 6.4
s (style and layout +0.12 s, scripts −0.23 s). `BoardController` reads the
window's size as it mounts (`useWindowSize`), which forces a layout of the
new page (~0.18 s in the profile); reading `WindowSizeContext` instead made
no measurable difference (fully visible 2.84 → 2.77 s, 5 runs each), since
the browser then does the same layout a moment later, so it was left as it
is.

**Not done.** /drills opens on the openings picker or on Maia's download
window, depending on what the browser has cached, which the server can't
know. The site's header chooses its phone or desktop menu in JavaScript too:
its server HTML has the desktop menu, which wraps to two lines at tablet
widths (671–1024 px), so every page there moves down 28 px when the app
loads and swaps in the phone menu (on `main` too).

### Round 6: PostHog and Google Analytics after the page has drawn

Measured against round 5 at 694083b (before the rebase on #330 and #332): local
production builds behind `scripts/perf/stub-proxy.mjs`, both built with a test
PostHog key and `/ingest` as its host (the proxy swallows it), 5 runs each, the
builds alternating. The phone is Chrome's own 4x CPU throttling with 4G. Another
project's Stockfish batch kept ada at load 95–100 of 160 during these runs, so
times vary.

PostHog's browser code (~170 KB uncompressed) was in Next's start-up chunk:
`instrumentation-client.ts` initialised it before the app ran, and `_app`
initialised it again, which PostHog ignored as a second init. Google
Analytics (`next/script`'s default, afterInteractive) downloaded and ran
right after hydration, on the analysis page while it was building the game.

PostHog now loads with a dynamic import and initialises once the page has
loaded and the browser is idle (or 5 s after the load event), with the
settings `instrumentation-client.ts` used. Events tracked before then wait
in `src/lib/posthogClient` and are sent once it has loaded, with the time
they happened; its page view is captured when it starts. Google Analytics
uses `lazyOnload`. `PostHogProvider` is gone (nothing used its hooks).

| measure                                                       | round 5 → round 6                          |
| ------------------------------------------------------------- | ------------------------------------------ |
| JavaScript shared by all pages (build output, gzip)           | 237 → 181 kB                               |
| analysis game fully visible, phone, first visit               | 3.58 → 3.13 s                              |
| /play's setup dialog on screen, phone, first visit            | 2.51 → 2.29 s                              |
| home page's JavaScript, phone, first visit                    | 653 → 554 KB                               |
| /play: choosing a side 1.5 s after the dialog, until the game | phone 1.57 → 1.56 s, desktop 0.88 → 0.91 s |
| /play: choosing as the dialog appears, until the game         | phone 1.64 → 2.06 s, desktop 1.03 → 1.17 s |

The last row is the cost: the analytics now start up as the page first goes
idle, which on /play is just after the dialog appears, so a visitor who
chooses at once waits for them. Waiting longer (idle, 1 s, idle again) was
tried and dropped: it moved the start-up onto the clicks of visitors who
choose a second or so after the dialog appears (1.5 s: phone 2.34 → 3.24 s,
desktop 1.09 → 1.29 s, at load ~143).

The analytics still arrive (PostHog's debug log, an ordinary Chrome user
agent): on a desktop PostHog starts at ~1.2–1.7 s instead of ~0.3 s and
stamps its page view then, Google Analytics sends its page view ~0.3 s later
than before, and an event tracked before PostHog had loaded
(`download_model_modal_shown`, at 0.66 s) was sent at 1.3 s with its own
time. Visitors who leave within the first seconds may not be counted, and
errors before PostHog loads aren't captured.

Rebased on main after #330 and #332, PostHog starts with main's settings
(`src/lib/posthog-browser-config.ts`): events through `/ingest`, a page view
for each page within the app, exceptions and web vitals. Checked against
main with a local stand-in for PostHog (an analysis game, a click, an
uncaught error, a link to /play, a game against Maia, then leaving the
page), the same events arrived: page views for the analysis page, /play and
/play/maia, `analysis_game_loaded`, `play_game_started`, `$exception` and
`$web_vitals`, the early ones with their own time. On the emulated phone
PostHog starts at ~2.2 s on /play and 2.5–4.9 s on the analysis page,
against ~1.5 s on main. A visitor who has moved to another page by then
gets a page view only for the page PostHog starts on; choosing a side at
once on /play, the /play page view still arrived in 3 of 3 runs.

One web vital was lost that main keeps. PostHog's web-vitals script reports
LCP at the visitor's first tap or key press, or when the page is hidden, and
then holds it 5 s before sending. For a visitor who has already tapped by
the time the script loads, LCP waits for the page to be hidden and is lost
when the tab closes. On the phone, choosing a side on /play at once sent FCP
but no LCP in 3 of 3 runs (main sent both). That was with round 7 on top,
whose dialog takes taps at ~1.3 s, before PostHog starts; on round 6 alone
the dialog takes taps at ~1.4 s, as PostHog starts, and LCP arrived in all
3 runs. With a 3 s pause before choosing, both arrived.
CLS and INP, which are reported as the page is hidden, didn't arrive on
either build.

LCP is now sent by `src/lib/largestContentfulPaint`, which
`instrumentation-client.ts` starts before the app, with none of PostHog's
code (JavaScript shared by all pages 181 → 182 kB; 0.6 kB gzip). As in
web-vitals, it takes the last paint before the first click or key press, or
before the page is hidden, and sends it as PostHog's `$web_vitals` event
(`$web_vitals_LCP_value`) through the queue in `src/lib/posthogClient`;
PostHog itself sends FCP, CLS and INP. On the emulated phone, choosing a
side at once on round 8's tip now sends LCP in 3 of 3 runs (0 of 3 without
it), and after a 3 s pause exactly one LCP in each of 3; round 6 alone, 3
of 3 both ways. Each value matched the browser's own LCP to the millisecond
(0.49–0.56 s on /play, 0.49–0.55 s on main), and it is sent at once rather
than 5 s later. On the analysis-to-/play visit the same events arrived as on
main, with the analysis page's LCP 1.28–1.30 s on a desktop against main's
1.25–1.29 s. The event carries the URL of the page that loaded; main's,
sent 5 s after the tap, carried the page the visitor was on by then:
/play/maia, for /play's LCP and for the analysis page's alike.

**Stockfish** (`scripts/perf/chart-probe.mjs`, the analysis page, round 5
against rounds 6 and 7 together, 8 steps per run, each pair run in both
orders: half the runs with round 5 first, half with the branch first): on a
desktop depth 12 came 0.01 s later after a step (± 0.01 s; sooner on 16 of
32 steps) and the depth reached before the next step was 16.97 on both. On
the emulated phone depth 12 came 0.19 s later (± 0.21 s; sooner on 28 of 63
steps), 63 of 64 steps reached it against 64, and the depth before the next
step went from 14.73 to 14.61; but with round 5 run first the branch was
0.07 s sooner (± 0.31 s), and with the branch run first 0.44 s later (± 0.29
s), so the phone's spread is larger than any difference; the small phone
delays read in round 5's checks (all with the base run first) were within it
too. Nothing round 6 changes runs while the page steps through a game (the
analytics have loaded by then), and the Stockfish provider's deferred start
uses the same `whenPageIsIdle`, moved to `src/lib`.

### Round 7: /play

Measured against round 6 at d672c08 (before the rebase on #330 and #332), as
there (test PostHog key; the phone is Chrome's own 4x CPU throttling with 4G), 5
runs each, the builds alternating, ada at load ~50. The probe (`play_flow.mjs`)
opens /play, chooses "Play as white" as soon as the dialog takes taps, and waits
for the game.

**The setup dialog in the server's HTML (b04ed0c).** /play drew nothing
until the app had loaded, the router was ready and the dialog's code (a
dynamic import in `ModalContext`) had arrived. /play now renders the dialog
itself, on the server too, without the fade and slide it has when a button
opens it (`ModalContainer`'s `animateIn`). Until the app has started the
dialog ignores taps (`pointer-events`): a choice made before then would show
but not be used. A URL with settings (a challenge, a position to continue
from) hides the server's default dialog until the app has read it, as
before.

**The game at once (30d4a55).** After choosing a side, /play/maia showed
nothing while `play/start_game` created the game (~0.6 s on the backend). It
now shows the game straight away, its board at the starting position, with
the visitor's moves and their logging waiting for the game's id (Maia's
moves already did); clocks start with the first move, as before. A new game
(Play again) gets a new `PlayMaia`.

**`start_game` as the visitor chooses (f3d1b7a).** With the game drawn at
once, the request went out only after /play/maia had rendered, and on the
phone the board took moves ~0.35 s later than before. The dialog now sends
`start_game` as the visitor chooses, and /play/maia takes that request if
its settings match, or starts its own. Two games still make two `start_game`
calls.

| /play, round 6 → round 7                  | phone         | desktop       |
| ----------------------------------------- | ------------- | ------------- |
| setup dialog on screen                    | 1.64 → 0.58 s | 0.45 → 0.30 s |
| dialog takes taps                         | 1.66 → 1.41 s | 0.46 → 0.42 s |
| after choosing: the board with its pieces | 1.99 → 1.29 s | 1.02 → 0.46 s |
| after choosing: the board takes moves     | 1.60 → 1.29 s | 0.90 → 0.83 s |
| main-thread work after choosing           | 1.50 → 1.36 s | 0.51 → 0.58 s |

Checked in local production builds: the dialog is at the same place in the
server's HTML and once loaded (a Pixel 7 and 1440 × 900), with no React
errors; a URL with `modalTitle` and `forcedColor` shows nothing until the
app has read it and then its own title; a game takes e4 once it has its id,
Maia answers ("1. e4 e5"), and both moves are logged under that id;
resigning and Play again as black give a new id, black at the bottom and the
starting position.

Not done: Hand and Brain (/play/hb) still waits for its game as before, and
the dialog that buttons elsewhere open still loads its code on the first
click.

### Round 8: the analysis chart after the page

Measured against round 7 at 9781b24 (before the rebase on #330 and #332): local
production builds, the test PostHog key, the phone being Chrome's own 4x CPU
throttling with 4G, 5 runs each, the builds alternating, ada at load ~40–50.

recharts and its d3 helpers (~320 KB of JavaScript, uncompressed) were the
largest part of the analysis page's start-up code, for one chart: Moves by
Rating, in the sidebar on desktops and below the board on phones. The chart
(`MovesByRatingArea`) now loads with `next/dynamic` once `MovesByRating`
renders; the panel and its heading draw at once, and a placeholder of the
chart's height holds its place. Puzzles, drills, broadcasts and the home
page's sections use the same component.

| analysis, round 7 → round 8          | phone (first visit) | desktop       |
| ------------------------------------ | ------------------- | ------------- |
| JavaScript at start-up (build, gzip) | 417 → 311 kB        | 417 → 311 kB  |
| game fully visible                   | 2.65 → 2.56 s       | 0.65 → 0.59 s |
| Moves by Rating chart drawn          | 2.98 → 3.13 s       | 0.77 → 0.79 s |
| main-thread work, first 10 s         | 6.51 → 6.66 s       |               |

The game was fully visible sooner in 4 of 5 phone pairs and 5 of 5 desktop
ones. The saving is mostly the download: recharts' code ran only when the
chart was drawn, so its script time doesn't change, and on this 4G (9 Mbps)
the 106 kB take ~0.1 s; on slower connections they take longer. The chart's
panel and chart are at the same place and size as before (a Pixel 7 and 1440
× 900).

Lighthouse (phone settings, local builds, 3 runs each): analysis 57–66 →
59–67 (medians 66 → 64), blocking time 2.72 → 2.31 s, speed index 3.02 →
3.07 s, main content (the board, in both) 2.45–3.91 → 2.60–3.44 s; /puzzles
42 → 42.

**Stockfish** (`scripts/perf/chart-probe.mjs`, the analysis page, 8 steps
per run, each pair run in both orders): on a desktop depth 12 came 0.03 s
sooner after a step (± 0.02 s; sooner on 19 of 32 steps) and the depth
reached before the next step went from 17.03 to 16.94; on the emulated phone
0.23 s sooner (± 0.24 s; sooner on 38 of 63 steps), 63 of 64 steps reached
it against 64, depth before the next step 14.69 → 14.61. As in round 6, the
build run first in a pair came out slower on the phone (with round 7 first
the branch was 0.93 s sooner, with the branch first 0.48 s later), which is
why the orders are balanced.

### Rounds 4–8 together

Main where the rounds start (ef23af3, after #324) against round 8's tip
before the rebase on #330 and #332 (56a1767): local production builds
behind `scripts/perf/stub-proxy.mjs`, a test PostHog key, 5 loads each, the
builds alternating, ada at load 50–75. The phone is Chrome's own 4x CPU
throttling with 4G; returning visits reuse each build's own warmed profile.
/play opens the page, chooses "Play as white" as soon as the dialog takes
taps, and waits for the game.

| main → round 8                                 | phone (first visit) | desktop       | phone (returning) |
| ---------------------------------------------- | ------------------- | ------------- | ----------------- |
| /play: setup dialog on screen                  | 1.94 → 0.49 s       | 0.37 → 0.16 s | 0.98 → 0.38 s     |
| /play: board with its pieces after choosing    | 1.89 → 0.59 s       | 1.23 → 0.30 s | 1.54 → 0.94 s     |
| /play: game takes moves, from the request      | 3.29 → 2.44 s       | 1.26 → 1.11 s | 2.01 → 2.07 s     |
| analysis game fully visible                    | 3.29 → 2.27 s       | 0.93 → 0.54 s | 2.01 → 1.52 s     |
| /analysis: board fully visible                 | 5.90 → 5.24 s       | 1.38 → 1.14 s |                   |
| /puzzles: puzzle fully visible                 | 3.99 → 3.39 s       | 2.42 → 2.04 s |                   |
| Bot or Not: game fully visible                 | 3.13 → 2.59 s       | 1.78 → 1.44 s |                   |
| home: main-thread work in the first 10 s (5 s) | 7.20 → 4.95 s       | 1.99 → 1.41 s | 5.85 → 3.87 s     |
| home: JavaScript transferred                   | 535 → 384 KB        | 535 → 489 KB  |                   |

Each "fully visible" and /play row except returning /play's last came out
sooner in 5 of 5 pairs. JavaScript at start-up (build output, gzip): shared
by all pages 308 → 181 kB, analysis game 468 → 311 kB, /play 283 → 169 kB,
home 295 → 183 kB, /puzzles 453 → 293 kB, Bot or Not 323 → 208 kB.

What is later:

- Returning /play, choosing at once: the game takes moves 0.06 s later (4
  of 5 pairs), while the analytics start up (round 6).
- First paint on the desktop app pages, 0.03–0.06 s later (e.g. analysis
  game 0.22 → 0.27 s), and on the phone for /puzzles and Bot or Not (0.51 →
  0.56 s, 0.50 → 0.56 s). It now draws the page's layout.
- Largest contentful paint where the layout now comes first and the largest
  element later: Bot or Not on a desktop 0.20 → 1.49 s, /puzzles 1.72 →
  2.17 s (desktop) and 3.29 → 3.46 s (phone), the analysis game on the phone
  0.53 → 0.63 s (returning 0.52 → 0.68 s). The game or puzzle is on screen
  sooner in each, but PostHog's web vitals, on since #330, report LCP.

**Stockfish** (`scripts/perf/chart-probe.mjs`, the analysis page, 8 steps
per run, each pair run in both orders): every step reached depth 12 on both
builds. With the tip run first, after the page-load runs above had finished,
depth 12 came at the same time on a desktop (0.01 s later, ± 0.01 s) and
0.14 s sooner on the phone (± 0.08 s; sooner on 21 of 32 steps). With main
run first, during those runs, main was 1–2 s slower on several desktop steps
and the tip came out 0.85 s sooner (± 0.20 s); that half isn't counted. Depth 18,
reached on fewer than half the steps, is too noisy to separate (phone 0.00 s
± 0.05 s; desktop, tip first, 0.73 s later ± 0.62 s). Depth reached before
the next step: desktop 16.97 → 16.91, phone 16.48 → 16.50.

### Round 9: the engines on the analysis page (nothing changed)

Measured on 2026-11-03 against main at 3e5ef6d (after #331): local
production builds behind `scripts/perf/stub-proxy.mjs`, the test PostHog
key, warm visits (each build's own primed profile), 8 cores reported. The
phone is the one in "On a phone": every thread of the page, workers
included, at a quarter of its speed (`cpu-slowdown.py`). The builds
alternated, and a pair is the same game and repetition on both. ada was busy
(load 65–137 of 160), so single pairs differ by several seconds.

**Where the time goes.** Main at load ~115, 4 warm visits each (seconds,
medians):

|                         | phone | desktop |
| ----------------------- | ----- | ------- |
| board on screen         | 2.86  | 0.43    |
| Maia's moves            | 9.50  | 2.01    |
| Stockfish's first depth | 12.16 | 1.83    |
| Stockfish depth 12      | 23.48 | 3.30    |
| Stockfish depth 18      | 37.88 | 5.76    |

On the phone, from performance marks in a diagnostic build:

- **Maia:** ONNX Runtime compiles (~1.5 s) while the model is read from
  IndexedDB (~1.6 s); creating the session takes 3.2–4 s, the first rating
  0.4–1.5 s more, and the chart's batch of 10 ratings 2.7–4.7 s on 4
  threads.
- **Stockfish:** the module and its 4 threads ~2.7 s; finding and reading
  the cached nets 2–7 s (main thread); copying them into the engine
  0.5–0.9 s (a main-thread long task); decoding the big net at the first
  `isready` ~2.9 s (0.8 s on a desktop). The first depth comes ~0.4 s
  later.
- **The main thread** is ~97% busy from 8 to 25 s: React renders ~5 s (96
  renders of ~52 ms), recharts 2.25 s (0.65 s of it the legend measuring its
  text), Google Analytics 1.17 s, the nets' copy 0.54 s, layout and paint
  ~2.7 s.

The phone is short of CPU, not waiting: each change below that made one
engine sooner made the other later, or was lost in the noise.

**Tried and reverted** (phone; paired medians, − is sooner; pairs sooner in
brackets):

| change                                                                                                               | pairs | Maia's moves | Stockfish first | depth 12    | depth 18    |
| -------------------------------------------------------------------------------------------------------------------- | ----- | ------------ | --------------- | ----------- | ----------- |
| Read Stockfish's nets in a worker, while the module starts                                                           | 6     | −0.77 s (5)  | −0.25 s (3)     | +0.48 s (2) | +0.38 s (2) |
| Send Maia's requests before the page hears it is ready                                                               | 6     | −1.56 s (5)  | +0.59 s (2)     | +0.83 s (1) | +3.27 s (1) |
| The chart's legend as HTML instead of recharts' `<Legend>` (pixel-identical)                                         | 6     | −0.54 s (3)  | +0.30 s (2)     | −0.87 s (3) | −1.99 s (3) |
| A half-size Maia model (8-bit weights, below)                                                                        | 14    | −0.87 s (12) | +1.52 s (5)     | +1.77 s (4) | +2.31 s (6) |
| Stockfish's display updated at most once a second during the page's first search, on phones (every 0.15 s otherwise) | 8     | +0.43 s (3)  | −0.24 s (4)     | −0.11 s (4) | −2.28 s (4) |

- Reading the nets in a worker also put the board 0.50 s later (sooner in 1
  of 6).
- The half-size model was faster everywhere on a desktop (6 pairs): Maia's
  moves 0.45 s sooner (5), Stockfish's first depth 0.47 s (5), depth 12
  0.94 s (5), depth 18 0.51 s (4). On the phone Maia's 10-rating batch then
  runs during Stockfish's start-up.
- As a bound, rendering Stockfish's updates at most every 2 s everywhere
  gave depth 12 2.60 s and depth 18 3.44 s sooner (3 of 4 pairs each). Once
  a second during the first search was within the noise: single pairs went
  from 9 s sooner to 7 s later.

**Smaller Maia models.** 300 game positions at the chart's 11 ratings, each
copy against today's model (fp16, 45.7 MB, 41.7 MB with Brotli), in Node
with onnxruntime-web 1.23 (WASM, 4 threads; the 8-bit-weights copy with the
worker's settings, the others with the runtime's defaults). For scale, the
first row is today's model against itself 200 rating points apart:

| model                                              | size (Brotli)  | same top move | chart probabilities moved (points) | win % moved (points) | batch of 10 |
| -------------------------------------------------- | -------------- | ------------- | ---------------------------------- | -------------------- | ----------- |
| today's, 200 rating points apart                   |                | 90.4%         | 2.71 on average, 26.9 at most      | 1.52, 13.0 at most   | 0.63 s      |
| 8-bit weights, 32-bit arithmetic                   | 24.2 (21.5) MB | 99.3%         | 0.24, 2.8 at most                  | 0.25, 2.7 at most    | 0.59 s      |
| 8-bit arithmetic, first and last layers at 32 bits | 27.3 MB        | 97.0%         | 0.76, 10.6 at most                 | 0.94, 9.3 at most    | 0.36 s      |
| 4-bit weights (`MatMulNBits`)                      | 31.6 MB        | 90.9%         | 2.66, 24.3 at most                 | 2.93, 32.1 at most   | 0.58 s      |

"Chart probabilities" are the moves of 5% or more. The 8-bit-weights copy
stores each weight matrix as int8 with a scale per output channel and a
`DequantizeLinear`; with `session.disable_quant_qdq` the runtime unpacks them
once, creating the session in 0.47 s instead of 0.70 s (without it, each run
unpacks them: 0.91 s a batch). onnxruntime-web 1.23 cannot load 8-bit
`MatMulNBits` or a 4-bit `Gather`, and the 4-bit copy keeps its `Gemm`
layers at 32 bits.

**Smaller Stockfish builds.** `lila-stockfish-web` also ships `sf16-7`
(Stockfish 16 with a single 6.5 MB net) and `sfhce` (no net). 200 game
positions, one search thread and 16 MB of hash as on the site, a desktop in
headless Chromium, 8 engines at once; each answer scored against Stockfish
17 at depth 22 (win % by Lichess's formula):

| engine                   | nets   | ready  | depth 12: time, same move, win % off | depth 18: time, same move, win % off |
| ------------------------ | ------ | ------ | ------------------------------------ | ------------------------------------ |
| Stockfish 17 (`sf17-79`) | 78 MB  | 3.0 s  | 0.07 s, 71.5%, 2.2                   | 0.86 s, 86.5%, 1.0                   |
| `sf16-7`                 | 6.5 MB | 0.54 s | 0.04 s, 63.5%, 3.2                   | 0.48 s, 70.5%, 2.2                   |
| `sfhce`                  | none   | 0.21 s | 0.08 s, 57.5%, 4.0                   | 0.90 s, 64.0%, 3.3                   |

`sf16-7` searches 3.4 times as many positions a second, but its depth 18 is
about as good as Stockfish 17's depth 12, and at depth 22 (1.79 s) it agrees
on 74.5% with win % 1.9 off. Scoring against Stockfish 17 favours it
somewhat, but not by that much. It only wins on start-up: by the phone's
times above, ~5–6 s on a warm visit (not measured), and the 78 MB download
on a first one.

**First visits.** On 4G (9 Mbit/s) on the phone (2 runs, main): the board
at 6.1–7.2 s, Maia's moves at 110.8–112.6 s (Download tapped at 8.6–9.4 s),
Stockfish's first depth at 132–135 s, depth 18 at 163–176 s. Maia's 42 MB
and Stockfish's 78 MB download together and share the link; at 50–100
Mbit/s they would take 10–20 s. Not built: downloading them one after the
other, and `sf16-7` as a stand-in while the nets download (its results kept
out of the shared analysis cache, and its depths labelled differently).

### Round 10: Stockfish 19's small net, and the best line first

Measured on 2026-11-05 against main at 3e5ef6d, as in round 9 (local production
builds behind `scripts/perf/stub-proxy.mjs`, warm visits with each build's own
primed profile, the phone at a quarter of full speed in every thread, 8 cores
reported), with ada at load 25–45 of 160. Six paired loads per device, the builds
alternating, on the two test games. The emulated phone is far slower than an iPhone
12 (see below), so use it to compare builds, not as what a phone user sees.

**The depth labels below are not like for like.** On main, "d18" appears when four
lines have reached depth 18. Here it appears when the best line alone has, with the
other lines as shallow as depth 6, and the same goes for "d12". So the fair comparison
of the whole display is when the lines stop changing: about 3.4 → 2.7 s after a step
on an iPhone 12, and 5.36 → 3.38 s on a desktop, not the threefold gain the labels
suggest. What the earlier label does give is a best move and eval about as reliable
as main's d18, sooner. The whole search, which ends with the deep search on Maia's
moves, takes longer: about 7.3 s against 6.0 s in a desktop replay, on engines not run
under identical load.

| warm visit, seconds     | phone: main → new | desktop: main → new |
| ----------------------- | ----------------- | ------------------- |
| board on screen         | 2.38 → 2.48       | 0.33 → 0.33         |
| Maia's moves            | 7.66 → 7.48       | 1.68 → 1.65         |
| Stockfish's first depth | 9.02 → 5.02       | 1.55 → 0.65         |
| Stockfish depth 12      | 18.02 → 7.50      | 2.80 → 0.80         |
| Stockfish depth 18      | 29.54 → 9.46      | 4.87 → 1.25         |

Every Stockfish row came out sooner in 6 of 6 pairs. The board and Maia's moves are
within the noise (the board 0.06 s later on the phone, sooner in 1 of 6).

Moving through a game (`chart-probe.mjs`, each pair in both orders; 24 steps of 26 s
per build on the phone, 32 of 7 s on a desktop):

| after each step, seconds    | phone: main → new | desktop: main → new |
| --------------------------- | ----------------- | ------------------- |
| depth 12                    | 6.56 → 2.57       | 1.11 → 0.39         |
| depth 18                    | 19.46 → 5.25      | 4.98 → 0.93         |
| steps that reached depth 18 | 13 → 24 of 24     | 30 → 32 of 32       |
| moves-by-rating chart drawn | 3.41 → 3.51       | 1.20 → 1.20         |
| lines stop changing         | 21.99 → 17.69     | 5.36 → 3.38         |

Memory, measured before the memory fix below: the page's renderer peaks at
1040–1050 MB on main and 550–557 MB now (a desktop, three runs each), and Stockfish's
own memory goes from 517 to 84 MB.

First visit on 4G (9 Mbit/s) on the phone, 2 runs each, before the last search change:
Stockfish's first depth at 125–127 s on main and 5.2–6.1 s now, depth 18 at 143–147 s
and 8.5–9.1 s, the board at 3.7–4.0 s and 2.4–2.5 s. Maia's 42 MB no longer shares the
link with 78 MB of nets, so its moves come at 53–54 s instead of 103–104 s.

**Stockfish 19's small net (commit "Stockfish 19 with its single 1.2 MB net").**
`@lichess-org/stockfish-web` 0.5.0 ships Stockfish 19 with one net of 1.2 MB,
instead of Stockfish 17's two of 78 MB in all. In an empty page on the phone
(one run each), the engine alone is ready at 1.5 s instead of 9.7 s. The net now
comes from the site itself, so the download code with its three hosts and the
IndexedDB cache are gone, and the old nets are removed from a returning
visitor's storage. Browsers with relaxed SIMD (Chrome) get a build that searches
~30% more positions a second; others (Firefox 131, tested) the plain one. Its
scripts load from `public/stockfish`, since webpack cannot bundle them.

How good are its answers? 200 game positions, one thread, 16 MB of hash, each
answer scored against a native search of about 12 s on 4 threads. Each reference
favours its own engine's scale, so both are shown (Stockfish 19 / Stockfish 17);
"lost" is how many win-percentage points the chosen move gives up by the
reference:

| build, at depth 18       | net    | same top move | lost        | eval off    | time   |
| ------------------------ | ------ | ------------- | ----------- | ----------- | ------ |
| Stockfish 17 (main)      | 78 MB  | 69.5 / 69.0%  | 0.39 / 0.36 | 3.61 / 1.30 | 0.71 s |
| Stockfish 19 small (new) | 1.2 MB | 72.5 / 72.0%  | 0.40 / 0.33 | 2.50 / 1.59 | 0.76 s |
| Stockfish 18 small       | 15 MB  | 70.5 / 74.0%  | 0.39 / 0.25 | 4.28 / 2.00 | 0.74 s |
| Stockfish 17.1 small     | 6.6 MB | 67.0 / 67.0%  | 0.53 / 0.46 | 4.97 / 2.64 | 0.32 s |
| Stockfish 19 full        | 98 MB  | 77.5 / 75.5%  | 0.27 / 0.23 | 1.38 / 2.14 | 1.79 s |

The full-size Stockfish 19 row comes from an earlier run, on a busier machine.
At the site's whole search on 222 positions of four games the small net is a
little behind at the end: the final best move loses 0.42 / 0.49 points against
Stockfish 17's 0.30 / 0.27. Played moves get the same colour from both engines
in 188 of 214 cases (87.9%), and agree with a deep search as often or more
(96.2 / 94.1% against 91.8 / 94.6%).

No published Stockfish 19 net lies between 1.2 and 98.5 MB. The small one drops
the full net's threat, pawn-pair and king-position inputs for 768 piece-square
inputs, so a middle size would need new training and a new build. Its author's
test has it 9.75 ± 2.7 Elo ahead of the 15 MB Stockfish 18 net over 20,000 games
(from the patch's notes, not repeated here). The 15 MB net takes twice as long
to be ready on the phone (3.0 s) with no clear gain, and the 6.6 MB one mostly
reaches a depth that is worth less.

**The best line first (commit "the best line reaches the target depth first").**
Depth 18 on main came after about 3.6 s of a four-line search. On 222 positions
of four games, replayed in an empty page on a desktop with Stockfish 17, the
first time depth 18 shows goes from 4.97 to 1.66 s, and is as good: the same top
move as a deep search 67.1% of the time against 62.2%, and 0.31 points lost
against 0.31. Stockfish 19 does a little worse on the same test (64.4% and 0.35).

**The first pass to depth 6 (commit "the first pass over the moves goes to depth
6").** On the same replay with the small net, depth 12 goes from 0.62 to 0.12 s
and depth 18 from 1.51 to 0.98 s, with the same accuracy.

**The lines on show one at a time (commit "the lines on show one at a time, and the
other moves after them").** The stages above made the four lines settle later than on
main, which matters on every move: 0.49 s later on an iPhone. The other three lines now
search one at a time among the moves not yet shown, and the second pass over every move
comes after them, as it changes none of the lines on show. On the replay, the four lines
are done at 5.37 s instead of 6.46 s, with as many of a deep search's top four moves
(2.90 against 2.86 of 4). The whole search is no shorter (~9.1 s in that busier replay).

**From a code review of the above (commit "an unfinished search is never taken
for a finished one").** An update is `partial` until the search ends, because
depth 18 now says only that the best line got there. A position left early is
searched again when revisited, full-game analysis and Learn From Mistakes wait
for the finish, unfinished results are not saved, and a move is coloured during
a search only from a score of depth 10 or more.

**Not changed:**

- **Keeping the hash between positions** (no `ucinewgame`): 8% fewer nodes with
  Stockfish 17, none with the small net.
- **ONNX Runtime 1.31:** creating Maia's session takes ~50% longer (1.8 s against
  1.2 s), batches ~5% less, and probabilities move by up to 0.64 points.
- **Removing the moves-by-rating chart**, as a bound: recharts dominates React's
  time on the phone (the 63 renders over 20 ms took 5.5 of 5.7 s in a load), but
  without it depth 12 and 18 came only ~2 s sooner on main (4 of 6 pairs) and
  ~0.1 s sooner on a desktop, so rewriting it isn't worth it yet.
- **`/play`:** on the phone taps respond in 130–160 ms and Maia's reply is back
  in ~100 ms from ada. Nothing stands out.

**On a real iPhone 12** (Safari 26, on 2026-11-04, with
`public/engine-bench.html` on the `claude/engine-bench` branch; one run on each
of three positions, the engine alone in the page):

| Stockfish, on three positions | 17 (main)             | 19 small (new)   |
| ----------------------------- | --------------------- | ---------------- |
| depth 12                      | 102, 113, 35 ms       | 50, 45, 14 ms    |
| depth 18                      | 590, 1253, 378 ms     | 569, 633, 197 ms |
| positions a second            | 629k                  | 916k             |
| memory                        | 423 MB                | 81 MB            |
| fetching the nets             | 16.4 s (78 MB, Wi-Fi) | 0.39 s (1.2 MB)  |
| loading and unpacking them    | 220 ms                | 23 ms            |

So this phone is much faster than the emulated one: on the first position,
depth 18 took 0.57 s, against ~10 s for the emulated phone in an empty page. The
emulated phone's seconds are not what an iPhone 12 user sees, and it is unmeasured
how close they are to a slower Android phone. The engine alone gains hundreds of
milliseconds here, plus the download on a first visit and 5 times less memory.
The best line first and the whole page have not been timed on the phone. Safari
gets the plain build, without relaxed SIMD.

**The whole site on the same iPhone**, in Safari, on 2026-11-05, with
`public/phone-lab.html` (branches `claude/phone-lab-base` for main's code and
`claude/engine-bench` for this round's). It runs the site in a frame, or for the
real reloads as the whole page, with saved analysis stubbed out so that the
engines run and nothing is stored. Runs were by hand, one or two per build, with
a few minutes between them:

| iPhone 12                      | main                      | new                      |
| ------------------------------ | ------------------------- | ------------------------ |
| 6 return visits                | page reloaded, both times | all finished, both times |
| 10 reloads of the whole page   | Safari gave up after 4    | engines back on 10/10    |
| 10 reloads in a frame          | page reloaded, twice      | engines back on 10/10    |
| after a step: depth 12         | 0.77–0.82 s               | 0.28–0.29 s              |
| after a step: depth 18         | 3.27–3.37 s               | 0.87–1.18 s              |
| after a step: Maia's moves     | 0.30 s                    | 0.28 s                   |
| after a step: chart            | 1.19–1.34 s               | 1.39–1.58 s              |
| after a step: lines settled    | 3.37–3.42 s               | 2.59–3.12 s              |
| after 10 quick taps: depth 12  | 1.12–1.54 s               | 0.24–0.29 s              |
| first visit: Stockfish's depth | 22.0 s                    | 3.6 s                    |
| first visit: Maia's moves      | 19.7 s                    | 10.6 s                   |
| first visit: board             | 0.94 s                    | 3.05 s (one load)        |
| Stockfish flat out, 2 minutes  | 577k → 478k a second      | 672k → 574k a second     |

Return visits on the new code: board 0.30 s, Maia's moves 1.66 s, Stockfish's first
depth 0.41 s, depth 12 0.73 s, depth 18 1.29 s, chart 2.75 s, lines settled 3.07 s,
with no main-thread stall over 100 ms. Main has no such row, as it never finished.
The step rows for the new code are from the final search order. Quick taps and the
first visit were measured before the last search change. On main, the stepping test
itself reloaded the page in 3 of 4 tries, so main's step rows come from the 2 runs that
finished. The new code finished all 6 of its runs.

**The chart, about 0.1–0.2 s later on the iPhone.** With a measure of Maia's last answer
on the same page, the chart appears 40–60 ms after it, so the drawing is not what is
late, and rendering it at normal priority instead of as a transition gained nothing
(1.56 and 1.40 s against 1.40 and 1.39 s). Main's own split is unmeasured, since main
reloaded both times; the likeliest cause is Maia sharing the phone's CPU with
Stockfish's search. On ada the chart is unchanged within the noise.

**The memory fix (commit "reserve less memory, and wait when an iPhone has none to
spare").** Before it, the new code's frame reloads brought both engines back on only
3 of 10 (`RangeError: Out of memory`), and later reservations failed even with no
page open. Reservations are now 134 MB for Stockfish and 268 MB for Maia (402 MB
together; main reserves about 1.5 GB), and both retry after 1, 3, 8 and 15 s. With it, 10 of 10 in both reload tests, before and after the last search change. Maia's moves come at about 2.9 s on most of those
reloads instead of about 1.6 s, which is what one 1 s retry would give, so the phone
is still short of memory there; that isn't confirmed. Stockfish now uses 84 MB.

**Maia on WebGPU: not pursued.** On the same phone, in a worker as on the site:

| Maia-3                                      | WebAssembly | WebGPU |
| ------------------------------------------- | ----------- | ------ |
| create the session, and the first rating    | 4.17 s      | 2.01 s |
| one rating                                  | 185 ms      | 188 ms |
| 10 ratings                                  | 1112 ms     | 470 ms |
| Stockfish's speed while batches run nonstop | 460k        | 304k   |
| batches meanwhile                           | 4           | 9      |

Stockfish alone ran at 916k positions a second, so WebGPU did not take Maia off
its back: per batch it loses about the same (~0.3 s) on both. WebGPU always ran
second, so a warmer phone may have counted against it. It would bring the chart
~0.6 s sooner on this phone, at the cost of probabilities that move (0.36 points
on average, 1.29 at most, the same top move in 30 of 30 cases), ~2.5 MB more to
download and a fallback for browsers without `shader-f16`.

A fairer rerun, with one move's work in mirrored order, reloaded the page with
both Maia runtimes and Stockfish loaded, so it gave no numbers. The site never
loads both runtimes at once.

**Not known yet:** how this behaves on real Android phones, and for real
visitors. No field data was used. The iPhone numbers are one phone and few runs.

### Round 11: what real visitors get, in PostHog

Rounds 1–10 measured emulated devices and one iPhone. These events show real visitors,
split by `engine`, `engine_build`, `is_phone`, `cores`, `release` and PostHog's own
`$os` and `$browser`. Nothing reads the page: `src/lib/analysisTiming.ts` takes a few
timestamps per engine update. Times are in milliseconds, and are left empty when the
visitor moved on or hid the page first.

| event                               | sent                                                | properties                                                                                                                                                                                        |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `analysis_engine_load`              | once a visit, for the first position                | `position_shown_ms`, `maia_first_ms`, `maia_chart_data_ms`, `chart_ms`, `stockfish_first_ms`, `d12_ms`, `d18_ms`, `lines_settled_ms`, `stockfish_done_ms`, `arrival`, `stockfish_ran`, `maia_ran` |
| `analysis_engine_steps`             | when the page is hidden or left, and every 30 moves | `steps`, the `_median_ms` of `maia_first`, `chart`, `d12`, `d18`, `lines_settled`, `stockfish_done`, and how many positions `_reached` each Stockfish stage                                       |
| `analysis_page_ended_unexpectedly`  | on the next analysis page in the tab                | `was_visible`, `seconds_since_it_started`                                                                                                                                                         |
| `stockfish_engine_ready`, `_failed` | once an engine, as before                           | `load_time_seconds`, and now `engine` and `memory_retries`                                                                                                                                        |
| `maia_engine_ready`, `_failed`      | once a page, when Maia starts from its saved model  | `load_time_seconds`, `restarts`                                                                                                                                                                   |

Reading them:

- **"d18" is not comparable across round 10:** use `lines_settled` for that. `d18_ms` says
  when the best line got there.
- **A crash:** `analysis_page_ended_unexpectedly` with `was_visible` true means the last
  analysis page in this tab was on screen and never left. With it false, the browser may
  just have dropped a page in the background. It undercounts: it can only report when the
  visitor comes back to an analysis page in that tab, so one who leaves after a crash, or
  sees Safari's "A problem repeatedly occurred", isn't counted until they return.
- **Saved analysis:** `stockfish_ran` false means the search didn't run for that position,
  so its times say nothing. Filter on it for engine times.
- **Before and after round 10:** only `stockfish_engine_ready`, `stockfish_engine_failed`,
  `$web_vitals` and `$exception` existed before it went live (2026-11-05 03:30 UTC). The
  new events have no "before", so they compare later changes against round 10.

Checked in a browser with PostHog's requests captured: the events and values above arrive;
a normal reload reports no crash; and a page that loses its exit handlers, as a killed one
would, is reported on the next load with `was_visible` true. PostHog ignores automated
browsers, so this needed the test browser to hide that it is one.

No slowdown within the noise, against the same code without these events: six paired
loads per device (test browsers, whose events PostHog drops, so sending itself isn't
counted). Desktop: first depth 0.00 s, depth 12 0.00 s, depth 18 0.00 s (paired medians).
Phone: first depth 0.56 s, depth 12 0.61 s and depth 18 0.71 s sooner, which is noise in
the build's favour (3–4 of 6 pairs).

Queries for PostHog's SQL editor:

```sql
-- Crash rate: analysis pages lost on screen, per analysis page load, by day and phone
SELECT toDate(timestamp) AS day, properties.is_phone AS phone,
  countIf(event = 'analysis_page_ended_unexpectedly' AND properties.was_visible = true) AS lost_on_screen,
  countIf(event = 'analysis_engine_load') AS loads
FROM events
WHERE event IN ('analysis_page_ended_unexpectedly', 'analysis_engine_load') AND timestamp > now() - INTERVAL 14 DAY
GROUP BY day, phone ORDER BY day

-- What a visitor waits for on a return visit, by phone and operating system
SELECT properties.is_phone AS phone, properties.$os AS os, count() AS loads,
  quantile(0.5)(toFloat(properties.stockfish_first_ms)) AS first_depth,
  quantile(0.5)(toFloat(properties.lines_settled_ms)) AS lines_settled,
  quantile(0.5)(toFloat(properties.chart_ms)) AS chart,
  quantile(0.9)(toFloat(properties.lines_settled_ms)) AS lines_settled_p90
FROM events
WHERE event = 'analysis_engine_load' AND properties.stockfish_ran = true AND timestamp > now() - INTERVAL 14 DAY
GROUP BY phone, os ORDER BY loads DESC

-- Round 10, before and after: Stockfish's start, and how often it failed
SELECT timestamp >= toDateTime('2026-11-05 03:30:00') AS after_round_10,
  countIf(event = 'stockfish_engine_ready') AS ready, countIf(event = 'stockfish_engine_failed') AS failed,
  quantileIf(0.5)(toFloat(properties.load_time_seconds), event = 'stockfish_engine_ready') AS median_ready_seconds
FROM events
WHERE event IN ('stockfish_engine_ready', 'stockfish_engine_failed') AND timestamp > now() - INTERVAL 30 DAY
GROUP BY after_round_10
```

### Round 13: getting past the Maia download

PostHog showed the biggest loss on the site isn't a slow page. Of the 7,631 people who
saw the full-page Maia download prompt in 30 days, 37.6% never started the download
(funnel to 2026-11-05), about 780 people in the last full week, or 11% of that week's
visitors. Of those who didn't start, 65% did nothing else within a minute, against 25% of
those who did. Both groups differ in other ways, so that doesn't prove the prompt caused it.

Stockfish doesn't wait for Maia, so nothing about the page needs the prompt to block it.

| what changed             | before                              | after                                                                       |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------------------- |
| desktop                  | full-page prompt, needs a click     | page opens, Maia downloads by itself, small card shows progress             |
| phone (or save-data, 2g) | full-page prompt, only exit is home | same size prompt, shorter text, "Not now" opens the page                    |
| after "Not now"          | -                                   | button in the empty Maia panel, and the prompt again in a new tab           |
| puzzles                  | prompt on arrival                   | nothing until the puzzle is over                                            |
| drills                   | prompt on arrival                   | choosing a drill isn't blocked; Maia is needed to start one                 |
| progress                 | stuck on "Starting download..."     | size and time left: "12 of 42MB, about 20 s left"                           |
| failed download          | logged as completed                 | logged as failed, with "Try again"                                          |
| saved model              | browser free to delete it           | browser asked to keep it (not Firefox, which would show a popup)            |
| saving it                | "saved" before the save was final   | waits for the save; a failure is reported, and Maia still runs on that page |

The progress bar never moved because the model is sent with brotli, so the browser gets no
`Content-Length`. The page now knows the size. Progress reaches the page's state in 10%
steps as before, and the bar reads finer steps directly, so the page doesn't re-render more.

"42 MB" is what the download uses: 41,688,610 bytes as sent, 45,683,686 once decompressed.

**Half of new visitors keep the prompt.** `maia_prompt_variant` is `wall` or `no_wall`,
chosen once per browser only when it has no model, and sent with every event, so the groups
can be compared for two weeks. On phones the comparison is "Return Home" against "Not now".

**Stockfish** (test browser, model at about the median 9 s, paired medians, later minus
earlier; phone-sized is not slowed down):

| comparison                                   | visits  | d12    | d18    |
| -------------------------------------------- | ------- | ------ | ------ |
| return visit, desktop: this against main     | 8 pairs | +46 ms | -5 ms  |
| return visit, phone-sized: this against main | 8 pairs | -56 ms | -38 ms |
| first visit, desktop: downloading or not     | 6 pairs | -3 ms  | +30 ms |

All are within the spread between visits. In an earlier run of the first-visit comparison,
2 of 6 visits reached d18 up to 0.5 s later while downloading. On a first desktop visit
Maia's moves appeared about 11.8 s after the board, with no click.

**Asked again after finishing the download** (60 days, per person, operating system and
browser; clearing cookies looks like a new person, so these are low):

| OS      | asked again at all | within an hour | of those back a day or more later |
| ------- | ------------------ | -------------- | --------------------------------- |
| iOS     | 7.9%               | 5.7%           | 4.7%                              |
| Android | 7.0%               | 3.8%           | 12.0%                             |
| Mac     | 4.5%               | 2.5%           | 6.7%                              |
| Windows | 2.4%               | 1.3%           | 3.5%                              |

New events say why from now on: `maia_model_lost` (with `days_since_saved`),
`maia_model_store_failed`, `maia_model_protected` (with `granted`). Also new:
`download_model_dismissed`, and `trigger` on `download_model_initiated` (`wall`, `auto`,
`tap`, `panel`).

```sql
-- Round 13: who gets Maia, and who stays, by group and device
SELECT properties.maia_prompt_variant AS grp, properties.$device_type AS device,
  uniqIf(person_id, event IN ('download_model_modal_shown', 'download_model_initiated')) AS needed_maia,
  uniqIf(person_id, event = 'download_model_completed') AS got_maia,
  uniqIf(person_id, event = 'download_model_dismissed') AS said_not_now,
  uniqIf(person_id, event = 'analysis_engine_steps') AS moved_through_a_game
FROM events
WHERE timestamp >= now() - INTERVAL 14 DAY AND properties.maia_prompt_variant IS NOT NULL
GROUP BY grp, device ORDER BY device, grp
```

Not tested: a real phone, whether browsers grant the request to keep the model (the test
browser refused it), and starting a drill on a phone.

## What changed

| commit                    | change                                                                                                                                                                                                                                                                                                                        | effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7dc2502                   | Stockfish: a superseded run no longer detaches the new run's listener; an abandoned search is stopped before MultiPV is reset; a new run always sends `stop`                                                                                                                                                                  | On `main` the first position froze at d14–17 once Maia's result arrived, and some positions never got past d9 when paging (no eval bar). After a move the next search waited up to 2.5 s behind the old one. Now: d18 on the first position, first depth ~0.3 s after each move                                                                                                                                                                                                                                                                                                                      |
| d371e75                   | Maia: requests queue on the main thread, one in flight; stale ones are dropped (ported from 6ba0cf2 on `human-bar`, without its priorities)                                                                                                                                                                                   | Maia after 10 rapid presses: 7.9–10.4 s → 1.75 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| a3b81ca                   | Stockfish starts 4 pthread workers instead of one per reported core                                                                                                                                                                                                                                                           | At 160 cores: 160 → 4 workers; pool ready 530 → 150–200 ms; renderer memory 1350–1480 → 1050 MB                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| eedf3a6                   | The Lichess PGN is fetched while the account loads; the stored analysis is fetched with the game, not after it, and shown as soon as it arrives                                                                                                                                                                               | Board ~0.1–0.2 s earlier; with stored analysis arriving 1 s late, it shows at 2.7 s instead of 3.5–3.7 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4acbb36                   | Maia runs the selected rating first (~0.1 s), then the other 20 in two batches; only complete rating sets are saved to the backend                                                                                                                                                                                            | Maia's moves 0.36–0.42 s after each move (was 1.5–1.7 s), ~1.3 s earlier on load                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ee6faa0                   | `maia.ts` no longer imports onnxruntime-web (only used for `Tensor`)                                                                                                                                                                                                                                                          | `_app` chunk 292 → 188 kB gzip; first-load JS of every page −103 kB (analysis page 711 → 608 kB)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 34486b0                   | Stockfish: renew the WASM heap view before copying the nets                                                                                                                                                                                                                                                                   | The copy failed on 3 of 26 test loads ("offset is out of bounds"), which re-downloaded the 78 MB of nets and started a second engine                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 74782ed                   | Stockfish: a superseded run returns before its multi-PV phase touches the engine                                                                                                                                                                                                                                              | Without it, a run superseded right after screening (e.g. on the last position, which has no played move to deepen) took the new run's `readyok`, and the new run froze (1 of 4 paging runs)                                                                                                                                                                                                                                                                                                                                                                                                          |
| 780ac64                   | Stockfish takes up Maia's candidate moves when it reaches the phases that use them, instead of the page restarting the analysis when Maia's policy arrives                                                                                                                                                                    | With Maia's answer at ~0.4 s the restart had thrown away the first search: depth 12 after a jump 1.4–2.1 s (was 0.8–0.9 s on `main`). First position d18 8.7–9.4 → 6.9–7.4 s                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 8239866                   | While Stockfish streams, the page re-renders at most every 150 ms (as React transitions); the moves-by-rating charts re-render only when their data changes; legal moves with SAN are cached per position                                                                                                                     | Each re-render had been a 50–85 ms main-thread task, which slowed the search (it is fed through the main thread). No long tasks during a jump; depth 12 after jumps back to `main`'s or better                                                                                                                                                                                                                                                                                                                                                                                                       |
| 137cb89, 74782ed          | Tests (`npm test` found none before)                                                                                                                                                                                                                                                                                          | 16 tests now; the Stockfish ones fail on `main`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 226a7f6                   | The analysis page builds a Lichess game from its PGN in the browser instead of waiting for `analyze_user_game` (which is still sent, unread, in case the backend records it). FENs as python-chess writes them; variants and set-up positions still go to the backend                                                         | Board on a return visit 1.33–1.76 → 0.59–0.68 s. Same FENs, moves, SAN, players and result as the backend for 45 Lichess games                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 123da37                   | The tournament game list is fetched once per analysis page load, not twice                                                                                                                                                                                                                                                    | One 41 KB request less                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3c2c65b                   | `"sideEffects": ["*.css", …]` in `package.json`, so webpack drops the modules a page doesn't use from barrels such as `src/components`                                                                                                                                                                                        | First Load JS: /settings and /leaderboard 600 → 321 kB, /blog/[id] 600 → 343, analysis page 610 → 493, home 343 → 320 kB. Every route renders as before (screenshots within 0.02%)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3b7c0ee                   | The Maia worker starts ONNX Runtime (with a one-node model) while it reads the 44 MB model from IndexedDB                                                                                                                                                                                                                     | Maia ready 2.04 → 1.75 s after navigation, its moves 2.50 → 2.28 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 38ec490                   | react-joyride (the first-visit tours) loads only when a tour starts                                                                                                                                                                                                                                                           | `_app` 165 → 136 kB gzip on every page; the tour appears at the same time                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3179c1f                   | Maia and Stockfish start 50 ms after the position changes, not 100                                                                                                                                                                                                                                                            | After a step: Maia 0.36 → 0.30 s, first Stockfish depth 0.27 → 0.21 s, depth 12 2.02 → 1.88 s; Maia after 10 quick presses 0.49 → 0.24 s                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 0bac57e                   | A small inline script in the page's HTML (new `_document.tsx`) starts the Lichess PGN request before the app's JavaScript has loaded                                                                                                                                                                                          | PGN in at ~0.23 s instead of ~0.67 s; board 0.66–0.74 → 0.58–0.64 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ff5c180                   | The same script starts the account request, on every page                                                                                                                                                                                                                                                                     | Account 0.26 → 0.13 s; analysis board 0.57 → 0.48 s. First visits to /turing, /play/maia and /play/hb no longer land on the "sign up for the beta" page (see below)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| b55d7ef, 3495708, 878e935 | Home page: the game carousel slides with a CSS animation instead of `scrollBy(0.5)` every 20 ms; the stats counters stop springing once their rounded number is final; an unused 3-second state update that re-rendered 36 boards is gone                                                                                     | The page no longer draws ~50 frames a second, each costing ~10 ms of compositing for the 36 small boards' ~1100 piece layers: main thread idle once the counters finish (~5 s) instead of ~55% busy for as long as the page is open; 5.7 → 3.9 s busy in the first 8 s                                                                                                                                                                                                                                                                                                                               |
| 5fcb2df                   | /play/maia and /play/hb start their game once the router has the URL's query                                                                                                                                                                                                                                                  | One `start_game` per visit instead of two (the first, with default settings, was abandoned); board 1.82–1.92 → 1.14–1.19 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8aac80c                   | /puzzles requests the next puzzle as soon as the current one's result is logged                                                                                                                                                                                                                                               | Next puzzle 1.94–1.99 → 0.19–0.22 s after pressing Next Puzzle (`new_puzzle` itself takes 1.6 s on the backend)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 46ba1fe, a6d0ae3          | The header's leaderboard badge and /leaderboard share one `auth/leaderboard` request; /analysis fetches the user's play games once                                                                                                                                                                                            | One request instead of two on /leaderboard, one instead of three on /analysis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| facc72e                   | `analysis-probe.mjs --proxy`, `stub-proxy.mjs` and `page-probe.mjs`: measurements with the browser's HTTP cache on (see "How it was measured")                                                                                                                                                                                | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2bb82ee, 6df5d6a          | Home page: the board grid is no longer rebuilt 100 ms after it comes into view (every time it does), and its 36 boards are drawn with chessground's elements and styles but without a chessground instance each, so pieces are placed by `left`/`top` and get no compositing layers                                           | Home page vs `main`: blocking time 462 → 272 ms, main-thread time in the first 8 s 5.6 → 2.2 s (layerize 2.7 → 0.14 s); with the grid in view 10.4 → 3.5 s over 15 s. The grid's screenshots match `main`'s at four window sizes                                                                                                                                                                                                                                                                                                                                                                     |
| 4fe06c3                   | The Maia worker starts ONNX Runtime early only once it has found a cached model (3b7c0ee started it as soon as the worker loaded)                                                                                                                                                                                             | A first visit to /analysis, /puzzles, /drills, /settings or /broadcast no longer downloads ORT's WebAssembly (3 MB compressed) before Maia is downloaded. On the phone on Slow 4G that had delayed the icon font and the analysis page's load event from 14 to 22 s. Returning visitors: Maia as before (2.25–2.57 s vs 2.27–2.94 s)                                                                                                                                                                                                                                                                 |
| 022c3c5                   | Home page: the small boards are drawn after the first paint (measured in an effect, not a layout effect)                                                                                                                                                                                                                      | On the phone the hero text painted at 833 ms (median of 14 loads) against `main`'s 724; now 720 vs `main`'s 822 in six paired loads. Screenshots of the grid unchanged                                                                                                                                                                                                                                                                                                                                                                                                                               |
| bef0994                   | Stockfish: when reading its cached nets takes over 1.5 s, the download starts, but the cached copy is used if it arrives first (the download is then cancelled)                                                                                                                                                               | On the phone every returning visit had downloaded 78 MB again (`main` too) and shown Stockfish's first depth at 77–83 s; now the cache is used, first depth 12.3–18.6 s. Desktop: unchanged (the read takes ~0.1 s)                                                                                                                                                                                                                                                                                                                                                                                  |
| 65fc6a8                   | The icon font is requested with Google Fonts' `icon_names` for the 82 icons the site shows (`src/constants/materialSymbols.ts`, used by `_app` and the error page); a test checks the icon names it finds in the code against the list                                                                                        | Font 1.14 MB → 29 KB on every first visit. On the phone on Slow 4G icons show at 4.6–5.8 s instead of 12.9–14.6 s (`main`); every route's icons are the same as on `main` (41 names seen, header and menu screenshots identical)                                                                                                                                                                                                                                                                                                                                                                     |
| 21d7dc1                   | Home page: the Analysis and Train sections draw their board and chart once the section is within a screen of the viewport                                                                                                                                                                                                     | Phone, returning visit: blocking time 2.89 → 1.93 s, main-thread time 6.00 → 4.78 s. Sections look the same once scrolled to (one overlapping chart label can stack differently)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 3bf9e38                   | Maia's inputs for a position are computed once and kept for the last 8 positions, instead of once per rating (21 times)                                                                                                                                                                                                       | Paging on a phone-size page at full speed: 336 → ~23 ms of chess.ts per 8 steps. With 86db02d, on the phone: Stockfish's depth when the next step comes 5–6 → 7, first depth after a step 0.79–0.86 → 0.64–0.69 s                                                                                                                                                                                                                                                                                                                                                                                    |
| 86db02d                   | The Options/Export and desktop Moves/Select Game tab bars are one memoized `UnderlineTabs` component, so they render only when their tab changes                                                                                                                                                                              | framer-motion forced a layout on every engine update for their sliding underline: 144 ms per 13 s of paging at full speed, now none. The underline slides the same way                                                                                                                                                                                                                                                                                                                                                                                                                               |
| d0c4931                   | The analysis page's `<Head>` is a memoized component                                                                                                                                                                                                                                                                          | Next.js no longer rewrites the head on every engine update (41 ms per 13 s of paging)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4a99de8                   | Maia's ONNX session uses graph optimisation `'basic'` instead of the default `'all'`                                                                                                                                                                                                                                          | On 157 positions of the two games at all 21 ratings, `'basic'` gives exactly the unoptimised model's probabilities and win chances; `'all'` moved probabilities by up to 0.64 points, shown one-decimal values in 4310 of 23355 cases and the top move in 5 (near-ties). An earlier note here ("logits change by up to 0.047") came from random boards and raw scores. Paired loads: Maia's moves 0.34 s sooner on a desktop, 1.18 s on the phone; Stockfish unchanged within noise (desktop depth 12/18 +64/+60 ms, later in 9 of 16 pairs); Maia after each step 162–169 → 173–179 ms on a desktop |
| 54d824d                   | The moves-by-rating chart waits for every rating's moves                                                                                                                                                                                                                                                                      | Since 4acbb36 the chart was drawn after the selected rating's answer with the other 20 ratings at 0% (95% of its points on the 0% line after every step); it now moves from the previous position's curves to the new ones, as on `main`, at about the same time (1.52–1.95 s after a step against 1.70–1.92 s)                                                                                                                                                                                                                                                                                      |
| f555c4c                   | Maia answers for the selected rating, then every 200 points (600–2600), then the ratings in between; the moves-by-rating chart is drawn from the 200-point ratings, the ones in between interpolated until they arrive (within 0.45 percentage points for 90% of points, at most 2.3); the later stages render as transitions | After a step the chart starts moving at 0.90–1.11 s on a desktop instead of 1.42–1.49 s, and at 3.7–4.7 s on the phone. Stockfish while paging unchanged (depth 12 after a step 1.36–1.47 s vs 1.44–1.51 s); rendered at once, the extra render had delayed it by ~0.15–0.25 s                                                                                                                                                                                                                                                                                                                       |
| 6a82f41                   | The moves-by-rating charts of the analysis page's mobile layout, the opening drill analysis and /openings get the current position (`positionKey`)                                                                                                                                                                            | They only took new data with it, so on a phone the chart stayed empty while moving through a game (on `main` too)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 943d0a0, b7ff773          | Probes: `--mobile`, `--net` and `--slowdown` (with `cpu-slowdown.py`); net read times and downloads                                                                                                                                                                                                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| e6b6e79                   | Probes: the phone keeps its touch emulation (a second CDP session turned it off)                                                                                                                                                                                                                                              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 3c3bee3                   | The moves-by-rating chart draws only when what it shows changes: once per update (not twice), and only for its own moves' colors                                                                                                                                                                                              | Phone: 3–10 chart draws per move instead of 16–26; Stockfish's depth 12 after a step 2.27 s sooner (24%, on all 16 positions). Desktop: depth 12 0.05 s sooner, depth 18 unchanged                                                                                                                                                                                                                                                                                                                                                                                                                   |
| facd303                   | Maia: on a desktop every 400 points first (the chart drawn from them), then every 200, then the rest; on a phone every 200 points in one request and no more, the ratings in between interpolated in the chart and the board description                                                                                      | Desktop: the chart starts at 0.48 s instead of 0.72 s; Stockfish unchanged. Phone: chart drawn and complete at 3.44 s instead of 3.66 and 5.87 s; depth 12 0.35 s sooner                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 22d3054                   | Maia starts again in a new worker (after 1 s, then 3 s) when ONNX Runtime can't reserve its memory, as on an iPhone after a reload                                                                                                                                                                                            | Before, the page showed "Failed to load Maia model: … RangeError: Out of memory". With the first worker made to fail that way, Maia's moves showed at 4.7 s with no error                                                                                                                                                                                                                                                                                                                                                                                                                            |
| b7d57f7                   | Maia's worker caps ONNX Runtime's shared memory at 512 MB instead of 4 GB (Maia uses ~110 MB, ~190 MB for 21 ratings)                                                                                                                                                                                                         | After an iPhone reload Maia failed to start ("RangeError: Out of memory", also on maiachess.com); 22d3054's restart did not help there. With the cap, reloading worked on an iPhone                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 380bb2b                   | Phone layout: Maia's and Stockfish's move lists keep room for 4 rows and the position description for 4 lines, so paging no longer moves what is below them                                                                                                                                                                   | Emulated iPhone, scrolled down while paging (6 steps): layout shift 1.55 before (1.02 on `main`), 0.05 after                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| c17afbd                   | `/ort`, `/stockfish`, `/assets`, `maia-worker.js` and `analytics.js` are served with `stale-while-revalidate` (7 days)                                                                                                                                                                                                        | A returning visitor no longer waits 155-490 ms per file (one after another as Maia and Stockfish start) for the server; a changed file is used from the following visit                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 8a1c793                   | /drills loads the endgame positions (~480 KB) when the Endgames tab is used, not with the page                                                                                                                                                                                                                                | First Load JS 602 -> 501 kB; phone first visit 728 -> 641 KB, blocking time 3.22 -> 2.75 s; returning visit 2.03 -> 1.57 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 0232ac5                   | The analysis game list's tabs are memoised                                                                                                                                                                                                                                                                                    | framer-motion no longer measures the page on every engine update (measureScroll 249-275 ms per 8 desktop moves, now none)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 58b7747                   | The Maia/Stockfish panel checks for checkmate once per position                                                                                                                                                                                                                                                               | 34-42 ms of chess.ts per 8 desktop moves, now none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 1c3af9a                   | The analysis sidebar renders only its shown layout (xl or smaller)                                                                                                                                                                                                                                                            | With 0232ac5 and 58b7747: main-thread busy while paging on a desktop 16% less; depth 12 0.35 s sooner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| e6d0417                   | The tour provider watches the page for the download window only while a tour runs                                                                                                                                                                                                                                             | It searched the whole page on every DOM change on every page; home page querySelector 36-39 ms -> 0-8 ms in the first 8 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7126951                   | Stockfish waits up to 20 s for a cached net it has found, instead of 1.5 s, before downloading it too                                                                                                                                                                                                                         | Phone, returning visit: nets downloaded again in 2 of 6 visits instead of 6 of 6; first depth 13.7 -> 11.9 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 31452ae                   | Stockfish's cache lookup timeout counts 100 ms timer ticks, so time the page is too busy to take the answer does not count                                                                                                                                                                                                    | Phone, returning visit: the lookup timed out (and the download started) in 0 of 12 visits instead of 5 of 12; Stockfish's timings unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 903191a                   | /settings and /profile wait for the account before sending guests home                                                                                                                                                                                                                                                        | A signed-in user who opened or reloaded either page was sent home                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4274479                   | A 404 page in the site's style                                                                                                                                                                                                                                                                                                | Unknown URLs showed Next.js's unstyled 404                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 281c0e6, abdf95b          | The home headline fits phones (sized to fit) and wraps on tablets                                                                                                                                                                                                                                                             | It was cut off on every phone and ran 22-137 px into the feature grid on tablets                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8dd059b, 27f05ce          | Board buttons, the Discord icon and the Maia model and round selects are labelled                                                                                                                                                                                                                                             | Controls without an accessible name: 31 -> 0 over all routes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 38d4304                   | Every page renders its title and description outside the auth wrapper and loading states                                                                                                                                                                                                                                      | Server HTML of 8 routes had no title or description; now all do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 8a9093f                   | Blog dates in UTC; unknown posts 404                                                                                                                                                                                                                                                                                          | Dates were a day early west of UTC                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 46e45c0                   | Wording, empty-list messages, footer links, mobile menu                                                                                                                                                                                                                                                                       | See "Round 3"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 92ced56                   | Debug console.log calls removed from move, drill and broadcast code                                                                                                                                                                                                                                                           | The move list logged (and walked the main line twice) on every move                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 9cd8ee1                   | Blog post titles are one string; the post page has no fallback; Lichess error replies are skipped                                                                                                                                                                                                                             | Titles read "...<!-- --> - Maia Chess" in the HTML; unknown posts answered 200                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6cf2da3, 591f5ea          | Broadcast round pages fetch the broadcast by id and open the round in the URL                                                                                                                                                                                                                                                 | Older broadcast links loaded forever; links opened the default round                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| fc04dbe                   | The leaderboard shows an error with Retry when its request fails                                                                                                                                                                                                                                                              | It spun forever                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| c635868                   | The page area is a screen tall on desktop too                                                                                                                                                                                                                                                                                 | Desktop CLS: /broadcast 0.127 -> 0.001, /puzzles 0.049 -> 0.001, others 0.025-0.027 -> 0-0.001                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 0aed6a5                   | The AudioContext is created after the first gesture, not on load                                                                                                                                                                                                                                                              | 57-60 ms of main thread off every page load (desktop)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8157834                   | The AudioContext stays suspended until a sound plays                                                                                                                                                                                                                                                                          | Created after a gesture it ran (silently) for the rest of the visit, also on analysis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| c7a4fd5                   | The header menus open on keyboard focus and click, close on focus out and Escape                                                                                                                                                                                                                                              | Keyboard users could not reach the PLAY, MORE and user menus                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| d238090                   | A plain message when a custom game cannot be imported                                                                                                                                                                                                                                                                         | The toast showed the HTTP status and the raw backend reply                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 0fd3ef5                   | Keeps the Canadian spelling of "favourite"                                                                                                                                                                                                                                                                                    | See "Round 3"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 43dba6e                   | The /401 page asks visitors to try again instead of to join the beta                                                                                                                                                                                                                                                          | See "Round 3"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4819438                   | /candidates links to the big tournament on now                                                                                                                                                                                                                                                                                | See "Round 3"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 441a1de                   | Model names with a hyphen (Maia-2, Maia-3)                                                                                                                                                                                                                                                                                    | See "Round 3"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| be4b6ea                   | Rating models named Maia-3 1100 (Maia-1 1100 for the Lichess bots)                                                                                                                                                                                                                                                            | See "Round 3"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 31abb1d                   | Stored games name the model that played them, by the game's date                                                                                                                                                                                                                                                              | See "Round 3"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| bb90e63                   | Saved game names name the model that played                                                                                                                                                                                                                                                                                   | See "Round 3"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8383bc0                   | The /broadcast list starts no engine; /drills and /puzzles start Stockfish once the page has loaded                                                                                                                                                                                                                           | See "Round 4". /broadcast, phone, first visit: no 76 MB download, main-thread work 9.2 → 4.3 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 017694c                   | Engine pages bring their own providers, so the engines' code and Maia's move tables load only with them                                                                                                                                                                                                                       | First Load JS shared by all pages 308 → 235 kB; home, phone, first visit: main-thread work 11.0 → 7.9 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 1ab0ce1                   | The leaderboard and the broadcast list render their headings at once (the leaderboard with placeholder rows)                                                                                                                                                                                                                  | Phone, main content: /leaderboard 3.2 → 0.9 s, /broadcast 4.8 → 0.7 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8fb8652                   | The broadcast list doesn't wait for the visitor's session (it asks only Lichess)                                                                                                                                                                                                                                              | Its heading is in the server HTML                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 181412c                   | The home page's stats counters count up in 1.5 s instead of springing for ~3 s                                                                                                                                                                                                                                                | Desktop, home: main-thread work 2.65 → 2.04 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| d6ef8b9                   | The home page's stats counters count up in 0.5 s                                                                                                                                                                                                                                                                              | Not measured separately                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| e4f9e79                   | An empty board drawn with CSS alone, for page shells (`EmptyBoard`); the visitor's saved board theme is applied before the first paint                                                                                                                                                                                        | Used by the two shells below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| c5b0da6                   | Bot or Not renders its layout (panels, empty board, guess form) before its game loads, on the server too, with the phone or desktop layout chosen by CSS                                                                                                                                                                      | Phone: page on screen 3.6 → 0.71 s (first visit), 2.5 → 0.60 s (returning); game fully visible at the same time or sooner; layout shift 0                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 0bcfe0a                   | The puzzles page renders its layout before the visitor's session and the puzzle load, and between puzzles                                                                                                                                                                                                                     | Phone: page on screen 4.9 → 0.77 s (first visit), 3.6 → 0.54 s (returning); puzzle fully visible 6.1 → 6.3 s, 5.1 → 4.5 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4e46a23                   | The analysis pages render their layout (panels, bars, empty board, blunder meter, controls) before the session and the game load; /analysis shows it while it finds a game to open                                                                                                                                            | Phone: page on screen 6.2 → 0.94 s (first visit), 2.2 → 0.72 s (returning); game fully visible 7.3 → 6.0 s, 3.7 → 3.1 s; desktop 1.02 → 0.65 s                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| e92f4a5                   | A page's shell is built once, and not at all while the app hydrates (`PageShell` keeps the server's HTML); after a link within the app only the window's layout renders                                                                                                                                                       | Undid the first analysis shell's cost on the phone (game ~0.5 s later, ~0.7 s more main-thread work on first visits)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3c00156                   | /play's setup dialog prefetches the game page; /play/maia shows the game without fading in                                                                                                                                                                                                                                    | From choosing a side to the game fully visible: phone 1.98–2.35 → 1.42–1.57 s, desktop 1.32–1.70 → 0.99–1.14 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 387921b                   | PostHog (out of Next's start-up chunk) and Google Analytics load once the page has loaded and the browser is idle; events tracked before then are queued                                                                                                                                                                      | Shared JavaScript 237 → 181 kB; phone: analysis game 3.58 → 3.13 s, /play dialog 2.51 → 2.29 s; choosing on /play the instant the dialog appears 0.1–0.4 s slower                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 02afe94                   | LCP is sent by an observer that starts before the app, so visitors who tap before PostHog has loaded send it too                                                                                                                                                                                                              |
| b04ed0c                   | /play's setup dialog is in the server's HTML, without its entrance animation; it ignores taps until the app has started                                                                                                                                                                                                       | Phone: dialog on screen 1.64 → 0.58 s; desktop 0.45 → 0.30 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 30d4a55                   | /play/maia shows the game, its board at the starting position, while `start_game` answers; moves and their logging wait for the game's id                                                                                                                                                                                     | After choosing, the board with its pieces: phone 1.99 → 1.29 s, desktop 1.02 → 0.46 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| f3d1b7a                   | The setup dialog sends `start_game` as the visitor chooses; /play/maia takes that request                                                                                                                                                                                                                                     | After choosing, the board takes moves: phone 1.60 → 1.29 s, desktop 0.90 → 0.83 s (with 30d4a55)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| c16c4fa                   | The Moves by Rating chart (recharts, ~320 KB) loads with `next/dynamic` once its panel renders                                                                                                                                                                                                                                | Analysis start-up JavaScript 417 → 311 kB; game fully visible: phone 2.65 → 2.56 s, desktop 0.65 → 0.59 s; chart 0.02–0.15 s later                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Things you will notice

- **Stockfish 19.** The analysis page now names Stockfish 19, and "d18" means the best
  line has reached depth 18, with the other lines filling in afterwards (round 10).
- **First visits to /turing, /play/maia and /play/hb** now show the page. On
  `main` a new visitor's page requests (`turing/new_game`, …) went out before
  the account request had created their guest session, got a 401, and sent
  them to "Sign up for the beta"; a second visit showed the page.
- **The home page's game carousel moves in Chrome.** It moved by
  `scrollBy(0.5)`, which Chrome rounds to nothing, so on maiachess.com it
  stands still in Chrome; it now slides at the intended 25 px/s everywhere.
- **/play/maia and /play/hb create one game per visit**; `main` also created
  an abandoned one with the default settings (Maia-3 1100, white).
- **Promotions** in a Lichess game keep their piece in the move (`a7a8q`), as
  Stockfish and Maia write moves; `analyze_user_game` dropped it.

- **On a desktop, a page shorter than the screen** (/blog, /404) no longer
  shows the start of the footer without scrolling (c635868), as on phones
  since 95da846.
- **Broadcast links open the round they name** (591f5ea); before, every
  link opened the broadcast's default round.
- **/candidates links to the big tournament on now** (4819438), or to the
  broadcast list, instead of the 2026 Candidates.
- **A failed request shows "Something went wrong"** with Try again
  (43dba6e), not the beta sign-up page.

- **Opening a broadcast round starts the engines** (8383bc0): the list no
  longer warms them up, so on a first visit Stockfish's nets download when
  the round opens.
- **On /drills and /puzzles, Stockfish starts once the page has loaded**,
  0.8–1.6 s later on a returning phone visit, 2–3 s on a first one.
- **The leaderboard shows its columns with grey placeholder rows** until the
  rankings arrive, and no longer fades in.
- **The home page's counters** count up in 0.5 s.
- **Analysis, Bot or Not and /puzzles show their layout at once**, with an
  empty board, instead of a blank page and then an animated loading board;
  the game or puzzle appears in place without fading in. Between puzzles and
  Bot or Not games the page keeps its frame while the next one loads.
- **A game against Maia appears without fading in** after choosing a side on
  /play.
- **/play shows its setup dialog at once**, without its slide-in; it takes
  taps once the app has started. After choosing a side, the game appears at
  once and takes moves once the backend has created it.
- **The Moves by Rating chart fills in a moment after its panel** (0.02–0.15
  s later than before).
- **PostHog and Google Analytics start a second or more later**: PostHog's
  page view is stamped when it starts, and visitors who leave within the
  first seconds may not be counted.
- **Bot or Not's White/Black switch** starts with its knob in the middle;
  it used to slide there each time a game appeared.

## Looked at, not changed

- **Reading Stockfish's cached nets in a worker** (on the phone the read
  took 1.4–3.9 s during page load): first depth unchanged (9.1–11.2 s
  against 9.1–12.9 s). Most of the time is IndexedDB itself (opening the
  database and getting the record took 0.5–1.4 s), not the main thread.
- **Reading the nets while the engine module starts**, again on the phone
  (by the names the bundled engine asks for): the read then competed with
  the page's start-up (3.7–4.9 s instead of 1.6–2.2 s); first depth 0.6 s
  sooner on one game, the same on the other, and depth 18 on the desktop
  slightly later on one game (5.18 → 5.45 s median), so it was dropped.
- **Maia's start-up on a phone**: of the ~8 s until its first moves, 4.4 s
  was creating the ONNX session (about 1 s on a desktop); reading the 44 MB
  model in its worker takes 0.26 s. 4a99de8 (graph optimisation `'basic'`)
  takes ~1.2 s off it.
- **recharts' legend** measures itself after every chart update (a forced
  layout, 168 ms per 13 s of paging at full speed), but mostly that is
  layout the next frame would do anyway.
- **More Stockfish threads.** 2–3 threads made depth 12 after a step ~13%
  faster but jumps no faster, delayed the first depth on load, and make the
  search non-deterministic.
- **A larger Stockfish hash** (64 or 128 MB instead of 16): no faster.
- **Reading Stockfish's nets earlier**, while its module starts (twice, in
  both rounds): the reads finished at the same time.
- **Decoding Stockfish's net faster.** The 0.74 s is Stockfish decoding the
  LEB128-compressed big net; an uncompressed copy would double the 75 MB read.
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
- **Every 400 points first on a phone**: the chart came ~0.9 s sooner, but
  Stockfish's depth 12 ~0.5 s later (see "Moving through a game on the
  phone").
- **Maia per rating.** Each rating is a full pass of the network (the rating
  is one of its inputs), ~0.22 s on the emulated phone. A batch of 10
  ratings in Node (ORT, 4 threads) took 439 ms with the fp16 model. A
  32-bit copy took 398 ms, but is 91 MB instead of 46 MB (probabilities
  within 0.57 percentage points). An 8-bit copy took 271 ms at 25 MB, but
  moved probabilities by up to 15.6 points and changed the top move in 116
  of 3,297 cases.
- **Stockfish on pages that do not need it yet.** /puzzles, /drills and
  /broadcast start Stockfish when they open, so a first visit downloads its
  ~77 MB of nets (on a phone, over mobile data) even on the drill selection
  screen or the broadcast list. /puzzles analyses the position in the
  background so the result shows as soon as the puzzle is solved, and drills
  give Stockfish only 5 s to be ready before skipping a position, so
  starting later would slow those down; left for a decision (for example,
  start on /drills when a drill begins and on /broadcast only in a round).
- **Memoising /drills' category tabs** (the same fix as 0232ac5): no
  measurable change; the page's framer-motion measuring comes from elsewhere.
- **Maia's model download.** 44 MB from Vercel on a first visit; it
  compresses only ~9% (Vercel already serves it with Brotli, 41.7 MB). It
  could be served from a CDN like Stockfish's nets (#321) to save Vercel
  bandwidth.
- **Google Analytics' script** costs 35–65 ms of main thread on every page
  (four times that on a slow phone); loading it later would miss short
  visits.
- **Re-rendering less often for Stockfish's updates on phones** (300 ms
  between renders instead of 150): no change in Stockfish's depth 12 after a
  step on the emulated phone (6 ± 267 ms later over 48 steps).
- **A 3 s timeout for finding Stockfish's cached nets** (after 7126951): the
  nets were downloaded again in 1 of 6 returning visits on the emulated phone
  instead of 2 of 6, and Stockfish's timings were within noise. 31452ae
  counts the timeout in timer ticks instead.

- **The home page's animated counters** (round 3): the CPU profile put
  33–50 ms of a first visit on their formatting function, but formatting a
  number costs about 2 µs in Chromium (a shared `Intl.NumberFormat` is no
  faster); the time is the counters' per-frame updates.
- **Stockfish and Maia on the /broadcast list**: the page starts both
  engines (Stockfish's 77 MB on a first visit) because `_app.tsx` matches
  any path containing `/broadcast`. Left for a decision: it helps a visitor
  who opens a round next.
- **The Stockfish debug panel** reads localStorage and sets new state every
  500 ms on engine pages, re-rendering a component that renders nothing
  while the panel is off: negligible.
- **The duplicate `analysis-game-list` id** on desktop analysis (the game
  info panel and the game list): the tour's "Game Selection" step targets
  it, so changing it changes what the tour highlights.

- **Next.js prefetching linked pages** (round 4): on the home page Next.js
  downloads, and when the browser is idle runs, the code of the pages its
  links point to (analysis, puzzles, drills, Bot or Not), engine code
  included. Turning it off (emulated phone) saved 168 KB of JavaScript but
  no main-thread time in the first 12 s, and would make those pages open
  more slowly.
- **The home page on a slow phone** (round 4) keeps the main thread busy for
  ~10 s at a quarter speed: hydrating the page, the Play section's grid of
  36 boards (~1,300 piece images painted), the sections, Google Analytics.
  Earlier rounds already cut most of what is cheap to cut; more would mean
  design changes. Measured by leaving each out (5 loads each, main-thread
  work, medians): without the 36-board grid, phone 6.8 → 5.8 s on a first
  visit and 5.1 → 4.3 s on a returning one, desktop 1.29 → 0.94 s; without
  the game carousel (the strip of game names under the hero), no measurable
  change (phone 7.4 and 5.8 s, desktop 1.24 s).
- **Shells for the app pages** (round 4): analysis, Bot or Not and /puzzles
  have them since round 5; for /drills and the site header see "Round 5".

## Rebasing `human-bar`

- Round 10 removes `loadNnueModel`, the net download and the IndexedDB cache from
  `stockfish.ts`, so `human-bar`'s `loadNnueModelShared` and its second engine
  need rewriting for one 1.2 MB net fetched from `public/stockfish`.
- d371e75 makes the same change to `useEngineAnalysis.ts` as 6ba0cf2, and its
  `maia.ts` part is 6ba0cf2 without the priority levels. When rebasing 6ba0cf2,
  keep its priorities in `maia.ts` and take this branch's `useEngineAnalysis.ts`
  (4acbb36 changed the Maia effect further).
- `stockfish.ts`: this branch changes the `createInstance()` call lines (pool
  cap) and the `setNnueBuffer` lines, and bef0994 rewrites `loadNnueModel`'s
  body (same signature) and adds `downloadNnueModel` after it. Merging
  `human-bar` (fa694e7) gives two conflicts in this file, the same before and
  after bef0994: both branches add a function right after `loadNnueModel`
  (`setNnueBuffer` here, `loadNnueModelShared` there). Keep both;
  `loadNnueModelShared` calls `loadNnueModel` as before.
- Because of a3b81ca, `human-bar`'s second engine also starts 4 workers instead
  of one per core.
- The commits after 3e0e504 (icon subset, home sections, Maia's inputs, tab
  bars, `<Head>`) add no merge conflicts with `human-bar` (fa694e7): the
  conflicting hunks per file are the same before and after them.
- 780ac64 and 8239866 change the Stockfish effect in `useEngineAnalysis.ts`, the
  staged run in `stockfish.ts` and `StockfishStreamOptions`; 3179c1f replaces
  the two `100` ms delays in `useEngineAnalysis.ts` with `ANALYSIS_DELAY_MS`;
  3b7c0ee adds a few lines at the top of `public/maia-worker.js`. `human-bar`
  doesn't touch those parts.
- facd303 adds one conflict hunk in `useEngineAnalysis.ts` (the stage list
  now sits before `attemptMaiaAnalysis`; this side only adds lines there);
  3c3bee3 adds none.
