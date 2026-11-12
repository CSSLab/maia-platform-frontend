interface StartGameConfirmModalProps {
  isOpen: boolean
  onStart: () => void
  onCancel: () => void
}

/**
 * Asks before a play page opened by a link starts a game, which ends the
 * player's game in progress (src/hooks/useStartConfirmation).
 */
export const StartGameConfirmModal: React.FC<StartGameConfirmModalProps> = ({
  isOpen,
  onStart,
  onCancel,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/90 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-game-confirm-title"
        className="w-full max-w-sm rounded-lg border border-glass-border bg-glass p-6 shadow-lg backdrop-blur-md"
      >
        <h3
          id="start-game-confirm-title"
          className="mb-4 text-lg font-semibold text-primary"
        >
          Start a new game?
        </h3>

        <p className="mb-6 text-sm text-secondary">
          If you have a game in progress, starting this one resigns it.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded border border-glass-border bg-glass px-4 py-2 text-sm text-secondary transition hover:bg-glass-stronger"
          >
            Not now
          </button>
          <button
            // The likely answer: the visitor opened the link to play.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onClick={onStart}
            className="flex-1 rounded bg-human-4 px-4 py-2 text-sm font-medium text-white transition hover:bg-human-4/90"
          >
            Start game
          </button>
        </div>
      </div>
    </div>
  )
}
