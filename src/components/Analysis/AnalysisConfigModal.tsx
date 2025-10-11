import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (depth: number) => void
  initialDepth?: number
}

export const AnalysisConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  initialDepth = 15,
}) => {
  const [selectedDepth, setSelectedDepth] = useState(initialDepth)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const depthOptions = [
    {
      value: 12,
      label: 'Fast (d12)',
      description: 'Quick surface-level analysis',
    },
    {
      value: 15,
      label: 'Balanced (d15)',
      description: 'Deeper analysis with good speed',
    },
    {
      value: 18,
      label: 'Deep (d18)',
      description: 'Thorough analysis with slower speed',
    },
  ]

  const handleConfirm = () => {
    onConfirm(selectedDepth)
    onClose()
  }

  if (!isOpen) return null

  return (
    <motion.div
      className="fixed inset-0 z-50 flex h-screen w-screen flex-col items-center justify-center bg-backdrop/90 px-4 md:px-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      data-testid="analysis-config-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        className="flex w-full flex-col gap-2 rounded-lg border border-white/10 bg-glass p-6 shadow-none backdrop-blur-md md:w-[min(500px,40vw)]"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-2xl text-white/80">
            network_intelligence
          </span>
          <h2 className="text-xl font-semibold text-white">
            Analyze Entire Game
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-white/75">
            Choose the Stockfish analysis depth for all positions in the game:
          </p>

          <div className="flex flex-col gap-2">
            {depthOptions.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-3 rounded-md border border-glassBorder p-3 transition duration-200 ${
                  selectedDepth === option.value
                    ? 'border-glassBorder bg-glass-stronger text-white'
                    : 'border-white/10 bg-glass text-white/80 hover:bg-glass-stronger hover:text-white'
                }`}
                htmlFor={`depth-${option.value}`}
                aria-label={`Select ${option.label}`}
              >
                <input
                  type="radio"
                  name="depth"
                  id={`depth-${option.value}`}
                  value={option.value}
                  checked={selectedDepth === option.value}
                  onChange={(e) => setSelectedDepth(Number(e.target.value))}
                  className="h-4 w-4 border-white/30 text-human-4 focus:ring-human-4"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-white">
                    {option.label}
                  </span>
                  <span className="text-xs text-white/70">
                    {option.description}
                  </span>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-md border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <span className="material-symbols-outlined !text-base text-white/70">
              info
            </span>
            <p className="text-xs text-white/70">
              Higher depths provide more accurate analysis but take longer to
              complete. You can cancel the analysis at any time. Analysis will
              persist even after you close the tab,
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded border border-glassBorder bg-glass px-4 py-2 text-sm font-medium text-white/80 transition duration-200 hover:bg-glass-strong hover:text-white"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-2 rounded border border-human-4/50 bg-human-4/80 px-4 py-2 text-sm text-white transition duration-200 hover:bg-human-4"
          >
            <span className="material-symbols-outlined text-sm">
              play_arrow
            </span>
            Start Analysis
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
