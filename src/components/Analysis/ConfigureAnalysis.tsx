import React from 'react'
import { AnalyzedGame } from 'src/types'

import { ContinueAgainstMaia } from 'src/components'

interface Props {
  currentMaiaModel: string
  setCurrentMaiaModel: (model: string) => void
  showTopMoveBadges: boolean
  setShowTopMoveBadges: (show: boolean) => void
  launchContinue: () => void
  MAIA_MODELS: string[]
  game: AnalyzedGame
  onDeleteCustomGame?: () => void
  onAnalyzeEntireGame?: () => void
  onLearnFromMistakes?: () => void
  isAnalysisInProgress?: boolean
  isLearnFromMistakesActive?: boolean
  autoSave?: {
    hasUnsavedChanges: boolean
    isSaving: boolean
    status: 'saving' | 'unsaved' | 'saved'
  }
}

export const ConfigureAnalysis: React.FC<Props> = ({
  currentMaiaModel,
  setCurrentMaiaModel,
  showTopMoveBadges,
  setShowTopMoveBadges,
  launchContinue,
  MAIA_MODELS,
  game,
  onDeleteCustomGame,
  onAnalyzeEntireGame,
  onLearnFromMistakes,
  isAnalysisInProgress = false,
  isLearnFromMistakesActive = false,
  autoSave,
}: Props) => {
  return (
    <div className="flex w-full flex-col items-start justify-start gap-1.5 rounded-md p-3 text-white/90">
      <div className="flex w-full flex-col gap-0.5">
        <p className="text-xs text-white/70">Analyze using:</p>
        <div className="relative inline-flex w-full items-center">
          <select
            value={currentMaiaModel}
            className="w-full cursor-pointer appearance-none rounded border border-glass-border bg-glass py-[5px] pl-2.5 pr-6 text-xs text-white/90 outline-none transition duration-200 hover:bg-glass-stronger"
            onChange={(e) => setCurrentMaiaModel(e.target.value)}
          >
            {MAIA_MODELS.map((model) => (
              <option
                value={model}
                key={model}
                className="bg-transparent text-white"
              >
                {model.replace('maia_kdd_', 'Maia ')}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/70">
            keyboard_arrow_down
          </span>
        </div>
      </div>
      {onAnalyzeEntireGame && (
        <button
          onClick={onAnalyzeEntireGame}
          disabled={isAnalysisInProgress || isLearnFromMistakesActive}
          className="flex w-full items-center gap-1.5 rounded border border-glass-border bg-glass !px-2.5 !py-[5px] !text-sm text-white/90 transition duration-200 hover:bg-glass-stronger disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined !text-sm text-white/80">
              network_intelligence
            </span>
            <span className="text-xs">
              {isAnalysisInProgress
                ? 'Analysis in progress...'
                : 'Analyze entire game'}
            </span>
          </div>
        </button>
      )}
      {onLearnFromMistakes && (
        <button
          onClick={onLearnFromMistakes}
          disabled={isAnalysisInProgress || isLearnFromMistakesActive}
          className="flex w-full items-center gap-1.5 rounded border border-glass-border bg-glass !px-2.5 !py-[5px] !text-sm text-white/90 transition duration-200 hover:bg-glass-stronger disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined !text-sm text-white/80">
              school
            </span>
            <span className="text-xs">
              {isLearnFromMistakesActive
                ? 'Learning in progress...'
                : 'Learn from mistakes'}
            </span>
          </div>
        </button>
      )}
      <div className="mt-1 flex w-full items-center justify-between rounded border border-glass-border bg-glass px-2.5 py-2">
        <div className="flex flex-col">
          <span className="text-xs text-white/90">Show board badges</span>
          <span className="text-[11px] text-white/60">
            Show ? / ?? marker on top human move destination
          </span>
        </div>
        <label
          htmlFor="analysis-top-move-badges-toggle"
          className="relative inline-flex cursor-pointer items-center"
        >
          <input
            id="analysis-top-move-badges-toggle"
            type="checkbox"
            checked={showTopMoveBadges}
            onChange={() => setShowTopMoveBadges(!showTopMoveBadges)}
            className="peer sr-only"
          />
          <div className="peer h-5 w-9 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-white/20 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-500/40 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-red-400"></div>
          <span className="sr-only">Toggle top move board badges</span>
        </label>
      </div>
      {autoSave && game.type !== 'tournament' && (
        <div className="mt-2 w-full">
          <div className="flex items-center gap-1.5">
            {autoSave.status === 'saving' && (
              <>
                <div className="h-2 w-2 animate-spin rounded-full border border-white/50 border-t-white"></div>
                <span className="text-xs text-white/70">
                  Saving analysis...
                </span>
              </>
            )}
            {autoSave.status === 'unsaved' && (
              <>
                <span className="material-symbols-outlined !text-sm text-orange-400">
                  sync_problem
                </span>
                <span className="text-xs text-orange-400">
                  Unsaved analysis. Will auto-save...
                </span>
              </>
            )}
            {autoSave.status === 'saved' && (
              <>
                <span className="material-symbols-outlined !text-sm text-green-400">
                  cloud_done
                </span>
                <span className="text-xs text-green-400">
                  Analysis auto-saved
                </span>
              </>
            )}
          </div>
        </div>
      )}
      {game.type === 'custom' && onDeleteCustomGame && (
        <div className="mt-2 w-full">
          <button
            onClick={onDeleteCustomGame}
            className="text-xs text-white/70 transition duration-200 hover:text-white"
          >
            <span className="underline">Delete</span> this stored Custom Game
          </button>
        </div>
      )}
    </div>
  )
}
