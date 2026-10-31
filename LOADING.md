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

## Rebasing `human-bar`

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
