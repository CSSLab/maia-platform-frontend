import React from 'react'
import { motion } from 'framer-motion'
import { DeepAnalysisProgress } from 'src/types/analysis'

interface Props {
  progress: DeepAnalysisProgress
  onCancel: () => void
}

export const AnalysisNotification: React.FC<Props> = ({
  progress,
  onCancel,
}) => {
  const hasTotals = progress.totalMoves > 0
  const progressPercentage = hasTotals
    ? Math.round((progress.currentMoveIndex / progress.totalMoves) * 100)
    : 0

  if (!progress.isAnalyzing) return null

  return (
    <motion.div
      className="pointer-events-auto fixed bottom-6 right-6 z-30 w-[20rem] overflow-hidden rounded-lg border border-white/25 bg-white/10 shadow-lg backdrop-blur-xl"
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      data-testid="analysis-notification"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/40 bg-white/15">
          <span className="material-symbols-outlined animate-spin !text-base text-white/90">
            neurology
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold leading-tight text-white/95">
              Analyzing Game
            </h3>
          </div>
          <span className="truncate text-xs text-white/70">
            {hasTotals
              ? `Position ${Math.max(progress.currentMoveIndex, 1)} of ${progress.totalMoves}`
              : 'Calibrating engine positions…'}
          </span>
        </div>

        <button
          onClick={onCancel}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/25 bg-white/10 text-white/70 transition-colors duration-150 hover:bg-white/20"
          title="Cancel Analysis"
        >
          <span className="material-symbols-outlined !text-sm">close</span>
        </button>
      </div>

      <div className="flex flex-col px-4 pb-3">
        <div className="flex flex-row items-center justify-center gap-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-white/60 via-white to-white/70"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>
          <span className="text-xs font-medium text-white/90">
            {progressPercentage}%
          </span>
        </div>
        {progress.currentMove && (
          <div className="mt-3 rounded-md border border-white/15 bg-white/10 px-3 py-2">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55">
              Current Position
            </p>
            <p className="mt-1 truncate font-mono text-xs text-white/90">
              {progress.currentMove}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
