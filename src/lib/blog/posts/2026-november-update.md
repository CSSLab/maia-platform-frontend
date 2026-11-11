---
title: "What's New on Maia Chess"
date: '2026-11-11'
tags:
  - maia
  - platform
  - update
excerpt: >-
  Over the past few weeks we have reworked large parts of Maia Chess: a practice mode with takebacks, games you can come back to, a much faster analysis page, an improved rating system, new analysis tools, and many fixes you asked for on Discord.
github: https://github.com/CSSLab/maia-platform-frontend
---

Over the past few weeks we have gone through nearly every page of Maia Chess. Some of the changes are new features, many are fixes, and a great deal of the work went into making the site faster, especially on phones. Much of it started as a request or a bug report on our Discord, so thank you to everyone who wrote in.

Three of the changes have posts of their own:

- **[Practice mode, and games you can come back to](/blog/practice-mode).** Play Maia with takebacks and extra time, close the tab in the middle of a game and continue it later, and find the setup dialog as you left it.
- **[A faster analysis page](/blog/faster-analysis).** Stockfish 19, the best move shown first, and a page that appears in less than half the time.
- **[An improved rating system](/blog/rating-system).** Ratings now say when they are still provisional, and profiles and the leaderboard explain where you stand.

The rest is below.

## New in analysis

**Endgame tablebases.** In positions with seven pieces or fewer, the analysis panel shows the exact result from the Lichess tablebase ("Mate in 22", "Draw") along with the best moves, which you can preview by hovering and play with a click.

**Variations.** Importing a PGN keeps its variations, and exporting one writes yours out, with correct move numbers. Exported games against Maia now carry the date, time control and ratings.

**Engine controls.** You can switch Stockfish off to see Maia alone, and choose the depth of live analysis, from 12 to 25.

**Getting around.** Mousewheel scroll over the board to step through the moves. "Analysis" in the top bar now opens a menu that takes you straight to your games against Maia, your Lichess games, your imported games or your favourites. If your browser closes a background tab to save memory, the page reopens on the move you were looking at, with the lines you had tried still there. And game lists now say when each game was played.

**Lichess studies.** The custom analysis dialog accepts a link to a Lichess study or chapter and lets you choose which chapter to import.

**Learn from mistakes** now goes through the same mistakes each time you review a game, and "See solution" shows the best move as an arrow on the position you were asked about.

## Broadcasts

The broadcast page shows both players' clocks beside their names, running for the side to move in a game in progress. It also remembers the Maia rating level you chose, separately from the analysis page.

## Everywhere else

- **Settings without an account.** Sound, board theme and the downloaded Maia model can now be changed by visitors who aren't signed in, from the gear icon in the header.
- **A news box on the homepage**, where announcements like this one will appear.
- **Signing in** is now a clear "Sign in with Lichess" button, and a failed request now leads to a page with a "Try again" button (instead of a sign-up page for a beta that has ended, as before).
- **Keyboard and screen readers.** The header's menus open from the keyboard, and the board's buttons are labelled.
- **Forced dark modes** in browsers and extensions no longer turn Black's pieces white.
- Puzzles reopened as Black are shown from Black's side, drills keep their queue through a refresh, and Bot or Not shows the game's result before you guess.

## Thank you

Many of these changes came from reports and requests in our Discord. If something is broken, confusing or missing, that is the best place to tell us: [discord.gg/Az93GqEAs7](https://discord.gg/Az93GqEAs7).
