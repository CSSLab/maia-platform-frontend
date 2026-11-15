import React, { useState } from 'react'
import { UnderlineTabs } from 'src/components/Common/UnderlineTabs'
import { ConfigureAnalysis } from 'src/components/Analysis/ConfigureAnalysis'
import { LearnFromMistakes } from 'src/components/Analysis/LearnFromMistakes'
import { ExportGame } from 'src/components/Common/ExportGame'
import { formatPgnDate, pgnNameOr } from 'src/lib/pgn'
import {
  AnalyzedGame,
  GameNode,
  LearnFromMistakesConfiguration,
  MistakePosition,
} from 'src/types'

interface Props {
  currentMaiaModel: string
  setCurrentMaiaModel: (model: string) => void
  showTopMoveBadges: boolean
  setShowTopMoveBadges: (show: boolean) => void
  stockfishDepth?: number
  setStockfishDepth?: (depth: number) => void
  stockfishEnabled?: boolean
  setStockfishEnabled?: (enabled: boolean) => void
  launchContinue: () => void
  MAIA_MODELS: string[]
  game: AnalyzedGame
  currentNode: GameNode
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
  // Learn from mistakes props
  learnFromMistakesState?: LearnFromMistakesConfiguration
  learnFromMistakesCurrentInfo?: {
    mistake: MistakePosition
    progress: string
    isLastMistake: boolean
  } | null
  onShowSolution?: () => void
  onNextMistake?: () => void
  onStopLearnFromMistakes?: () => void
  onSelectPlayer?: (color: 'white' | 'black') => void
  lastMoveResult?: 'correct' | 'incorrect' | 'not-learning'
  showHumanBars?: boolean
  setShowHumanBars?: (show: boolean) => void
}

const SCREENS = [
  { id: 'configure', name: 'Options' },
  { id: 'export', name: 'Export' },
] as const

export const ConfigurableScreens: React.FC<Props> = ({
  currentMaiaModel,
  setCurrentMaiaModel,
  showTopMoveBadges,
  setShowTopMoveBadges,
  stockfishDepth,
  setStockfishDepth,
  stockfishEnabled,
  setStockfishEnabled,
  launchContinue,
  MAIA_MODELS,
  game,
  currentNode,
  onDeleteCustomGame,
  onAnalyzeEntireGame,
  onLearnFromMistakes,
  isAnalysisInProgress,
  isLearnFromMistakesActive,
  autoSave,
  learnFromMistakesState,
  learnFromMistakesCurrentInfo,
  onShowSolution,
  onNextMistake,
  onStopLearnFromMistakes,
  onSelectPlayer,
  lastMoveResult,
  showHumanBars,
  setShowHumanBars,
}) => {
  const [screenId, setScreenId] = useState<(typeof SCREENS)[number]['id']>(
    SCREENS[0].id,
  )
  // A game played here by a visitor who wasn't signed in has no name for them.
  const unnamedPlayer = ['play', 'hand', 'brain'].includes(game.type)
    ? 'Guest'
    : '?'

  // If learn from mistakes is active, show only the learning interface
  if (
    isLearnFromMistakesActive &&
    learnFromMistakesState &&
    (learnFromMistakesCurrentInfo || learnFromMistakesState.showPlayerSelection)
  ) {
    return (
      <div className="flex w-full flex-1 flex-col overflow-hidden border-glass-border bg-glass md:w-auto md:rounded">
        <div className="red-scrollbar flex flex-1 flex-col items-start justify-start overflow-y-scroll">
          <LearnFromMistakes
            state={learnFromMistakesState}
            currentInfo={learnFromMistakesCurrentInfo || null}
            onShowSolution={
              onShowSolution ||
              (() => {
                /* no-op */
              })
            }
            onNext={
              onNextMistake ||
              (() => {
                /* no-op */
              })
            }
            onStop={
              onStopLearnFromMistakes ||
              (() => {
                /* no-op */
              })
            }
            onSelectPlayer={
              onSelectPlayer ||
              (() => {
                /* no-op */
              })
            }
            lastMoveResult={lastMoveResult || 'not-learning'}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden border border-glass-border bg-glass md:w-auto md:rounded">
      <UnderlineTabs
        tabs={SCREENS}
        selected={screenId}
        onSelect={setScreenId}
        layoutId="selectedScreen"
      />
      <div className="red-scrollbar flex flex-1 flex-col items-start justify-start overflow-y-scroll">
        {screenId === 'configure' ? (
          <ConfigureAnalysis
            currentMaiaModel={currentMaiaModel}
            setCurrentMaiaModel={setCurrentMaiaModel}
            showTopMoveBadges={showTopMoveBadges}
            setShowTopMoveBadges={setShowTopMoveBadges}
            stockfishDepth={stockfishDepth}
            setStockfishDepth={setStockfishDepth}
            stockfishEnabled={stockfishEnabled}
            setStockfishEnabled={setStockfishEnabled}
            launchContinue={launchContinue}
            MAIA_MODELS={MAIA_MODELS}
            game={game}
            onDeleteCustomGame={onDeleteCustomGame}
            onAnalyzeEntireGame={onAnalyzeEntireGame}
            onLearnFromMistakes={onLearnFromMistakes}
            isAnalysisInProgress={isAnalysisInProgress}
            isLearnFromMistakesActive={isLearnFromMistakesActive}
            autoSave={autoSave}
            showHumanBars={showHumanBars}
            setShowHumanBars={setShowHumanBars}
          />
        ) : screenId === 'export' ? (
          <div className="flex w-full flex-col p-3">
            <ExportGame
              game={game}
              currentNode={currentNode}
              whitePlayer={pgnNameOr(game.whitePlayer.name, unnamedPlayer)}
              blackPlayer={pgnNameOr(game.blackPlayer.name, unnamedPlayer)}
              whiteElo={game.whitePlayer.rating}
              blackElo={game.blackPlayer.rating}
              // A custom game's time is when it was imported, not played.
              date={
                game.createdAt && game.type !== 'custom'
                  ? formatPgnDate(new Date(game.createdAt))
                  : undefined
              }
              event="Analysis"
              type="analysis"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
