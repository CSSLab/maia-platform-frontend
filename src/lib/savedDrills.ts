import {
  DrillCategoryType,
  DrillConfiguration,
  OpeningSelection,
} from 'src/types/openings'

export interface SavedDrillPreset {
  id: string
  name: string
  configuration: DrillConfiguration
  selectionCount: number
  createdAt: string
  updatedAt: string
  signature: string
}

export const SAVED_DRILL_PRESETS_STORAGE_KEY = 'maia-saved-drill-presets'

const MAX_SAVED_DRILL_PRESETS = 24

export const cloneDrillConfiguration = (
  configuration: DrillConfiguration,
): DrillConfiguration => ({
  selections: JSON.parse(
    JSON.stringify(configuration.selections ?? []),
  ) as OpeningSelection[],
})

const getSelectionCategory = (
  selection: OpeningSelection,
): DrillCategoryType => {
  if (selection.opening.categoryType) return selection.opening.categoryType
  return selection.opening.isCustom ? 'custom' : 'opening'
}

export const getDrillSelectionSignature = (selection: OpeningSelection) => {
  const category = getSelectionCategory(selection)
  const isCustom = category === 'custom' || selection.opening.isCustom

  return {
    category,
    openingId: selection.opening.id,
    openingFen: isCustom ? selection.opening.fen : undefined,
    openingPgn: isCustom ? selection.opening.pgn : undefined,
    openingSetupFen: isCustom ? selection.opening.setupFen : undefined,
    variationId: selection.variation?.id ?? null,
    variationFen: isCustom ? selection.variation?.fen : undefined,
    variationPgn: isCustom ? selection.variation?.pgn : undefined,
    playerColor: selection.playerColor,
    maiaVersion: selection.maiaVersion,
    targetMoveNumber: selection.targetMoveNumber,
    endgameTraits: [...(selection.endgameTraits ?? [])].sort(),
    endgameScope: selection.endgameScope ?? null,
    endgamePositions:
      selection.endgamePositions?.map((position) => ({
        fen: position.fen,
        trait: position.trait,
        index: position.index,
      })) ?? null,
  }
}

export const getDrillConfigurationSignature = (
  configuration: DrillConfiguration,
): string =>
  JSON.stringify(
    (configuration.selections ?? []).map((selection) =>
      getDrillSelectionSignature(selection),
    ),
  )

const getSingleSelectionConfiguration = (
  selection: OpeningSelection,
): DrillConfiguration => cloneDrillConfiguration({ selections: [selection] })

export const getDefaultSavedDrillPresetName = (
  configuration: DrillConfiguration,
): string => {
  const selections = configuration.selections ?? []
  const firstSelection = selections[0]

  if (!firstSelection) {
    return 'Saved Drill'
  }

  const firstName = firstSelection.variation
    ? `${firstSelection.opening.name}: ${firstSelection.variation.name}`
    : firstSelection.opening.name

  if (selections.length === 1) {
    return firstName
  }

  return `${firstName} + ${selections.length - 1}`
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const createPresetFromSelection = ({
  selection,
  id,
  name,
  createdAt,
  updatedAt,
}: {
  selection: OpeningSelection
  id: string
  name?: string
  createdAt: string
  updatedAt: string
}): SavedDrillPreset => {
  const configuration = getSingleSelectionConfiguration(selection)
  const signature = getDrillConfigurationSignature(configuration)

  return {
    id,
    name: name ?? getDefaultSavedDrillPresetName(configuration),
    configuration,
    selectionCount: 1,
    createdAt,
    updatedAt,
    signature,
  }
}

const normalizeSavedDrillPreset = (value: unknown): SavedDrillPreset[] => {
  if (!isRecord(value)) {
    return []
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    !isRecord(value.configuration)
  ) {
    return []
  }

  const rawSelections = value.configuration.selections
  if (!Array.isArray(rawSelections)) {
    return []
  }

  const presetId = value.id
  const presetName = value.name
  const createdAt = value.createdAt
  const updatedAt = value.updatedAt

  const configuration = cloneDrillConfiguration({
    selections: rawSelections as OpeningSelection[],
  })

  return configuration.selections.map((selection, index) =>
    createPresetFromSelection({
      selection,
      id:
        configuration.selections.length === 1
          ? presetId
          : `${presetId}-${index + 1}`,
      name:
        configuration.selections.length === 1
          ? presetName
          : getDefaultSavedDrillPresetName({ selections: [selection] }),
      createdAt,
      updatedAt,
    }),
  )
}

export const readSavedDrillPresets = (): SavedDrillPreset[] => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = window.localStorage.getItem(SAVED_DRILL_PRESETS_STORAGE_KEY)
    if (!stored) {
      return []
    }

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return []
    }

    const uniquePresets = new Map<string, SavedDrillPreset>()

    parsed.flatMap(normalizeSavedDrillPreset).forEach((preset) => {
      if (!uniquePresets.has(preset.signature)) {
        uniquePresets.set(preset.signature, preset)
      }
    })

    return Array.from(uniquePresets.values()).slice(0, MAX_SAVED_DRILL_PRESETS)
  } catch (error) {
    console.warn('Failed to parse saved drill presets:', error)
    return []
  }
}

export const writeSavedDrillPresets = (
  presets: SavedDrillPreset[],
): SavedDrillPreset[] => {
  const normalizedPresets = presets.slice(0, MAX_SAVED_DRILL_PRESETS)

  if (typeof window === 'undefined') {
    return normalizedPresets
  }

  try {
    window.localStorage.setItem(
      SAVED_DRILL_PRESETS_STORAGE_KEY,
      JSON.stringify(normalizedPresets),
    )
  } catch (error) {
    console.warn('Failed to save drill presets:', error)
  }

  return normalizedPresets
}

export const upsertSavedDrillPreset = (
  configuration: DrillConfiguration,
  existingPresets: SavedDrillPreset[],
): SavedDrillPreset[] => {
  if (!configuration.selections.length) {
    return existingPresets
  }

  const clonedConfiguration = cloneDrillConfiguration(configuration)
  const now = new Date().toISOString()
  const nextPresets = clonedConfiguration.selections.map((selection, index) => {
    const singleSelectionConfiguration =
      getSingleSelectionConfiguration(selection)
    const signature = getDrillConfigurationSignature(
      singleSelectionConfiguration,
    )
    const existingPreset = existingPresets.find(
      (preset) => preset.signature === signature,
    )

    return createPresetFromSelection({
      selection,
      id:
        existingPreset?.id ??
        `saved-drill-${Date.now()}-${index}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
      name: existingPreset?.name,
      createdAt: existingPreset?.createdAt ?? now,
      updatedAt: now,
    })
  })

  const nextSignatures = new Set(nextPresets.map((preset) => preset.signature))
  return [
    ...nextPresets,
    ...existingPresets.filter(
      (existing) => !nextSignatures.has(existing.signature),
    ),
  ].slice(0, MAX_SAVED_DRILL_PRESETS)
}
