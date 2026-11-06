import { ConfirmModal } from './ConfirmModal'

interface ResignationConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export const ResignationConfirmModal: React.FC<
  ResignationConfirmModalProps
> = ({ isOpen, onClose, onConfirm }) => (
  <ConfirmModal
    isOpen={isOpen}
    onClose={onClose}
    onConfirm={onConfirm}
    title="Confirm Resignation"
    message="Are you sure you want to resign this game? This action cannot be undone."
    confirmLabel="Resign"
    tone="danger"
  />
)
