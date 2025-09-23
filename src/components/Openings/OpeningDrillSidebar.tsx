import React, { useContext } from 'react'
import Image from 'next/image'
import { CompletedDrill, OpeningSelection } from 'src/types/openings'
import { BoardController, MovesContainer } from 'src/components'
import { TreeControllerContext } from 'src/contexts'
import { GameNode } from 'src/types'

interface Props {
  currentDrill: OpeningSelection | null
  completedDrills: CompletedDrill[]
  remainingDrills: OpeningSelection[]
  currentDrillIndex: number
  totalDrills: number
  drillSequence: OpeningSelection[]
  onResetCurrentDrill: () => void
  onChangeSelections?: () => void
  onLoadCompletedDrill?: (drill: CompletedDrill) => void
  onNavigateToDrill?: (drillIndex: number) => void
  embedded?: boolean
  // New optional props to render moves + controller
  openingEndNode?: GameNode | null
  analysisEnabled?: boolean
  continueAnalyzingMode?: boolean
}

export const OpeningDrillSidebar: React.FC<Props> = ({
  currentDrill,
  completedDrills,
  remainingDrills,
  currentDrillIndex,
  totalDrills,
  drillSequence,
  onResetCurrentDrill,
  onChangeSelections,
  onLoadCompletedDrill,
  onNavigateToDrill,
  embedded = false,
  openingEndNode,
  analysisEnabled,
  continueAnalyzingMode,
}) => {
  const containerClass = embedded
    ? 'flex h-full w-full max-w-full flex-col'
    : 'flex h-full w-full max-w-full flex-col border-r border-white/10 bg-background-1'

  const sectionHeaderClass = embedded
    ? 'px-4 py-4 w-full'
    : 'border-b border-white/10 p-4 w-full'

  const listHeaderClass = embedded
    ? 'px-4 py-2'
    : 'border-b border-white/10 px-3 py-2'

  const tree = useContext(TreeControllerContext)

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
    if (!openingEndNode) return tree?.goToRootNode()
    if (tree) {
      tree.goToNode(openingEndNode)
    }
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
                {currentDrill.opening.name}
              </p>
              {currentDrill.variation && (
                <p className="text-xs text-white/70">
                  {currentDrill.variation.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
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
              <span>
                vs Maia {currentDrill.maiaVersion.replace('maia_kdd_', '')}
              </span>
              <span>•</span>
              <span>{currentDrill.targetMoveNumber} moves</span>
            </div>
            {/* <div className="mt-3 flex gap-2">
            <button
                onClick={onResetCurrentDrill}
                className="w-full rounded bg-background-2 py-1 text-xs transition-colors hover:bg-background-3"
              >
                Reset Drill
              </button>
            {onChangeSelections && (
                <button
                  onClick={onChangeSelections}
                  className="w-full rounded bg-background-2 py-1 text-xs transition-colors hover:bg-background-3"
                >
                  Change
                </button>
              )}
            </div> */}
          </div>
        ) : (
          <p className="text-sm text-white/70">No drill selected</p>
        )}
      </div>

      {/* Separator between current drill and list */}
      <div className="h-3 w-full border-y border-glassBorder" />

      {/* All Drills List */}
      <div className="flex h-96 w-full flex-col overflow-hidden">
        <div className={listHeaderClass}>
          <h3 className="text-sm font-medium text-white/90">
            Drill Progress ({currentDrillIndex + 1} of {totalDrills})
          </h3>
        </div>
        <div className="red-scrollbar flex h-full flex-col overflow-y-auto">
          {drillSequence.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="max-w-[12rem] text-center text-xs text-white/70">
                No drills selected
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {drillSequence.map((drill, index) => {
                // Determine drill status
                const isCurrentDrill = index === currentDrillIndex
                const isCompleted = completedDrills.some(
                  (cd) => cd.selection.id === drill.id,
                )
                const isIncomplete = index < currentDrillIndex && !isCompleted

                // Get status info
                const getStatusInfo = () => {
                  if (isCompleted) {
                    return {
                      label: 'Completed',
                      color: 'text-green-400',
                      bgColor: 'bg-green-900/20 hover:bg-green-900/30',
                    }
                  } else if (isCurrentDrill) {
                    return {
                      label: 'Current',
                      color: 'text-blue-400',
                      bgColor: 'bg-blue-900/20 hover:bg-blue-900/30',
                    }
                  } else if (isIncomplete) {
                    return {
                      label: 'Incomplete',
                      color: 'text-yellow-400',
                      bgColor: 'bg-yellow-900/20 hover:bg-yellow-900/30',
                    }
                  } else {
                    return {
                      label: 'Pending',
                      color: 'text-secondary',
                      bgColor: 'bg-background-1 hover:bg-background-2',
                    }
                  }
                }

                const statusInfo = getStatusInfo()
                const drillNumber = index + 1

                const shouldHide =
                  !isCurrentDrill && !isCompleted && index > currentDrillIndex

                return (
                  <button
                    key={drill.id}
                    className={`w-full border-b border-white/5 px-3 py-2 text-left transition-colors ${
                      isCurrentDrill
                        ? 'border-human-4/30 bg-human-4/20'
                        : statusInfo.bgColor
                    } ${
                      onNavigateToDrill ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    onClick={() => onNavigateToDrill?.(index)}
                    disabled={!onNavigateToDrill}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-white/90">
                            Drill #{drillNumber}
                          </p>
                          <span
                            className={`text-xs font-medium ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        {!shouldHide && (
                          <>
                            <p className="text-xs text-white/90">
                              {drill.opening.name}
                            </p>
                            {drill.variation && (
                              <p className="text-xs text-white/70">
                                {drill.variation.name}
                              </p>
                            )}
                          </>
                        )}
                        {/* Details removed: icon, vs Maia, and move count */}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Moves + Controller (embedded) */}
      {tree?.gameTree && currentDrill && (
        <div className="flex w-full flex-1 flex-col overflow-hidden">
          <div className="h-3 border-b border-t border-glassBorder" />
          <div className="red-scrollbar flex w-full flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <MovesContainer
              game={{ id: currentDrill.id, tree: tree.gameTree }}
              startFromNode={openingEndNode || undefined}
              restrictNavigationBefore={openingEndNode || undefined}
              showAnnotations={!!(analysisEnabled || continueAnalyzingMode)}
              showVariations={!!continueAnalyzingMode}
              embedded
              heightClass="h-40"
            />
            <BoardController
              gameTree={tree.gameTree}
              orientation={tree.orientation}
              setOrientation={() => {}}
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
