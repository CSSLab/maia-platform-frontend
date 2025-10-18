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

    const aggregatedTraits: Partial<Record<EndgameTrait, string[]>> = {}

    const motifList: EndgameMotifData[] = Object.entries(motifs).map(
      ([motifName, motifTraitsRaw]) => {
        const motifSlug = slugify(motifName)
        const traitEntries = normalizeMotifTraits(motifTraitsRaw)

        for (const trait of ENDGAME_TRAITS) {
          if (traitEntries[trait]?.length) {
            const existing = new Set(aggregatedTraits[trait] ?? [])
            traitEntries[trait]!.forEach((fen) =>
              existing.add(normalizeFen(fen)),
            )
            aggregatedTraits[trait] = Array.from(existing)
          }
        }

        const motifData: EndgameMotifData = {
          slug: motifSlug,
          name: motifName,
          traits: traitEntries,
        }

        motifMap[`${categorySlug}/${motifSlug}`] = {
          ...motifData,
          categorySlug,
        }

        return motifData
      },
    )

    const categoryData: EndgameCategoryData = {
      slug: categorySlug,
      name: categoryName,
      traits: aggregatedTraits,
      motifs: motifList,
    }

    categories.push(categoryData)
    categoryMap[categorySlug] = categoryData
  }

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
        description: `Practice ${category.name.toLowerCase()} motifs.`,
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
