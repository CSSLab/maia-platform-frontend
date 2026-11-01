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

**Engines only where they're needed (0ccb31b).** The /broadcast list
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

**Engine code only on engine pages (930e78d).** `_app.tsx` imported the
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

**Headings at once (d368f65, d2849bc).** The leaderboard and the broadcast
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

**The home page's counters (a0b4279).** The three stats counters sprang
from 0 to tens of millions, which took ~3 s to settle, re-laying out the
hero on every frame (their `duration` was ignored by the spring); they now
count up in 1.5 s. Desktop, home, main-thread work over the load and 6 s:
2.65 → 2.04 s (every run lower). On the emulated phone no change: there
the main thread is saturated for ~10 s anyway and draws fewer frames.

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
| 0ccb31b                   | The /broadcast list starts no engine; /drills and /puzzles start Stockfish once the page has loaded                                                                                                                                                                                                                           | See "Round 4". /broadcast, phone, first visit: no 76 MB download, main-thread work 9.2 → 4.3 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 930e78d                   | Engine pages bring their own providers, so the engines' code and Maia's move tables load only with them                                                                                                                                                                                                                       | First Load JS shared by all pages 308 → 235 kB; home, phone, first visit: main-thread work 11.0 → 7.9 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| d368f65                   | The leaderboard and the broadcast list render their headings at once (the leaderboard with placeholder rows)                                                                                                                                                                                                                  | Phone, main content: /leaderboard 3.2 → 0.9 s, /broadcast 4.8 → 0.7 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| d2849bc                   | The broadcast list doesn't wait for the visitor's session (it asks only Lichess)                                                                                                                                                                                                                                              | Its heading is in the server HTML                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| a0b4279                   | The home page's stats counters count up in 1.5 s instead of springing for ~3 s                                                                                                                                                                                                                                                | Desktop, home: main-thread work 2.65 → 2.04 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Things you will notice

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

- **Opening a broadcast round starts the engines** (0ccb31b): the list no
  longer warms them up, so on a first visit Stockfish's nets download when
  the round opens.
- **On /drills and /puzzles, Stockfish starts once the page has loaded**,
  0.8–1.6 s later on a returning phone visit, 2–3 s on a first one.
- **The leaderboard shows its columns with grey placeholder rows** until the
  rankings arrive, and no longer fades in.
- **The home page's counters** count up in 1.5 s.

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
  ~10 s at a quarter speed: hydrating the page, the carousel's 36 boards
  (~1,300 piece images painted), the sections, Google Analytics. Earlier
  rounds already cut most of what is cheap to cut; more would mean design
  changes (fewer boards, or each board drawn as one image).
- **Shells for the app pages** (round 4): see "Not done: the app pages".

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
- facd303 adds one conflict hunk in `useEngineAnalysis.ts` (the stage list
  now sits before `attemptMaiaAnalysis`; this side only adds lines there);
  3c3bee3 adds none.
