import React from 'react'
import Image from 'next/image'
import { CompletedDrill, OpeningSelection } from 'src/types/openings'

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
}) => {
  const containerClass = embedded
    ? 'flex h-full w-full flex-col 2xl:min-w-72'
    : 'flex h-full w-full flex-col border-r border-white/10 bg-background-1 2xl:min-w-72'

  const sectionHeaderClass = embedded
    ? 'px-4 pt-4'
    : 'border-b border-white/10 p-4'

  const listHeaderClass = embedded
    ? 'px-4 pb-2'
    : 'border-b border-white/10 px-3 py-2'

  return (
    <div className={containerClass}>
      {/* Current Drill Info */}
      <div className={sectionHeaderClass}>
        <h2 className="mb-2 text-base font-semibold text-white/95">
          Current Drill
        </h2>
        {currentDrill ? (
          <div className="space-y-2">
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

      {/* All Drills List */}
      <div className="flex h-96 flex-col overflow-hidden">
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
                        {!shouldHide && (
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <div className="relative h-3 w-3">
                              <Image
                                src={
                                  drill.playerColor === 'white'
                                    ? '/assets/pieces/white king.svg'
                                    : '/assets/pieces/black king.svg'
                                }
                                fill={true}
                                alt={`${drill.playerColor} king`}
                              />
                            </div>
                            <span className="text-white/70">
                              vs Maia{' '}
                              {drill.maiaVersion.replace('maia_kdd_', '')}
                            </span>
                            <span className="text-white/70">
                              • {drill.targetMoveNumber} moves
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
