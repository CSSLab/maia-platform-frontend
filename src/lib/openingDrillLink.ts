import openingsJson from 'src/constants/maia_openings_expanded.json'
import { MAIA3_OPPONENT_RATINGS } from 'src/constants/common'
import { Opening, OpeningSelection, OpeningVariation } from 'src/types'

const OPENINGS = openingsJson as Opening[]

// The moves a linked drill plays from the opening, as the drill dialog's
// default.
const LINKED_TARGET_MOVES = 10

// The Maia a drill falls back to: the drill dialog's default.
const DEFAULT_MAIA = MAIA3_OPPONENT_RATINGS[9] ?? MAIA3_OPPONENT_RATINGS[0]

export interface OpeningMatch {
  opening: Opening
  variation: OpeningVariation | null
}

/**
 * A position by its pieces, side to move and castling rights: move counters
 * differ between move orders, and the en passant square between FEN writers
 * (some write it after any double step, some only when a capture is legal).
 */
const positionKey = (fen: string) =>
  fen.trim().split(/\s+/).slice(0, 3).join(' ')

let positions: Map<string, OpeningMatch> | null = null

/** Each drillable opening and variation by its position. */
const openingPositions = () => {
  if (positions) return positions
  positions = new Map()
  for (const opening of OPENINGS) {
    const key = positionKey(opening.fen)
    if (!positions.has(key)) positions.set(key, { opening, variation: null })
    for (const variation of opening.variations) {
      const key = positionKey(variation.fen)
      if (!positions.has(key)) positions.set(key, { opening, variation })
    }
  }
  return positions
}

/**
 * The most specific drillable opening a game reached: the last of its
 * positions (in order, from the start) that is an opening's or variation's.
 */
export const matchOpening = (fens: string[]): OpeningMatch | null => {
  const known = openingPositions()
  for (let i = fens.length - 1; i >= 0; i--) {
    const match = known.get(positionKey(fens[i]))
    if (match) return match
  }
  return null
}

/** The name a button gives the drill: the variation's, else the opening's. */
export const openingLabel = (match: OpeningMatch) =>
  match.variation?.name ?? match.opening.name

const maiaOrDefault = (maiaVersion: string | undefined) =>
  MAIA3_OPPONENT_RATINGS.find((model) => model.id === maiaVersion)?.id ??
  DEFAULT_MAIA.id

/** The drills page, starting a drill of this opening at once. */
export const openingDrillHref = (
  match: OpeningMatch,
  color: 'white' | 'black',
  maiaVersion: string,
) =>
  `/drills?${new URLSearchParams({
    opening: match.opening.id,
    ...(match.variation ? { variation: match.variation.id } : {}),
    color,
    maia: maiaOrDefault(maiaVersion),
  })}`

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined

/**
 * The drill an openings page link asks for (see `openingDrillHref`), or
 * null when it names no opening the page has.
 */
export const linkedDrillSelection = (query: {
  [key: string]: string | string[] | undefined
}): OpeningSelection | null => {
  const opening = OPENINGS.find((o) => o.id === one(query.opening))
  if (!opening) return null
  const variationId = one(query.variation)
  const variation = variationId
    ? opening.variations.find((v) => v.id === variationId)
    : null
  if (variationId && !variation) return null
  const playerColor = one(query.color) === 'black' ? 'black' : 'white'
  const maiaVersion = maiaOrDefault(one(query.maia))
  return {
    opening: { ...opening, categoryType: 'opening' },
    variation: variation ?? null,
    playerColor,
    maiaVersion,
    targetMoveNumber: LINKED_TARGET_MOVES,
    id: `${opening.id}-${variation?.id || 'main'}-${playerColor}-${maiaVersion}`,
  }
}
