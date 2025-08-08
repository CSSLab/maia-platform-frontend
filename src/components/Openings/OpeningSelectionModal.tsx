import React, { useState, useMemo, useEffect, useContext } from 'react'
import { Chess } from 'chess.ts'
import Image from 'next/image'
import { motion } from 'framer-motion'
import Chessground from '@react-chess/chessground'
import { useWindowSize } from 'src/hooks/useWindowSize'
import {
  Opening,
  OpeningVariation,
  OpeningSelection,
  DrillConfiguration,
  EcoOpening,
  EcoOpeningVariation,
  EcoDatabase,
  EcoSection,
  PopularOpening,
} from 'src/types'
import { ModalContainer } from '../Common/ModalContainer'
import { useTour } from 'src/contexts'
import { tourConfigs } from 'src/constants/tours'
import { WindowSizeContext } from 'src/contexts/WindowSizeContext'
import EcoTreeView from './EcoTreeView'
import {
  processEcoDatabase,
  ecoToLegacyOpening,
} from 'src/lib/openings/ecoProcessor'
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
import { selectOpeningDrills } from 'src/api/opening'

type MobileTab = 'browse' | 'selected'

interface Props {
  openings: Opening[]
  ecoDatabase: EcoDatabase
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
    const pgn = variation?.pgn || opening.pgn
    if (pgn) {
      try {
        const chess = new Chess()
        chess.loadPgn(pgn.trim())
        return chess.fen()
      } catch (err) {
        // fall back to any provided fen if parsing fails
        return variation?.fen || opening.fen || ''
      }
    }
    return variation?.fen || opening.fen || ''
  }, [opening, variation])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-background-1 p-4">
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
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                  selectedColor === 'white'
                    ? 'bg-human-4 text-white'
                    : 'bg-background-2 hover:bg-background-3'
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
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                  selectedColor === 'black'
                    ? 'bg-human-4 text-white'
                    : 'bg-background-2 hover:bg-background-3'
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
            className="flex-1 rounded bg-background-2 py-2 text-sm font-medium transition-colors hover:bg-background-3"
          >
            Cancel
          </button>
          {isSelected ? (
            <button
              onClick={onRemove}
              className="flex-1 rounded bg-human-4 py-2 text-sm font-medium transition-colors"
            >
              Remove
            </button>
          ) : (
            <button
              onClick={() => onAdd(selectedColor)}
              className="flex-1 rounded bg-human-4 py-2 text-sm font-medium transition-colors hover:bg-human-4/80"
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

const PreviewPanel: React.FC<{
  selections: OpeningSelection[]
  previewOpening: Opening
  previewVariation: OpeningVariation | null
  previewFen: string
  selectedColor: 'white' | 'black'
  setSelectedColor: (color: 'white' | 'black') => void
  addSelection: () => void
}> = ({
  selections,
  previewOpening,
  previewVariation,
  previewFen,
  selectedColor,
  setSelectedColor,
  addSelection,
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
      <div className="hidden h-20 flex-col justify-center gap-1 border-b border-white/10 p-4 md:flex">
        <h2 className="text-xl font-bold">Preview Opening</h2>
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
          <p className="font-mono text-xs text-secondary">
            {previewVariation ? previewVariation.pgn : previewOpening.pgn}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium md:text-sm">Play as:</p>
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

      <div className="flex-shrink-0 border-t border-white/10 bg-background-1 p-3 md:p-4">
        <button
          onClick={addSelection}
          disabled={isDuplicateSelection(previewOpening, previewVariation)}
          className="w-full rounded bg-human-4 py-2 text-sm font-medium transition-colors hover:bg-human-4/80 disabled:cursor-not-allowed disabled:opacity-50"
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
  drillCount: number
  setDrillCount: (count: number) => void
  handleStartDrilling: () => void
  selectedMaiaVersion: (typeof MAIA_MODELS_WITH_NAMES)[0]
  setSelectedMaiaVersion: (version: (typeof MAIA_MODELS_WITH_NAMES)[0]) => void
  targetMoveNumber: number
  setTargetMoveNumber: (number: number) => void
}> = ({
  activeTab,
  selections,
  removeSelection,
  drillCount,
  setDrillCount,
  handleStartDrilling,
  selectedMaiaVersion,
  setSelectedMaiaVersion,
  targetMoveNumber,
  setTargetMoveNumber,
}) => (
  <div
    id="opening-drill-selected"
    className={`flex w-full flex-col overflow-hidden ${activeTab !== 'selected' ? 'hidden md:flex' : 'flex'} md:border-l md:border-white/10`}
  >
    <div className="hidden h-20 flex-col justify-center gap-1 border-b border-white/10 p-4 md:flex">
      <h2 className="text-xl font-bold">
        Selected Openings ({selections.length})
      </h2>
      <p className="text-xs text-secondary">Click X remove an opening</p>
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
                  className="ml-2 text-secondary transition-colors hover:text-human-4"
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
    <div className="flex-shrink-0 border-t border-white/10 bg-background-1 p-3 md:p-4">
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
          className="w-full rounded bg-background-2 p-2 text-xs focus:outline-none md:text-sm"
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

      {/* Drill Count Configuration */}
      <div className="mb-3 md:mb-4">
        <p className="mb-1 text-xs font-medium md:mb-2 md:text-sm">
          Number of Drills: {drillCount}
        </p>
        <input
          type="range"
          min="1"
          max="20"
          value={drillCount}
          onChange={(e) => setDrillCount(parseInt(e.target.value) || 5)}
          className="w-full accent-human-4"
        />
        <div className="mt-1 flex justify-between text-xs text-secondary">
          <span>1</span>
          <span>20</span>
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
  ecoDatabase,
  initialSelections = [],
  onComplete,
  onClose,
}) => {
  const { startTour } = useTour()
  const { isMobile } = useContext(WindowSizeContext)
  const [selections, setSelections] =
    useState<OpeningSelection[]>(initialSelections)
  const [selectedMaiaVersion, setSelectedMaiaVersion] = useState(
    MAIA_MODELS_WITH_NAMES[4],
  )
  const [selectedColor, setSelectedColor] = useState<'white' | 'black'>('white')
  const [targetMoveNumber, setTargetMoveNumber] = useState(10)
  const [drillCount, setDrillCount] = useState(5)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<MobileTab>('browse')
  const [initialTourCheck, setInitialTourCheck] = useState(false)
  const [hasTrackedModalOpen, setHasTrackedModalOpen] = useState(false)

  // ECO database processing
  const ecoData = useMemo(() => {
    return processEcoDatabase(ecoDatabase)
  }, [ecoDatabase])

  // ECO preview state - initialize with first ECO opening if available
  const [previewEcoOpening, setPreviewEcoOpening] = useState<EcoOpening | null>(
    null,
  )
  const [previewEcoVariation, setPreviewEcoVariation] =
    useState<EcoOpeningVariation | null>(null)
  const [mobilePopupOpening, setMobilePopupOpening] = useState<Opening | null>(
    null,
  )
  const [mobilePopupVariation, setMobilePopupVariation] =
    useState<OpeningVariation | null>(null)
  const [mobilePopupOpen, setMobilePopupOpen] = useState(false)

  // Initialize ECO preview when data becomes available
  useEffect(() => {
    if (ecoData?.sections?.[0]?.openings?.[0] && !previewEcoOpening) {
      setPreviewEcoOpening(ecoData.sections[0].openings[0])
    }
  }, [ecoData, previewEcoOpening])

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
    const pgn = previewEcoVariation?.pgn || previewEcoOpening?.pgn
    if (pgn) {
      try {
        const chess = new Chess()
        chess.loadPgn(pgn.trim())
        return chess.fen()
      } catch (err) {
        // fallback to any fen if present
        return (
          previewEcoVariation?.fen ||
          previewEcoOpening?.fen ||
          ecoData?.sections?.[0]?.openings?.[0]?.fen ||
          ''
        )
      }
    }
    return (
      previewEcoVariation?.fen ||
      previewEcoOpening?.fen ||
      ecoData?.sections?.[0]?.openings?.[0]?.fen ||
      ''
    )
  }, [previewEcoOpening, previewEcoVariation, ecoData])

  // ECO selection handlers
  const handleEcoOpeningClick = (
    opening: EcoOpening,
    variation?: EcoOpeningVariation,
  ) => {
    setPreviewEcoOpening(opening)
    setPreviewEcoVariation(variation || null)
    trackOpeningPreviewSelected(
      opening.name,
      opening.id,
      !!variation,
      variation?.name,
    )
  }

  const handleEcoQuickAdd = (
    opening: EcoOpening,
    variation?: EcoOpeningVariation,
  ) => {
    const legacyOpening = ecoToLegacyOpening(opening)
    const legacyVariation = variation
      ? {
          id: variation.id,
          name: variation.name,
          fen: variation.fen,
          pgn: variation.pgn,
        }
      : null

    // Check for duplicates
    const isDuplicate = selections.some(
      (s) =>
        s.opening.id === legacyOpening.id &&
        s.variation?.id === legacyVariation?.id &&
        s.playerColor === selectedColor &&
        s.maiaVersion === selectedMaiaVersion.id &&
        s.targetMoveNumber === targetMoveNumber,
    )

    if (isDuplicate) return

    // Track quick add usage
    trackOpeningQuickAddUsed(
      legacyOpening.name,
      selectedColor,
      selectedMaiaVersion.id,
      targetMoveNumber,
    )

    const newSelection: OpeningSelection = {
      id: `${legacyOpening.id}-${legacyVariation?.id || 'main'}-${selectedColor}-${selectedMaiaVersion.id}-${targetMoveNumber}`,
      opening: legacyOpening,
      variation: legacyVariation,
      playerColor: selectedColor,
      maiaVersion: selectedMaiaVersion.id,
      targetMoveNumber,
    }

    setSelections([...selections, newSelection])
    setPreviewEcoOpening(opening)
    setPreviewEcoVariation(variation || null)
    if (isMobile) {
      setActiveTab('selected')
    }
  }

  const isEcoSelected = (
    opening: EcoOpening,
    variation?: EcoOpeningVariation,
  ) => {
    return selections.some(
      (s) => s.opening.id === opening.id && s.variation?.id === variation?.id,
    )
  }

  const addSelection = () => {
    if (!previewEcoOpening) return

    const currentOpening = ecoToLegacyOpening(previewEcoOpening)
    const currentVariation = previewEcoVariation
      ? {
          id: previewEcoVariation.id,
          name: previewEcoVariation.name,
          fen: previewEcoVariation.fen,
          pgn: previewEcoVariation.pgn,
        }
      : null

    // Check for duplicates
    const isDuplicate = selections.some(
      (s) =>
        s.opening.id === currentOpening.id &&
        s.variation?.id === currentVariation?.id &&
        s.playerColor === selectedColor &&
        s.maiaVersion === selectedMaiaVersion.id &&
        s.targetMoveNumber === targetMoveNumber,
    )

    if (isDuplicate) return

    const newSelection: OpeningSelection = {
      id: `${currentOpening.id}-${currentVariation?.id || 'main'}-${selectedColor}-${selectedMaiaVersion.id}-${targetMoveNumber}`,
      opening: currentOpening,
      variation: currentVariation,
      playerColor: selectedColor,
      maiaVersion: selectedMaiaVersion.id,
      targetMoveNumber,
    }

    // Track opening configuration and addition
    trackOpeningConfiguredAndAdded(
      currentOpening.name,
      selectedColor,
      selectedMaiaVersion.id,
      targetMoveNumber,
      currentVariation?.name,
    )

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

  // Helper function to generate drill sequenc
  const generateDrillSequence = (
    selections: OpeningSelection[],
    count: number,
  ): OpeningSelection[] => {
    if (selections.length === 0) return []

    const createUniqueDrill = (
      selection: OpeningSelection,
      index: number,
    ): OpeningSelection => {
      const timestamp = Date.now()
      const uniqueId = `${selection.id}-${timestamp}-${index}`
      return {
        ...selection,
        id: uniqueId,
      }
    }

    if (count <= selections.length) {
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

  const handleStartDrilling = async () => {
    if (selections.length > 0) {
      const drillSequence = generateDrillSequence(selections, drillCount)

      try {
        // Prepare API request data
        const openings = selections.map((selection) => ({
          opening_fen: selection.variation
            ? selection.variation.fen
            : selection.opening.fen,
          side_played: selection.playerColor,
        }))

        // Call the backend API to log opening selections and get session ID
        const response = await selectOpeningDrills({
          openings,
          opponent: selectedMaiaVersion.id,
          num_moves: targetMoveNumber,
          num_drills: drillCount,
        })

        const configuration: DrillConfiguration = {
          selections,
          drillCount,
          drillSequence,
          sessionId: response.session_id,
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
      } catch (error) {
        console.error('Failed to start drilling session:', error)
        // Still allow the drill to start even if API call fails
        const configuration: DrillConfiguration = {
          selections,
          drillCount,
          drillSequence,
        }
        onComplete(configuration)
      }
    }
  }

  return (
    <ModalContainer className="!z-10" dismiss={onClose}>
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
          <div
            className={`flex w-full flex-col overflow-hidden ${activeTab !== 'browse' ? 'hidden md:flex' : 'flex'} md:border-r md:border-white/10`}
          >
            <div className="hidden h-20 flex-col justify-center gap-1 border-b border-white/10 p-4 md:flex">
              <h2 className="text-xl font-bold">ECO Opening Tree</h2>
              <p className="text-xs text-secondary">
                Browse openings organized by ECO classification
              </p>
            </div>

            <div className="flex h-16 flex-col justify-center gap-1 border-b border-white/10 p-4 md:hidden">
              <h2 className="text-lg font-bold">ECO Openings</h2>
              <p className="text-xs text-secondary">Choose from ECO database</p>
            </div>

            <EcoTreeView
              sections={ecoData.sections}
              popularOpenings={ecoData.popularOpenings}
              onOpeningClick={handleEcoOpeningClick}
              onQuickAdd={handleEcoQuickAdd}
              isSelected={isEcoSelected}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              previewOpening={previewEcoOpening}
              previewVariation={previewEcoVariation}
            />
          </div>
          <PreviewPanel
            selections={selections}
            previewOpening={
              previewEcoOpening
                ? ecoToLegacyOpening(previewEcoOpening)
                : ecoData?.sections?.[0]?.openings?.[0]
                  ? ecoToLegacyOpening(ecoData.sections[0].openings[0])
                  : {
                      id: '',
                      name: '',
                      description: '',
                      fen: '',
                      pgn: '',
                      variations: [],
                    }
            }
            previewVariation={
              previewEcoVariation
                ? {
                    id: previewEcoVariation.id,
                    name: previewEcoVariation.name,
                    fen: previewEcoVariation.fen,
                    pgn: previewEcoVariation.pgn,
                  }
                : null
            }
            previewFen={previewFen}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            addSelection={addSelection}
          />
          <SelectedPanel
            activeTab={activeTab}
            selections={selections}
            removeSelection={removeSelection}
            drillCount={drillCount}
            setDrillCount={setDrillCount}
            handleStartDrilling={handleStartDrilling}
            selectedMaiaVersion={selectedMaiaVersion}
            setSelectedMaiaVersion={setSelectedMaiaVersion}
            targetMoveNumber={targetMoveNumber}
            setTargetMoveNumber={setTargetMoveNumber}
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
