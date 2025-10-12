import React, { useState, useEffect } from 'react'

interface FavoriteModalProps {
  isOpen: boolean
  currentName: string
  onClose: () => void
  onSave: (name: string) => Promise<void> | void
  onDelete?: () => Promise<void> | void
  title?: string
  deleteLabel?: string
}

export const FavoriteModal: React.FC<FavoriteModalProps> = ({
  isOpen,
  currentName,
  onClose,
  onSave,
  onDelete,
  title = 'Edit Favourite Game',
  deleteLabel = 'Delete',
}) => {
  const [name, setName] = useState(currentName)
  const [isProcessing, setIsProcessing] = useState(false)

  // Reset the name when modal opens with a new currentName
  useEffect(() => {
    if (isOpen) {
      setName(currentName)
      setIsProcessing(false)
    }
  }, [isOpen, currentName])

  if (!isOpen) return null

  const handleSave = async () => {
    if (name.trim()) {
      try {
        setIsProcessing(true)
        await onSave(name.trim())
        onClose()
      } catch (error) {
        console.error('Failed to save game name', error)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleDelete = async () => {
    if (onDelete) {
      try {
        setIsProcessing(true)
        await onDelete()
        onClose()
      } catch (error) {
        console.error('Failed to delete game', error)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="absolute inset-0 z-50 flex items-center justify-center px-2"
        onClick={() => {
          if (!isProcessing) onClose()
        }}
      >
        <div className="absolute inset-0 bg-backdrop/80 backdrop-blur-md" />
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-md border border-glass-border bg-glass p-4 backdrop-blur-md"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 95% 75% at 50% 0%, rgba(239, 68, 68, 0.1) 0%, transparent 65%)',
            }}
          />
          <div className="relative z-10 flex flex-col gap-1">
            <h3
              id="favorite-modal-title"
              className="text-lg font-semibold text-white/95"
            >
              {title}
            </h3>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="favorite-name"
                className="text-xs tracking-wide text-white/60"
              >
                Custom Name
              </label>
              <input
                id="favorite-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && !isProcessing && handleSave()
                }
                placeholder="Enter custom name"
                className="rounded-md border border-glass-border bg-glass px-3 py-2 text-sm text-white/90 placeholder-white/40 focus:border-white/35 focus:outline-none"
              />
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="rounded border border-glass-border bg-glass-strong px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-glass-stronger disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              {onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={isProcessing}
                  className="rounded border border-red-400/40 bg-red-400/5 px-3 py-1.5 text-sm text-red-200 transition-colors hover:border-red-300/50 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleteLabel}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!name.trim() || isProcessing}
                className="flex-1 rounded border border-glass-border bg-glass-strong px-3 py-1.5 text-sm text-white transition-colors hover:bg-glass-stronger disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
