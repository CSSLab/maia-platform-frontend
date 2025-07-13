import React, { useState, useMemo, useEffect, useContext } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import Chessground from '@react-chess/chessground'
import {
  Opening,
  OpeningVariation,
  OpeningSelection,
  DrillConfiguration,
} from 'src/types'
import { ModalContainer } from '../Misc/ModalContainer'
import { useTour } from 'src/contexts'
import { tourConfigs } from 'src/config/tours'
import { WindowSizeContext } from 'src/contexts/WindowSizeContext'
import {
  trackOpeningSelectionModalOpened,
  trackOpeningSearchUsed,
  trackOpeningPreviewSelected,
  trackOpeningQuickAddUsed,
  trackOpeningConfiguredAndAdded,
  trackOpeningRemovedFromSelection,
  trackDrillConfigurationCompleted,
} from 'src/utils/analytics'

const MAIA_VERSIONS = [
  { id: 'maia_kdd_1100', name: 'Maia 1100' },
  { id: 'maia_kdd_1200', name: 'Maia 1200' },
  { id: 'maia_kdd_1300', name: 'Maia 1300' },
  { id: 'maia_kdd_1400', name: 'Maia 1400' },
  { id: 'maia_kdd_1500', name: 'Maia 1500' },
  { id: 'maia_kdd_1600', name: 'Maia 1600' },
  { id: 'maia_kdd_1700', name: 'Maia 1700' },
  { id: 'maia_kdd_1800', name: 'Maia 1800' },
  { id: 'maia_kdd_1900', name: 'Maia 1900' },
]

type MobileTab = 'browse' | 'preview' | 'selected'

interface Props {
  openings: Opening[]
  initialSelections?: OpeningSelection[]
  onComplete: (configuration: DrillConfiguration) => void
  onClose: () => void
}

const TabNavigation: React.FC<{
  activeTab: MobileTab
  setActiveTab: (tab: MobileTab) => void
  selectionsCount: number
}> = ({ activeTab, setActiveTab, selectionsCount }) => {
  const { isMobile } = useContext(WindowSizeContext)

  return (
    <div className="flex w-full border-b border-white/10 md:hidden">
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
        {...(isMobile ? { id: 'opening-drill-preview' } : {})}
        onClick={() => setActiveTab('preview')}
        className={`flex-1 py-3 text-sm font-medium transition-colors ${
          activeTab === 'preview'
            ? 'border-b-2 border-human-4 text-primary'
            : 'text-secondary hover:text-primary'
        }`}
      >
        Preview
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

// Left Panel - Opening Selection - moved outside main component
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
}) => (
  <div
    id="opening-drill-browse"
    className={`flex w-full flex-col overflow-y-scroll ${activeTab !== 'browse' ? 'hidden md:flex' : 'flex'} md:border-r md:border-white/10`}
  >
    <div className="hidden h-20 flex-col justify-center gap-1 border-b border-white/10 p-4 md:flex">
      <h2 className="text-xl font-bold">Select Openings</h2>
      <p className="text-xs text-secondary">
        Click the + button to quickly add an opening with current settings
      </p>
    </div>

    {/* Mobile header */}
    <div className="flex h-16 flex-col justify-center gap-1 border-b border-white/10 p-4 md:hidden">
      <h2 className="text-lg font-bold">Select Openings</h2>
      <p className="text-xs text-secondary">Choose openings to practice</p>
    </div>

    {/* Search Bar */}
    <div className="border-b border-white/10 p-4">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary">
          search
        </span>
        <input
          type="text"
          placeholder="Search openings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded bg-background-2 py-2 pl-10 pr-4 text-sm text-primary placeholder-secondary focus:outline-none focus:ring-1 focus:ring-human-4"
        />
      </div>
    </div>

    <div
      className="red-scrollbar flex flex-1 flex-col overflow-y-auto"
      style={{ userSelect: 'none' }}
    >
      {filteredOpenings.map((opening) => (
        <div key={opening.id} className="flex flex-col">
          <div
            className={`group mb-1 transition-colors ${
              previewOpening.id === opening.id && !previewVariation
                ? 'bg-human-2/20'
                : 'hover:bg-human-2/10'
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
                  trackOpeningPreviewSelected(opening.name, opening.id, false)
                  if (window.innerWidth < 768) {
                    setActiveTab('preview')
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setPreviewOpening(opening)
                    setPreviewVariation(null)
                    trackOpeningPreviewSelected(opening.name, opening.id, false)
                    if (window.innerWidth < 768) {
                      setActiveTab('preview')
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
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  addQuickSelection(opening, null)
                }}
                disabled={isDuplicateSelection(opening, null)}
                className="mr-3 rounded p-1 text-secondary/60 transition-colors hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30 group-hover:text-secondary/80"
                title={
                  isDuplicateSelection(opening, null)
                    ? 'Already added with current settings'
                    : 'Add opening with current settings'
                }
              >
                <span className="material-symbols-outlined text-base">add</span>
              </button>
            </div>
          </div>
          {opening.variations.map((variation) => (
            <div
              key={variation.id}
              className={`group transition-colors ${
                previewOpening.id === opening.id &&
                previewVariation?.id === variation.id
                  ? 'bg-human-2/20'
                  : 'hover:bg-human-2/10'
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
                    if (window.innerWidth < 768) {
                      setActiveTab('preview')
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
                      if (window.innerWidth < 768) {
                        setActiveTab('preview')
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-secondary">{variation.name}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    addQuickSelection(opening, variation)
                  }}
                  disabled={isDuplicateSelection(opening, variation)}
                  className="mr-3 rounded p-1 text-secondary/60 transition-colors hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30 group-hover:text-secondary/80"
                  title={
                    isDuplicateSelection(opening, variation)
                      ? 'Already added with current settings'
                      : 'Add variation with current settings'
                  }
                >
                  <span className="material-symbols-outlined text-base">
                    add
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
)

const PreviewPanel: React.FC<{
  activeTab: MobileTab
  previewOpening: Opening
  previewVariation: OpeningVariation | null
  previewFen: string
  selectedColor: 'white' | 'black'
  setSelectedColor: (color: 'white' | 'black') => void
  selectedMaiaVersion: (typeof MAIA_VERSIONS)[0]
  setSelectedMaiaVersion: (version: (typeof MAIA_VERSIONS)[0]) => void
  targetMoveNumber: number
  setTargetMoveNumber: (number: number) => void
  addSelection: () => void
  isDuplicateSelection: (
    opening: Opening,
    variation: OpeningVariation | null,
  ) => boolean
}> = ({
  activeTab,
  previewOpening,
  previewVariation,
  previewFen,
  selectedColor,
  setSelectedColor,
  selectedMaiaVersion,
  setSelectedMaiaVersion,
  targetMoveNumber,
  setTargetMoveNumber,
  addSelection,
  isDuplicateSelection,
}) => (
  <div
    id="opening-drill-preview"
    className={`flex w-full flex-col overflow-hidden ${activeTab !== 'preview' ? 'hidden md:flex' : 'flex'}`}
  >
    <div className="hidden h-20 flex-col justify-center gap-1 border-b border-white/10 p-4 md:flex">
      <h2 className="text-xl font-bold">{previewOpening.name}</h2>
      <p className="text-xs text-secondary">
        {previewVariation && `${previewVariation.name} →`} Configure your drill
        settings
      </p>
    </div>

    {/* Mobile header */}
    <div className="flex h-16 flex-col justify-center gap-1 border-b border-white/10 p-4 md:hidden">
      <h2 className="text-lg font-bold">{previewOpening.name}</h2>
      <p className="text-xs text-secondary">
        {previewVariation && `${previewVariation.name} →`} Configure settings
      </p>
    </div>

    {/* Compact content area - no scrolling */}
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Compact chessboard section */}
      <div className="flex items-center justify-center p-2 md:p-3">
        <div className="aspect-square w-full max-w-[180px] md:max-w-[200px]">
          <Chessground
            contained
            config={{
              viewOnly: true,
              fen: previewFen,
              coordinates: true,
              animation: { enabled: true, duration: 200 },
            }}
          />
        </div>
      </div>

      {/* Compact configuration options */}
      <div className="flex flex-col gap-2 p-2 md:gap-3 md:p-3">
        {/* Color Selection */}
        <div>
          <p className="mb-1 text-xs font-medium md:text-sm">Play as:</p>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedColor('white')}
              className={`flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors md:px-3 md:py-2 md:text-sm ${
                selectedColor === 'white'
                  ? 'bg-human-4 text-white'
                  : 'bg-background-2 hover:bg-background-3'
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
              className={`flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors md:px-3 md:py-2 md:text-sm ${
                selectedColor === 'black'
                  ? 'bg-human-4 text-white'
                  : 'bg-background-2 hover:bg-background-3'
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

        {/* Maia Version Selection */}
        <div>
          <p className="mb-1 text-xs font-medium md:text-sm">Opponent:</p>
          <select
            value={selectedMaiaVersion.id}
            onChange={(e) => {
              const version = MAIA_VERSIONS.find((v) => v.id === e.target.value)
              if (version) {
                setSelectedMaiaVersion(version)
              }
            }}
            className="w-full rounded bg-background-2 p-2 text-xs focus:outline-none md:text-sm"
          >
            {MAIA_VERSIONS.map((version) => (
              <option key={version.id} value={version.id}>
                {version.name}
              </option>
            ))}
          </select>
        </div>

        {/* Move Count Configuration */}
        <div>
          <p className="mb-1 text-xs font-medium md:text-sm">
            Target Move Count: {targetMoveNumber}
          </p>
          <input
            type="range"
            min="5"
            max="30"
            value={targetMoveNumber}
            onChange={(e) =>
              setTargetMoveNumber(parseInt(e.target.value) || 10)
            }
            className="w-full accent-human-4"
          />
          <div className="mt-1 flex justify-between text-xs text-secondary">
            <span>5</span>
            <span>30</span>
          </div>
        </div>
      </div>
    </div>

    {/* Fixed button section - always visible */}
    <div className="flex-shrink-0 border-t border-white/10 bg-background-1 p-3 md:p-4">
      <button
        onClick={addSelection}
        disabled={isDuplicateSelection(previewOpening, previewVariation)}
        className="w-full rounded bg-human-4 py-2 text-sm font-medium transition-colors hover:bg-human-4/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDuplicateSelection(previewOpening, previewVariation)
          ? 'Already Added with Same Settings'
          : 'Add to Drill'}
      </button>
    </div>
  </div>
)

const SelectedPanel: React.FC<{
  activeTab: MobileTab
  selections: OpeningSelection[]
  removeSelection: (id: string) => void
  drillCount: number
  setDrillCount: (count: number) => void
  handleStartDrilling: () => void
}> = ({
  activeTab,
  selections,
  removeSelection,
  drillCount,
  setDrillCount,
  handleStartDrilling,
}) => (
  <div
    id="opening-drill-selected"
    className={`flex w-full flex-col overflow-hidden ${activeTab !== 'selected' ? 'hidden md:flex' : 'flex'} md:border-l md:border-white/10`}
  >
    <div className="hidden h-20 flex-col justify-center gap-1 border-b border-white/10 p-4 md:flex">
      <h2 className="text-xl font-bold">
        Selected Openings ({selections.length})
      </h2>
      <p className="text-xs text-secondary">Click to remove an opening</p>
    </div>

    {/* Mobile header */}
    <div className="flex h-16 flex-col justify-center gap-1 border-b border-white/10 p-4 md:hidden">
      <h2 className="text-lg font-bold">Selected ({selections.length})</h2>
      <p className="text-xs text-secondary">Tap to remove</p>
    </div>

    {/* Compact selections list - with constrained scrolling */}
    <div className="flex flex-1 flex-col overflow-hidden">
      {selections.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="max-w-xs px-4 text-center text-xs text-secondary md:text-sm">
            No openings selected yet. Choose openings from the Browse tab to
            start drilling.
          </p>
        </div>
      ) : (
        <div className="red-scrollbar flex-1 overflow-y-auto">
          <div className="flex w-full flex-col">
            {selections.map((selection) => (
              <div
                tabIndex={0}
                role="button"
                key={selection.id}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    removeSelection(selection.id)
                  }
                }}
                onClick={() => removeSelection(selection.id)}
                className="group flex cursor-pointer items-center justify-between border-b border-white/5 p-3 transition-colors hover:bg-human-2/10 md:p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
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
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs font-medium text-primary md:text-sm">
                        {selection.opening.name}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-secondary">
                        {selection.variation && (
                          <span className="truncate">
                            {selection.variation.name} •
                          </span>
                        )}
                        <span>
                          v. Maia{' '}
                          {selection.maiaVersion.replace('maia_kdd_', '')} •
                        </span>
                        <span>{selection.targetMoveNumber} moves</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button className="ml-2 text-secondary transition-colors group-hover:text-human-4">
                  <span className="material-symbols-outlined text-sm">
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
    <div className="flex-shrink-0 border-t border-white/10 bg-background-1 p-3 md:p-4">
      {/* Drill Count Configuration */}
      <div className="mb-3 md:mb-4">
        <p className="mb-1 text-xs font-medium md:mb-2 md:text-sm">
          Number of Drills: {drillCount}
        </p>
        <input
          type="range"
          min="1"
          max="50"
          value={drillCount}
          onChange={(e) => setDrillCount(parseInt(e.target.value) || 5)}
          className="w-full accent-human-4"
        />
        <div className="mt-1 flex justify-between text-xs text-secondary">
          <span>1</span>
          <span>50</span>
        </div>
        <p className="mt-1 text-xs text-secondary">
          {drillCount <= selections.length
            ? `You'll play ${drillCount} of your selected openings`
            : selections.length > 0
              ? `Each opening played at least once, with ${drillCount - selections.length} repeats`
              : 'Total number of opening drills to complete'}
        </p>
      </div>

      <button
        onClick={handleStartDrilling}
        disabled={selections.length === 0}
        className="w-full rounded bg-human-4 py-2 text-sm font-medium transition-colors hover:bg-human-4/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Start Drilling ({drillCount} drill{drillCount !== 1 ? 's' : ''})
      </button>
    </div>
  </div>
)

export const OpeningSelectionModal: React.FC<Props> = ({
  openings,
  initialSelections = [],
  onComplete,
  onClose,
}) => {
  const { startTour } = useTour()
  const [selections, setSelections] =
    useState<OpeningSelection[]>(initialSelections)
  const [previewOpening, setPreviewOpening] = useState<Opening>(openings[0])
  const [previewVariation, setPreviewVariation] =
    useState<OpeningVariation | null>(null)
  const [selectedMaiaVersion, setSelectedMaiaVersion] = useState(
    MAIA_VERSIONS[4],
  )
  const [selectedColor, setSelectedColor] = useState<'white' | 'black'>('white')
  const [targetMoveNumber, setTargetMoveNumber] = useState(10)
  const [drillCount, setDrillCount] = useState(5)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<MobileTab>('browse')
  const [initialTourCheck, setInitialTourCheck] = useState(false)
  const [hasTrackedModalOpen, setHasTrackedModalOpen] = useState(false)

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

  const handleStartTour = () => {
    startTour(tourConfigs.openingDrill.id, tourConfigs.openingDrill.steps, true)
  }

  const previewFen = useMemo(() => {
    return previewVariation ? previewVariation.fen : previewOpening.fen
  }, [previewOpening, previewVariation])

  const filteredOpenings = useMemo(() => {
    if (!searchTerm) return openings
    const filtered = openings.filter(
      (opening) =>
        opening.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opening.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opening.variations.some((variation) =>
          variation.name.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
    )

    // Track search usage
    if (searchTerm) {
      trackOpeningSearchUsed(searchTerm, filtered.length)
    }

    return filtered
  }, [openings, searchTerm])

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

    // Track opening configuration and addition
    trackOpeningConfiguredAndAdded(
      previewOpening.name,
      selectedColor,
      selectedMaiaVersion.id,
      targetMoveNumber,
      previewVariation?.name,
    )

    setSelections([...selections, newSelection])
    // Switch to selected tab on mobile after adding
    if (window.innerWidth < 768) {
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

  const addQuickSelection = (
    opening: Opening,
    variation: OpeningVariation | null,
  ) => {
    if (isDuplicateSelection(opening, variation)) return

    // Track quick add usage
    trackOpeningQuickAddUsed(
      opening.name,
      selectedColor,
      selectedMaiaVersion.id,
      targetMoveNumber,
    )

    const newSelection: OpeningSelection = {
      id: `${opening.id}-${variation?.id || 'main'}-${selectedColor}-${selectedMaiaVersion.id}-${targetMoveNumber}`,
      opening,
      variation,
      playerColor: selectedColor,
      maiaVersion: selectedMaiaVersion.id,
      targetMoveNumber,
    }

    setSelections([...selections, newSelection])
    // Also update the preview to show what was just added
    setPreviewOpening(opening)
    setPreviewVariation(variation)
    // Switch to selected tab on mobile after adding
    if (window.innerWidth < 768) {
      setActiveTab('selected')
    }
  }

  // Helper function to generate drill sequence
  const generateDrillSequence = (
    selections: OpeningSelection[],
    count: number,
  ): OpeningSelection[] => {
    if (selections.length === 0) return []

    // Create unique drill objects with timestamps to ensure unique IDs
    const createUniqueDrill = (
      selection: OpeningSelection,
      index: number,
    ): OpeningSelection => {
      const timestamp = Date.now()
      const uniqueId = `${selection.id}-${timestamp}-${index}`
      return {
        ...selection,
        id: uniqueId, // Create unique ID for each drill instance
      }
    }

    if (count <= selections.length) {
      // If drill count is less than or equal to selections, just shuffle and take the required amount
      const shuffled = [...selections].sort(() => Math.random() - 0.5)
      return shuffled
        .slice(0, count)
        .map((selection, index) => createUniqueDrill(selection, index))
    }

    // If drill count is more than selections, ensure each opening is played at least once
    const sequence: OpeningSelection[] = []

    // Add each selection once
    selections.forEach((selection, index) => {
      sequence.push(createUniqueDrill(selection, index))
    })

    const remaining = count - selections.length

    // Fill remaining slots by randomly picking from selections
    for (let i = 0; i < remaining; i++) {
      const randomSelection =
        selections[Math.floor(Math.random() * selections.length)]
      sequence.push(createUniqueDrill(randomSelection, selections.length + i))
    }

    // Shuffle the final sequence
    return sequence.sort(() => Math.random() - 0.5)
  }

  const handleStartDrilling = () => {
    if (selections.length > 0) {
      const drillSequence = generateDrillSequence(selections, drillCount)
      const configuration: DrillConfiguration = {
        selections,
        drillCount,
        drillSequence,
      }

      // Track drill configuration completion
      const uniqueOpenings = new Set(selections.map((s) => s.opening.id)).size
      const averageTargetMoves =
        selections.reduce((sum, s) => sum + s.targetMoveNumber, 0) /
        selections.length
      const maiaVersionsUsed = [
        ...new Set(selections.map((s) => s.maiaVersion)),
      ]
      const colorDistribution = selections.reduce(
        (acc, s) => {
          acc[s.playerColor]++
          return acc
        },
        { white: 0, black: 0 },
      )

      trackDrillConfigurationCompleted(
        selections.length,
        drillCount,
        uniqueOpenings,
        averageTargetMoves,
        maiaVersionsUsed,
        colorDistribution,
      )

      onComplete(configuration)
    }
  }

  return (
    <ModalContainer dismiss={onClose}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative flex h-[90vh] max-h-[900px] w-[98vw] max-w-[1400px] flex-col items-start justify-start overflow-hidden rounded-lg bg-background-1 shadow-2xl md:h-[90vh]"
      >
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
          className="flex w-full flex-col gap-1 border-b border-white/10 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-row items-center gap-3">
                <h1 className="text-xl font-bold text-primary md:text-2xl">
                  Opening Drills
                </h1>
                <button
                  type="button"
                  className="material-symbols-outlined text-lg text-secondary duration-200 hover:text-human-3 focus:outline-none"
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
          />
          <PreviewPanel
            activeTab={activeTab}
            previewOpening={previewOpening}
            previewVariation={previewVariation}
            previewFen={previewFen}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            selectedMaiaVersion={selectedMaiaVersion}
            setSelectedMaiaVersion={setSelectedMaiaVersion}
            targetMoveNumber={targetMoveNumber}
            setTargetMoveNumber={setTargetMoveNumber}
            addSelection={addSelection}
            isDuplicateSelection={isDuplicateSelection}
          />
          <SelectedPanel
            activeTab={activeTab}
            selections={selections}
            removeSelection={removeSelection}
            drillCount={drillCount}
            setDrillCount={setDrillCount}
            handleStartDrilling={handleStartDrilling}
          />
        </div>
      </motion.div>
    </ModalContainer>
  )
}
