import React, {
  useState,
  useMemo,
  useEffect,
  useContext,
  useCallback,
} from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import Chessground from '@react-chess/chessground'
import { Chess } from 'chess.ts'
import {
  Opening,
  EndgameTrait,
  OpeningVariation,
  OpeningSelection,
  DrillConfiguration,
  DrillCategoryType,
  EndgamePositionDetail,
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
import {
  ENDGAME_TRAITS,
  ENDGAME_TRAIT_LABELS,
  collectEndgamePositions,
  EndgameDataset,
  EndgameCategoryData,
  EndgameMotifData,
} from 'src/lib/endgames'

type MobileTab = 'browse' | 'selected'

const DEFAULT_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const PGN_RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*'])

const getTraitSelectionKey = (
  openingId: string,
  variationId: string | null | undefined,
) => (variationId ? `${openingId}__${variationId}` : openingId)

const getOpeningCategory = (opening: Opening): DrillCategoryType => {
  if (opening.categoryType === 'endgame') return 'endgame'
  if (opening.categoryType === 'custom' || opening.isCustom) return 'custom'
  return 'opening'
}

const formatCategoryLabel = (category: DrillCategoryType) => {
  switch (category) {
    case 'opening':
      return 'opening'
    case 'endgame':
      return 'endgame'
    case 'custom':
      return 'custom position'
    default:
      return category
  }
}

interface Props {
  openings: Opening[]
  endgames?: Opening[]
  endgameDataset?: EndgameDataset
  initialSelections?: OpeningSelection[]
  onComplete: (configuration: DrillConfiguration) => void
  onClose: () => void
}

interface MobileOpeningPopupProps {
  opening: Opening
  variation: OpeningVariation | null
  isOpen: boolean
  onClose: () => void
  previewFen: string
  onAddOpening: (color: 'white' | 'black') => void
  onAddEndgame: () => void
  onRemove: () => void
  isSelected: boolean
  isEndgame: boolean
  selectedTraits: EndgameTrait[]
  availableTraits: EndgameTrait[]
  onToggleTrait: (trait: EndgameTrait) => void
  isDuplicate: boolean
  isAddDisabled: boolean
  disabledReason?: string
  selectedColor: 'white' | 'black'
  setSelectedColor: (color: 'white' | 'black') => void
}

const MobileOpeningPopup: React.FC<MobileOpeningPopupProps> = ({
  opening,
  variation,
  isOpen,
  onClose,
  previewFen,
  onAddOpening,
  onAddEndgame,
  onRemove,
  isSelected,
  isEndgame,
  selectedTraits,
  availableTraits,
  onToggleTrait,
  isDuplicate,
  isAddDisabled,
  disabledReason,
  selectedColor,
  setSelectedColor,
}) => {
  const addDisabled = isDuplicate || isAddDisabled
  const addTitle = isDuplicate
    ? 'Already added with same settings'
    : disabledReason || undefined

  const handleAdd = () => {
    if (isEndgame) {
      onAddEndgame()
    } else {
      onAddOpening(selectedColor)
    }
  }

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
                orientation: isEndgame ? 'white' : selectedColor,
              }}
            />
          </div>
        </div>

        {!isSelected &&
          (isEndgame ? (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium">Include traits:</p>
              {availableTraits.length === 0 ? (
                <p className="text-xs text-secondary">
                  No positions available for this selection.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {availableTraits.map((trait) => {
                    const checked = selectedTraits.includes(trait)
                    return (
                      <label
                        key={trait}
                        className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                          checked
                            ? 'border-human-4 bg-human-4/20 text-white'
                            : 'border-glass-border bg-white/5 text-white/90 hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-human-4"
                          checked={checked}
                          onChange={() => onToggleTrait(trait)}
                        />
                        {ENDGAME_TRAIT_LABELS[trait]}
                      </label>
                    )
                  })}
                </div>
              )}
              {selectedTraits.length === 0 && availableTraits.length > 0 && (
                <p className="mt-2 text-xs text-red-400">
                  Select at least one trait to add this endgame drill.
                </p>
              )}
            </div>
          ) : (
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
          ))}

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
              onClick={handleAdd}
              disabled={addDisabled}
              className="flex-1 rounded border border-glass-border bg-white/5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              title={addTitle}
            >
              {isDuplicate ? 'Already Added' : 'Add Drill'}
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
    traits?: EndgameTrait[],
  ) => boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
  selections: OpeningSelection[]
  onOpeningClick: (opening: Opening, variation: OpeningVariation | null) => void
  removeSelection: (id: string) => void
  onRemoveCustomOpening: (openingId: string) => void
  browseCategory: 'openings' | 'endgames' | 'custom'
  onBrowseCategoryChange: (category: 'openings' | 'endgames' | 'custom') => void
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
  onBrowseCategoryChange,
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
    <div className="grid w-full select-none grid-cols-3 items-center justify-between border-b border-glass-border bg-white/[0.02]">
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
              onBrowseCategoryChange(value)
              setActiveTab('browse')
            }}
            aria-pressed={isSelected}
            className={`relative flex-1 border-r border-white/5 px-3 py-3 text-xs font-medium transition-all duration-200 last:border-r-0 md:text-sm ${
              isSelected
                ? 'bg-white/[0.06] text-white'
                : 'bg-transparent text-white/55 hover:bg-white/[0.03] hover:text-white/90'
            }`}
          >
            <span>{label}</span>
            {isSelected && (
              <motion.div
                layoutId="browse-category-underline"
                className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-human-4/80"
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
        className={`flex w-full flex-col overflow-hidden ${activeTab !== 'browse' ? 'hidden md:flex' : 'flex'} md:w-[320px] md:flex-none md:border-r md:border-glass-border`}
      >
        {renderTabs()}
        <form
          className="flex flex-col gap-2.5 px-4 pb-3 pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            onAddCustomPosition()
          }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Paste FEN or PGN…"
              className="flex-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-[9px] text-[13px] text-white placeholder-white/35 focus:outline-none focus:ring-1 focus:ring-white/15"
            />
            <button
              type="submit"
              className="flex-shrink-0 rounded-md bg-human-4/20 px-3.5 py-[9px] text-[12px] font-semibold text-human-2 transition-colors hover:bg-human-4/30 disabled:opacity-40"
              disabled={!customInput.trim()}
            >
              Add
            </button>
          </div>
          {customError && (
            <p className="text-[11px] text-red-400">{customError}</p>
          )}
        </form>

        <div className="px-4 pb-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 !text-[16px] text-white/30">
              search
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] py-[9px] pl-9 pr-3 text-[13px] text-white placeholder-white/35 focus:outline-none focus:ring-1 focus:ring-white/15"
            />
          </div>
        </div>

        <div className="red-scrollbar flex flex-1 flex-col overflow-y-auto px-2">
          {filteredOpenings.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-[12px] text-white/35">
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
                  className={`group rounded-md transition-colors ${
                    openingIsSelected
                      ? 'bg-white/[0.08]'
                      : openingIsBeingPreviewed
                        ? 'bg-white/[0.05]'
                        : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center">
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex-1 cursor-pointer px-2.5 py-[8px]"
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
                            <h3 className="text-[13px] font-medium">
                              {opening.name}
                            </h3>
                            <span className="rounded bg-human-4/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-human-2">
                              Custom
                            </span>
                          </div>
                          <p className="text-[11px] text-white/35">
                            {opening.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mr-1 flex items-center gap-0.5">
                      {openingIsSelected ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeOpeningSelection(opening, null)
                          }}
                          className="rounded p-1 text-white/70 transition-colors hover:text-white"
                          title="Remove position from selection"
                        >
                          <span className="material-symbols-outlined !text-[18px]">
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
                          <span className="material-symbols-outlined !text-[18px]">
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
                        <span className="material-symbols-outlined !text-[18px]">
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

  const renderRow = (
    label: string,
    pgn: string,
    isItemSelected: boolean,
    isPreviewed: boolean,
    onSelect: () => void,
    onToggle: () => void,
    toggleTitle: string,
  ) => (
    <div
      className={`group flex items-center rounded-md transition-colors ${
        isItemSelected
          ? 'bg-white/[0.08]'
          : isPreviewed
            ? 'bg-white/[0.05]'
            : 'hover:bg-white/[0.04]'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        className="min-w-0 flex-1 cursor-pointer px-2.5 py-[8px]"
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onSelect()
          }
        }}
      >
        <p
          className={`truncate text-[13px] ${
            isItemSelected ? 'text-white' : 'text-white/70'
          }`}
        >
          {label}
        </p>
        {pgn && <p className="truncate text-[11px] text-white/25">{pgn}</p>}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className={`mr-2 rounded p-0.5 transition-colors ${
          isItemSelected
            ? 'text-human-3 hover:text-human-2'
            : 'text-white/20 hover:text-white/50'
        }`}
        title={toggleTitle}
      >
        <span className="material-symbols-outlined !text-[18px]">
          {isItemSelected ? 'check' : 'add'}
        </span>
      </button>
    </div>
  )

  return (
    <div
      id="opening-drill-browse"
      className={`flex w-full flex-col overflow-hidden ${activeTab !== 'browse' ? 'hidden md:flex' : 'flex'} md:w-[320px] md:flex-none md:border-r md:border-glass-border`}
    >
      {renderTabs()}

      <div className="px-4 pb-2 pt-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-white/35">
            search
          </span>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.06] py-[9px] pl-9 pr-4 text-[13px] text-white placeholder-white/35 focus:border-white/20 focus:outline-none"
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
          const showStandaloneOpening = opening.variations.length === 0

          return (
            <div key={opening.id} className="px-4 pb-3 pt-4">
              <div className="px-2.5 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/35">
                  {opening.name}
                </p>
                {opening.pgn && opening.variations.length > 0 && (
                  <p className="mt-0.5 text-[11px] text-white/20">
                    {opening.pgn}
                  </p>
                )}
                {opening.description && (
                  <p className="mt-0.5 text-[11px] leading-snug text-white/25">
                    {opening.description}
                  </p>
                )}
              </div>

              {showStandaloneOpening
                ? renderRow(
                    opening.name,
                    opening.pgn,
                    openingIsSelected,
                    openingIsBeingPreviewed,
                    () => {
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
                    },
                    () => {
                      if (openingIsSelected) {
                        removeOpeningSelection(opening, null)
                      } else {
                        addQuickSelection(opening, null)
                      }
                    },
                    openingIsSelected
                      ? `Remove ${categoryLabel.toLowerCase()} from selection`
                      : `Add ${categoryLabel.toLowerCase()} with current settings`,
                  )
                : null}

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
                  <React.Fragment key={variation.id}>
                    {renderRow(
                      variation.name,
                      (() => {
                        if (!variation.pgn.startsWith(opening.pgn))
                          return variation.pgn
                        const suffix = variation.pgn
                          .slice(opening.pgn.length)
                          .trim()
                        if (!suffix) return ''
                        // Find the last move number in the parent PGN to determine context
                        const moveNumMatch = opening.pgn.match(
                          /(\d+)\.\s*(\S+)\s*(\S+)?\s*$/,
                        )
                        if (!moveNumMatch) return suffix
                        const moveNum = parseInt(moveNumMatch[1])
                        const hasWhiteReply = !!moveNumMatch[3]
                        // If parent ended after black's move (both white+black present),
                        // suffix starts with a new white move
                        if (hasWhiteReply) {
                          return `${moveNum + 1}. ${suffix}`
                        }
                        // Parent ended after white's move, suffix is black's reply
                        return `${moveNum}. ...${suffix}`
                      })(),
                      variationIsSelected,
                      variationIsBeingPreviewed,
                      () => {
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
                      },
                      () => {
                        if (variationIsSelected) {
                          removeOpeningSelection(opening, variation)
                        } else {
                          addQuickSelection(opening, variation)
                        }
                      },
                      variationIsSelected
                        ? 'Remove variation from selection'
                        : 'Add variation with current settings',
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
const DrillStudioPanel: React.FC<{
  previewOpening: Opening
  previewVariation: OpeningVariation | null
  previewFen: string
  selectedColor: 'white' | 'black'
  setSelectedColor: (color: 'white' | 'black') => void
  addSelection: () => void
  panelLabel: string
  isDuplicate: boolean
  isAddDisabled: boolean
  disabledReason?: string
  isEndgame: boolean
  selectedTraits: EndgameTrait[]
  availableTraits: EndgameTrait[]
  onToggleTrait: (trait: EndgameTrait) => void
  selections: OpeningSelection[]
  removeSelection: (id: string) => void
  onSelectQueueItem: (selection: OpeningSelection) => void
  handleStartDrilling: () => void
  selectedMaiaVersion: (typeof MAIA_MODELS_WITH_NAMES)[0]
  setSelectedMaiaVersion: (version: (typeof MAIA_MODELS_WITH_NAMES)[0]) => void
  targetMoveNumber: number | null
  setTargetMoveNumber: (number: number | null) => void
  showTargetSlider: boolean
}> = ({
  previewOpening,
  previewVariation,
  previewFen,
  selectedColor,
  setSelectedColor,
  addSelection,
  panelLabel,
  isDuplicate,
  isAddDisabled,
  disabledReason,
  isEndgame,
  selectedTraits,
  availableTraits,
  onToggleTrait,
  selections,
  removeSelection,
  onSelectQueueItem,
  handleStartDrilling,
  selectedMaiaVersion,
  setSelectedMaiaVersion,
  targetMoveNumber,
  setTargetMoveNumber,
  showTargetSlider,
}) => {
  const addDisabled = isDuplicate || isAddDisabled
  const addButtonLabel = isDuplicate ? 'Already Added' : 'Add Drill'
  const addButtonTitle = isDuplicate
    ? 'Already added with same settings'
    : disabledReason || undefined

  const getSelectionSubtitle = (selection: OpeningSelection) => {
    if (
      selection.opening.categoryType === 'endgame' &&
      selection.endgameTraits?.length
    ) {
      return selection.endgameTraits
        .map((trait) => ENDGAME_TRAIT_LABELS[trait])
        .join(', ')
    }
    if (selection.variation?.name) {
      return selection.variation.name
    }
    return selection.opening.categoryType === 'custom'
      ? 'Custom position'
      : selection.playerColor === 'white'
        ? 'White'
        : 'Black'
  }

  const renderEndgameTraitControls = () => (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">
        Included Traits
      </p>
      {availableTraits.length === 0 ? (
        <p className="text-xs text-secondary">
          No positions available for this selection.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {availableTraits.map((trait) => {
            const checked = selectedTraits.includes(trait)
            return (
              <label
                key={trait}
                className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-xs transition-colors md:px-3 md:py-2 md:text-sm ${
                  checked
                    ? 'border-human-4 bg-human-4/20 text-white'
                    : 'border-glass-border bg-white/5 text-white/90 hover:bg-white/10'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3 w-3 accent-human-4 md:h-4 md:w-4"
                  checked={checked}
                  onChange={() => onToggleTrait(trait)}
                />
                {ENDGAME_TRAIT_LABELS[trait]}
              </label>
            )
          })}
        </div>
      )}
      {selectedTraits.length === 0 && availableTraits.length > 0 && (
        <p className="text-xs text-red-400">
          Select at least one trait to add this endgame drill.
        </p>
      )}
    </div>
  )

  return (
    <div
      id="opening-drill-preview"
      className="hidden w-full flex-1 flex-col overflow-hidden md:flex"
    >
      <div className="border-l border-glass-border">
        {/* Scrollable Content */}
        <div className="red-scrollbar flex h-[calc(90vh-5.5rem)] max-h-[820px] flex-col overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">
            {/* Preview: Board + Info side by side */}
            <div className="flex gap-6">
              <div className="aspect-square w-[280px] flex-shrink-0 overflow-hidden rounded-md">
                <Chessground
                  contained
                  config={{
                    viewOnly: true,
                    fen: previewFen,
                    coordinates: true,
                    animation: { enabled: true, duration: 200 },
                    orientation: isEndgame ? 'white' : selectedColor,
                  }}
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/35">
                    Preview
                  </p>
                  <h3 className="text-[16px] font-semibold text-white">
                    {previewVariation?.name || previewOpening.name}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-white/45">
                    {previewVariation ? previewOpening.name : panelLabel} ·{' '}
                    {previewOpening.description}
                  </p>
                </div>

                {isEndgame ? (
                  renderEndgameTraitControls()
                ) : (
                  <div className="flex gap-1.5">
                    {(['white', 'black'] as const).map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`flex items-center gap-1.5 rounded-md border px-3.5 py-[6px] text-[12px] font-medium capitalize transition-colors ${
                          selectedColor === color
                            ? 'border-white/20 bg-white/[0.1] text-white'
                            : 'border-white/[0.08] bg-white/[0.03] text-white/45 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="relative h-3 w-3">
                          <Image
                            src={`/assets/pieces/${color} king.svg`}
                            fill={true}
                            alt={`${color} king`}
                          />
                        </div>
                        {color}
                      </button>
                    ))}
                  </div>
                )}

                {disabledReason && !isDuplicate ? (
                  <p className="text-xs text-red-300">{disabledReason}</p>
                ) : null}
              </div>
            </div>

            {/* Settings row: Opponent + Target Moves */}
            <div className="flex gap-5">
              <div className="flex flex-1 flex-col gap-1.5">
                <label
                  htmlFor="drill-opponent-select"
                  className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/35"
                >
                  Opponent
                </label>
                <select
                  id="drill-opponent-select"
                  value={selectedMaiaVersion.id}
                  onChange={(e) => {
                    const version = MAIA_MODELS_WITH_NAMES.find(
                      (v) => v.id === e.target.value,
                    )
                    if (version) {
                      setSelectedMaiaVersion(version)
                    }
                  }}
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.06] px-2.5 py-[8px] text-[13px] text-white/90 focus:outline-none"
                >
                  {MAIA_MODELS_WITH_NAMES.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.name}
                    </option>
                  ))}
                </select>
              </div>

              {showTargetSlider ? (
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/35">
                    Target Moves{' '}
                    <span className="font-bold normal-case tracking-normal text-white/55">
                      {targetMoveNumber === null ? '∞' : targetMoveNumber}
                    </span>
                  </label>
                  <div className="pt-2">
                    <input
                      type="range"
                      min="5"
                      max="21"
                      value={targetMoveNumber === null ? 21 : targetMoveNumber}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        setTargetMoveNumber(val >= 21 ? null : val)
                      }}
                      className="w-full accent-human-4"
                    />
                    <div className="mt-0.5 flex justify-between text-[10px] text-white/25">
                      <span>5</span>
                      <span>∞</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/35">
                    Session Type
                  </p>
                  <p className="text-[12px] leading-relaxed text-white/50">
                    Endgame drills use the selected traits and position pools
                    instead of a target move count.
                  </p>
                </div>
              )}
            </div>

            {/* Add Drill button */}
            <button
              onClick={addSelection}
              disabled={addDisabled}
              title={addButtonTitle}
              className="w-full rounded-md bg-human-4/80 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-human-4 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/30 2xl:w-auto 2xl:px-10"
            >
              {addButtonLabel}
            </button>

            {/* Queue */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  Queue
                </p>
                <span className="rounded-full bg-human-4/[0.08] px-3 py-0.5 text-xxs font-semibold text-human-2">
                  {selections.length}
                </span>
              </div>

              {selections.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-[13px] text-secondary">
                  Select drills from the library to begin.
                </div>
              ) : (
                <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto 2xl:grid-cols-2">
                  {selections.map((selection) => {
                    const isEndgame =
                      selection.opening.categoryType === 'endgame'
                    const label = selection.variation
                      ? `${selection.opening.name}: ${selection.variation.name}`
                      : selection.opening.name
                    const meta =
                      isEndgame && selection.endgameTraits?.length
                        ? selection.endgameTraits
                            .map((t) => ENDGAME_TRAIT_LABELS[t])
                            .join(', ')
                        : selection.playerColor === 'white'
                          ? 'White'
                          : 'Black'

                    const isActive =
                      previewOpening.id === selection.opening.id &&
                      (selection.variation
                        ? previewVariation?.id === selection.variation.id
                        : !previewVariation)

                    return (
                      <div
                        key={selection.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectQueueItem(selection)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ')
                            onSelectQueueItem(selection)
                        }}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-[7px] transition-colors ${
                          isActive
                            ? 'bg-white/[0.08]'
                            : 'bg-white/[0.04] hover:bg-white/[0.06]'
                        }`}
                      >
                        <p className="min-w-0 flex-1 truncate text-[12px] text-white/70">
                          <span className="font-medium text-white">
                            {label}
                          </span>
                          <span className="text-white/30"> · {meta}</span>
                        </p>
                        <button
                          onClick={() => removeSelection(selection.id)}
                          className="flex-shrink-0 text-white/25 transition-colors hover:text-white"
                        >
                          <span className="material-symbols-outlined !text-[14px]">
                            close
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed footer: Start button */}
        <div className="px-6 pb-5 pt-1">
          <button
            onClick={handleStartDrilling}
            disabled={selections.length === 0}
            className="w-full rounded-lg bg-human-4/85 py-3 text-[14px] font-semibold text-black transition-colors hover:bg-human-4 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
          >
            Start Drilling ({selections.length}{' '}
            {selections.length === 1 ? 'selection' : 'selections'})
          </button>
        </div>
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
  targetMoveNumber: number | null
  setTargetMoveNumber: (number: number | null) => void
  categoryLabel: string
  categoryLabelPlural: string
  showTargetSlider: boolean
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
  showTargetSlider,
}) => (
  <div
    id="opening-drill-selected"
    className={`flex w-full flex-col overflow-hidden ${activeTab !== 'selected' ? 'hidden' : 'flex'}`}
  >
    <div className="flex h-16 flex-col justify-center gap-1 border-b border-glass-border p-4">
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
            {selections.map((selection) => {
              const isEndgameSelection =
                getOpeningCategory(selection.opening) === 'endgame'

              return (
                <div
                  key={selection.id}
                  className="flex items-center justify-between border-b border-white/5 p-3 transition-colors md:px-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      {isEndgameSelection ? (
                        <span className="material-symbols-outlined text-base text-human-3 md:text-lg">
                          trophy
                        </span>
                      ) : (
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
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-xs font-medium text-primary md:text-sm">
                            {selection.opening.name}
                          </span>
                          {selection.opening.isCustom && (
                            <span className="rounded border border-human-4/40 bg-human-4/10 px-2 py-0.5 text-xxs font-semibold uppercase tracking-wide text-human-2">
                              Custom
                            </span>
                          )}
                        </div>
                        {selection.variation && (
                          <p className="text-xs text-white/70">
                            {selection.variation.name}
                          </p>
                        )}
                        {isEndgameSelection &&
                        selection.endgameTraits?.length ? (
                          <div className="mt-1 flex flex-col items-start gap-1">
                            <span className="text-xxs text-secondary">
                              {selection.endgameTraits
                                .map((trait) => ENDGAME_TRAIT_LABELS[trait])
                                .join(', ')}
                            </span>
                            <span className="text-xxs text-secondary">
                              {(
                                selection.endgamePositions?.length ?? 0
                              ).toLocaleString()}{' '}
                              positions ·{' '}
                              {selection.playerColor === 'white'
                                ? 'White to move'
                                : 'Black to move'}
                            </span>
                          </div>
                        ) : null}
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
              )
            })}
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
      {showTargetSlider && (
        <div className="mb-3 md:mb-4">
          <p className="mb-1 text-xs font-medium md:mb-2 md:text-sm">
            Target Move Count:{' '}
            {targetMoveNumber === null ? '∞' : targetMoveNumber}
          </p>
          <input
            type="range"
            min="5"
            max="21"
            value={targetMoveNumber === null ? 21 : targetMoveNumber}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              setTargetMoveNumber(val >= 21 ? null : val)
            }}
            className="w-full accent-human-4"
          />
          <div className="mt-1 flex justify-between text-xs text-secondary">
            <span>5</span>
            <span>∞</span>
          </div>
        </div>
      )}

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
  endgameDataset,
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

  const firstInitialSelection = initialSelections[0] ?? null
  const initialSelectionCategory = firstInitialSelection
    ? getOpeningCategory(firstInitialSelection.opening)
    : null

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

  const fallbackOpening = useMemo<Opening>(
    () => ({
      id: 'custom-fallback-position',
      name: 'Custom Position',
      description: 'Create a custom drill to get started.',
      fen: DEFAULT_START_FEN,
      pgn: '',
      variations: [],
      isCustom: true,
      categoryType: 'custom',
    }),
    [],
  )

  const [customOpenings, setCustomOpenings] = useState<Opening[]>(
    initialCustomOpenings,
  )
  const [selections, setSelections] =
    useState<OpeningSelection[]>(initialSelections)
  const [endgameTraitSelections, setEndgameTraitSelections] = useState<
    Record<string, EndgameTrait[]>
  >(() => {
    const initial: Record<string, EndgameTrait[]> = {}
    initialSelections.forEach((selection) => {
      if (
        (selection.opening.categoryType ?? 'opening') === 'endgame' &&
        selection.endgameTraits
      ) {
        const key = getTraitSelectionKey(
          selection.opening.id,
          selection.variation?.id ?? null,
        )
        initial[key] = selection.endgameTraits
      }
    })
    return initial
  })

  const hasOpenings = normalizedOpenings.length > 0
  const hasEndgames = normalizedEndgames.length > 0

  const initialBrowseCategory: 'openings' | 'endgames' | 'custom' =
    initialSelectionCategory === 'opening'
      ? 'openings'
      : initialSelectionCategory === 'endgame'
        ? 'endgames'
        : initialSelectionCategory === 'custom'
          ? 'custom'
          : hasOpenings
            ? 'openings'
            : hasEndgames
              ? 'endgames'
              : 'custom'

  const [browseCategory, setBrowseCategory] = useState<
    'openings' | 'endgames' | 'custom'
  >(initialBrowseCategory)

  const initialPreview = useMemo(() => {
    if (firstInitialSelection) {
      const selectionOpening = firstInitialSelection.opening
      const selectionIsUsable =
        selectionOpening.categoryType !== 'endgame' ||
        selectionOpening.endgameMeta

      if (selectionIsUsable) {
        return selectionOpening
      }
    }

    if (initialBrowseCategory === 'custom') {
      return initialCustomOpenings[0] ?? fallbackOpening
    }

    if (initialBrowseCategory === 'endgames') {
      return normalizedEndgames[0] ?? fallbackOpening
    }

    return normalizedOpenings[0] ?? fallbackOpening
  }, [
    fallbackOpening,
    firstInitialSelection,
    initialBrowseCategory,
    initialCustomOpenings,
    normalizedEndgames,
    normalizedOpenings,
  ])

  const initialPreviewVariation =
    firstInitialSelection && initialPreview === firstInitialSelection.opening
      ? (firstInitialSelection.variation ?? null)
      : null
  const defaultMaiaVersion =
    MAIA_MODELS_WITH_NAMES[4] ?? MAIA_MODELS_WITH_NAMES[0]
  const initialMaiaVersion = firstInitialSelection?.maiaVersion
    ? (MAIA_MODELS_WITH_NAMES.find(
        (model) => model.id === firstInitialSelection.maiaVersion,
      ) ?? defaultMaiaVersion)
    : defaultMaiaVersion
  const initialTargetMoves = firstInitialSelection?.targetMoveNumber ?? 10
  const initialSelectedColor: 'white' | 'black' =
    firstInitialSelection?.playerColor ?? 'white'

  const [previewOpening, setPreviewOpening] = useState<Opening>(initialPreview)
  const [previewVariation, setPreviewVariation] =
    useState<OpeningVariation | null>(initialPreviewVariation)
  const [selectedMaiaVersion, setSelectedMaiaVersion] =
    useState(initialMaiaVersion)
  const [selectedColor, setSelectedColor] = useState<'white' | 'black'>(
    initialBrowseCategory === 'endgames' ? 'white' : initialSelectedColor,
  )
  const [targetMoveNumber, setTargetMoveNumber] = useState<number | null>(
    initialTargetMoves,
  )
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
  const getDefaultPreviewByCategory = useCallback(
    (category: 'openings' | 'endgames' | 'custom'): Opening => {
      if (category === 'openings') {
        return normalizedOpenings[0] ?? fallbackOpening
      }
      if (category === 'endgames') {
        return normalizedEndgames[0] ?? fallbackOpening
      }
      return customOpenings[0] ?? fallbackOpening
    },
    [customOpenings, normalizedEndgames, normalizedOpenings, fallbackOpening],
  )

  const handleBrowseCategoryChange = useCallback(
    (
      category: 'openings' | 'endgames' | 'custom',
      options: { preservePreview?: boolean } = {},
    ) => {
      const { preservePreview = false } = options

      setBrowseCategory(category)
      setSearchTerm('')
      setMobilePopupOpen(false)
      setMobilePopupOpening(null)
      setMobilePopupVariation(null)

      if (!preservePreview) {
        const nextPreview = getDefaultPreviewByCategory(category)
        setPreviewOpening(nextPreview)
        setPreviewVariation(null)
        if (category === 'endgames') {
          setSelectedColor('white')
        }
      }

      if (category !== 'endgames') {
        setEndgameTraitSelections({})
      }

      setSelections((prevSelections) => {
        if (!prevSelections.length) return prevSelections
        const selectionCategory = getOpeningCategory(prevSelections[0].opening)
        return selectionCategory === category ? prevSelections : []
      })
    },
    [
      getDefaultPreviewByCategory,
      setPreviewOpening,
      setPreviewVariation,
      setBrowseCategory,
      setSearchTerm,
      setSelectedColor,
      setMobilePopupOpen,
      setMobilePopupOpening,
      setMobilePopupVariation,
      setEndgameTraitSelections,
      setSelections,
    ],
  )

  const activeSelectionCategory = useMemo<DrillCategoryType | null>(() => {
    if (selections.length === 0) {
      return null
    }

    const first = selections[0]
    return getOpeningCategory(first.opening)
  }, [selections])

  const resolveCategoryData = useCallback(
    (opening: Opening): EndgameCategoryData | null => {
      if (opening.categoryType !== 'endgame' || !opening.endgameMeta) {
        return null
      }

      const fromDataset =
        endgameDataset?.categoryMap[opening.endgameMeta.categorySlug]
      if (fromDataset) {
        return fromDataset
      }

      return {
        slug: opening.endgameMeta.categorySlug,
        name: opening.endgameMeta.categoryName,
        traits: opening.endgameMeta.traits ?? {},
        motifs:
          opening.endgameMeta.motifs?.map((motif) => ({
            slug: motif.subcategorySlug,
            name: motif.subcategoryName,
            traits: motif.traits ?? {},
          })) ?? [],
      }
    },
    [endgameDataset],
  )

  const resolveMotifData = useCallback(
    (
      opening: Opening,
      variation: OpeningVariation | null,
    ): EndgameMotifData | null => {
      if (opening.categoryType !== 'endgame' || !variation?.endgameMeta) {
        return null
      }

      const categoryFromDataset =
        endgameDataset?.categoryMap[variation.endgameMeta.categorySlug]
      if (categoryFromDataset) {
        const fromMap =
          endgameDataset?.motifMap[
            `${variation.endgameMeta.categorySlug}/${variation.endgameMeta.subcategorySlug}`
          ]
        if (fromMap) {
          return fromMap
        }
      }

      const category = resolveCategoryData(opening)
      if (!category) return null

      const fallback =
        category.motifs.find(
          (motif) => motif.slug === variation.endgameMeta?.subcategorySlug,
        ) ??
        (variation.endgameMeta
          ? {
              slug: variation.endgameMeta.subcategorySlug,
              name: variation.endgameMeta.subcategoryName,
              traits: variation.endgameMeta.traits ?? {},
            }
          : null)

      return fallback ? { ...fallback } : null
    },
    [endgameDataset, resolveCategoryData],
  )

  const getAvailableEndgameTraits = useCallback(
    (opening: Opening, variation: OpeningVariation | null): EndgameTrait[] => {
      if (opening.categoryType !== 'endgame') return []

      const category = resolveCategoryData(opening)
      if (!category) return []

      const motif = variation ? resolveMotifData(opening, variation) : null
      const sourceTraits = motif ? motif.traits : category.traits

      return ENDGAME_TRAITS.filter(
        (trait) => (sourceTraits[trait]?.length ?? 0) > 0,
      )
    },
    [resolveCategoryData, resolveMotifData],
  )

  const getSelectedEndgameTraits = useCallback(
    (opening: Opening, variation: OpeningVariation | null): EndgameTrait[] => {
      const available = getAvailableEndgameTraits(opening, variation)
      if (!available.length) return []

      const key = getTraitSelectionKey(opening.id, variation?.id ?? null)
      const stored = endgameTraitSelections[key]

      if (stored === undefined) {
        return available
      }

      const filtered = stored.filter((trait) => available.includes(trait))
      if (filtered.length === 0) {
        return stored.length === 0 ? [] : available
      }
      return filtered
    },
    [endgameTraitSelections, getAvailableEndgameTraits],
  )

  const updateEndgameTraitSelection = useCallback(
    (
      openingId: string,
      variationId: string | null,
      nextTraits: EndgameTrait[],
    ) => {
      setEndgameTraitSelections((prev) => ({
        ...prev,
        [getTraitSelectionKey(openingId, variationId)]: nextTraits,
      }))
    },
    [],
  )

  const buildEndgamePositions = useCallback(
    (
      opening: Opening,
      variation: OpeningVariation | null,
      traits: EndgameTrait[],
    ): EndgamePositionDetail[] => {
      const category = resolveCategoryData(opening)
      if (!category || !traits.length) return []

      const motif = variation ? resolveMotifData(opening, variation) : null
      return collectEndgamePositions(category, motif, traits)
    },
    [resolveCategoryData, resolveMotifData],
  )

  const getEndgamePreviewFen = useCallback(
    (
      opening: Opening,
      variation: OpeningVariation | null,
      traits: EndgameTrait[],
    ): string => {
      const positions = buildEndgamePositions(opening, variation, traits)
      if (positions.length > 0) {
        return positions[0].fen
      }
      return variation?.fen ?? opening.fen
    },
    [buildEndgamePositions],
  )

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
    handleBrowseCategoryChange('custom', { preservePreview: true })
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
      const fallbackCategory = hasOpenings
        ? 'openings'
        : hasEndgames
          ? 'endgames'
          : 'custom'
      handleBrowseCategoryChange(fallbackCategory, { preservePreview: true })
    }

    if (previewOpening.id === openingId) {
      const updatedPreview = nextPreview || fallbackOpening
      setPreviewOpening(updatedPreview)
      setPreviewVariation(null)
      if ((updatedPreview.categoryType ?? 'opening') === 'endgame') {
        setSelectedColor('white')
      }
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
        targetMoveNumber:
          getOpeningCategory(selection.opening) === 'endgame'
            ? null
            : targetMoveNumber,
      })),
    )
  }, [selectedMaiaVersion.id, targetMoveNumber])

  const handleStartTour = () => {
    startTour(tourConfigs.openingDrill.id, tourConfigs.openingDrill.steps, true)
  }

  const previewFen = useMemo(() => {
    if (previewOpening.categoryType === 'endgame') {
      const traits = getSelectedEndgameTraits(previewOpening, previewVariation)
      return getEndgamePreviewFen(previewOpening, previewVariation, traits)
    }

    return previewVariation ? previewVariation.fen : previewOpening.fen
  }, [
    getEndgamePreviewFen,
    getSelectedEndgameTraits,
    previewOpening,
    previewVariation,
  ])

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

  const isDuplicateSelection = useCallback(
    (
      opening: Opening,
      variation: OpeningVariation | null,
      traits: EndgameTrait[] = [],
    ) => {
      const category = getOpeningCategory(opening)
      if (category === 'endgame') {
        const normalizedTraits = [...traits].sort().join('|')
        return selections.some((selection) => {
          if (getOpeningCategory(selection.opening) !== 'endgame') {
            return false
          }
          if (selection.opening.id !== opening.id) return false
          if ((selection.variation?.id ?? null) !== (variation?.id ?? null)) {
            return false
          }
          const existingTraits = [...(selection.endgameTraits ?? [])]
            .sort()
            .join('|')
          return existingTraits === normalizedTraits
        })
      }

      return selections.some(
        (selection) =>
          selection.opening.id === opening.id &&
          selection.variation?.id === variation?.id &&
          selection.playerColor === selectedColor &&
          selection.maiaVersion === selectedMaiaVersion.id,
      )
    },
    [selectedColor, selectedMaiaVersion.id, selections],
  )

  const addSelection = () => {
    const category = getOpeningCategory(previewOpening)
    if (
      activeSelectionCategory &&
      activeSelectionCategory !== category &&
      selections.length > 0
    ) {
      return
    }

    if (category === 'endgame') {
      const selectedTraits = getSelectedEndgameTraits(
        previewOpening,
        previewVariation,
      )
      if (!selectedTraits.length) return

      if (
        isDuplicateSelection(previewOpening, previewVariation, selectedTraits)
      )
        return

      const positions = buildEndgamePositions(
        previewOpening,
        previewVariation,
        selectedTraits,
      )
      if (!positions.length) return

      const scope = previewVariation ? 'motif' : 'category'

      const newSelection: OpeningSelection = {
        id: `endgame-${previewOpening.id}-${previewVariation?.id || 'all'}-${selectedTraits.slice().sort().join('-')}-${
          positions.length
        }-${Date.now()}`,
        opening: previewOpening,
        variation: previewVariation,
        playerColor: 'white',
        maiaVersion: selectedMaiaVersion.id,
        targetMoveNumber: null,
        endgameTraits: selectedTraits,
        endgamePositions: positions,
        endgameScope: scope,
      }

      setSelections([...selections, newSelection])
      if (isMobile) {
        setActiveTab('selected')
      }
      return
    }

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

  const handleMobilePopupAddOpening = (color: 'white' | 'black') => {
    if (!mobilePopupOpening) return

    if (
      activeSelectionCategory &&
      activeSelectionCategory !== getOpeningCategory(mobilePopupOpening) &&
      selections.length > 0
    ) {
      return
    }

    if (isDuplicateSelection(mobilePopupOpening, mobilePopupVariation)) {
      return
    }

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
    if (isMobile) {
      setActiveTab('selected')
    }
  }

  const handleMobilePopupAddEndgame = () => {
    if (!mobilePopupOpening) return

    if (
      activeSelectionCategory &&
      activeSelectionCategory !== getOpeningCategory(mobilePopupOpening) &&
      selections.length > 0
    ) {
      return
    }

    const traits = getSelectedEndgameTraits(
      mobilePopupOpening,
      mobilePopupVariation,
    )
    if (!traits.length) return

    if (
      isDuplicateSelection(mobilePopupOpening, mobilePopupVariation, traits)
    ) {
      return
    }

    const positions = buildEndgamePositions(
      mobilePopupOpening,
      mobilePopupVariation,
      traits,
    )
    if (!positions.length) return

    const scope = mobilePopupVariation ? 'motif' : 'category'

    const newSelection: OpeningSelection = {
      id: `endgame-${mobilePopupOpening.id}-${mobilePopupVariation?.id || 'all'}-${traits.slice().sort().join('-')}-${
        positions.length
      }-${Date.now()}`,
      opening: mobilePopupOpening,
      variation: mobilePopupVariation,
      playerColor: 'white',
      maiaVersion: selectedMaiaVersion.id,
      targetMoveNumber: null,
      endgameTraits: traits,
      endgamePositions: positions,
      endgameScope: scope,
    }

    setSelections([...selections, newSelection])
    setMobilePopupOpen(false)
    setMobilePopupOpening(null)
    setMobilePopupVariation(null)
    if (isMobile) {
      setActiveTab('selected')
    }
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
    const category = getOpeningCategory(opening)
    if (
      activeSelectionCategory &&
      activeSelectionCategory !== category &&
      selections.length > 0
    ) {
      return
    }

    if (category === 'endgame') {
      const selectedTraits = getSelectedEndgameTraits(opening, variation)
      if (!selectedTraits.length) return
      if (isDuplicateSelection(opening, variation, selectedTraits)) return

      const positions = buildEndgamePositions(
        opening,
        variation,
        selectedTraits,
      )
      if (!positions.length) return

      const scope = variation ? 'motif' : 'category'
      const newSelection: OpeningSelection = {
        id: `endgame-${opening.id}-${variation?.id || 'all'}-${selectedTraits.slice().sort().join('-')}-${
          positions.length
        }-${Date.now()}`,
        opening,
        variation,
        playerColor: 'white',
        maiaVersion: selectedMaiaVersion.id,
        targetMoveNumber: null,
        endgameTraits: selectedTraits,
        endgamePositions: positions,
        endgameScope: scope,
      }

      setSelections([...selections, newSelection])
      setPreviewOpening(opening)
      setPreviewVariation(variation)
      if (isMobile) {
        setActiveTab('selected')
      }
      return
    }

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
    const numericTargets = selections
      .map((selection) =>
        typeof selection.targetMoveNumber === 'number'
          ? selection.targetMoveNumber
          : null,
      )
      .filter((value): value is number => value !== null)
    const averageTargetMoves =
      numericTargets.length > 0
        ? numericTargets.reduce((sum, value) => sum + value, 0) /
          numericTargets.length
        : 0
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

  const previewCategoryType = getOpeningCategory(previewOpening)
  const previewAvailableTraits =
    previewOpening.categoryType === 'endgame'
      ? getAvailableEndgameTraits(previewOpening, previewVariation)
      : []
  const previewSelectedTraits =
    previewOpening.categoryType === 'endgame'
      ? getSelectedEndgameTraits(previewOpening, previewVariation)
      : []
  const categoryMismatch =
    selections.length > 0 &&
    activeSelectionCategory !== null &&
    activeSelectionCategory !== previewCategoryType
  const previewIsDuplicate =
    previewOpening.categoryType === 'endgame'
      ? isDuplicateSelection(
          previewOpening,
          previewVariation,
          previewSelectedTraits,
        )
      : isDuplicateSelection(previewOpening, previewVariation)
  const previewAddDisabled =
    categoryMismatch ||
    (previewOpening.categoryType === 'endgame' &&
      (previewSelectedTraits.length === 0 ||
        previewAvailableTraits.length === 0))
  const previewDisabledReason = categoryMismatch
    ? `Cannot mix ${formatCategoryLabel(
        activeSelectionCategory,
      )} drills with ${formatCategoryLabel(previewCategoryType)} drills.`
    : previewOpening.categoryType === 'endgame' &&
        previewSelectedTraits.length === 0
      ? 'Select at least one trait.'
      : previewOpening.categoryType === 'endgame' &&
          previewAvailableTraits.length === 0
        ? 'No positions available for this selection.'
        : undefined

  const mobileCategory = mobilePopupOpening
    ? getOpeningCategory(mobilePopupOpening)
    : null
  const mobileAvailableTraits =
    mobilePopupOpening && mobilePopupOpening.categoryType === 'endgame'
      ? getAvailableEndgameTraits(mobilePopupOpening, mobilePopupVariation)
      : []
  const mobileSelectedTraits =
    mobilePopupOpening && mobilePopupOpening.categoryType === 'endgame'
      ? getSelectedEndgameTraits(mobilePopupOpening, mobilePopupVariation)
      : []
  const mobileCategoryMismatch =
    !!mobilePopupOpening &&
    selections.length > 0 &&
    activeSelectionCategory !== null &&
    mobileCategory !== null &&
    activeSelectionCategory !== mobileCategory
  const mobileIsDuplicate =
    mobilePopupOpening && mobilePopupOpening.categoryType === 'endgame'
      ? isDuplicateSelection(
          mobilePopupOpening,
          mobilePopupVariation,
          mobileSelectedTraits,
        )
      : mobilePopupOpening
        ? isDuplicateSelection(mobilePopupOpening, mobilePopupVariation)
        : false
  const mobileAddDisabled =
    mobileCategoryMismatch ||
    (mobilePopupOpening?.categoryType === 'endgame' &&
      (mobileSelectedTraits.length === 0 || mobileAvailableTraits.length === 0))
  const mobileDisabledReason = mobileCategoryMismatch
    ? `Cannot mix ${formatCategoryLabel(
        activeSelectionCategory,
      )} drills with ${mobileCategory ? formatCategoryLabel(mobileCategory) : 'this'} drills.`
    : mobilePopupOpening?.categoryType === 'endgame' &&
        mobileSelectedTraits.length === 0
      ? 'Select at least one trait.'
      : mobilePopupOpening?.categoryType === 'endgame' &&
          mobileAvailableTraits.length === 0
        ? 'No positions available for this selection.'
        : undefined
  const mobilePreviewFen =
    mobilePopupOpening?.categoryType === 'endgame'
      ? getEndgamePreviewFen(
          mobilePopupOpening,
          mobilePopupVariation,
          mobileSelectedTraits,
        )
      : mobilePopupVariation
        ? mobilePopupVariation.fen
        : (mobilePopupOpening?.fen ?? DEFAULT_START_FEN)

  return (
    <ModalContainer className="!z-10" dismiss={onClose}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative flex h-[90vh] max-h-[900px] w-[98vw] max-w-[1320px] flex-col items-start justify-start overflow-hidden rounded-xl border border-glass-border bg-[#231d1a] backdrop-blur-md md:h-[90vh]"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.00) 20%), radial-gradient(ellipse 180% 160% at 0% 100%, rgba(239, 68, 68, 0.08) 0%, transparent 72%)',
          }}
        />
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-secondary transition-colors hover:text-primary"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        {/* Header Section */}
        <div
          id="opening-drill-modal"
          className="flex w-full items-center justify-between border-b border-glass-border px-6 pb-3.5 pt-[18px]"
        >
          <div>
            <h1 className="text-[18px] font-semibold text-primary">
              Maia Drill Studio
            </h1>
            <p className="mt-0.5 text-[12px] text-secondary">
              Select drills, configure settings, practice against Maia.
            </p>
          </div>
        </div>

        {/* Mobile Tab Navigation */}
        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectionsCount={selections.length}
        />

        {/* Main Content - Responsive Layout */}
        <div className="grid w-full flex-1 grid-cols-1 overflow-hidden md:grid-cols-[320px_minmax(0,1fr)]">
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
            onBrowseCategoryChange={handleBrowseCategoryChange}
            customInput={customInput}
            setCustomInput={setCustomInput}
            customError={customError}
            onAddCustomPosition={handleAddCustomPosition}
            categoryLabel={categoryLabel}
            categoryLabelPlural={categoryLabelPlural}
          />
          <DrillStudioPanel
            previewOpening={previewOpening}
            previewVariation={previewVariation}
            previewFen={previewFen}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            addSelection={addSelection}
            panelLabel={previewPanelLabel}
            isDuplicate={previewIsDuplicate}
            isAddDisabled={previewAddDisabled}
            disabledReason={previewDisabledReason}
            isEndgame={previewOpening.categoryType === 'endgame'}
            selectedTraits={previewSelectedTraits}
            availableTraits={previewAvailableTraits}
            onToggleTrait={(trait) => {
              const current = new Set(previewSelectedTraits)
              if (current.has(trait)) {
                current.delete(trait)
              } else {
                current.add(trait)
              }
              updateEndgameTraitSelection(
                previewOpening.id,
                previewVariation?.id ?? null,
                Array.from(current),
              )
            }}
            selections={selections}
            removeSelection={removeSelection}
            onSelectQueueItem={(selection) => {
              setPreviewOpening(selection.opening)
              setPreviewVariation(selection.variation ?? null)
              setSelectedColor(selection.playerColor)
            }}
            handleStartDrilling={handleStartDrilling}
            selectedMaiaVersion={selectedMaiaVersion}
            setSelectedMaiaVersion={setSelectedMaiaVersion}
            targetMoveNumber={targetMoveNumber}
            setTargetMoveNumber={setTargetMoveNumber}
            showTargetSlider={browseCategory === 'openings'}
          />
        </div>

        {/* Mobile-only Selected Panel */}
        <div className="w-full md:hidden">
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
            showTargetSlider={browseCategory === 'openings'}
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
            previewFen={mobilePreviewFen}
            onAddOpening={handleMobilePopupAddOpening}
            onAddEndgame={handleMobilePopupAddEndgame}
            onRemove={handleMobilePopupRemove}
            isSelected={isOpeningSelected(
              mobilePopupOpening,
              mobilePopupVariation,
            )}
            isEndgame={mobilePopupOpening.categoryType === 'endgame'}
            selectedTraits={mobileSelectedTraits}
            availableTraits={mobileAvailableTraits}
            onToggleTrait={(trait) => {
              if (!mobilePopupOpening) return
              const key = getTraitSelectionKey(
                mobilePopupOpening.id,
                mobilePopupVariation?.id ?? null,
              )
              const current = new Set(mobileSelectedTraits)
              if (current.has(trait)) {
                current.delete(trait)
              } else {
                current.add(trait)
              }
              updateEndgameTraitSelection(
                mobilePopupOpening.id,
                mobilePopupVariation?.id ?? null,
                Array.from(current),
              )
            }}
            isDuplicate={mobileIsDuplicate}
            isAddDisabled={mobileAddDisabled}
            disabledReason={mobileDisabledReason}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
          />
        )}
      </motion.div>
    </ModalContainer>
  )
}
