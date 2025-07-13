import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'

import personJon from './people/jon.jpg'
import { TeamMember } from './TeamMember'
import personSid from './people/sid.jpeg'
import personReid from './people/reid.jpg'
import personIsaac from './people/isaac.jpg'
import personKevin from './people/kevin.jpg'
import personJoseph from './people/joseph.jpg'
import personAshton from './people/ashton.jpeg'
import personDmitriy from './people/dmitriy.jpg'
import personArthur from './people/arthur.png'

const teamMembers = [
  {
    image: personAshton,
    name: 'Ashton Anderson',
    website: 'http://www.cs.toronto.edu/~ashton/',
    institution: 'University of Toronto',
    role: 'Project Lead',
    github: 'ashtonanderson',
  },
  {
    image: personReid,
    name: 'Reid McIlroy-Young',
    website: 'https://reidmcy.com/',
    institution: 'University of Toronto',
    role: 'Head Developer',
    github: 'reidmcy',
  },
  {
    image: personJon,
    name: 'Jon Kleinberg',
    website: 'https://www.cs.cornell.edu/home/kleinber/',
    institution: 'Cornell University',
    role: 'Collaborator',
  },
  {
    image: personSid,
    name: 'Siddhartha Sen',
    website: 'http://sidsen.org/',
    institution: 'Microsoft Research',
    role: 'Collaborator',
    github: 'sidsen',
  },
  {
    image: personJoseph,
    name: 'Joseph Tang',
    website: 'https://lilv98.github.io/',
    institution: 'University of Toronto',
    role: 'Model Developer',
    github: 'lilv98',
  },
  {
    image: personKevin,
    name: 'Kevin Thomas',
    website: 'https://kevinjosethomas.com/',
    institution: 'Burnaby South Secondary',
    role: 'Web Developer',
    github: 'kevinjosethomas',
  },
  {
    image: personDmitriy,
    name: 'Dmitriy Prokopchuk',
    website: 'https://prokopchukdim.github.io/',
    institution: 'University of Toronto',
    role: 'Web Developer',
    github: 'prokopchukdim',
  },
  {
    image: personArthur,
    name: 'Arthur Soenarto',
    website: 'https://artyang.me/',
    institution: 'University of Toronto',
    role: 'Web Developer',
    github: 'arthursoenarto',
  },
  {
    image: personIsaac,
    name: 'Isaac Waller',
    website: 'https://waller.is/',
    institution: 'University of Toronto',
    role: 'Web Developer',
  },
]

const researchPapers = {
  maia1: {
    title:
      'Aligning Superhuman AI with Human Behavior: Chess as a Model System',
    link: 'https://www.cs.toronto.edu/~ashton/pubs/maia-kdd2020.pdf',
    description:
      'This paper introduces Maia, a chess engine trained to imitate real human moves at different rating levels. Instead of always picking the best move, Maia predicts what a human player of a given skill would actually play. This makes it ideal for training, game analysis, and even coaching, as it helps players learn from realistic decisions rather than computer perfection. It was the first AI to prioritize human-likeness over engine strength, making it a powerful tool for improvement.',
  },
  maia2: {
    title: 'Maia‑2: A Unified Model for Human‑AI Alignment in Chess',
    link: 'https://www.cs.toronto.edu/~ashton/pubs/maia2-neurips2024.pdf',
    description:
      "Maia‑2 is the evolution of Maia into a single model that can simulate any skill level in chess. Instead of using separate models for different ratings, it understands and adapts to your level in real time. Whether you're a beginner or a master, Maia‑2 predicts the moves players like you would actually make. It's built to feel human, teach naturally, and support personalized analysis without needing to toggle between bots.",
  },
  others: [
    {
      title: 'Learning Personalized Models of Human Behavior in Chess',
      link: 'https://www.cs.toronto.edu/~ashton/pubs/maia-personalized2021.pdf',
      description:
        'Creates a version of Maia that learns your individual playing style and mirrors the way you think on the board.',
    },
    {
      title:
        'Detecting Individual Decision‑Making Style: Exploring Behavioral Stylometry in Chess',
      link: 'https://www.cs.toronto.edu/~ashton/pubs/chessembed-neurips2021.pdf',
      description:
        'Shows that your chess style is as unique as a fingerprint, allowing the model to recognize you just by your move choices.',
    },
    {
      title: 'Learning Models of Individual Behavior in Chess',
      link: 'https://www.cs.toronto.edu/~ashton/pubs/maia-personalized2021.pdf',
      description:
        'Extends personalized Maia to thousands of players, showing it can consistently capture how real people play across the rating ladder.',
    },
    {
      title:
        'Designing Skill‑Compatible AI: Methodologies and Frameworks in Chess',
      link: 'https://www.cs.toronto.edu/~ashton/pubs/maia-partner-iclr24.pdf',
      description:
        'Explains how to build training bots that play at your level and support fair, instructive, and enjoyable games.',
    },
  ],
}

const PaperCard = ({
  paper,
  featured = false,
  className = '',
}: {
  paper: typeof researchPapers.maia1
  featured?: boolean
  className?: string
}) => (
  <motion.div
    className={`group relative flex h-full flex-col rounded-lg bg-background-1 transition-all duration-200 ${featured ? '' : 'hover:scale-[1.02]'} ${className} ${featured ? 'overflow-hidden' : 'p-4 md:p-6'}`}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4 }}
  >
    <div
      className={`absolute ${featured ? 'right-4 top-4 z-10' : 'right-4 top-4'}`}
    >
      <span className="material-symbols-outlined text-sm text-primary/60">
        arrow_outward
      </span>
    </div>
    {featured && (
      <div className="aspect-[4/3] w-full overflow-hidden">
        <img
          src={`/assets/papers/${paper.title.includes('Maia‑2') ? 'maia2' : 'maia1'}.jpg`}
          alt={`${paper.title} paper preview`}
          className="h-full w-full object-cover object-top"
        />
      </div>
    )}
    <div className={`flex flex-1 flex-col items-start justify-between`}>
      <div className={`flex flex-col ${featured ? 'p-4 md:p-6' : ''}`}>
        <h4
          className={`pr-6 font-bold leading-tight ${featured ? 'text-center text-base' : 'text-left text-lg'}`}
        >
          {paper.title}
        </h4>
        <p
          className={`mt-3 text-sm text-primary/80 ${featured ? 'text-justify leading-relaxed' : 'text-left'}`}
        >
          {paper.description}
        </p>
      </div>
      {featured && (
        <a
          href={paper.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center bg-human-4/80 px-5 py-3 font-medium text-primary transition duration-200 hover:bg-human-4"
        >
          Read {paper.title.includes('Maia‑2') ? 'Maia 2' : 'Maia 1'} Paper
        </a>
      )}
    </div>

    {!featured && (
      <a
        href={paper.link}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 rounded-lg"
        aria-label={`Read paper: ${paper.title}`}
      />
    )}
  </motion.div>
)

export const AboutMaia = () => {
  const [projectRef, projectInView] = useInView({
    triggerOnce: false,
    threshold: 0.2,
  })

  const [researchRef, researchInView] = useInView({
    triggerOnce: false,
    threshold: 0.2,
  })

  const [teamRef, teamInView] = useInView({
    triggerOnce: false,
    threshold: 0.2,
  })

  const [acknowledgementsRef, acknowledgementsInView] = useInView({
    triggerOnce: false,
    threshold: 0.2,
  })

  return (
    <div>
      <section
        id="main_info"
        className="relative flex flex-col items-center justify-center bg-background-2 py-20 text-center"
        ref={projectRef}
      >
        <div className="flex max-w-3xl flex-col items-center justify-center px-4 md:px-0">
          <h3 className="text-xs font-bold uppercase tracking-wide">
            Human-AI Collaboration for Chess
          </h3>
          <h2 className="mb-6 mt-2 text-center text-4xl font-bold">
            What is Maia Chess?
          </h2>
          <div className="flex flex-col gap-4">
            <p className="text-primary/90">
              Maia is a human-like chess engine, designed to play like a human
              instead of playing the strongest moves. Maia uses the same deep
              learning techniques that power superhuman chess engines, but with
              a novel approach: Maia is trained to play like a human rather than
              to win.
            </p>

            <p className="text-primary/90">
              Maia is trained to predict human moves rather than to find the
              optimal move in a position. As a result, Maia exhibits common
              human biases and makes many of the same mistakes that humans make.
              We have trained a set of nine neural network engines, each
              targeting a specific rating level on the Lichess.org rating scale,
              from 1100 to 1900.
            </p>

            <p className="text-primary/90">
              We introduced Maia in our paper that appeared at KDD 2020, and
              Maia 2 in our paper that appeared at NeurIPS 2024.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-[95%] px-2 pt-16 md:max-w-[90%] md:px-4">
          {/* Layout for screens < 1280px */}
          <div className="xl:hidden">
            {/* Featured papers in a row */}
            <div className="mb-6 grid grid-rows-2 gap-6 md:grid-cols-2 md:grid-rows-none">
              <PaperCard
                paper={researchPapers.maia1}
                featured={true}
                className=""
              />
              <PaperCard
                paper={researchPapers.maia2}
                featured={true}
                className=""
              />
            </div>
            {/* Other papers in a row */}
            <div className="grid grid-rows-2 gap-4 sm:grid-cols-4 sm:grid-rows-none">
              {researchPapers.others.map((paper, index) => (
                <PaperCard key={index} paper={paper} className="flex-1" />
              ))}
            </div>
          </div>

          {/* Layout for screens >= 1280px (original layout) */}
          <div className="hidden xl:grid xl:grid-cols-3 xl:gap-6">
            <PaperCard
              paper={researchPapers.maia1}
              featured={true}
              className=""
            />
            <PaperCard
              paper={researchPapers.maia2}
              featured={true}
              className=""
            />
            <div className="flex flex-col gap-4">
              {researchPapers.others.map((paper, index) => (
                <PaperCard key={index} paper={paper} className="flex-1" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="team_info"
        className="relative overflow-hidden bg-background-1 py-16"
        ref={teamRef}
      >
        <div className="relative z-10 mx-auto my-0 flex max-w-[1200px] flex-col items-center justify-center gap-8">
          <div className="m-auto box-border w-auto px-4 md:w-2/3">
            <h3 className="text-center text-xl font-bold uppercase">Team</h3>
          </div>
          <div className="grid max-w-[1200px] grid-cols-3 gap-x-2 gap-y-8 px-4 text-center md:gap-y-12 lg:grid-cols-5 xl:gap-x-4 2xl:gap-x-8">
            {teamMembers.map((member, index) => (
              <TeamMember key={member.name} {...member} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative flex flex-col items-center justify-center gap-2 overflow-hidden bg-background-2 py-20"
        ref={acknowledgementsRef}
      >
        <h3 className="text-center text-xl font-bold uppercase">
          Acknowledgments
        </h3>
        <p className="max-w-4xl px-4 text-center text-primary/90">
          Many thanks to Lichess.org for providing the human games that we
          trained on and hosting our Maia models that you can play against.
          Ashton Anderson was supported in part by an NSERC grant, a Microsoft
          Research gift, and a CFI grant. Jon Kleinberg was supported in part by
          a Simons Investigator Award, a Vannevar Bush Faculty Fellowship, a
          MURI grant, and a MacArthur Foundation grant.
        </p>
      </section>
    </div>
  )
}
