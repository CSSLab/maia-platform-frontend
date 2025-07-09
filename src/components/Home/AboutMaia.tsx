import Image from 'next/image'
import { useEffect } from 'react'

import personJon from './people/jon.jpg'
import personSid from './people/sid.jpeg'
import personReid from './people/reid.jpg'
import personIsaac from './people/isaac.jpg'
import personKevin from './people/kevin.jpg'
import personJoseph from './people/joseph.jpg'
import personAshton from './people/ashton.jpeg'
import example_board from './example_board.png'
import personDmitriy from './people/dmitriy.jpg'
import { draw_all_plots, destroy_all_charts } from './plots'
import maia_transfer_val_accs from './maia_transfer_val_accs.svg'
import maia_diagram_transparent from './maia-diagram_transparent.png'
import { EnvelopeSquareIcon, GithubIcon } from 'src/components/Icons/icons'

export const AboutMaia = () => {
  useEffect(() => {
    draw_all_plots()
    return () => destroy_all_charts()
  })

  return (
    <div className="font-helvetica [&_a]:text-blue-500">
      <div className="flex flex-row items-center justify-center gap-10 bg-white py-5 text-sm uppercase tracking-wider">
        <a href="#main_info" className="!text-black">
          Project
        </a>
        <a href="#paper" className="!text-black">
          Paper
        </a>
        <a href="#data" className="!text-black">
          Data
        </a>
        <a href="#team" className="!text-black">
          Team
        </a>
        <a
          id="#code"
          target="_blank"
          rel="noreferrer"
          href="https://github.com/CSSLab/maia-chess"
          className="flex flex-row items-center justify-start gap-2"
        >
          <i className="flex [&>*]:!fill-black">{GithubIcon}</i>{' '}
          <span className="!text-black">Code</span>
        </a>
        <a
          id="#email"
          target="_blank"
          rel="noreferrer"
          href="https://forms.gle/jaQfzSGmaeMcu2UA7"
          className="flex flex-row items-center justify-start gap-2"
        >
          <i className="flex text-black [&>*]:!fill-black">
            {EnvelopeSquareIcon}
          </i>{' '}
          <span className="!text-black">Email list</span>
        </a>
      </div>
      <section
        id="main_info"
        className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black"
      >
        <div className="mx-auto my-0 max-w-[1170px]">
          <div className="flex flex-col md:flex-row">
            <div className="m-auto box-border w-auto px-4 md:w-2/3">
              <h2 className="text-center text-2xl font-bold uppercase">
                Capturing human style in chess
              </h2>
              <div className="relative m-auto min-h-[170px] w-full max-w-[600px]">
                <canvas id="maia_bars" />
              </div>
              <p>
                Maia&rsquo;s goal is to play the <b>human</b> move — not
                necessarily the best move. As a result, Maia has a more
                human-like style than previous engines, matching moves played by
                human players in online games over 50% of the time.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black">
        <div className="mx-auto my-0 max-w-[1170px]">
          <div className="flex flex-col md:flex-row">
            <div className="box-border w-auto px-4 md:w-1/2">
              <figure>
                <Image
                  src={maia_diagram_transparent}
                  alt="observer diagram"
                  className="observer-diagram"
                />
                <figcaption>
                  During training, Maia is given a position that occurred in a
                  real human game and tries to predict which move was made.
                  After seeing hundreds of millions of positions, Maia
                  accurately captures how people at different levels play chess.
                </figcaption>
              </figure>
            </div>
            <div className="box-border w-auto px-4 md:w-1/2">
              <p>
                Maia is an AlphaZero/Leela-like deep learning framework that
                learns from online human games instead of self-play. Maia is
                trained on millions of games, and tries to predict the human
                move played in each position seen.
              </p>
              <p>
                We trained 9 versions of Maia, one for each Elo milestone
                between 1100 and 1900. Maia 1100 was only trained on games
                between 1100-rated players, and so on. Each version learned from
                12 million human games, and learns how chess is typically played
                at its specific level.
              </p>
              <p />
            </div>
          </div>
        </div>
      </section>
      <section className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black">
        <div className="mx-auto my-0 max-w-[1170px]">
          <div className="flex flex-col md:flex-row">
            <div className="box-border w-auto px-4 md:w-1/3">
              <p>
                We measure “move-matching accuracy”, how often Maia&rsquo;s
                predicted move is the same as the human move played in real
                online games.
              </p>
              <p>
                Because we trained 9 different versions of Maia, each at a
                targeted skill level, we can begin to algorithmically capture
                what kinds of mistakes players at specific skill levels make
                &ndash; and when people stop making them.{' '}
              </p>
              <p>
                In this example, the Maias predict that people stop playing the
                tempting but wrong move <i>b6</i> at around 1500.{' '}
              </p>
            </div>
            <div className="m-auto box-border w-auto px-4 md:w-2/3">
              <figure>
                <Image src={example_board} alt="example board" />
                <figcaption>
                  In this position, Maia levels 1100&ndash;1400 correctly
                  predict that White will play the tempting but wrong move b6
                  (the move played in the game). It threatens the Queen, but
                  after …Qxc5 White&rsquo;s big advantage is mostly gone. Maia
                  levels 1500&ndash;1900 predict that, on average, players rated
                  1500 and above will play the correct bxa6, forcing the
                  Queenside open to decisive effect.
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>
      <section className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black">
        <div className="mx-auto my-0 max-w-[1170px]">
          <h2 className="text-center text-2xl font-bold uppercase">
            Maia captures human style at targeted skill levels
          </h2>
          <div className="flex flex-col md:flex-row">
            <div className="box-border w-auto px-4 md:w-1/2">
              <div className="relative m-auto min-h-[170px] w-full max-w-[600px]">
                <canvas id="maia_lines" className="line_plot" />
              </div>
            </div>
            <div className="box-border w-auto px-4 md:w-1/2">
              <div className="text_column">
                <p>
                  We tested each Maia on 9 sets of 500,000 positions that arose
                  in real human games, one for each rating level between 1100
                  and 1900. Every Maia made a prediction for every position, and
                  we measured its resulting move-matching accuracy on each
                  set.{' '}
                </p>
                <p>
                  Each Maia captures human style at its targeted skill level.
                  Lower Maias best predict moves played by lower-rated players,
                  whereas higher Maias predict moves made by higher-rated
                  players.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black">
        <div className="mx-auto my-0 max-w-[1170px]">
          <div className="flex flex-col md:flex-row">
            <div className="box-border w-auto px-4 md:w-1/2">
              <div className="relative m-auto min-h-[170px] w-full max-w-[600px]">
                <canvas id="all_lines" className="line_plot" />
              </div>
            </div>
            <div className="box-border w-auto px-4 md:w-1/2">
              <div className="text_column">
                <p>
                  As a comparison, we looked at how depth-limited Stockfish does
                  on the same prediction task. We ran various depth limits,
                  ranging from only considering the current board (D01) to
                  letting it search 15 plies ahead (D15). Depth-limited
                  Stockfish is the most popular engine to play against for fun
                  (e.g. the &quot;Play with the Computer&quot; feature on
                  Lichess).
                </p>
                <p>
                  We also compared against a variety of Leela chess models,
                  ranging from the very weak 800-rated version to a 3200-rating
                  version.
                </p>
                <p>
                  Stockfish and Leela models don&apos;t predict human moves as
                  well as Maia. Equally importantly, they don&apos;t match a
                  targeted skill level: the curves in the graph are relatively
                  flat across a wide range of human skill levels.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black">
        <div className="mx-auto my-0 max-w-[1170px]">
          <h2 className="text-center text-2xl font-bold uppercase">
            Predicting mistakes
          </h2>
          <div className="flex flex-col md:flex-row">
            <div className="box-border w-auto px-4 md:w-1/2">
              <div className="relative m-auto min-h-[170px] w-full max-w-[600px]">
                <canvas id="data_delta" className="line_plot" />
              </div>
            </div>
            <div className="box-border w-auto px-4 md:w-1/2">
              <div className="text_column">
                <p>
                  Maia is particularly good at predicting human mistakes. The
                  move-matching accuracy of any model increases with the quality
                  of the move, since good moves are easier to predict. But even
                  when players make horrific blunders, Maia correctly predicts
                  the exact blunder they make around 25% of the time. This
                  ability to understand how and when people are likely to make
                  mistakes can make Maia a very useful learning tool.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black">
        <div className="mx-auto my-0 max-w-[1170px]">
          <h2 className="text-center text-2xl font-bold uppercase">
            Personalizing to Individual Players
          </h2>
          <div className="flex flex-col md:flex-row">
            <div className="box-border w-auto px-4 md:w-1/2">
              <figure>
                <Image src={maia_transfer_val_accs} alt="Transfer Maia" />
                <figcaption>
                  By targeting a specific player we can get even higher move
                  prediction accuracy compared to Maias targeting just the
                  player&apos;s rating.
                </figcaption>
              </figure>
            </div>
            <div className="box-border w-auto px-4 md:w-1/2">
              <div className="text_column">
                <p>
                  Next, we tried pushing the modeling of human play to the next
                  level: could we predict the moves a <i>particular</i> human
                  player would make? It turns out that personalizing Maia gives
                  us our biggest performance gains. We achieve these results by
                  fine-tuning Maia: starting with a base Maia, say Maia 1900, we
                  update the model by continuing training on an individual
                  player&rsquo;s games. This plot shows that personalized Maias
                  achieve up to 65% accuracy at predicting particular
                  players&apos; moves.
                </p>
                <p>
                  The paper for this work is available{' '}
                  <a
                    href="https://www.cs.toronto.edu/~ashton/pubs/maia-individual-kdd2022.pdf"
                    title="Link to individual Maia paper"
                  >
                    here
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black">
        <div className="mx-auto my-0 max-w-[1170px]">
          <h2 className="text-center text-2xl font-bold uppercase">
            Play Maia and more
          </h2>
          <p>
            You can play against Maia yourself on Lichess! You can play{' '}
            <a href="https://lichess.org/@/maia1">Maia 1100</a>,{' '}
            <a href="https://lichess.org/@/maia5">Maia 1500</a>, and{' '}
            <a href="https://lichess.org/@/maia9">Maia 1900</a>.
          </p>
          <p>
            Maia is an ongoing research project using chess as a case study for
            how to design better human-AI interactions. We hope Maia becomes a
            useful learning tool and is fun to play against. Our research goals
            include personalizing Maia to individual players, characterizing the
            kinds of mistakes that are made at each rating level, running Maia
            on your games and spotting repeated, predictable mistakes, and more.
          </p>
          <p>
            This is work in progress and we&rsquo;d love to hear what you think.
            Please let us know if you have any feedback or questions by{' '}
            <a href="mailto:maiachess@cs.toronto.edu">email</a> or{' '}
            <a href="https://twitter.com/maiachess">Twitter</a>.
          </p>
        </div>
      </section>
      <section
        id="paper"
        className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black"
      >
        <div className="mx-auto my-0 max-w-[1170px]">
          <div className="row col-lg-9 col-lg-offset-2 left-justify-section">
            <h3 className="text-center text-xl font-bold uppercase">Paper</h3>
            <p>
              {' '}
              Read the full{' '}
              <a href="https://arxiv.org/abs/2006.01855">
                research paper on Maia
              </a>
              , which was published in the{' '}
              <i>
                2020 ACM SIGKDD International Conference on Knowledge Discovery
                and Data Mining (KDD 2020)
              </i>
              .
            </p>
            <p>
              You can read a blog post about Maia{' '}
              <a href="http://csslab.cs.toronto.edu/blog/2020/08/24/maia_chess_kdd/">
                from the Computational Social Science Lab
              </a>{' '}
              or{' '}
              <a href="https://www.microsoft.com/en-us/research/blog/the-human-side-of-ai-for-chess">
                Microsoft Research
              </a>
              .
            </p>
            <p>
              {' '}
              We are going to be releasing beta versions of learning tools,
              teaching aids, and experiments based on Maia (analyses of your
              games, personalized puzzles, Turing tests, etc.). If you want to
              be the first to know, you can sign up for our email list{' '}
              <a
                href="https://forms.gle/jaQfzSGmaeMcu2UA7"
                title="Email signup list"
              >
                here
              </a>
              .
            </p>
            <p>
              {' '}
              If you want to see some more examples of Maia&apos;s predictions
              we have a tool{' '}
              <a
                href="https://csslab.github.io/Maia-Agreement-Visualizer/"
                title="Link to interactive prediction visualizer"
              >
                here
              </a>{' '}
              to see where the different models disagree.
            </p>
            <p>
              The code for training Maia can be found on our{' '}
              <a href="https://github.com/CSSLab/maia-chess">Github Repo</a>.
            </p>
            <h3 className="mt-20 text-center text-xl font-bold uppercase">
              Abstract
            </h3>
            <p className="abstract">
              As artificial intelligence becomes increasingly intelligent--in
              some cases, achieving superhuman performance--there is growing
              potential for humans to learn from and collaborate with
              algorithms. However, the ways in which AI systems approach
              problems are often different from the ways people do, and thus may
              be uninterpretable and hard to learn from. A crucial step in
              bridging this gap between human and artificial intelligence is
              modeling the granular actions that constitute human behavior,
              rather than simply matching aggregate human performance. We pursue
              this goal in a model system with a long history in artificial
              intelligence: chess. The aggregate performance of a chess player
              unfolds as they make decisions over the course of a game. The
              hundreds of millions of games played online by players at every
              skill level form a rich source of data in which these decisions,
              and their exact context, are recorded in minute detail. Applying
              existing chess engines to this data, including an open-source
              implementation of AlphaZero, we find that they do not predict
              human moves well. We develop and introduce Maia, a customized
              version of Alpha-Zero trained on human chess games, that predicts
              human moves at a much higher accuracy than existing engines, and
              can achieve maximum accuracy when predicting decisions made by
              players at a specific skill level in a tuneable way. For a dual
              task of predicting whether a human will make a large mistake on
              the next move, we develop a deep neural network that significantly
              outperforms competitive baselines. Taken together, our results
              suggest that there is substantial promise in designing artificial
              intelligence systems with human collaboration in mind by first
              accurately modeling granular human decision-making.
            </p>
          </div>
        </div>
      </section>
      <section
        id="data"
        className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black"
      >
        <div className="mx-auto my-0 max-w-[1170px]">
          <div className="row col-lg-8 col-lg-offset-2 left-justify-section">
            <h3 className="text-center text-xl font-bold uppercase">Data</h3>
            <p>
              {' '}
              All our data is from the wonderful archive at{' '}
              <a href="https://database.lichess.org/">database.lichess.org</a>.
              We converted the raw PGN raw data dumps into CSV, and have made
              the CSV we used for testing available at{' '}
              <a href="http://csslab.cs.toronto.edu/datasets/#maia_kdd">
                csslab.cs.toronto.edu/datasets
              </a>
              .
            </p>
          </div>
        </div>
      </section>
      <section
        id="team"
        className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black"
      >
        <div className="mx-auto my-0 max-w-[1170px]">
          <div>
            <h3 className="text-center text-xl font-bold uppercase">Team</h3>
            <div className="flex flex-col items-center justify-center text-center md:flex-row md:flex-wrap md:items-stretch md:justify-between">
              <div className="flex min-w-[270px] flex-col items-center justify-center gap-3 pb-16">
                <Image
                  src={personAshton}
                  alt="Picture of Ashton Anderson"
                  className="h-48 w-48 rounded-full"
                />
                <div className="flex flex-col">
                  <a
                    target="_blank"
                    href="http://www.cs.toronto.edu/~ashton/"
                    className="text-2xl"
                  >
                    Ashton Anderson
                  </a>

                  <p>University of Toronto</p>
                </div>
                <p className="font-semibold">Project Lead</p>
              </div>
              <div className="flex min-w-[270px] flex-col items-center justify-center gap-3 pb-16">
                <Image
                  src={personReid}
                  alt="Picture of Reid McIlroy-Young"
                  className="h-48 w-48 rounded-full"
                />
                <div className="flex flex-col">
                  <a
                    target="_blank"
                    href="https://reidmcy.com"
                    className="text-2xl"
                  >
                    Reid McIlroy-Young
                  </a>

                  <p>University of Toronto</p>
                </div>
                <p className="font-semibold">Head Developer</p>
              </div>
              <div className="flex min-w-[270px] flex-col items-center justify-center gap-3 pb-16">
                <Image
                  src={personJon}
                  alt="Picture of Jon Kleinberg"
                  className="h-48 w-48 rounded-full"
                />
                <div className="flex flex-col">
                  <a
                    target="_blank"
                    href="http://www.cs.cornell.edu/home/kleinber"
                    className="text-2xl"
                  >
                    Jon Kleinberg
                  </a>

                  <p>Cornell University</p>
                </div>
                <p className="font-semibold">Collaborator</p>
              </div>
              <div className="flex min-w-[270px] flex-col items-center justify-center gap-3 pb-16">
                <Image
                  src={personSid}
                  alt="Picture of Siddhartha Sen"
                  className="h-48 w-48 rounded-full"
                />
                <div className="flex flex-col">
                  <a
                    target="_blank"
                    href="http://sidsen.org"
                    className="text-2xl"
                  >
                    Siddhartha Sen
                  </a>

                  <p>Microsoft Research</p>
                </div>
                <p className="font-semibold">Collaborator</p>
              </div>
              <div className="flex min-w-[270px] flex-col items-center justify-center gap-3 pb-16">
                <Image
                  src={personJoseph}
                  alt="Picture of Joseph Tang"
                  className="h-48 w-48 rounded-full"
                />
                <div className="flex flex-col">
                  <a
                    target="_blank"
                    href="https://lilv98.github.io/"
                    className="text-2xl"
                  >
                    Joseph Tang
                  </a>

                  <p>University of Toronto</p>
                </div>
                <p className="font-semibold">Model Developer</p>
              </div>
              <div className="flex min-w-[270px] flex-col items-center justify-center gap-3 pb-16">
                <Image
                  src={personIsaac}
                  alt="Picture of Isaac Waller"
                  className="h-48 w-48 rounded-full"
                />
                <div className="flex flex-col">
                  <a
                    target="_blank"
                    href="https://waller.is/"
                    className="text-2xl"
                  >
                    Isaac Waller
                  </a>

                  <p>University of Toronto</p>
                </div>
                <p className="font-semibold">Web Developer</p>
              </div>
              <div className="flex min-w-[270px] flex-col items-center justify-center gap-3 pb-16">
                <Image
                  src={personDmitriy}
                  className="h-48 w-48 rounded-full"
                  alt="Picture of Dmitriy Prokopchuk"
                />
                <div className="flex flex-col">
                  <a
                    target="_blank"
                    href="https://prokopchukdim.github.io/"
                    className="text-2xl"
                  >
                    Dmitriy Prokopchuk
                  </a>

                  <p>University of Toronto</p>
                </div>
                <p className="font-semibold">Web Developer</p>
              </div>
              <div className="flex min-w-[270px] flex-col items-center justify-center gap-3 pb-16">
                <Image
                  src={personKevin}
                  className="h-48 w-48 rounded-full"
                  alt="Picture of Kevin Thomas"
                />
                <div className="flex flex-col">
                  <a
                    target="_blank"
                    href="https://kevinjosethomas.com/"
                    className="text-2xl"
                  >
                    Kevin Thomas
                  </a>
                  <p>Burnaby South Secondary</p>
                </div>
                <p className="font-semibold">Web Developer</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="flex min-h-[60vh] flex-col justify-evenly bg-white py-20 text-black">
        <div className="mx-auto my-0 max-w-[1170px]">
          <div className="m-auto box-border w-auto px-4 md:w-2/3">
            <h3 className="text-center text-xl font-bold uppercase">
              Acknowledgments
            </h3>
            <p>
              Many thanks to Lichess.org for providing the human games that we
              trained on and hosting our Maia models that you can play against.
              Ashton Anderson was supported in part by an NSERC grant, a
              Microsoft Research gift, and a CFI grant. Jon Kleinberg was
              supported in part by a Simons Investigator Award, a Vannevar Bush
              Faculty Fellowship, a MURI grant, and a MacArthur Foundation
              grant.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
