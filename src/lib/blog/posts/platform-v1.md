---
title: 'Introducing Maia Platform v1'
date: '2025-07-10'
tags:
  - chess
  - maia
  - human-ai
excerpt: >-
  We release MaiaChess v1, a major update to our platform for human-aligned chess analysis. Powered by the new Maia-2 model, the platform combines neural predictions with engine insights to provide detailed, rating-aware feedback on games, drills, and puzzles.
github: https://github.com/CSSLab/maia-platform-frontend
image: all_lineplot.png
---

We are thrilled to announce the beta launch of Maia Chess v1. This release represents a significant step forward in our goal of providing a more human-centered chess analysis experience, combining insights from neural models trained on human games with traditional engine-based evaluation.

Version 1.0 includes major changes across all core functionalities, beginning with the introduction of the Maia-2 model. These updates affect every part of the user experience and introduce new tools for analysis, training, and gameplay exploration.

## Introducing the Maia-2 Model

The most substantial change in v1 is the adoption of the new Maia-2 model, a new version of our neural network trained to predict human moves at various rating levels. As a unified model, Maia-2 has improved predictive accuracy and generalization, as well as consistent coherence across all rating levels. You can read more about the model in our [research paper](https://arxiv.org/abs/2409.20553).

This model underpins nearly every page of the platform and enables tighter integration with Stockfish evaluations. You can now see each move through two lenses: one rooted in traditional engine evaluation and one informed by how humans are likely to play. This dual perspective provides more contextually grounded feedback, helping you understand not only what was wrong with a move but also how it compares to the decisions typical of players at different skill levels.

## New Analysis Page

![Maia-2 Analysis](/blog/platform-v1/analysis.png)

The analysis page has been restructured to make use of Maia-2 and expose deeper feedback mechanisms highlighting the relationship between engine accuracy and human-like play. New components and functionalities include:

1. **Insight Panel**: Presents a combined Maia and Stockfish breakdown of move quality and intention. This helps you understand the relationship between engine accuracy and human-like play.
2. **Moves by Rating Graph**: Displays the likelihood of each candidate move being played by humans at different rating levels. This helps you understand which moves are typical at different skill levels, and how moves improve as players get stronger.
3. **Blunder Meter**: Highlights sharp drops in move quality based on both engine and human-aligned expectations. This helps you understand the difficulty of the position, while also showing you how a player of the specified rating level makes good, okay, and bad moves.
4. **Move Map**: A revamped interactive scatter plot that shows move popularity and divergence across ratings. This blends engine accuracy with human-like play, and helps you understand the relationship between optimal and human-like play.

In addition to the new analysis features, you are also able to load custom games by inputting PGN or FEN strings. These games will be stored in your browser's local storage, and you can always return to them later. Similarly, while analyzing any game, you are now able to make variations and experiment from any game position with real-time evaluation and branching.

Finally, we have made additional quality-of-life improvements across the analysis page, including: pagination to accommodate games when you have many of them, components to export your games/positions as PGN/FEN, clickable moves and tooltips across all analysis components to easily create variations and explore new positions, move quality indicators (blunders, surprisingly good moves, etc.) in the move lists, amongst many other mini-features. If you have any feedback on the analysis page, please let us know!

## Opening Drill Page

![Maia-2 Opening Drill](/blog/platform-v1/opening-drill.png)

We also introduce a brand new opening drill page, which provides a structured way to rehearse post-opening decision-making. This page is designed to promote deeper pattern recognition and decision-making practice in positions that arise frequently in practical play:

1. You can configure a custom set of openings (with configurable length, difficulty, and drill count) you would like to practice
2. Each drill begins in the post-opening position, allowing you to practice the transition into the middlegame against your preferred Maia model
3. During drills, you can utilize all our standard analysis tools if you would like to experiment with the positions in real-time. This also includes all Maia/Stockfish insights: blunder meter, move map, moves by rating graph, etc.
4. After each drill, you will receive feedback on critical decisions, what rating level you played like, Stockfish evaluations over time, and move-by-move quality assessment. (pictured above)
5. Upon completing all your drills, you can review aggregate performance across all openings.

## New Training Page

![Maia-2 Training Page](/blog/platform-v1/training.png)

We overhauled the training page to provide a more structured and engaging way to practice chess skills. This page is designed to help you practice your chess skills in a more structured and engaging way:

1. After completing/forfeiting a puzzle, you now have full access to the same analysis tools available on the game analysis page. This includes all Maia/Stockfish insights: blunder meter, move map, moves by rating graph, etc.
2. You can also play out and explore the puzzle position after completing/forfeiting.

We have also improved puzzle history tracking, including rating changes and review of past puzzles.

## User Experience Improvements

With the new platform, we have also introduced new interactive walkthroughs for each page, which are designed to help both new and returning users understand the full capabilities of the platform. Each major page now has a tutorial which will walk you through the different components and features of the page. If you would like to replay the walkthroughs, you can hit the ? button in the top left corner of each page.

Additionally, we have also added new features and made quality-of-life improvements across the platform:

1. Improved challenge and rating history for bot-or-not (Turing Test) challenges and training puzzles
2. Cleaner leaderboard which now displays top-rated users who have played within the last seven days
3. Public profile pages for users which now display their elo and links to their external profiles (e.g., Lichess)
4. Unified visual design across all pages with consistent layout, colors, and component structure.
5. Improved support for players on mobile devices and smaller screens.
6. Smoother transitions and animations to clarify user interactions.
7. Pagination for long game histories, including sorting and export options (PGN/FEN).
8. Improved homepage which now displays the latest news and research from the Maia Chess team.

## Open Source and Community

The frontend codebase for the Maia Chess platform is entirely open-source. Developers, researchers, and contributors are welcome to view the codebase, suggest improvements, or integrate components into their own work. The full repository is available at:

**GitHub**: [github.com/CSSLab/maia-platform-frontend](https://github.com/CSSLab/maia-platform-frontend)

We also encourage users to participate in discussions, share feedback, and help shape future features. You can join the community through our public Discord:

**Discord**: [discord.gg/hHb6gqFpxZ](https://discord.gg/hHb6gqFpxZ)

Thank you to the community members and testers who have contributed to Maia Chess over the last year. We look forward to continued collaboration and feedback as we refine and expand the platform.

—
_The Maia Chess Team_
