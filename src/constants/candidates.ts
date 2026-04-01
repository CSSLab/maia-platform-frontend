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
export const CANDIDATES_FEATURED_POSITIONS: CandidatePosition[] = [
  {
    id: 'rd4-sindarov-breakthrough',
    title: "Rd4 Challenge 1: Sindarov's Breakthrough",
    subtitle:
      "Can you break through against Black's damaged structure? (Sindarov—Caruana)",
    summary:
      "White to move in a sharp position against Caruana's damaged structure. Break through and win.",
    tag: 'Featured',
    accent: 'red',
    fen: '3q4/3r1pkp/5b2/2Rp1p2/Pp4r1/4B1P1/1P2QP1P/3R2K1 w - - 0 28',
    playerColor: 'white',
    maiaVersion: 'maia_kdd_1900',
    targetMoveNumber: 8,
  },
  {
    id: 'rd4-convert-like-zhu',
    title: 'Rd4 Challenge 2: Convert Like Zhu',
    subtitle:
      'Black is two pawns up. Deal with the light square pressure and convert the win. (Deshmukh—Zhu)',
    summary:
      'Black is materially ahead but must handle light-square pressure to finish the conversion.',
    tag: 'Featured',
    accent: 'amber',
    fen: 'r4r2/1p3qpk/2ppb2p/p2n1p2/P1Bb3P/1Q4P1/1P1BRPN1/R5K1 b - - 1 23',
    playerColor: 'black',
    maiaVersion: 'maia_kdd_1900',
    targetMoveNumber: 8,
  },
  {
    id: 'rd4-giri-wandering-king',
    title: "Rd4 Challenge 3: Giri's Wandering King",
    subtitle:
      'Black has long-term advantages, but can you consolidate and win? (Esipenko—Giri)',
    summary:
      "Giri's king is active and Black has long-term trumps. Consolidate the edge and convert.",
    tag: 'Featured',
    accent: 'blue',
    fen: '1kr4r/1p2bp1p/Q1b1p3/2pq3N/4N3/5P2/PR4PP/1R4K1 b - - 0 23',
    playerColor: 'black',
    maiaVersion: 'maia_kdd_1900',
    targetMoveNumber: 8,
  },
]

export const CANDIDATES_ROUND_THREE_POSITIONS: CandidatePosition[] = [
  {
    id: 'rd3-convert-fabi-win',
    title: "Rd3 Challenge 1: Convert Fabi's Win",
    subtitle:
      "Black resigned here, but could you convert White's win if you had to?",
    summary:
      "Caruana's position is winning, but Black is still to move. Play White and convert it.",
    tag: 'Featured',
    accent: 'red',
    fen: '3q1rk1/p3ppb1/6pp/4r3/6P1/1Q5b/PP1PPP1P/R1BNK1R1 b Q - 1 19',
    playerColor: 'white',
    maiaVersion: 'maia_kdd_1900',
    targetMoveNumber: 8,
  },
  {
    id: 'rd3-take-down-pragg',
    title: 'Rd3 Challenge 2: Take Down Pragg',
    subtitle: 'Can you crash through like Sindarov did against Pragg?',
    summary:
      'Sindarov broke through against Praggnanandhaa. Black to move and press the attack.',
    tag: 'Featured',
    accent: 'amber',
    fen: 'r1br2k1/pp2q1pp/8/2b2p2/2P1p3/2Q1P1N1/2BNR1PP/R1K5 b - - 7 24',
    playerColor: 'black',
    maiaVersion: 'maia_kdd_1900',
    targetMoveNumber: 8,
  },
  {
    id: 'rd3-bibisara-attack',
    title: "Rd3 Challenge 3: Bibisara's Attack",
    subtitle:
      'Bibisara navigated the complications to take the full point. Try to win with Black!',
    summary:
      'A sharp attacking position for Black. Navigate the complications and win.',
    tag: 'Featured',
    accent: 'blue',
    fen: '2rqkb2/1p2pp2/p6p/n2PB3/2P3r1/Pp2R3/2bN1PP1/R1Q2BK1 b - - 4 22',
    playerColor: 'black',
    maiaVersion: 'maia_kdd_1900',
    targetMoveNumber: 8,
  },
]

export const CANDIDATES_ROUND_TWO_POSITIONS: CandidatePosition[] = [
  {
    id: 'rd2-defend-like-hikaru',
    title: 'Rd2 Challenge 1: Defend like Hikaru',
    subtitle: 'Can you hold the position like Hikaru did?',
    summary: 'Nakamura is under pressure. Black to move and defend accurately.',
    tag: 'Featured',
    accent: 'red',
    fen: '2r3k1/2q2ppp/5n2/p1p1p3/4P2P/1PQ3P1/P4PB1/2R3K1 b - - 0 25',
    playerColor: 'black',
    maiaVersion: 'maia_kdd_1900',
    targetMoveNumber: 8,
  },
  {
    id: 'rd2-pragg-french',
    title: "Rd2 Challenge 2: Hold off Pragg's French",
    subtitle:
      'Can you defend the White side after some inaccuracies in the French?',
    summary:
      'White to move in a tense French structure. Defend the position accurately.',
    tag: 'Featured',
    accent: 'amber',
    fen: 'r1b2rk1/6pp/ppqbpn2/2pp4/3P1P2/2N1B3/PPPQB1PP/4RR1K b - - 1 16',
    playerColor: 'white',
    maiaVersion: 'maia_kdd_1800',
    targetMoveNumber: 8,
  },
  {
    id: 'rd2-be-like-bluebaum',
    title: 'Rd2 Challenge 3: Be like Bluebaum',
    subtitle:
      'Bluebaum had less space, but held the draw anyway. Try to do the same.',
    summary:
      'Bluebaum-style defense and coordination. Black to move and find the right plan.',
    tag: 'Featured',
    accent: 'blue',
    fen: '4rb1r/pp1k1pp1/2p1nnb1/3p2Np/3P3P/2P1NPP1/PP3K2/R1B2B1R b - - 3 19',
    playerColor: 'black',
    maiaVersion: 'maia_kdd_1900',
    targetMoveNumber: 8,
  },
]

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
