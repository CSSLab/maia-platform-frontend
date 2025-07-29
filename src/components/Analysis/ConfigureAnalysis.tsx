import React from 'react'
import { AnalyzedGame } from 'src/types'

import { ContinueAgainstMaia } from 'src/components'

interface Props {
  currentMaiaModel: string
  setCurrentMaiaModel: (model: string) => void
  launchContinue: () => void
  MAIA_MODELS: string[]
  game: AnalyzedGame
  onDeleteCustomGame?: () => void
  onAnalyzeEntireGame?: () => void
  onLearnFromMistakes?: () => void
  onDrillFromPosition?: () => void
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
  launchContinue,
  MAIA_MODELS,
  game,
  onDeleteCustomGame,
  onAnalyzeEntireGame,
  onLearnFromMistakes,
  onDrillFromPosition,
  isAnalysisInProgress = false,
  isLearnFromMistakesActive = false,
  autoSave,
}: Props) => {
  const isCustomGame = game.type === 'custom-pgn' || game.type === 'custom-fen'

  return (
    <div className="flex w-full flex-col items-start justify-start gap-1 p-3">
      <div className="flex w-full flex-col gap-0.5">
        <p className="text-xs text-secondary">Analyze using:</p>
        <select
          value={currentMaiaModel}
          className="cursor-pointer rounded-sm border-none bg-human-4/60 p-1 text-xs text-primary/70 outline-none transition duration-300 hover:bg-human-4/80 hover:text-primary"
          onChange={(e) => setCurrentMaiaModel(e.target.value)}
        >
          {MAIA_MODELS.map((model) => (
            <option value={model} key={model}>
              {model.replace('maia_kdd_', 'Maia ')}
            </option>
          ))}
        </select>
      </div>
      <ContinueAgainstMaia
        launchContinue={launchContinue}
        background="bg-human-4/60 !rounded-sm hover:bg-human-4/80 text-primary/70 hover:text-primary !px-2 !py-1 !text-xs"
      />
      {onAnalyzeEntireGame && (
        <button
          onClick={onAnalyzeEntireGame}
          disabled={isAnalysisInProgress || isLearnFromMistakesActive}
          className="flex w-full items-center gap-1.5 rounded-sm bg-human-4/60 !px-2 !py-1 !text-sm text-primary/70 transition duration-200 hover:bg-human-4/80 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined !text-sm">
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
          className="flex w-full items-center gap-1.5 rounded-sm bg-human-4/60 !px-2 !py-1 !text-sm text-primary/70 transition duration-200 hover:bg-human-4/80 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined !text-sm">school</span>
            <span className="text-xs">
              {isLearnFromMistakesActive
                ? 'Learning in progress...'
                : 'Learn from mistakes'}
            </span>
          </div>
        </button>
      )}
      {onDrillFromPosition && (
        <button
          onClick={onDrillFromPosition}
          className="flex w-full items-center gap-1.5 rounded-sm bg-human-4/60 !px-2 !py-1 !text-sm text-primary/70 transition duration-200 hover:bg-human-4/80 hover:text-primary"
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined !text-sm">explore</span>
            <span className="text-xs">Drill from this position</span>
          </div>
        </button>
      )}
      {autoSave &&
        game.type !== 'custom-pgn' &&
        game.type !== 'custom-fen' &&
        game.type !== 'tournament' && (
          <div className="mt-2 w-full">
            <div className="flex items-center gap-1.5">
              {autoSave.status === 'saving' && (
                <>
                  <div className="h-2 w-2 animate-spin rounded-full border border-secondary border-t-primary"></div>
                  <span className="text-xs text-secondary">
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
      {isCustomGame && onDeleteCustomGame && (
        <div className="mt-2 w-full">
          <button
            onClick={onDeleteCustomGame}
            className="text-xs text-secondary transition duration-200 hover:text-human-4"
          >
            <span className="underline">Delete</span> this stored Custom Game
          </button>
        </div>
      )}
    </div>
  )
}
