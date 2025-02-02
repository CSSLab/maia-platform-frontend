import { useContext } from 'react'
import { AnimatePresence } from 'framer-motion'

import { ModalContext } from 'src/contexts'
import { CloseIcon } from 'src/components/Icons/icons'
import { Markdown, ModalContainer } from 'src/components'

export type InstructionsType =
  | 'againstMaia'
  | 'handAndBrain'
  | 'analysis'
  | 'train'
  | 'turing'

const titles = {
  againstMaia: 'Play Maia',
  handAndBrain: 'Play Hand and Brain',
  analysis: 'Analysis',
  train: 'Training',
  turing: 'Bot or Not',
}

// const placeholder = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum eget velit volutpat, efficitur velit sed, volutpat orci. Pellentesque magna libero, commodo a neque a, interdum fringilla lacus. Nulla bibendum scelerisque dignissim. Sed non mi ac ligula laoreet euismod in ut diam. Maecenas nunc dolor, congue et nisl a, placerat dignissim urna. Mauris pretium quis ante a tristique. Duis vulputate leo ac erat mollis finibus. Fusce leo neque, auctor a dignissim non, tristique quis tortor. Aenean faucibus lacus turpis, eget bibendum sem maximus vitae.`

const analysisModalText = `This is the Analysis page, where you can analyze both your own Lichess games and World Championship matches with Maia and Stockfish. Combining Maia analysis with Stockfish analysis gives you a more human-centered way to think about chess. For example, it can help you differentiate strong, findable moves from strong but impossible-to-find "engine" moves. It can also highlight tempting blunders that humans are likely to play. The movemap in the top-right visualizes all legal moves on a plane, where Stockfish-measured quality is on the x-axis and Maia probability is on the y-axis. Strong, findable moves are in the top right, "engine" moves are in the bottom right, and tempting blunders are in the top left. You can navigate to different games in the games panel, and you can play a position against Maia with the "Continue against Maia" button. Happy analyzing, and let us know if you find any bugs or want to see any improvements!`

const turingModalText = `Welcome to Bot-or-not, a fun Turing game where you see if you can tell human from machine. You will be shown games where one player is a human and the other player is a bot, and your job is to pick which side is the bot. You can browse the game in its entirety, and along with your guess you can submit an optional explanation of your reasoning. You will get a rating based on your accuracy, and you can see how you compare to other players on the leaderboard. Bots will also get ratings based on how often they trick humans. Have fun!`

const handAndBrainModalText = `Here you can play Hand and Brain with Maia. In Hand and Brain chess, one player is the "brain" and decides which piece type to move (e.g. "pawn" or "rook") and the other player is the "hand" and chooses which move to make with that piece type (e.g. rook to c7). You can play as either the hand or the brain, and Maia will be your partner and play the other role. You will play against a team of Maias paired up with each other (one Maia will be the brain, and the other Maia will randomly decide which move to play, according to how often a human would play that move). You can also choose the level of Maia's play, from 1100 to 1900, for both your partner Maia and the opponent Maias. You will get both a Hand rating and a Brain rating based on your play. Have fun!`

const againstMaiaModalText = `Here you can play against Maia, our human-like chess engine. Maia is trained to play like a human at a specific skill level. You can choose the level of Maia's play, from 1100 to 1900, and you can also choose the time control of the game. You can also choose to play from a specific starting position, for example to practice a specific opening. You will get a Maia rating based on your play. Have fun!`

const trainModalText = `Here you can solve Maia-inspired tactics puzzles. Once you either correctly solve the puzzle or choose to give up, you will unlock the movemap that shows all legal moves in the position on the Stockfish-Maia plane. You will get a tactics rating based on your attempts. Have fun!`

const content = {
  againstMaia: againstMaiaModalText,
  handAndBrain: handAndBrainModalText,
  analysis: analysisModalText,
  train: trainModalText,
  turing: turingModalText,
}

export interface Props {
  instructionsType: InstructionsType
}

export const InstructionsModal: React.FC<Props> = ({
  instructionsType,
}: Props) => {
  const {
    openedModals,
    setOpenedModals,
    setInstructionsModalProps: setInstructionsModalProps,
  } = useContext(ModalContext)

  const dismiss = () => {
    setInstructionsModalProps(undefined)
    setOpenedModals({ ...openedModals, [instructionsType]: true })
  }

  return (
    <AnimatePresence>
      <ModalContainer dismiss={dismiss} className="z-50">
        <div className="relative flex flex-col gap-4">
          <button
            title="Close"
            onClick={dismiss}
            className="absolute -right-4 -top-2 cursor-pointer border-none bg-none opacity-50 outline-none transition duration-300 hover:opacity-100"
          >
            {CloseIcon}
          </button>
          <h2 className="text-center text-2xl font-bold">
            {titles[instructionsType]}
          </h2>
          <div className="max-w-[600px]">
            <Markdown>{content[instructionsType]}</Markdown>
            <div className="flex items-center justify-end">
              <button
                onClick={dismiss}
                className="flex items-center justify-center rounded-sm bg-human-3 px-4 py-2 transition duration-200 hover:bg-human-4"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </ModalContainer>
    </AnimatePresence>
  )
}
