import React, { useContext } from 'react'
import Image from 'next/image'
import { CompletedDrill, OpeningSelection } from 'src/types/openings'
import { BoardController, MovesContainer } from 'src/components'
import { TreeControllerContext } from 'src/contexts'
import { GameNode } from 'src/types'

interface Props {
  currentDrill: OpeningSelection | null
  completedDrills: CompletedDrill[]
  selectionPool: OpeningSelection[]
  onLoadCompletedDrill?: (drill: CompletedDrill) => void
  embedded?: boolean
  // New optional props to render moves + controller
  openingEndNode?: GameNode | null
  analysisEnabled?: boolean
  continueAnalyzingMode?: boolean
  drillTerminationNote?: string
}

export const OpeningDrillSidebar: React.FC<Props> = ({
  currentDrill,
  completedDrills,
  selectionPool,
  onLoadCompletedDrill,
  embedded = false,
  openingEndNode,
  analysisEnabled,
  continueAnalyzingMode,
  drillTerminationNote,
}) => {
  const containerClass = embedded
    ? 'flex h-full w-full max-w-full flex-col'
    : 'flex h-full w-full max-w-full flex-col border-r border-glass-border'

  const sectionHeaderClass = embedded
    ? 'px-4 py-4 w-full'
    : 'border-b border-glass-border p-4 w-full'

  const listHeaderClass = embedded
    ? 'px-4 py-2'
    : 'border-b border-glass-border px-3 py-2'

  const tree = useContext(TreeControllerContext)

  const currentIsEndgame = currentDrill?.opening.categoryType === 'endgame'
  const currentTraitLabel = currentDrill?.endgameMeta?.traitLabel
  const currentGroupLabel = currentDrill?.endgameMeta?.groupLabel

  const poolCategory =
    selectionPool[0]?.opening.categoryType ??
    currentDrill?.opening.categoryType ??
    'opening'
  const poolLabel =
    poolCategory === 'endgame'
      ? 'Endgame'
      : poolCategory === 'custom'
        ? 'Position'
        : 'Opening'
  const poolLabelPlural =
    poolLabel === 'Endgame'
      ? 'Endgames'
      : poolLabel === 'Opening'
        ? 'Openings'
        : 'Positions'

  // Navigation guards to respect opening start
  const customGoToPreviousNode = () => {
    if (!tree) return
    if (!openingEndNode) {
      tree.goToPreviousNode()
      return
    }
    const atOpeningEnd = tree.currentNode === openingEndNode
    const wouldLandOnOpeningEnd =
      !!tree.currentNode?.parent &&
      tree.currentNode.parent.fen === openingEndNode.fen

    if (atOpeningEnd || wouldLandOnOpeningEnd) return
    tree.goToPreviousNode()
  }

  const customGoToRootNode = () => {
    if (!tree) return
    if (!openingEndNode) {
      tree.goToRootNode()
      return
    }
    tree.goToNode(openingEndNode)
  }

  const handleSetOrientation = (orientation: 'white' | 'black') => {
    tree?.setOrientation(orientation)
  }

  return (
    <div className={containerClass}>
      {/* Current Drill Info */}
      <div className={sectionHeaderClass}>
        <h2 className="mb-2 text-base font-semibold text-white/95">
          Current Drill
        </h2>
        {currentDrill ? (
          <div className="flex flex-col gap-1">
            <div>
              <p className="text-sm font-medium text-white/95">
                {currentIsEndgame
                  ? currentGroupLabel || currentDrill.opening.name
                  : currentDrill.opening.name}
              </p>
              {currentIsEndgame
                ? currentTraitLabel && (
                    <p className="text-xs text-human-3">{currentTraitLabel}</p>
                  )
                : currentDrill.variation && (
                    <p className="text-xs text-white/70">
                      {currentDrill.variation.name}
                    </p>
                  )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
              {currentIsEndgame ? (
                <span className="material-symbols-outlined text-sm text-human-3 md:text-base">
                  trophy
                </span>
              ) : (
                <div className="relative h-4 w-4">
                  <Image
                    src={
                      currentDrill.playerColor === 'white'
                        ? '/assets/pieces/white king.svg'
                        : '/assets/pieces/black king.svg'
                    }
                    fill={true}
                    alt={`${currentDrill.playerColor} king`}
                  />
                </div>
              )}
              <span>
                vs Maia {currentDrill.maiaVersion.replace('maia_kdd_', '')}
              </span>
              {currentIsEndgame ? (
                <>
                  <span>•</span>
                  <span>
                    {currentDrill.playerColor === 'white'
                      ? 'White to move'
                      : 'Black to move'}
                  </span>
                </>
              ) : (
                <>
                  <span>•</span>
                  <span>{currentDrill.targetMoveNumber} moves</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/70">No drill selected</p>
        )}
      </div>

      {/* Completed drills history */}
      <div className="flex h-96 w-full flex-col overflow-hidden border-t border-glass-border">
        <div className={listHeaderClass}>
          <h3 className="text-sm font-medium text-white/90">
            Completed Drills ({completedDrills.length})
          </h3>
        </div>
        <div className="red-scrollbar flex h-full flex-col overflow-y-auto">
          {completedDrills.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 py-6">
              <p className="max-w-[13rem] text-center text-xs text-white/70">
                Complete drills to see your history here.
              </p>
            </div>
          ) : (
            [...completedDrills]
              .map((drill, index) => ({ drill, order: index + 1 }))
              .map(({ drill, order }) => {
                const selection = drill.selection
                return (
                  <button
                    key={`${selection.id}-history-${order}`}
                    className={`w-full border-b border-white/5 px-3 py-3 text-left transition-colors ${
                      onLoadCompletedDrill
                        ? 'cursor-pointer hover:bg-white/5'
                        : 'cursor-default'
                    }`}
                    onClick={() => onLoadCompletedDrill?.(drill)}
                    disabled={!onLoadCompletedDrill}
                  >
                    <div className="flex items-start gap-2">
                      {selection.opening.categoryType === 'endgame' ? (
                        <span className="material-symbols-outlined mt-0.5 text-sm text-human-3 md:text-base">
                          trophy
                        </span>
                      ) : (
                        <div className="relative mt-0.5 h-4 w-4 flex-shrink-0">
                          <Image
                            src={
                              selection.playerColor === 'white'
                                ? '/assets/pieces/white king.svg'
                                : '/assets/pieces/black king.svg'
                            }
                            fill={true}
                            alt={`${selection.playerColor} king`}
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xxs text-secondary">
                          Drill #{order}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-white/95">
                            {selection.opening.name}
                          </p>
                          {selection.opening.isCustom && (
                            <span className="rounded border border-human-4/40 bg-human-4/10 px-2 py-0.5 text-xxs font-semibold uppercase tracking-wide text-human-2">
                              Custom
                            </span>
                          )}
                        </div>
                        {selection.opening.categoryType === 'endgame'
                          ? selection.endgameMeta?.traitLabel && (
                              <p className="text-xs text-human-3">
                                {selection.endgameMeta.traitLabel}
                              </p>
                            )
                          : selection.variation && (
                              <p className="text-xs text-white/70">
                                {selection.variation.name}
                              </p>
                            )}
                      </div>
                    </div>
                  </button>
                )
              })
          )}
        </div>
        <div className="flex flex-col gap-1 border-t border-glass-border px-0 py-2">
          <h3 className="px-4 text-sm font-medium text-white/90">
            Active {poolLabel} Pool ({selectionPool.length})
          </h3>
          {selectionPool.length === 0 ? (
            <p className="mt-2 text-xs text-white/70">
              Add {poolLabelPlural.toLowerCase()} to begin drilling.
            </p>
          ) : (
            <div className="flex w-full flex-col">
              {selectionPool.map((selection, index) => (
                <div
                  key={`pool-${selection.id}-${index}`}
                  className="flex w-full items-center gap-2 px-4 py-1"
                >
                  {selection.opening.categoryType === 'endgame' ? (
                    <span className="material-symbols-outlined text-sm text-human-3 md:text-base">
                      trophy
                    </span>
                  ) : (
                    <div className="relative h-4 w-4 flex-shrink-0">
                      <Image
                        src={
                          selection.playerColor === 'white'
                            ? '/assets/pieces/white king.svg'
                            : '/assets/pieces/black king.svg'
                        }
                        fill={true}
                        alt={`${selection.playerColor} king`}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-xs font-medium text-white/90">
                        {selection.opening.name}
                      </p>
                      {selection.opening.isCustom && (
                        <span className="rounded border border-human-4/40 bg-human-4/10 px-2 py-0.5 text-xxs font-semibold uppercase tracking-wide text-human-2">
                          Custom
                        </span>
                      )}
                    </div>
                    {selection.opening.categoryType === 'endgame'
                      ? selection.endgameMeta?.traitLabel && (
                          <p className="text-xxs text-human-3">
                            {selection.endgameMeta.traitLabel}
                          </p>
                        )
                      : selection.variation && (
                          <p className="truncate text-[11px] text-white/60">
                            {selection.variation.name}
                          </p>
                        )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Moves + Controller (embedded) */}
      {tree?.gameTree && currentDrill && (
        <div className="flex w-full flex-1 flex-col overflow-hidden border-t border-glass-border">
          <div className="red-scrollbar flex w-full flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <MovesContainer
              game={{ id: currentDrill.id, tree: tree.gameTree }}
              startFromNode={openingEndNode || undefined}
              restrictNavigationBefore={openingEndNode || undefined}
              terminationNote={drillTerminationNote}
              showAnnotations={!!(analysisEnabled || continueAnalyzingMode)}
              showVariations={!!continueAnalyzingMode}
              embedded
              heightClass="h-40"
            />
            <BoardController
              gameTree={tree.gameTree}
              orientation={tree.orientation}
              setOrientation={handleSetOrientation}
              currentNode={tree.currentNode}
              plyCount={tree.plyCount}
              goToNode={tree.goToNode}
              goToNextNode={tree.goToNextNode}
              goToPreviousNode={customGoToPreviousNode}
              goToRootNode={customGoToRootNode}
              disableFlip={true}
              disablePrevious={
                openingEndNode
                  ? tree.currentNode === openingEndNode ||
                    (!!tree.currentNode?.parent &&
                      tree.currentNode.parent.fen === openingEndNode.fen)
                  : false
              }
              embedded
            />
          </div>
        </div>
      )}
    </div>
  )
}
