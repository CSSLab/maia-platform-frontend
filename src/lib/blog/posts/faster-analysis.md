---
title: 'A Faster Analysis Page'
date: '2026-11-11'
tags:
  - chess
  - maia
  - stockfish
  - platform
excerpt: >-
  The analysis page now runs Stockfish 19, shows the best move first, and appears in less than half the time. Here is what changed and what we measured.
---

Much of our recent work went into how quickly the analysis page becomes useful, especially on phones.

## Stockfish 19

The page now runs Stockfish 19 with its small network. The network it has to download fell from 78 MB to 1.2 MB, and the engine needs about 80 MB of memory where it used to need about 500 MB, which matters most on a phone.

It is also quicker to answer: on a desktop, a position reaches depth 18 in about 3.1 seconds, down from 5.1s.

## The best move first

Stockfish used to search its top four lines together, so nothing reached full depth until all of them had. It now takes its best line to full depth alone, and then fills in the others.

## The page itself

- The board is on screen in about 0.6 seconds, where it used to take 1.4s to 1.8s.
- Maia's moves appear about 0.3 seconds after each move you step through, down from about 1.5s.
- The moves-by-rating chart is drawn from a few rating levels first and filled in as the rest arrive.

## Maia-3 without the wait

On a desktop, the Maia-3 model now downloads in the background the first time you visit, with a small progress card, in place of a prompt that blocked the page. It is downloaded once and kept by your browser.

For everything else that changed, see [What's New on Maia Chess](/blog/2026-november-update).
