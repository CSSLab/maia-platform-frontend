import {
  Opening,
  OpeningVariation,
  EndgameTrait,
  EndgamePositionDetail,
} from 'src/types/openings'

export const ENDGAME_TRAITS: EndgameTrait[] = [
  'multi_pawns_each',
  'no_pawns',
  'one_pawn_each',
  'one_pawn_total',
]

export const ENDGAME_TRAIT_LABELS: Record<EndgameTrait, string> = {
  multi_pawns_each: 'Multi-Pawns Each',
  no_pawns: 'No Pawns',
  one_pawn_each: 'One Pawn Each',
  one_pawn_total: 'One Pawn Total',
}

const ENDGAME_CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'King-Pawn Endgames': 'Pawn Endgames',
}

const ENDGAME_CATEGORY_ORDER = [
  'King-Pawn Endgames',
  'Rook Endgames',
  'Queen Endgames',
  'Bishop Endgames',
  'Knight Endgames',
] as const

const ENDGAME_MOTIF_ORDER: Partial<Record<string, readonly string[]>> = {
  'Queen Endgames': [
    'QvQ',
    'QvR',
    'RvQ',
    'QvRR',
    'RRvQ',
    'QvK',
    'QvBR',
    'BRvQ',
    'QvNR',
    'NRvQ',
  ],
  'Rook Endgames': [
    'RvR',
    'RvB',
    'BvR',
    'RvN',
    'NvR',
    'RvK',
    'RvBB',
    'BBvR',
    'RvNB',
    'NBvR',
    'RvNN',
  ],
  'Bishop Endgames': ['BvB', 'BvN', 'NvB', 'BvK', 'BBvK', 'NBvK'],
  'Knight Endgames': ['NvN', 'NvK'],
  'King-Pawn Endgames': [
    'pawn_only_subtype__noflank_balanced',
    'pawn_only_subtype__noflank_majority',
    'pawn_only_subtype__noflank_minority',
    'pawn_only_subtype__flank_balanced',
    'pawn_only_subtype__flank_majority',
    'pawn_only_subtype__flank_minority',
  ],
}

const PIECE_CODE_LABELS: Record<string, string> = {
  K: 'King',
  Q: 'Queen',
  R: 'Rook',
  B: 'Bishop',
  N: 'Knight',
}

const formatMaterialSide = (material: string): string => {
  if (!material) return material

  const repeatedPiece = material.length === 2 && material[0] === material[1]
  if (repeatedPiece) {
    const label = PIECE_CODE_LABELS[material[0]] ?? material[0]
    return `Two ${label}s`
  }

  if (material.length === 2) {
    const chars = material.split('')
    const normalizedPair = chars.slice().sort().join('')

    if (normalizedPair === 'BN') return 'Bishop + Knight'
    if (normalizedPair === 'BR') return 'Bishop + Rook'

    return chars.map((char) => PIECE_CODE_LABELS[char] ?? char).join(' + ')
  }

  return PIECE_CODE_LABELS[material] ?? material
}

const ENDGAME_MOTIF_DISPLAY_NAMES: Record<string, string> = {
  pawn_only_subtype__flank_balanced: 'Flank Pawns (Balanced)',
  pawn_only_subtype__flank_majority: 'Flank Pawns (Majority)',
  pawn_only_subtype__flank_minority: 'Flank Pawns (Minority)',
  pawn_only_subtype__noflank_balanced: 'Central Pawns (Balanced)',
  pawn_only_subtype__noflank_majority: 'Central Pawns (Majority)',
  pawn_only_subtype__noflank_minority: 'Central Pawns (Minority)',
}

const getEndgameCategoryDisplayName = (categoryName: string) =>
  ENDGAME_CATEGORY_DISPLAY_NAMES[categoryName] ?? categoryName

const getEndgameMotifDisplayName = (motifName: string) => {
  const explicitLabel = ENDGAME_MOTIF_DISPLAY_NAMES[motifName]
  if (explicitLabel) return explicitLabel

  const [left, right] = motifName.split('v')
  if (left && right) {
    return `${formatMaterialSide(left)} vs ${formatMaterialSide(right)}`
  }

  return motifName
}

const getPreferredOrderIndex = (
  value: string,
  preferredOrder: readonly string[] | undefined,
) => {
  if (!preferredOrder) return Number.POSITIVE_INFINITY
  const index = preferredOrder.indexOf(value)
  return index === -1 ? Number.POSITIVE_INFINITY : index
}

const normalizeFen = (fen: string): string => {
  const trimmed = fen.trim()
  if (!trimmed) return trimmed

  const parts = trimmed.split(/\s+/)

  if (parts.length >= 6) {
    return parts.slice(0, 6).join(' ')
  }

  const defaults: Record<number, string> = {
    1: 'w',
    2: '-',
    3: '-',
    4: '0',
    5: '1',
  }

  const normalized = [...parts]

  for (let index = parts.length; index < 6; index += 1) {
    normalized[index] = defaults[index] ?? '0'
  }

  return normalized.slice(0, 6).join(' ')
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

type EndgameMotifRaw = Partial<Record<EndgameTrait, string[]>> | string[]

export type EndgamesJson = Record<string, Record<string, EndgameMotifRaw>>

export interface EndgameMotifData {
  slug: string
  name: string
  traits: Partial<Record<EndgameTrait, string[]>>
}

export interface EndgameCategoryData {
  slug: string
  name: string
  traits: Partial<Record<EndgameTrait, string[]>>
  motifs: EndgameMotifData[]
}

export interface EndgameDataset {
  categories: EndgameCategoryData[]
  categoryMap: Record<string, EndgameCategoryData>
  motifMap: Record<string, EndgameMotifData & { categorySlug: string }>
}

const cloneTraitLists = (
  traits: Partial<Record<EndgameTrait, string[]>>,
): Partial<Record<EndgameTrait, string[]>> => {
  const result: Partial<Record<EndgameTrait, string[]>> = {}
  for (const trait of ENDGAME_TRAITS) {
    const list = traits[trait]
    if (list?.length) {
      result[trait] = Array.from(new Set(list.map((fen) => normalizeFen(fen))))
    }
  }
  return result
}

const normalizeMotifTraits = (
  traits: EndgameMotifRaw,
): Partial<Record<EndgameTrait, string[]>> => {
  if (Array.isArray(traits)) {
    return {
      multi_pawns_each: traits.map((fen) => normalizeFen(fen)),
    }
  }
  return cloneTraitLists(traits)
}

export const buildEndgameDataset = (raw: EndgamesJson): EndgameDataset => {
  const categories: EndgameCategoryData[] = []
  const categoryMap: Record<string, EndgameCategoryData> = {}
  const motifMap: Record<string, EndgameMotifData & { categorySlug: string }> =
    {}

  for (const [categoryName, motifs] of Object.entries(raw)) {
    const categorySlug = slugify(categoryName)
    const categoryDisplayName = getEndgameCategoryDisplayName(categoryName)

    const aggregatedTraits: Partial<Record<EndgameTrait, string[]>> = {}

    const motifOrder = ENDGAME_MOTIF_ORDER[categoryName]

    const motifList = Object.entries(motifs)
      .map(([motifName, motifTraitsRaw]) => {
        const motifSlug = slugify(motifName)
        const traitEntries = normalizeMotifTraits(motifTraitsRaw)

        for (const trait of ENDGAME_TRAITS) {
          const traitList = traitEntries[trait]
          if (traitList?.length) {
            const existing = new Set(aggregatedTraits[trait] ?? [])
            traitList.forEach((fen) => existing.add(normalizeFen(fen)))
            aggregatedTraits[trait] = Array.from(existing)
          }
        }

        const motifData: EndgameMotifData = {
          slug: motifSlug,
          name: getEndgameMotifDisplayName(motifName),
          traits: traitEntries,
        }

        motifMap[`${categorySlug}/${motifSlug}`] = {
          ...motifData,
          categorySlug,
        }

        return {
          rawName: motifName,
          data: motifData,
        }
      })
      .sort((a, b) => {
        const aIndex = getPreferredOrderIndex(a.rawName, motifOrder)
        const bIndex = getPreferredOrderIndex(b.rawName, motifOrder)

        if (aIndex !== bIndex) return aIndex - bIndex

        return a.data.name.localeCompare(b.data.name)
      })
      .map((entry) => entry.data)

    const categoryData: EndgameCategoryData = {
      slug: categorySlug,
      name: categoryDisplayName,
      traits: aggregatedTraits,
      motifs: motifList,
    }

    categories.push(categoryData)
    categoryMap[categorySlug] = categoryData
  }

  categories.sort((a, b) => {
    const aIndex = getPreferredOrderIndex(
      a.slug,
      ENDGAME_CATEGORY_ORDER.map((category) => slugify(category)),
    )
    const bIndex = getPreferredOrderIndex(
      b.slug,
      ENDGAME_CATEGORY_ORDER.map((category) => slugify(category)),
    )

    if (aIndex !== bIndex) return aIndex - bIndex

    return a.name.localeCompare(b.name)
  })

  return {
    categories,
    categoryMap,
    motifMap,
  }
}

const pickFirstFen = (
  traits: Partial<Record<EndgameTrait, string[]>>,
): string | null => {
  for (const trait of ENDGAME_TRAITS) {
    const list = traits[trait]
    if (list?.length) {
      return normalizeFen(list[0])
    }
  }
  return null
}

export const createEndgameOpenings = (dataset: EndgameDataset): Opening[] => {
  return dataset.categories
    .map<Opening | null>((category) => {
      const fallbackFen = pickFirstFen(category.traits) ?? ''

      if (!fallbackFen) {
        return null
      }

      const variations: OpeningVariation[] = category.motifs
        .map((motif) => {
          const motifFen = pickFirstFen(motif.traits)
          if (!motifFen) return null

          return {
            id: `${category.slug}__${motif.slug}`,
            name: motif.name,
            fen: motifFen,
            pgn: '',
            setupFen: motifFen,
            endgameMeta: {
              categorySlug: category.slug,
              categoryName: category.name,
              subcategorySlug: motif.slug,
              subcategoryName: motif.name,
              traits: motif.traits,
            },
          } as OpeningVariation
        })
        .filter(
          (variation): variation is OpeningVariation => variation !== null,
        )

      const opening: Opening = {
        id: category.slug,
        name: category.name,
        description: '',
        fen: fallbackFen,
        pgn: '',
        setupFen: fallbackFen,
        variations,
        categoryType: 'endgame',
        endgameMeta: {
          categorySlug: category.slug,
          categoryName: category.name,
          traits: category.traits,
          motifs: category.motifs.map((motif) => ({
            subcategorySlug: motif.slug,
            subcategoryName: motif.name,
            traits: motif.traits,
          })),
        },
      }

      return opening
    })
    .filter((opening): opening is Opening => opening !== null)
}

export const collectEndgamePositions = (
  category: EndgameCategoryData,
  motif: EndgameMotifData | null,
  selectedTraits: EndgameTrait[],
): EndgamePositionDetail[] => {
  const positions: EndgamePositionDetail[] = []
  const seen = new Set<string>()

  const sourceTraits = motif ? motif.traits : category.traits

  selectedTraits.forEach((trait) => {
    const fenList = sourceTraits[trait] ?? []
    fenList.forEach((fen, index) => {
      const normalizedFen = normalizeFen(fen)
      if (seen.has(normalizedFen)) return
      seen.add(normalizedFen)
      positions.push({
        fen: normalizedFen,
        trait,
        traitLabel: ENDGAME_TRAIT_LABELS[trait],
        categoryName: category.name,
        categorySlug: category.slug,
        subcategoryName: motif?.name,
        subcategorySlug: motif?.slug,
        index,
      })
    })
  })

  return positions
}
