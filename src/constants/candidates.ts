import type { PositionLinkOptions } from 'src/lib/positionLinks'

export interface CandidateStoryline {
  title: string
  description: string
  icon: string
}

export interface CandidateIdea {
  title: string
  description: string
  icon: string
}

export interface CandidatePosition extends PositionLinkOptions {
  id: string
  title: string
  subtitle: string
  summary: string
  tag: string
  accent: 'amber' | 'red' | 'blue'
  broadcastHref?: string
}

export const CANDIDATES_HERO = {
  eyebrow: 'Candidates HQ',
  title: 'One page for live moments, instant analysis, and Maia challenges.',
  description:
    'As the tournament starts, this page becomes the fast path from a sharp position to deep analysis or a playable Maia challenge.',
}

export const CANDIDATES_STORYLINES: CandidateStoryline[] = [
  {
    title: 'Interesting positions first',
    description:
      'Every featured moment can jump straight into a dedicated analysis view instead of forcing users to scrub through move lists.',
    icon: 'center_focus_strong',
  },
  {
    title: 'Turn any moment into a challenge',
    description:
      'Linked drills start from the exact board state so visitors can immediately test whether they can convert or defend it better than the players did.',
    icon: 'swords',
  },
  {
    title: 'Broadcast, analysis, and drills stay connected',
    description:
      'Each card can carry the live round link too, so people can move between the event feed and the interactive tools without losing the thread.',
    icon: 'hub',
  },
]

export const CANDIDATES_EXTRA_IDEAS: CandidateIdea[] = [
  {
    title: 'Maia Disagreement Meter',
    description:
      'Flag moments where Maia strongly prefers a human move that differs from Stockfish, then sort those by surprise value.',
    icon: 'psychology',
  },
  {
    title: 'Conversion Tests',
    description:
      'Collect winning positions that still require technique and let visitors see whether they can actually finish the job against Maia.',
    icon: 'military_tech',
  },
  {
    title: 'Round Recap Shelf',
    description:
      'Keep one short note and one featured board from each round so the page becomes an archive instead of a disposable live feed.',
    icon: 'history',
  },
]

// Drop live tournament moments here as PGN or FEN during the event.
export const CANDIDATES_FEATURED_POSITIONS: CandidatePosition[] = []

// Warm-up cards keep the page useful before round one begins.
export const CANDIDATES_WARMUP_POSITIONS: CandidatePosition[] = [
  {
    id: 'warmup-pressure-center',
    title: 'Rd1 Challenge 1: Can you convert Sindarov vs. Esipenko?',
    subtitle:
      'Esipenko (Black) just blundered with 31. ...Qc6??. Can you convert the win like Sindarov did?',
    summary:
      'Sindarov has the win in hand after 31. ...Qc6??. White to move and convert.',
    tag: 'Warm-up',
    accent: 'red',
    fen: '5rk1/6p1/Rbq4p/1p1pRp1Q/2pn1P1P/1P4P1/5PK1/3B4 w - - 1 32',
    playerColor: 'white',
    maiaVersion: 'maia_kdd_1900',
    targetMoveNumber: 8,
  },
  {
    id: 'warmup-endgame-squeeze',
    title: 'Rd1 Challenge 2: Win like Pragg',
    subtitle:
      "Praggnanandhaa took advantage of Giri's mistake to take home the full point. Can you do the same?",
    summary:
      "Praggnanandhaa converted after Giri's mistake. White to move and win.",
    tag: 'Warm-up',
    accent: 'amber',
    fen: '8/1p1k4/p4nn1/2p3Nr/P3Rp1P/2PP4/6P1/4B1K1 w - - 3 37',
    playerColor: 'white',
    maiaVersion: 'maia_kdd_1700',
    targetMoveNumber: 10,
  },
  {
    id: 'warmup-take-down-hikaru',
    title: 'Rd1 Challenge 3: Take down Hikaru',
    subtitle:
      'Fabi has built up a nice advantage against Hikaru, but how do you break through?',
    summary:
      'Caruana is pressing against Nakamura. White to move and finish the attack.',
    tag: 'Warm-up',
    accent: 'blue',
    fen: 'q4k2/3B2p1/1p3b1p/p6P/P1Pp2Q1/3P2P1/5P2/6K1 w - - 5 55',
    playerColor: 'white',
    maiaVersion: 'maia_kdd_1900',
    targetMoveNumber: 8,
  },
]
