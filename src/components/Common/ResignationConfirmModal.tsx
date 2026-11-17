import { createPortal } from 'react-dom'

interface ResignationConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export const ResignationConfirmModal: React.FC<
  ResignationConfirmModalProps
> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  // Drawn in the page's body, over the whole window. Where the Resign button
  // is, in the game's panel, it was held inside the panel: the panel blurs
  // what is behind it, and such a box is what `fixed` is measured from, and
  // it cuts off what doesn't fit. On a phone the panel is a short strip
  // under the board, so the dialog filled it edge to edge, or was cut.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/90 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resign-confirm-title"
        className="w-full max-w-sm rounded-lg border border-glass-border bg-glass p-6 shadow-lg backdrop-blur-md"
      >
        <h3
          id="resign-confirm-title"
          className="mb-4 text-lg font-semibold text-primary"
        >
          Confirm Resignation
        </h3>

        <p className="mb-6 text-sm text-secondary">
          Are you sure you want to resign this game? This action cannot be
          undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="min-h-11 flex-1 rounded border border-glass-border bg-glass px-4 py-2 text-sm text-secondary transition hover:bg-glass-stronger"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="min-h-11 flex-1 rounded bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700"
          >
            Resign
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
