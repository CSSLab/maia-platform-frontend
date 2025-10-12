import React, { useState, useMemo, useEffect, useContext } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import Chessground from '@react-chess/chessground'
import { Chess } from 'chess.ts'
import {
  Opening,
  OpeningVariation,
  OpeningSelection,
  DrillConfiguration,
} from 'src/types'
import { ModalContainer } from '../Common/ModalContainer'
import { useTour } from 'src/contexts'
import { tourConfigs } from 'src/constants/tours'
import { WindowSizeContext } from 'src/contexts/WindowSizeContext'
import {
  trackOpeningSelectionModalOpened,
  trackOpeningSearchUsed,
  trackOpeningPreviewSelected,
  trackOpeningQuickAddUsed,
  trackOpeningConfiguredAndAdded,
  trackOpeningRemovedFromSelection,
  trackDrillConfigurationCompleted,
} from 'src/lib/analytics'
import { MAIA_MODELS_WITH_NAMES } from 'src/constants/common'

type MobileTab = 'browse' | 'selected'

const DEFAULT_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const PGN_RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*'])

interface Props {
  openings: Opening[]
  endgames?: Opening[]
  initialSelections?: OpeningSelection[]
  onComplete: (configuration: DrillConfiguration) => void
  onClose: () => void
}

interface MobileOpeningPopupProps {
  opening: Opening
  variation: OpeningVariation | null
  isOpen: boolean
  onClose: () => void
  onAdd: (color: 'white' | 'black') => void
  onRemove: () => void
  isSelected: boolean
}

const MobileOpeningPopup: React.FC<MobileOpeningPopupProps> = ({
  opening,
  variation,
  isOpen,
  onClose,
  onAdd,
  onRemove,
  isSelected,
}) => {
  const [selectedColor, setSelectedColor] = useState<'white' | 'black'>('white')
  const previewFen = useMemo(() => {
    return variation ? variation.fen : opening.fen
  }, [opening, variation])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/90">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-glass-border bg-glass p-4 backdrop-blur-md">
        <div className="mb-4">
          <h3 className="text-lg font-bold">{opening.name}</h3>
          {variation && (
            <p className="text-sm text-secondary">{variation.name}</p>
          )}
        </div>

        <div className="mb-4">
          <div className="mx-auto aspect-square w-full max-w-[200px]">
            <Chessground
              contained
              config={{
                viewOnly: true,
                fen: previewFen,
                coordinates: true,
                animation: { enabled: true, duration: 200 },
                orientation: selectedColor,
              }}
            />
          </div>
        </div>

        {!isSelected && (
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium">Play as:</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedColor('white')}
                className={`flex items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                  selectedColor === 'white'
                    ? 'border-glass-border bg-white/10 text-white'
                    : 'border-glass-border bg-white/5 text-white/90 hover:bg-white/10'
                }`}
              >
                <div className="relative h-4 w-4">
                  <Image
                    src="/assets/pieces/white king.svg"
                    fill={true}
                    alt="white king"
                  />
                </div>
                White
              </button>
              <button
                onClick={() => setSelectedColor('black')}
                className={`flex items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                  selectedColor === 'black'
                    ? 'border-glass-border bg-white/10 text-white'
                    : 'border-glass-border bg-white/5 text-white/90 hover:bg-white/10'
                }`}
              >
                <div className="relative h-4 w-4">
                  <Image
                    src="/assets/pieces/black king.svg"
                    fill={true}
                    alt="black king"
                  />
                </div>
                Black
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-glass-border bg-white/5 py-2 text-sm font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          {isSelected ? (
            <button
              onClick={onRemove}
              className="flex-1 rounded border border-glass-border bg-white/5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Remove
            </button>
          ) : (
            <button
              onClick={() => onAdd(selectedColor)}
              className="flex-1 rounded border border-glass-border bg-white/5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Add Drill
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const TabNavigation: React.FC<{
  activeTab: MobileTab
  setActiveTab: (tab: MobileTab) => void
  selectionsCount: number
}> = ({ activeTab, setActiveTab, selectionsCount }) => {
  const { isMobile } = useContext(WindowSizeContext)

  return (
    <div className="flex w-full border-b border-glass-border md:hidden">
      <button
        {...(isMobile ? { id: 'opening-drill-browse' } : {})}
        onClick={() => setActiveTab('browse')}
        className={`flex-1 py-3 text-sm font-medium transition-colors ${
          activeTab === 'browse'
            ? 'border-b-2 border-human-4 text-primary'
            : 'text-secondary hover:text-primary'
        }`}
      >
        Browse
      </button>
      <button
        {...(isMobile ? { id: 'opening-drill-selected' } : {})}
        onClick={() => setActiveTab('selected')}
        className={`flex-1 py-3 text-sm font-medium transition-colors ${
          activeTab === 'selected'
            ? 'border-b-2 border-human-4 text-primary'
            : 'text-secondary hover:text-primary'
        }`}
      >
        Selected ({selectionsCount})
      </button>
    </div>
  )
}

// Left Panel - Opening Selection
const BrowsePanel: React.FC<{
  activeTab: MobileTab
  filteredOpenings: Opening[]
  previewOpening: Opening
  previewVariation: OpeningVariation | null
  setPreviewOpening: (opening: Opening) => void
  setPreviewVariation: (variation: OpeningVariation | null) => void
  setActiveTab: (tab: MobileTab) => void
  addQuickSelection: (
    opening: Opening,
    variation: OpeningVariation | null,
  ) => void
  isDuplicateSelection: (
    opening: Opening,
    variation: OpeningVariation | null,
  ) => boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
  selections: OpeningSelection[]
  onOpeningClick: (opening: Opening, variation: OpeningVariation | null) => void
  removeSelection: (id: string) => void
  onRemoveCustomOpening: (openingId: string) => void
  browseCategory: 'openings' | 'endgames' | 'custom'
  setBrowseCategory: (category: 'openings' | 'endgames' | 'custom') => void
  customInput: string
  setCustomInput: (value: string) => void
  customError: string | null
  onAddCustomPosition: () => void
  categoryLabel: string
  categoryLabelPlural: string
}> = ({
  activeTab,
  filteredOpenings,
  previewOpening,
  previewVariation,
  setPreviewOpening,
  setPreviewVariation,
  setActiveTab,
  addQuickSelection,
  isDuplicateSelection,
  searchTerm,
  setSearchTerm,
  selections,
  onOpeningClick,
  removeSelection,
  onRemoveCustomOpening,
  browseCategory,
  setBrowseCategory,
  customInput,
  setCustomInput,
  customError,
  onAddCustomPosition,
  categoryLabel,
  categoryLabelPlural,
}) => {
  const { isMobile } = useContext(WindowSizeContext)
  const isCustomCategory = browseCategory === 'custom'

  const searchPlaceholder = `Search ${categoryLabelPlural.toLowerCase()}...`

  const removeOpeningSelection = (
    opening: Opening,
    variation: OpeningVariation | null,
  ) => {
    const selectionToRemove = selections.find(
      (selection) =>
        selection.opening.id === opening.id &&
        selection.variation?.id === variation?.id,
    )
    if (selectionToRemove) {
      removeSelection(selectionToRemove.id)
    }
  }

  const renderTabs = () => (
    <div className="grid w-full select-none grid-cols-3 items-center justify-between overflow-hidden border-b border-glass-border">
      {[
        { label: 'Openings', value: 'openings' as const },
        { label: 'Endgames', value: 'endgames' as const },
        { label: 'Custom', value: 'custom' as const },
      ].map(({ label, value }) => {
        const isSelected = browseCategory === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => {
              setBrowseCategory(value)
              setActiveTab('browse')
            }}
            aria-pressed={isSelected}
            className={`relative flex-1 px-3 py-2 text-xs font-medium transition-all duration-200 md:text-sm ${
              isSelected
                ? 'bg-white/10 text-white'
                : 'hover:bg-white/8 bg-white/5 text-white/60 hover:text-white/90'
            }`}
          >
            <span>{label}</span>
            {isSelected && (
              <motion.div
                layoutId="browse-category-underline"
                className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-primary/50"
              />
            )}
          </button>
        )
      })}
    </div>
  )

  if (isCustomCategory) {
    return (
      <div
        id="opening-drill-browse"
        className={`flex w-full flex-col overflow-hidden ${activeTab !== 'browse' ? 'hidden md:flex' : 'flex'} md:border-r md:border-glass-border`}
      >
        {renderTabs()}
        <form
          className="flex h-20 flex-col gap-3 border-b border-glass-border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            onAddCustomPosition()
          }}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Drill a custom FEN/PGN"
              className="h-full flex-1 rounded border border-glass-border bg-white/5 px-3 text-sm text-white placeholder-primary/50 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <button
              type="submit"
              className="flex h-10 items-center justify-center rounded border border-human-4/50 bg-human-4/20 px-4 text-xs font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-human-4/30 md:h-10"
              disabled={!customInput.trim()}
            >
              Add Position
            </button>
          </div>
          {customError && <p className="text-xs text-red-400">{customError}</p>}
        </form>

        <div className="border-b border-glass-border p-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary">
              search
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded border border-glass-border bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/60 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 p-3 text-xs text-secondary md:p-4">
          <p>Saved custom positions:</p>
        </div>

        <div className="red-scrollbar flex flex-1 flex-col overflow-y-auto">
          {filteredOpenings.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-secondary md:text-sm">
              No saved positions yet. Add a FEN or PGN above to get started.
            </div>
          ) : (
            filteredOpenings.map((opening) => {
              const openingIsSelected = selections.some(
                (selection) =>
                  selection.opening.id === opening.id &&
                  selection.variation === null,
              )
              const openingIsBeingPreviewed =
                previewOpening.id === opening.id && !previewVariation

              return (
                <div
                  key={opening.id}
                  className={`group border-b border-white/5 transition-colors ${
                    openingIsSelected
                      ? 'bg-white/5'
                      : openingIsBeingPreviewed
                        ? 'bg-white/5'
                        : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center">
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex-1 cursor-pointer p-4"
                      onClick={() => {
                        setPreviewOpening(opening)
                        setPreviewVariation(null)
                        trackOpeningPreviewSelected(
                          opening.name,
                          opening.id,
                          false,
                        )
                        if (isMobile) {
                          onOpeningClick(opening, null)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setPreviewOpening(opening)
                          setPreviewVariation(null)
                          trackOpeningPreviewSelected(
                            opening.name,
                            opening.id,
                            false,
                          )
                          if (isMobile) {
                            onOpeningClick(opening, null)
                          }
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{opening.name}</h3>
                            <span className="rounded border border-human-4/40 bg-human-4/10 px-2 py-0.5 text-xxs font-semibold uppercase tracking-wide text-human-2">
                              Custom
                            </span>
                          </div>
                          <p className="text-xs text-secondary">
                            {opening.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mr-1 flex items-center gap-1">
                      {openingIsSelected ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeOpeningSelection(opening, null)
                          }}
                          className="rounded p-1 text-white/70 transition-colors hover:text-white"
                          title="Remove position from selection"
                        >
                          <span className="material-symbols-outlined !text-base">
                            check
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            addQuickSelection(opening, null)
                          }}
                          className="rounded p-1 text-secondary/60 transition-colors hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30 group-hover:text-secondary/80"
                          title="Add position with current settings"
                        >
                          <span className="material-symbols-outlined !text-base">
                            add
                          </span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveCustomOpening(opening.id)
                        }}
                        className="rounded p-1 text-secondary/60 transition-colors hover:text-secondary"
                        title="Remove custom position"
                      >
                        <span className="material-symbols-outlined !text-base">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      id="opening-drill-browse"
      className={`flex w-full flex-col overflow-hidden ${activeTab !== 'browse' ? 'hidden md:flex' : 'flex'} md:border-r md:border-glass-border`}
    >
      {renderTabs()}
      <div className="hidden h-20 flex-col justify-center gap-1 border-b border-glass-border p-4 md:flex">
        <h2 className="text-xl font-bold">Select {categoryLabelPlural}</h2>
        <p className="text-xs text-secondary">
          Browse and select {categoryLabelPlural.toLowerCase()} to drill.
        </p>
      </div>

      <div className="flex h-16 flex-col justify-center gap-1 border-b border-glass-border p-4 md:hidden">
        <h2 className="text-lg font-bold">Select {categoryLabelPlural}</h2>
        <p className="text-xs text-secondary">
          Choose {categoryLabelPlural.toLowerCase()} to practice
        </p>
      </div>

      <div className="border-b border-glass-border p-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary">
            search
          </span>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded border border-glass-border bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/60 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
      </div>

      <div
        className="red-scrollbar flex flex-1 flex-col overflow-y-auto"
        style={{ userSelect: 'none' }}
      >
        {filteredOpenings.map((opening) => {
          const openingIsSelected = selections.some(
            (selection) =>
              selection.opening.id === opening.id &&
              selection.variation === null,
          )
          const openingIsBeingPreviewed =
            previewOpening.id === opening.id && !previewVariation
          return (
            <div key={opening.id} className="flex flex-col">
              <div
                className={`group transition-colors ${
                  isMobile
                    ? openingIsSelected
                      ? 'bg-white/5'
                      : ''
                    : openingIsSelected
                      ? 'bg-white/5'
                      : openingIsBeingPreviewed
                        ? 'bg-white/5'
                        : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center">
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex-1 cursor-pointer p-4"
                    onClick={() => {
                      setPreviewOpening(opening)
                      setPreviewVariation(null)
                      trackOpeningPreviewSelected(
                        opening.name,
                        opening.id,
                        false,
                      )
                      if (isMobile) {
                        onOpeningClick(opening, null)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setPreviewOpening(opening)
                        setPreviewVariation(null)
                        trackOpeningPreviewSelected(
                          opening.name,
                          opening.id,
                          false,
                        )
                        if (isMobile) {
                          onOpeningClick(opening, null)
                        }
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{opening.name}</h3>
                        <p className="text-sm text-secondary">
                          {opening.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mr-1 flex items-center gap-1">
                    {openingIsSelected ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeOpeningSelection(opening, null)
                        }}
                        className="rounded p-1 text-white/70 transition-colors hover:text-white"
                        title={`Remove ${categoryLabel.toLowerCase()} from selection`}
                      >
                        <span className="material-symbols-outlined !text-base">
                          check
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          addQuickSelection(opening, null)
                        }}
                        className="rounded p-1 text-secondary/60 transition-colors hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30 group-hover:text-secondary/80"
                        title={`Add ${categoryLabel.toLowerCase()} with current settings`}
                      >
                        <span className="material-symbols-outlined !text-base">
                          add
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {opening.variations.map((variation) => {
                const variationIsSelected = selections.some(
                  (selection) =>
                    selection.opening.id === opening.id &&
                    selection.variation?.id === variation.id,
                )
                const variationIsBeingPreviewed =
                  previewOpening.id === opening.id &&
                  previewVariation?.id === variation.id

                return (
                  <div
                    key={variation.id}
                    className={`group transition-colors ${
                      isMobile
                        ? variationIsSelected
                          ? 'bg-white/5'
                          : ''
                        : variationIsSelected
                          ? 'bg-white/5'
                          : variationIsBeingPreviewed
                            ? 'bg-white/5'
                            : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        role="button"
                        tabIndex={0}
                        className="flex-1 cursor-pointer px-6 py-1"
                        onClick={() => {
                          setPreviewOpening(opening)
                          setPreviewVariation(variation)
                          trackOpeningPreviewSelected(
                            opening.name,
                            opening.id,
                            true,
                            variation.name,
                          )
                          if (isMobile) {
                            onOpeningClick(opening, variation)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setPreviewOpening(opening)
                            setPreviewVariation(variation)
                            trackOpeningPreviewSelected(
                              opening.name,
                              opening.id,
                              true,
                              variation.name,
                            )
                            if (isMobile) {
                              onOpeningClick(opening, variation)
                            }
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-secondary">
                            {variation.name}
                          </p>
                        </div>
                      </div>
                      {variationIsSelected ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeOpeningSelection(opening, variation)
                          }}
                          className="mr-3 rounded p-1 text-white/70 transition-colors hover:text-white"
                          title="Remove variation from selection"
                        >
                          <span className="material-symbols-outlined !text-base">
                            check
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            addQuickSelection(opening, variation)
                          }}
                          className="mr-3 rounded p-1 text-secondary/60 transition-colors hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30 group-hover:text-secondary/80"
                          title="Add variation with current settings"
                        >
                          <span className="material-symbols-outlined !text-base">
                            add
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
const PreviewPanel: React.FC<{
  selections: OpeningSelection[]
  previewOpening: Opening
  previewVariation: OpeningVariation | null
  previewFen: string
  selectedColor: 'white' | 'black'
  setSelectedColor: (color: 'white' | 'black') => void
  addSelection: () => void
  panelLabel: string
}> = ({
  selections,
  previewOpening,
  previewVariation,
  previewFen,
  selectedColor,
  setSelectedColor,
  addSelection,
  panelLabel,
}) => {
  const isDuplicateSelection = (
    opening: Opening,
    variation: OpeningVariation | null,
  ) => {
    return selections.some(
      (selection) =>
        selection.opening.id === opening.id &&
        selection.variation?.id === variation?.id,
    )
  }

  return (
    <div
      id="opening-drill-preview"
      className="hidden w-full flex-col overflow-hidden md:flex"
    >
      <div className="hidden h-20 flex-col justify-center gap-1 border-b border-glass-border p-4 md:flex">
        <h2 className="text-xl font-bold">Preview {panelLabel}</h2>
        <p className="text-xs text-secondary">Configure your drill settings</p>
      </div>

      <div className="red-scrollbar flex flex-1 flex-col gap-4 overflow-y-scroll p-3 md:p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium md:text-base">
            {previewOpening.name}
            <span className="text-xs font-normal text-secondary md:text-sm">
              {previewVariation && ` → ${previewVariation.name}`}
            </span>
          </p>
          <p className="text-xs text-secondary">{previewOpening.description}</p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium md:text-sm">Play as:</p>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedColor('white')}
              className={`flex items-center gap-2 rounded border px-2 py-1 text-xs transition-colors md:px-3 md:py-2 md:text-sm ${
                selectedColor === 'white'
                  ? 'border-glass-border bg-white/10 text-white'
                  : 'border-glass-border bg-white/5 text-white/90 hover:bg-white/10'
              }`}
            >
              <div className="relative h-4 w-4 md:h-5 md:w-5">
                <Image
                  src="/assets/pieces/white king.svg"
                  fill={true}
                  alt="white king"
                />
              </div>
              White
            </button>
            <button
              onClick={() => setSelectedColor('black')}
              className={`flex items-center gap-2 rounded border px-2 py-1 text-xs transition-colors md:px-3 md:py-2 md:text-sm ${
                selectedColor === 'black'
                  ? 'border-glass-border bg-white/10 text-white'
                  : 'border-glass-border bg-white/5 text-white/90 hover:bg-white/10'
              }`}
            >
              <div className="relative h-4 w-4 md:h-5 md:w-5">
                <Image
                  src="/assets/pieces/black king.svg"
                  fill={true}
                  alt="black king"
                />
              </div>
              Black
            </button>
          </div>
        </div>

        <div className="flex w-full flex-col items-start justify-center gap-1">
          <p className="text-xs font-medium md:text-sm">Preview:</p>
          <div className="aspect-square w-full max-w-[250px] self-center md:max-w-[300px]">
            <Chessground
              contained
              config={{
                viewOnly: true,
                fen: previewFen,
                coordinates: true,
                animation: { enabled: true, duration: 200 },
                orientation: selectedColor,
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-glass-border p-3 md:p-4">
        <button
          onClick={addSelection}
          disabled={isDuplicateSelection(previewOpening, previewVariation)}
          className="w-full rounded border border-glass-border bg-white/5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          title={
            isDuplicateSelection(previewOpening, previewVariation)
              ? 'Already added with same settings'
              : 'Add to Drill'
          }
        >
          {isDuplicateSelection(previewOpening, previewVariation)
            ? 'Drill Already Added'
            : 'Add to Drill'}
        </button>
      </div>
    </div>
  )
}

const SelectedPanel: React.FC<{
  activeTab: MobileTab
  selections: OpeningSelection[]
  removeSelection: (id: string) => void
  handleStartDrilling: () => void
  selectedMaiaVersion: (typeof MAIA_MODELS_WITH_NAMES)[0]
  setSelectedMaiaVersion: (version: (typeof MAIA_MODELS_WITH_NAMES)[0]) => void
  targetMoveNumber: number
  setTargetMoveNumber: (number: number) => void
  categoryLabel: string
  categoryLabelPlural: string
}> = ({
  activeTab,
  selections,
  removeSelection,
  handleStartDrilling,
  selectedMaiaVersion,
  setSelectedMaiaVersion,
  targetMoveNumber,
  setTargetMoveNumber,
  categoryLabel,
  categoryLabelPlural,
}) => (
  <div
    id="opening-drill-selected"
    className={`flex w-full flex-col overflow-hidden ${activeTab !== 'selected' ? 'hidden md:flex' : 'flex'} md:border-l md:border-glass-border`}
  >
    <div className="hidden h-20 flex-col justify-center gap-1 border-b border-glass-border p-4 md:flex">
      <h2 className="text-xl font-bold">
        Selected {categoryLabelPlural} ({selections.length})
      </h2>
      <p className="text-xs text-secondary">
        Click × to remove from the selection
      </p>
    </div>

    {/* Mobile header */}
    <div className="flex h-16 flex-col justify-center gap-1 border-b border-glass-border p-4 md:hidden">
      <h2 className="text-lg font-bold">Selected ({selections.length})</h2>
      <p className="text-xs text-secondary">Tap to remove</p>
    </div>

    {/* Compact selections list - with constrained scrolling */}
    <div className="flex flex-1 flex-col overflow-hidden">
      {selections.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="max-w-xs px-4 text-center text-xs text-secondary md:text-sm">
            No {categoryLabelPlural.toLowerCase()} selected yet. Choose from the
            Browse tab to start drilling.
          </p>
        </div>
      ) : (
        <div className="red-scrollbar flex-1 overflow-y-auto">
          <div className="flex w-full flex-col">
            {selections.map((selection) => (
              <div
                key={selection.id}
                className="flex items-center justify-between border-b border-white/5 p-3 transition-colors md:px-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="relative h-4 w-4 flex-shrink-0 md:h-5 md:w-5">
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
                    <div className="flex min-w-0 flex-1 flex-row items-center gap-2">
                      <span className="truncate text-xs font-medium text-primary md:text-sm">
                        {selection.opening.name}
                      </span>
                      {selection.opening.isCustom && (
                        <span className="rounded border border-human-4/40 bg-human-4/10 px-2 py-0.5 text-xxs font-semibold uppercase tracking-wide text-human-2">
                          Custom
                        </span>
                      )}
                      {selection.variation && (
                        <span className="mt-1 truncate text-xxs text-secondary">
                          {selection.variation.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      removeSelection(selection.id)
                    }
                  }}
                  onClick={() => removeSelection(selection.id)}
                  className="ml-2 text-secondary transition-colors hover:text-white"
                >
                  <span className="material-symbols-outlined !text-lg">
                    close
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Fixed button section - always visible */}
    <div className="flex-shrink-0 border-t border-glass-border p-3 md:p-4">
      {/* Opponent Selection */}
      <div className="mb-3 md:mb-4">
        <p className="mb-1 text-xs font-medium md:mb-2 md:text-sm">Opponent:</p>
        <select
          value={selectedMaiaVersion.id}
          onChange={(e) => {
            const version = MAIA_MODELS_WITH_NAMES.find(
              (v) => v.id === e.target.value,
            )
            if (version) {
              setSelectedMaiaVersion(version)
            }
          }}
          className="w-full rounded border border-glass-border bg-white/5 p-2 text-xs text-white/90 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-white/20 md:text-sm"
        >
          {MAIA_MODELS_WITH_NAMES.map((version) => (
            <option key={version.id} value={version.id}>
              {version.name}
            </option>
          ))}
        </select>
      </div>

      {/* Target Move Count Configuration */}
      <div className="mb-3 md:mb-4">
        <p className="mb-1 text-xs font-medium md:mb-2 md:text-sm">
          Target Move Count: {targetMoveNumber}
        </p>
        <input
          type="range"
          min="5"
          max="20"
          value={targetMoveNumber}
          onChange={(e) => setTargetMoveNumber(parseInt(e.target.value) || 10)}
          className="w-full accent-human-4"
        />
        <div className="mt-1 flex justify-between text-xs text-secondary">
          <span>5</span>
          <span>20</span>
        </div>
      </div>

      <button
        onClick={handleStartDrilling}
        disabled={selections.length === 0}
        className="w-full rounded border border-glass-border bg-white/5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Start Drilling ({selections.length}{' '}
        {selections.length === 1 ? 'selection' : 'selections'})
      </button>
    </div>
  </div>
)

export const OpeningSelectionModal: React.FC<Props> = ({
  openings,
  endgames = [],
  initialSelections = [],
  onComplete,
  onClose,
}) => {
  const { startTour } = useTour()
  const { isMobile } = useContext(WindowSizeContext)

  const normalizedOpenings = useMemo(
    () =>
      openings.map((opening) => ({
        ...opening,
        categoryType: opening.categoryType ?? 'opening',
      })),
    [openings],
  )

  const normalizedEndgames = useMemo(
    () =>
      endgames.map((endgame) => ({
        ...endgame,
        categoryType: endgame.categoryType ?? 'endgame',
      })),
    [endgames],
  )

  const initialCustomOpenings = useMemo(() => {
    const builtInIds = new Set([
      ...normalizedOpenings.map((opening) => opening.id),
      ...normalizedEndgames.map((endgame) => endgame.id),
    ])

    const unique = new Map<string, Opening>()

    initialSelections.forEach((selection) => {
      const selectionOpening = selection.opening
      if (!builtInIds.has(selectionOpening.id)) {
        unique.set(selectionOpening.id, {
          ...selectionOpening,
          variations: (selectionOpening.variations || []).map((variation) => ({
            ...variation,
            isCustom: true,
          })),
          isCustom: true,
          categoryType: 'custom',
        })
      }
    })

    return Array.from(unique.values())
  }, [initialSelections, normalizedEndgames, normalizedOpenings])

  const fallbackOpening: Opening = {
    id: 'custom-fallback-position',
    name: 'Custom Position',
    description: 'Create a custom drill to get started.',
    fen: DEFAULT_START_FEN,
    pgn: '',
    variations: [],
    isCustom: true,
    categoryType: 'custom',
  }

  const [customOpenings, setCustomOpenings] = useState<Opening[]>(
    initialCustomOpenings,
  )
  const [selections, setSelections] =
    useState<OpeningSelection[]>(initialSelections)

  const hasOpenings = normalizedOpenings.length > 0
  const hasEndgames = normalizedEndgames.length > 0

  const [browseCategory, setBrowseCategory] = useState<
    'openings' | 'endgames' | 'custom'
  >(hasOpenings ? 'openings' : hasEndgames ? 'endgames' : 'custom')

  const initialPreview =
    initialCustomOpenings[0] ||
    (hasOpenings ? normalizedOpenings[0] : undefined) ||
    (hasEndgames ? normalizedEndgames[0] : undefined) ||
    fallbackOpening

  const [previewOpening, setPreviewOpening] = useState<Opening>(initialPreview)
  const [previewVariation, setPreviewVariation] =
    useState<OpeningVariation | null>(null)
  const [selectedMaiaVersion, setSelectedMaiaVersion] = useState(
    MAIA_MODELS_WITH_NAMES[4],
  )
  const [selectedColor, setSelectedColor] = useState<'white' | 'black'>('white')
  const [targetMoveNumber, setTargetMoveNumber] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<MobileTab>('browse')
  const [initialTourCheck, setInitialTourCheck] = useState(false)
  const [hasTrackedModalOpen, setHasTrackedModalOpen] = useState(false)
  const [mobilePopupOpening, setMobilePopupOpening] = useState<Opening | null>(
    null,
  )
  const [mobilePopupVariation, setMobilePopupVariation] =
    useState<OpeningVariation | null>(null)
  const [mobilePopupOpen, setMobilePopupOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)

  const handleAddCustomPosition = () => {
    const rawInput = customInput.trim()

    if (!rawInput) {
      setCustomError('Enter a PGN or FEN to create a custom drill.')
      return
    }

    const inputLines = rawInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    let detectedFen: string | undefined
    let remainingInput = ''

    if (inputLines.length > 0) {
      const potentialFen = inputLines[0]
      const fenTokens = potentialFen.split(/\s+/)
      if (fenTokens.length === 6 && potentialFen.includes('/')) {
        const fenTester = new Chess()
        try {
          if (fenTester.load(potentialFen)) {
            detectedFen = potentialFen
            inputLines.shift()
            remainingInput = inputLines.join(' ')
          }
        } catch (error) {
          // treat as PGN if parsing fails
        }
      }
    }

    if (!detectedFen) {
      remainingInput = rawInput
    }

    const chess = new Chess()

    if (detectedFen) {
      try {
        if (!chess.load(detectedFen)) {
          setCustomError('The supplied FEN could not be parsed.')
          return
        }
      } catch (error) {
        setCustomError('The supplied FEN could not be parsed.')
        return
      }
    } else {
      chess.load(DEFAULT_START_FEN)
    }

    let parsedPgn = ''

    if (remainingInput) {
      const sanitizedMoves = remainingInput
        .replace(/\{[^}]*\}/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\$\d+/g, ' ')
        .replace(/\d+\.\.\.|\d+\./g, ' ')
        .replace(/\r?\n/g, ' ')
        .split(/\s+/)
        .filter((token) => token && !PGN_RESULT_TOKENS.has(token))

      if (sanitizedMoves.length === 0) {
        setCustomError(
          'Unable to parse the PGN input. Please check the moves provided.',
        )
        return
      }

      for (const moveToken of sanitizedMoves) {
        try {
          const moveResult = chess.move(moveToken, { sloppy: true })
          if (!moveResult) {
            setCustomError(`Could not apply move "${moveToken}" from the PGN.`)
            return
          }
        } catch (error) {
          setCustomError(`Could not apply move "${moveToken}" from the PGN.`)
          return
        }
      }

      parsedPgn = sanitizedMoves.join(' ')
    }

    const finalFen = chess.fen()
    const generatedId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const newOpening: Opening = {
      id: generatedId,
      name: `Custom Position ${customOpenings.length + 1}`,
      description:
        detectedFen && !parsedPgn
          ? 'Custom drill created from a supplied FEN.'
          : 'Custom drill created from PGN input.',
      fen: finalFen,
      pgn: parsedPgn,
      variations: [],
      isCustom: true,
      setupFen: detectedFen,
      categoryType: 'custom',
    }

    const duplicate = customOpenings.some(
      (opening) =>
        opening.fen === newOpening.fen &&
        opening.pgn === newOpening.pgn &&
        opening.setupFen === newOpening.setupFen,
    )

    if (duplicate) {
      setCustomError('You already saved a custom drill with the same position.')
      return
    }

    setCustomOpenings((prev) => [newOpening, ...prev])
    setPreviewOpening(newOpening)
    setPreviewVariation(null)
    setCustomInput('')
    setCustomError(null)
    setBrowseCategory('custom')
    setActiveTab('browse')
  }

  const handleRemoveCustomOpening = (openingId: string) => {
    const remainingCustom = customOpenings.filter(
      (opening) => opening.id !== openingId,
    )

    const fallbackCandidates = [
      ...remainingCustom,
      ...normalizedOpenings,
      ...normalizedEndgames,
    ]

    const nextPreview = fallbackCandidates.find(
      (opening) => opening.id !== openingId,
    )

    setCustomOpenings(remainingCustom)
    setSelections((prev) =>
      prev.filter((selection) => selection.opening.id !== openingId),
    )

    if (remainingCustom.length === 0 && browseCategory === 'custom') {
      setBrowseCategory(
        hasOpenings ? 'openings' : hasEndgames ? 'endgames' : 'custom',
      )
    }

    if (previewOpening.id === openingId) {
      setPreviewOpening(nextPreview || fallbackOpening)
      setPreviewVariation(null)
    }

    if (mobilePopupOpening?.id === openingId) {
      setMobilePopupOpen(false)
      setMobilePopupOpening(null)
      setMobilePopupVariation(null)
    }
  }
  const categoryLabel =
    browseCategory === 'endgames'
      ? 'Endgame'
      : browseCategory === 'custom'
        ? 'Position'
        : 'Opening'
  const categoryLabelPlural =
    categoryLabel === 'Endgame'
      ? 'Endgames'
      : categoryLabel === 'Opening'
        ? 'Openings'
        : 'Positions'

  const previewPanelLabel = useMemo(() => {
    if (previewOpening.isCustom || previewOpening.categoryType === 'custom') {
      return 'Position'
    }
    if (previewOpening.categoryType === 'endgame') {
      return 'Endgame'
    }
    if (previewOpening.categoryType === 'opening') {
      return 'Opening'
    }
    return categoryLabel
  }, [previewOpening.isCustom, previewOpening.categoryType, categoryLabel])
  // Check if user has completed the tour on initial load
  useEffect(() => {
    if (!initialTourCheck) {
      setInitialTourCheck(true)
      if (typeof window !== 'undefined') {
        const completedTours = JSON.parse(
          localStorage.getItem('maia-completed-tours') || '[]',
        )

        if (!completedTours.includes('openingDrill')) {
          startTour(
            tourConfigs.openingDrill.id,
            tourConfigs.openingDrill.steps,
            false,
          )
        }
      }
    }
  }, [initialTourCheck, startTour])

  // Track modal opened
  useEffect(() => {
    if (!hasTrackedModalOpen) {
      trackOpeningSelectionModalOpened('page_load', initialSelections.length)
      setHasTrackedModalOpen(true)
    }
  }, [hasTrackedModalOpen, initialSelections.length])

  // Update the ID to reflect the new settings
  useEffect(() => {
    setSelections((prevSelections) =>
      prevSelections.map((selection) => ({
        ...selection,
        maiaVersion: selectedMaiaVersion.id,
        targetMoveNumber,
      })),
    )
  }, [selectedMaiaVersion.id, targetMoveNumber])

  const handleStartTour = () => {
    startTour(tourConfigs.openingDrill.id, tourConfigs.openingDrill.steps, true)
  }

  const previewFen = useMemo(() => {
    return previewVariation ? previewVariation.fen : previewOpening.fen
  }, [previewOpening, previewVariation])

  const basePositions = useMemo(() => {
    if (browseCategory === 'custom') return customOpenings
    if (browseCategory === 'endgames') return normalizedEndgames
    return normalizedOpenings
  }, [browseCategory, customOpenings, normalizedEndgames, normalizedOpenings])

  const filteredOpenings = useMemo(() => {
    if (!searchTerm) return basePositions
    const lowered = searchTerm.toLowerCase()
    const filtered = basePositions.filter(
      (opening) =>
        opening.name.toLowerCase().includes(lowered) ||
        opening.description.toLowerCase().includes(lowered) ||
        opening.variations.some((variation) =>
          variation.name.toLowerCase().includes(lowered),
        ),
    )

    if (searchTerm) {
      trackOpeningSearchUsed(searchTerm, filtered.length)
    }

    return filtered
  }, [basePositions, searchTerm])

  useEffect(() => {
    const availableOpenings = [
      ...customOpenings,
      ...normalizedOpenings,
      ...normalizedEndgames,
    ]

    if (!availableOpenings.length) return

    const previewExists = availableOpenings.some(
      (opening) => opening.id === previewOpening.id,
    )

    if (!previewExists) {
      setPreviewOpening(availableOpenings[0])
      setPreviewVariation(null)
    }
  }, [
    customOpenings,
    normalizedOpenings,
    normalizedEndgames,
    previewOpening.id,
  ])

  const isDuplicateSelection = (
    opening: Opening,
    variation: OpeningVariation | null,
  ) => {
    return selections.some(
      (s) =>
        s.opening.id === opening.id &&
        s.variation?.id === variation?.id &&
        s.playerColor === selectedColor &&
        s.maiaVersion === selectedMaiaVersion.id,
    )
  }

  const addSelection = () => {
    if (isDuplicateSelection(previewOpening, previewVariation)) return

    const newSelection: OpeningSelection = {
      id: `${previewOpening.id}-${previewVariation?.id || 'main'}-${selectedColor}-${selectedMaiaVersion.id}-${targetMoveNumber}`,
      opening: previewOpening,
      variation: previewVariation,
      playerColor: selectedColor,
      maiaVersion: selectedMaiaVersion.id,
      targetMoveNumber,
    }

    if (!previewOpening.isCustom) {
      trackOpeningConfiguredAndAdded(
        previewOpening.name,
        selectedColor,
        selectedMaiaVersion.id,
        targetMoveNumber,
        previewVariation?.name,
      )
    }

    setSelections([...selections, newSelection])
    // Switch to selected tab on mobile after adding
    if (isMobile) {
      setActiveTab('selected')
    }
  }

  const removeSelection = (selectionId: string) => {
    const selectionToRemove = selections.find((s) => s.id === selectionId)
    if (selectionToRemove) {
      trackOpeningRemovedFromSelection(
        selectionToRemove.opening.name,
        selectionId,
      )
    }
    setSelections(selections.filter((s) => s.id !== selectionId))
  }

  const handleMobileOpeningClick = (
    opening: Opening,
    variation: OpeningVariation | null,
  ) => {
    setMobilePopupOpening(opening)
    setMobilePopupVariation(variation)
    setMobilePopupOpen(true)
  }

  const handleMobilePopupAdd = (color: 'white' | 'black') => {
    if (!mobilePopupOpening) return

    const newSelection: OpeningSelection = {
      id: `${mobilePopupOpening.id}-${mobilePopupVariation?.id || 'main'}-${color}-${selectedMaiaVersion.id}-${targetMoveNumber}`,
      opening: mobilePopupOpening,
      variation: mobilePopupVariation,
      playerColor: color,
      maiaVersion: selectedMaiaVersion.id,
      targetMoveNumber,
    }

    setSelections([...selections, newSelection])
    setMobilePopupOpen(false)
    setMobilePopupOpening(null)
    setMobilePopupVariation(null)
  }

  const handleMobilePopupRemove = () => {
    if (!mobilePopupOpening) return

    const selectionToRemove = selections.find(
      (s) =>
        s.opening.id === mobilePopupOpening.id &&
        s.variation?.id === mobilePopupVariation?.id,
    )

    if (selectionToRemove) {
      removeSelection(selectionToRemove.id)
    }

    setMobilePopupOpen(false)
    setMobilePopupOpening(null)
    setMobilePopupVariation(null)
  }

  const isOpeningSelected = (
    opening: Opening,
    variation: OpeningVariation | null,
  ) => {
    return selections.some(
      (s) => s.opening.id === opening.id && s.variation?.id === variation?.id,
    )
  }

  const addQuickSelection = (
    opening: Opening,
    variation: OpeningVariation | null,
  ) => {
    if (isDuplicateSelection(opening, variation)) return

    if (!opening.isCustom) {
      trackOpeningQuickAddUsed(
        opening.name,
        selectedColor,
        selectedMaiaVersion.id,
        targetMoveNumber,
      )
    }

    const newSelection: OpeningSelection = {
      id: `${opening.id}-${variation?.id || 'main'}-${selectedColor}-${selectedMaiaVersion.id}-${targetMoveNumber}`,
      opening,
      variation,
      playerColor: selectedColor,
      maiaVersion: selectedMaiaVersion.id,
      targetMoveNumber,
    }

    setSelections([...selections, newSelection])
    setPreviewOpening(opening)
    setPreviewVariation(variation)
    if (isMobile) {
      setActiveTab('selected')
    }
  }

  const handleStartDrilling = () => {
    if (selections.length === 0) {
      return
    }

    const configuration: DrillConfiguration = {
      selections,
    }

    // Track drill configuration completion
    const uniqueOpenings = new Set(selections.map((s) => s.opening.id)).size
    const averageTargetMoves =
      selections.reduce((sum, s) => sum + s.targetMoveNumber, 0) /
      selections.length
    const maiaVersionsUsed = [...new Set(selections.map((s) => s.maiaVersion))]
    const colorDistribution = selections.reduce(
      (acc, s) => {
        acc[s.playerColor]++
        return acc
      },
      { white: 0, black: 0 },
    )

    trackDrillConfigurationCompleted(
      selections.length,
      selections.length, // Use selections length for drill count
      uniqueOpenings,
      averageTargetMoves,
      maiaVersionsUsed,
      colorDistribution,
    )

    onComplete(configuration)
  }

  return (
    <ModalContainer className="!z-10" dismiss={onClose}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative flex h-[90vh] max-h-[900px] w-[98vw] max-w-[1400px] flex-col items-start justify-start overflow-hidden rounded-lg border border-glass-border bg-glass backdrop-blur-md md:h-[90vh]"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 180% 160% at 0% 100%, rgba(239, 68, 68, 0.10) 0%, transparent 72%)',
          }}
        />
        {/* Close Button - Top Right of Modal */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-secondary transition-colors hover:text-primary"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        {/* Header Section */}
        <div
          id="opening-drill-modal"
          className="flex w-full flex-col gap-1 border-b border-glass-border p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-row items-center gap-3">
                <h1 className="text-xl font-bold text-primary md:text-2xl">
                  Opening Drills
                </h1>
                <button
                  type="button"
                  className="material-symbols-outlined text-lg text-secondary duration-200 hover:text-white focus:outline-none"
                  onClick={handleStartTour}
                  title="Start tour"
                >
                  help
                </button>
              </div>

              <p className="text-xs text-secondary md:text-sm">
                Practice openings against Maia. Select openings to drill, choose
                your color and opponent strength.
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Tab Navigation */}
        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectionsCount={selections.length}
        />

        {/* Main Content - Responsive Layout */}
        <div className="grid w-full flex-1 grid-cols-1 overflow-hidden md:grid-cols-3">
          <BrowsePanel
            activeTab={activeTab}
            filteredOpenings={filteredOpenings}
            previewOpening={previewOpening}
            previewVariation={previewVariation}
            setPreviewOpening={setPreviewOpening}
            setPreviewVariation={setPreviewVariation}
            setActiveTab={setActiveTab}
            addQuickSelection={addQuickSelection}
            isDuplicateSelection={isDuplicateSelection}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selections={selections}
            onOpeningClick={handleMobileOpeningClick}
            removeSelection={removeSelection}
            onRemoveCustomOpening={handleRemoveCustomOpening}
            browseCategory={browseCategory}
            setBrowseCategory={setBrowseCategory}
            customInput={customInput}
            setCustomInput={setCustomInput}
            customError={customError}
            onAddCustomPosition={handleAddCustomPosition}
            categoryLabel={categoryLabel}
            categoryLabelPlural={categoryLabelPlural}
          />
          <PreviewPanel
            selections={selections}
            previewOpening={previewOpening}
            previewVariation={previewVariation}
            previewFen={previewFen}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            addSelection={addSelection}
            panelLabel={previewPanelLabel}
          />
          <SelectedPanel
            activeTab={activeTab}
            selections={selections}
            removeSelection={removeSelection}
            handleStartDrilling={handleStartDrilling}
            selectedMaiaVersion={selectedMaiaVersion}
            setSelectedMaiaVersion={setSelectedMaiaVersion}
            targetMoveNumber={targetMoveNumber}
            setTargetMoveNumber={setTargetMoveNumber}
            categoryLabel={categoryLabel}
            categoryLabelPlural={categoryLabelPlural}
          />
        </div>

        {/* Mobile Opening Popup */}
        {mobilePopupOpening && (
          <MobileOpeningPopup
            opening={mobilePopupOpening}
            variation={mobilePopupVariation}
            isOpen={mobilePopupOpen}
            onClose={() => {
              setMobilePopupOpen(false)
              setMobilePopupOpening(null)
              setMobilePopupVariation(null)
            }}
            onAdd={handleMobilePopupAdd}
            onRemove={handleMobilePopupRemove}
            isSelected={isOpeningSelected(
              mobilePopupOpening,
              mobilePopupVariation,
            )}
          />
        )}
      </motion.div>
    </ModalContainer>
  )
}
