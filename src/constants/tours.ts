import { TourStep } from 'src/contexts'

export const analysisTourSteps: TourStep[] = [
  {
    id: 'analysis-overview',
    title: 'Welcome to Analysis',
    description:
      "This analysis page combines Maia's human-like predictions with Stockfish evaluations to bring new depth to understanding chess. Here you can see how moves change as you get better, understand which positions are more challenging for players at different skill levels, and discover many more metrics that help improve your chess understanding.",
    targetId: 'analysis',
    placement: 'left',
  },
  {
    id: 'analysis-game-list',
    title: 'Game Selection',
    description:
      'Use this component to choose which game to analyze. You can load your Maia or Hand & Brain games played on this platform, your Lichess games, World Championship games, or custom PGN/FEN positions.',
    targetId: 'analysis-game-list',
    placement: 'right',
  },
  {
    id: 'analysis-highlight',
    title: 'Analysis Panel',
    description:
      "This panel shows Maia and Stockfish perspectives on the current position. The left section displays Maia's predicted win probability and the most likely moves at your selected rating level. The right section displays Stockfish's evaluation of the position and the best engine moves. The position is summarized in the bottom section.",
    targetId: 'analysis-highlight',
    placement: 'bottom',
  },
  {
    id: 'analysis-moves-by-rating',
    title: 'Moves by Rating',
    description:
      'This chart shows how players make different moves as they get stronger. The X-axis shows rating levels, Y-axis shows probability, and each line represents a different move. Use this plot to see which moves are typical at different skill levels, and how moves change as players get stronger.',
    targetId: 'analysis-moves-by-rating',
    placement: 'left',
  },
  {
    id: 'analysis-move-colors',
    title: 'Move Color Coding',
    description:
      'All moves throughout the analysis are color-coded based on their quality according to Stockfish. Green moves are good (minimal evaluation loss), orange/yellow moves are OK (moderate loss), and red moves are blunders (significant loss).',
    targetId: 'analysis-highlight',
    placement: 'top',
  },
  {
    id: 'analysis-move-map',
    title: 'Move Map',
    description:
      'This scatter plot visualizes all legal moves on two dimensions: better moves (according to Stockfish) are further right, and more likely moves (according to Maia) are further up. This blends engine accuracy with human-like play patterns. Tempting blunders are in the top left, while unnatural, strong "engine" moves are in the bottom right.',
    targetId: 'analysis-move-map',
    placement: 'left',
  },
  {
    id: 'analysis-blunder-meter',
    title: 'Blunder Meter',
    description:
      'This stacked bar chart shows the probability of good moves, okay moves, and blunders for a player at your configured Maia rating level in the current position. It helps you understand the difficulty of the position: if the blunder portion is large, it means players are likely to make mistakes.',
    targetId: 'analysis-blunder-meter',
    placement: 'left',
  },
]

export const trainTourSteps: TourStep[] = [
  {
    id: 'train-overview',
    title: 'Welcome to Puzzles',
    description:
      'This is the puzzle page where you solve chess puzzles to improve your tactical skills. Each puzzle presents a position where you need to find the best move. The puzzles are rated, and your performance affects your puzzle rating. Try to solve each puzzle by making the correct moves on the board.',
    targetId: 'train-page',
    placement: 'right',
  },
  {
    id: 'train-analysis',
    title: 'Give Up & Analyze',
    description:
      'If you get stuck on a puzzle, you can give up to reveal the solution and unlock detailed analysis. Once you give up or solve the puzzle, you get access to the same powerful analysis tools from the analysis page - including Maia move predictions, Stockfish evaluations, move maps, and blunder meters. This helps you understand why certain moves are correct and learn from the position.',
    targetId: 'analysis',
    placement: 'left',
  },
]

export const turingTourSteps: TourStep[] = [
  {
    id: 'turing-overview',
    title: 'Welcome to Bot or Not',
    description:
      'This is the "Bot or Not" challenge - a Turing test for chess! You\'ll be shown real chess games and your task is to determine whether each player (white or black) was human or an AI. Study the moves, look for patterns, and use your chess intuition to distinguish between human and computer play styles.',
    targetId: 'turing-page',
    placement: 'right',
  },
  {
    id: 'turing-submission',
    title: 'Make Your Guess',
    description:
      "After analyzing the game, use this panel to submit your verdict. Click the toggle buttons to select whether you think White and Black were human or AI players. You can also provide reasoning for your choices in the text area. Your accuracy in identifying bots vs humans will be tracked and you'll earn points for correct guesses.",
    targetId: 'turing-submission',
    placement: 'left',
  },
]

export const playTourSteps: TourStep[] = [
  {
    id: 'play-overview',
    title: 'Welcome to Play vs Maia',
    description:
      "You're now playing against Maia, the human-like chess AI! Unlike traditional engines that play perfectly, Maia has been trained to play like humans at different rating levels. This means you'll face a more realistic and instructive opponent that can help you improve. The Maia version you're playing against mimics the playing style of players at that specific rating level.",
    targetId: 'play-page',
    placement: 'right',
  },
  {
    id: 'play-controls',
    title: 'Game Controls',
    description:
      'Use these controls to manage your game. You can resign, or start a new game when this one finishes. The clock shows remaining time for both players (if time controls are enabled). After the game ends, you can analyze it on the analysis page or play again with the same or different settings.',
    targetId: 'play-controls',
    placement: 'left',
  },
]

export const handBrainTourSteps: TourStep[] = [
  {
    id: 'handbrain-overview',
    title: 'Welcome to Hand and Brain',
    description:
      "Hand and Brain is a collaborative chess format where you team up with Maia! If you're playing as Hand, you make the actual moves on the board while your Maia partner (Brain) selects which pieces to move. If you're playing as Brain, you choose which piece type should be moved and your Maia partner (Hand) executes the specific move. Try to work together to win!",
    targetId: 'play-page',
    placement: 'right',
  },
  {
    id: 'handbrain-controls',
    title: 'Hand and Brain Controls',
    description:
      "These controls are specific to Hand and Brain gameplay. As Brain, you'll select piece types using the buttons, and your Maia partner will make the moves. As Hand, you'll see which pieces your Maia partner wants you to move, and you'll execute the specific moves on the board. You can resign if needed or start a new game when this one finishes.",
    targetId: 'play-controls',
    placement: 'left',
  },
]

const openingDrillTourSteps = (): TourStep[] => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 1024

  return [
    {
      id: 'opening-drill-overview',
      title: 'Welcome to Opening Drills',
      description:
        'Practice your openings by drilling specific openings against Maia. First select the openings you want to practice, configure drill settings, and practice them repeatedly until they become second nature. You can track your progress and analyze your performance after each drill.',
      targetId: 'opening-drill-modal',
      placement: 'bottom',
    },
    {
      id: 'opening-drill-selection',
      title: 'Select Openings',
      description:
        'Browse and select the openings you want to practice. You can search for specific variations and  add them using the + button.',
      targetId: 'opening-drill-browse',
      placement: isMobile ? 'bottom' : 'right',
      ...(isMobile && {
        beforeAction: () => {
          document
            .getElementById('opening-drill-browse')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        },
      }),
    },
    {
      id: 'opening-drill-start',
      title: 'Start Drilling',
      description:
        'Customize your drills by choosing the Maia opponent strength, how many moves in each drill, and how many drills to do. Click "Start Drilling" to start!',
      targetId: isMobile ? 'opening-drill-selected' : 'opening-drill-preview',
      placement: isMobile ? 'bottom' : 'left',
      ...(isMobile && {
        beforeAction: () => {
          document
            .getElementById('opening-drill-selected')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        },
      }),
    },
    {
      id: 'opening-drill-gameplay',
      title: 'Drill Experience',
      description:
        "During drilling, you'll play through your selected openings against Maia until reaching the target move count. After each drill, you can analyze the moves you played, see how the Maia and Stockfish evaluations changed throughout the game, and learn from your insights.",
      targetId: 'opening-drill-modal',
      placement: 'bottom',
    },
  ]
}

export const tourConfigs = {
  analysis: {
    id: 'analysis',
    name: 'Analysis Page Tour',
    steps: analysisTourSteps,
  },
  train: {
    id: 'train',
    name: 'Training Page Tour',
    steps: trainTourSteps,
  },
  turing: {
    id: 'turing',
    name: 'Bot or Not Tour',
    steps: turingTourSteps,
  },
  play: {
    id: 'play',
    name: 'Play vs Maia Tour',
    steps: playTourSteps,
  },
  handBrain: {
    id: 'handBrain',
    name: 'Hand and Brain Tour',
    steps: handBrainTourSteps,
  },
  openingDrill: {
    id: 'openingDrill',
    name: 'Opening Drill Tour',
    steps: openingDrillTourSteps(),
  },
}
