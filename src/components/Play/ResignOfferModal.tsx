import { createPortal } from 'react-dom'

interface ResignOfferModalProps {
  isOpen: boolean
  // The answer is on its way to the server.
  answering: boolean
  onAccept: () => void
  onPlayOn: () => void
}

/**
 * Maia (a beta model that can resign) would resign: the player decides.
 * Accept ends the game as a win by resignation; Play on goes on with it, and
 * Maia doesn't offer again in the game. The board stays in view behind it.
 */
export const ResignOfferModal: React.FC<ResignOfferModalProps> = ({
  isOpen,
  answering,
  onAccept,
  onPlayOn,
}) => {
  if (!isOpen) return null

  // In the page's body, over the whole window (see ResignationConfirmModal).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resign-offer-title"
        aria-describedby="resign-offer-description"
        className="w-full max-w-sm rounded-lg border border-glass-border bg-glass p-6 shadow-lg backdrop-blur-md"
      >
        <h3
          id="resign-offer-title"
          className="mb-4 text-lg font-semibold text-primary"
        >
          Maia is offering to resign
        </h3>

        <p
          id="resign-offer-description"
          className="mb-6 text-sm text-secondary"
        >
          Accept, and you win the game by resignation. Play on, and the game
          continues: Maia won&apos;t offer to resign again in this game.
        </p>

        <div className="flex gap-3">
          <button
            // The answer that keeps the game as it is, for a key pressed too
            // soon.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onClick={onPlayOn}
            disabled={answering}
            className="min-h-11 flex-1 rounded border border-glass-border bg-glass px-4 py-2 text-sm text-secondary transition hover:bg-glass-stronger disabled:opacity-50"
          >
            Play on
          </button>
          <button
            onClick={onAccept}
            disabled={answering}
            className="min-h-11 flex-1 rounded bg-human-4 px-4 py-2 text-sm font-medium text-white transition hover:bg-human-4/90 disabled:opacity-70"
          >
            Accept
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
