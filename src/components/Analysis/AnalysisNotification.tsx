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
  const progressPercentage =
    hasTotals
      ? Math.round((progress.currentMoveIndex / progress.totalMoves) * 100)
      : 0

  if (!progress.isAnalyzing) return null

  return (
    <motion.div
      className="pointer-events-auto fixed bottom-8 right-8 z-30 w-[22rem] overflow-hidden rounded-xl border border-white/30 bg-white/10 backdrop-blur-xl"
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      data-testid="analysis-notification"
    >
      <div className="flex items-start justify-between px-5 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/15">
            <span className="material-symbols-outlined animate-spin !text-lg text-white/90">
              neurology
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">
              Preparing Insights
            </span>
            <h3 className="mt-1 text-base font-semibold text-white/95">Analyzing Game</h3>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white/70 transition-all duration-200 hover:bg-white/20"
          title="Cancel Analysis"
        >
          <span className="material-symbols-outlined !text-base">close</span>
        </button>
      </div>

      <div className="px-5 pt-4 pb-5">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>
            {hasTotals
              ? `Position ${Math.max(progress.currentMoveIndex, 1)} of ${progress.totalMoves}`
              : 'Calibrating engine positions…'}
          </span>
          <span className="font-medium text-white/90">{progressPercentage}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-white/60 via-white to-white/70"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>

        {progress.currentMove && (
          <div className="mt-4 rounded-lg border border-white/20 bg-white/10 px-4 py-3">
            <p className="text-xs text-white/60">Current position</p>
            <p className="mt-1 font-mono text-sm text-white/90">
              {progress.currentMove}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
