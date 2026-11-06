import { createPortal } from 'react-dom'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel: string
  // 'danger' for actions that can't be undone (resigning).
  tone?: 'danger' | 'default'
}

/** Asks before an action in a game: Cancel, or the action's own button. */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  tone = 'default',
}) => {
  if (!isOpen || typeof document === 'undefined') return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  // Rendered at the end of <body>: in the game's side panel, a blurred
  // (backdrop-filter) ancestor made `fixed` relative to that panel, so the
  // dialog was squeezed into it instead of covering the page.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/90">
      <div className="w-full max-w-sm rounded-lg border border-glass-border bg-glass p-6 shadow-lg backdrop-blur-md">
        <h3 className="mb-4 text-lg font-semibold text-primary">{title}</h3>

        <p className="mb-6 text-sm text-secondary">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-glass-border bg-glass px-4 py-2 text-sm text-secondary transition hover:bg-glass-stronger"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 rounded px-4 py-2 text-sm text-white transition ${
              tone === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-human-4 hover:bg-human-4/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
