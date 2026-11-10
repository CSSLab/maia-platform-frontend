---
title: 'Introducing Maia: a Human-Like Chess Engine'
date: '2020-08-24'
tags:
  - chess
  - deep learning
  - maia
  - human-ai
excerpt: >-
  We develop and introduce Maia, a machine learning model that captures human style in chess. Maia is trained on millions of games, and tries to predict the human move played in each position seen.
arxiv: https://arxiv.org/abs/2006.01855
github: https://github.com/CSSLab/maia-chess
journal: KDD 2020
image: all_lineplot.png
---

# Intro

As artificial intelligence becomes increasingly intelligent, there is growing potential for humans to learn from and collaborate with algorithms.
However, the ways in which AI/ML systems approach problems are often
different from the ways people do, which makes it hard for us to interpret and learn from them.

In this work, we try to bridge the gap between human and artificial intelligence in chess. Chess has been on the leading edge of AI since the beginning of AI, and this is no exception. Chess "engines" definitively surpassed all human ability by 2005, but people are playing chess in record numbers --- making chess one of the first really interesting domains where both humans and superhuman AI agents are active.

But despite the wide availability of super-strong chess engines, they haven't been all that helpful to the average player. Engines like Stockfish recommend moves that they would play, but that's not always what an average human player should play.

We are introducing Maia, a new human-like chess engine. It is a customized version of AlphaZero trained on human games with the goal of playing the most human-like moves, instead of being trained on self-play games with the goal of playing the optimal moves. In order to characterize human chess-playing at different skill levels, we developed a suite of 9 Maias, one for each Elo level between 1100 and 1900. As you'll see below, Maia is the most human-like chess engine ever created.

Maia's goal is to play the **human** move — not necessarily the best move. As a result, Maia has a more human-like style than previous engines, matching moves played by human players in online games over 50% of the time.

![During training, Maia is given a position that occurred in a real human game and tries to predict which move was made](/blog/maia-diagram_transparent.png)

During training, Maia is given a position that occurred in a real human game and tries to predict which move was made. After seeing hundreds of millions of positions, Maia accurately captures how people at different levels play chess.

If you're curious, you can play against a few versions of Maia on [Lichess](https://lichess.org) or download them yourself from the [GitHub repo](https://github.com/CSSLab/maia-chess).

# Measuring human-like play

What does it mean for a chess engine to play like a human? For our purposes, we settled on a simple metric: Given a position that occurred in an actual human game, what is the probability that the engine plays the move that was made in the game?

Making an engine that plays like a human according to this definition is a difficult task. The vast majority of positions seen in real games only happen once. People have a wide variety of styles, even at the same rough skill level. And even the exact same person might make a different move if they saw the same position twice!

# Evaluation

To rigorously compare engines in how human-like they are, we need a good test set evaluate them with. We made a collection of 9 test sets, one for each narrow rating range. Here's how we made them:

- First, we made rating bins for each range of 100 rating
  points (e.g. 1200-1299, 1300-1399, and so on)
- In each bin, we put all games where both players are in the same rating range
- We drew 10,000 games from each bin, ignoring Bullet and HyperBullet games
- Within each game, we discarded the first 10 ply (a single move made by one player is one
  "ply") to ignore most memorized opening moves
- We also discarded any move where the player had less than 30 seconds to complete the
  rest of the game (to avoid situations where players are making random moves)

After these restrictions we had 9 test sets, one for each rating range, which contained roughly 500,000 positions each.

We tested each Maia on these 9 sets of positions, one for each rating level between 1100 and 1900. Every Maia made a prediction for every position, and we measured its resulting move-matching accuracy on each set.

# Previous attempts

People have been trying to create human-like chess engines for decades. For one thing, they would make great sparring partners. But getting crushed like a bug every single game isn't that fun, so the most popular attempts at human-like engines have been some kind of _attenuated_ version of a strong chess engine. For example, the "Play With The Computer" feature on Lichess is a series of [Stockfish](https://stockfishchess.org/) models that are limited in the number of moves they are allowed to look ahead. Chess.com, ICC, FICS, and other platforms all have similar engines. How human-like are they?

We created several attenuated versions of Stockfish, one for each depth limit (e.g. the depth 3 Stockfish can only look 3 moves ahead), and tested them on our test sets. In the plot below, we break out the accuracies by rating level so you can see if the engine thinks more like players of a specific skill.

![Move matching accuracy for Stockfish compared with the targeted player's ELO rating](/blog/sf_lineplot.svg)

As you can see, it doesn't work that well. Attenuated versions of Stockfish only match human moves about 35-40% of the time. And equally importantly, each curve is strictly increasing, meaning that even depth-1 Stockfish does a better job at matching 1900-rated human moves than it does matching 1100-rated human moves. Attenuated Stockfish by restricting the depth it can search doesn't capture human-like play at lower skill levels -- instead, it looks like it's playing regular Stockfish chess with a lot of noise mixed in.

An interesting side-note: Stockfish's accuracy is non-monotonic in the depth limitation. As you start limiting the depth (say from depth 15 to depth 7), the accuracy goes down, as you would expect. But if you keep limiting the depth even further (say from depth 7 to depth 1), the accuracy starts going back up again. So while very strong Stockfish is the best at predicting the move humans will make, very weak Stockfish is actually better than moderate-strength Stockfish.

## Leela Chess

Attenuating Stockfish doesn't characterize human play at specific levels. What about Leela? [Leela Chess](http://lczero.org/), an open-source implementation of AlphaZero Chess, is a very strong engine that learns to play chess by playing against itself. Unlike Stockfish, Leela incorporates no human knowledge in its design. Despite this, however, the chess community was very excited by Leela's seemingly more human-like play.

![Move matching accuracy for Leela compared with the targeted player's ELO rating](/blog/leela_lineplot.svg)

In the analysis above, we looked at a number of different Leela generations, with the ratings being their relative skill (commentators noted that early Leela generations were particularly human-like in their play). People were right in that the best versions of Leela match human moves more often than Stockfish. But Leela still doesn't capture human-like play at different skill levels: each version is always getting better or always getter worse as the human skill level increases. To characterize human play at a particular level, we need another approach.

# Maia

Maia is an engine designed to play like humans at a particular skill level. To achieve this, we adapted the AlphaZero/Leela Chess framework to learn from human games. We created 9 different versions, one for each rating range from 1100-1199 to 1900-1999. We made 9 training datasets in the same way that we made the test datasets (described above), with each training set containing 12 million games. We then trained a separate Maia model for each rating bin to create our 9 Maias, from Maia-1 1100 to Maia-1 1900.

![Move matching accuracy for Maia compared with the targeted player's ELO rating](/blog/maia_lineplot.svg)

As you can see, the Maia results are qualitatively different from Stockfish and Leela. First off, the move matching performance is much higher: Maia's _lowest_ accuracy, when it is trained on 1900-rated players but predicts moves
made by 1100-rated players, is 46% -- is as high as the best performance
achieved by any Stockfish or Leela model on any human skill level we
tested. Maia's highest accuracy is over 52%. Over half the time, Maia-1 1900 predicts _the exact move_ a 1900-rated human played in an actual game.

![Move matching accuracy for all the models compared with the targeted player's ELO rating](/blog/all_lineplot.svg)

Importantly, every version of Maia uniquely captures a specific human skill level, since every curve achieves its maximum accuracy at a different human rating. Even Maia-1 1100 achieves over 50% accuracy in predicting 1100-rated moves, and is much better at predicting 1100-rated players than 1900-rated players!

This means something deep about chess: there is such a thing as "1100-rated style". And furthermore, it can be captured by a machine learning model. This was surprising to us: it would have been possible that human play is a mixture of good moves and random blunders, with 1100-rated players blundering more often and 1900-rated players blundering less often. Then it would have been impossible to capture 1100-rated style, because random blunders are impossible to predict. But since we _can_ predict human play at different levels, there is a reliable, predictable, and maybe even algorithmically teachable difference between one human skill level and the next.

Each Maia captures human style at its targeted skill level. Lower Maias best predict moves played by lower-rated players, whereas higher Maias predict moves made by higher-rated players.

# Maia's predictions

You can find all of the juicy details in the paper, but one of the most exciting things about Maia is that it can predict _mistakes_. Even when a human makes an absolute howler -- hanging a queen, for example -- Maia predicts the exact mistake made more than 25% of the time. This could be really valuable for average players trying to improve: Maia could look at your games and tell which blunders were _predictable_, and which were random mistakes. If your mistakes are predictable, you know what to work on to hit the next level.

![Move matching accuracy as a function of the quality of the move played in the game](/blog/delta_human_wr.svg)

Maia is particularly good at predicting human mistakes. The move-matching accuracy of any model increases with the quality of the move, since good moves are easier to predict. But even when players make horrific blunders, Maia correctly predicts the exact blunder they make around 25% of the time. This ability to understand how and when people are likely to make mistakes can make Maia a very useful learning tool.

Because we trained 9 different versions of Maia, each at a targeted skill level, we can begin to algorithmically capture what kinds of mistakes players at specific skill levels make – and when people stop making them.

![In this position, Maia levels 1100–1400 correctly predict that White will play the tempting but wrong move b6](/blog/example_board.png)

In this position, Maia levels 1100–1400 correctly predict that White will play the tempting but wrong move b6 (the move played in the game). It threatens the Queen, but after …Qxc5 White's big advantage is mostly gone. Maia levels 1500–1900 predict that, on average, players rated 1500 and above will play the correct bxa6, forcing the Queenside open to decisive effect.

# Personalizing to Individual Players

Next, we tried pushing the modeling of human play to the next level: could we predict the moves a _particular_ human player would make? It turns out that personalizing Maia gives us our biggest performance gains. We achieve these results by fine-tuning Maia: starting with a base Maia, say Maia-1 1900, we update the model by continuing training on an individual player's games. This approach allows personalized Maias to achieve up to 65% accuracy at predicting particular players' moves.

![By targeting a specific player we can get even higher move prediction accuracy compared to Maias targeting just the player's rating](/blog/maia_transfer_val_accs.svg)

The paper for this work is available [here](https://www.cs.toronto.edu/~ashton/pubs/maia-individual-kdd2022.pdf).

# Play Maia and More

You can play against Maia yourself on Lichess! You can play [Maia-1 1100](https://lichess.org/@/maia1), [Maia-1 1500](https://lichess.org/@/maia5), and [Maia-1 1900](https://lichess.org/@/maia9).

Maia is an ongoing research project using chess as a case study for how to design better human-AI interactions. We hope Maia becomes a useful learning tool and is fun to play against. Our research goals include personalizing Maia to individual players, characterizing the kinds of mistakes that are made at each rating level, running Maia on your games and spotting repeated, predictable mistakes, and more.

This is work in progress and we'd love to hear what you think. Please let us know if you have any feedback or questions by [email](mailto:maiachess@cs.toronto.edu) or [Twitter](https://twitter.com/maiachess).

# Acknowledgments

Many thanks to [Lichess.org](https://lichess.org/) for providing the human games that we trained on, and hosting our Maia models that you can play against. Ashton Anderson was supported in part by an NSERC grant, a Microsoft Research Award, and a CFI grant. Jon Kleinberg was supported in part by a Simons Investigator Award, a Vannevar Bush Faculty Fellowship, a MURI grant, and a MacArthur Foundation grant.

# Further Information

You can read the full paper [here](http://www.cs.toronto.edu/~ashton/pubs/maia-kdd2020.pdf), and view the code on [GitHub](https://github.com/CSSLab/maia-chess).

If you want to see some more examples of Maia's predictions, we have a tool [here](https://csslab.github.io/Maia-Agreement-Visualizer/) to see where the different models disagree.

All our data is from the wonderful archive at [database.lichess.org](https://database.lichess.org/). We converted the raw PGN raw data dumps into CSV, and have made the CSV we used for testing available at [csslab.cs.toronto.edu/datasets](http://csslab.cs.toronto.edu/datasets/#maia_kdd).

If you're interested in being notified about beta versions of learning tools, teaching aids, and experiments based on Maia (analyses of your games, personalized puzzles, Turing tests, etc.), you can sign up for our email list [here](https://forms.gle/jaQfzSGmaeMcu2UA7).

### Citation

```
@article{mcilroyyoung2020maia,
  title={Aligning Superhuman AI with Human Behavior: Chess as a Model System},
  author={McIlroy-Young, Reid and  Sen, Siddhartha and Kleinberg, Jon and Anderson, Ashton},
  year={2020},
  eprint={2006.01855},
  archivePrefix={arXiv},
  primaryClass={cs.AI}
}
```
