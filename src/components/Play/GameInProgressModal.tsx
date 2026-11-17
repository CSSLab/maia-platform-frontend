import {
  ServerGame,
  describeServerGame,
  isRatedServerGame,
} from 'src/lib/serverGames'

interface GameInProgressModalProps {
  // The player's game in progress; nothing is shown without one.
  game?: ServerGame
  // The game is being resigned for the new one.
  resigning: boolean
  onContinue: () => void
  onStartNew: () => void
}

/**
 * Asked when a play page is opened for a game while the player has another
 * in progress: go on with that one, or resign it and start the new one
 * (src/hooks/useGameInProgressQuestion).
 */
export const GameInProgressModal: React.FC<GameInProgressModalProps> = ({
  game,
  resigning,
  onContinue,
  onStartNew,
}) => {
  if (!game) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/90 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-in-progress-title"
        className="w-full max-w-sm rounded-lg border border-glass-border bg-glass p-6 shadow-lg backdrop-blur-md"
      >
        <h3
          id="game-in-progress-title"
          className="mb-4 text-lg font-semibold text-primary"
        >
          You have a game in progress
        </h3>

        <p className="mb-2 text-sm font-medium text-primary">
          {describeServerGame(game)}
        </p>
        <p className="mb-6 text-sm text-secondary">
          {isRatedServerGame(game)
            ? 'Starting a new game resigns it, and the loss counts for your rating.'
            : "Starting a new game resigns it. It's unrated, so your rating stays as it is."}
        </p>

        <div className="flex gap-3">
          <button
            // The answer that loses nothing, for a key pressed too soon.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onClick={onContinue}
            disabled={resigning}
            className="min-h-11 flex-1 rounded border border-glass-border bg-glass px-4 py-2 text-sm text-secondary transition hover:bg-glass-stronger disabled:opacity-50"
          >
            Continue it
          </button>
          <button
            onClick={onStartNew}
            disabled={resigning}
            className="min-h-11 flex-1 rounded bg-human-4 px-4 py-2 text-sm font-medium text-white transition hover:bg-human-4/90 disabled:opacity-70"
          >
            {resigning ? 'Starting…' : 'Start new game'}
          </button>
        </div>
      </div>
    </div>
  )
}
