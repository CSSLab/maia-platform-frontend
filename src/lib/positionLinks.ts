import { Chess } from 'chess.ts'

import { MAIA_MODELS } from 'src/constants/common'

export interface PositionLinkOptions {
  fen: string
  challengeId?: string
  name?: string
  description?: string
  pgn?: string
  playerColor?: 'white' | 'black'
  maiaVersion?: string
  targetMoveNumber?: number | null
  returnTo?: string
  forcedPlayerColor?: 'white' | 'black'
  modalTitle?: string
  modalSubtitle?: string
}

export const DEFAULT_POSITION_MAIA_MODEL = 'maia_kdd_1900'
const DEFAULT_POSITION_NAME = 'Tournament Position'

export const normalizeFen = (fen: string): string => {
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

  if (!normalized[1]) normalized[1] = 'w'
  if (!normalized[2]) normalized[2] = '-'
  if (!normalized[3]) normalized[3] = '-'

  return normalized.slice(0, 6).join(' ')
}

export const isValidFen = (fen: string): boolean => {
  const normalized = normalizeFen(fen)
  if (!normalized) return false

  try {
    return new Chess().load(normalized)
  } catch {
    return false
  }
}

export const inferPlayerColorFromFen = (fen: string): 'white' | 'black' => {
  const normalized = normalizeFen(fen)
  return normalized.split(' ')[1] === 'b' ? 'black' : 'white'
}

export const getValidMaiaModel = (model?: string): string => {
  if (model && MAIA_MODELS.includes(model)) {
    return model
  }

  return DEFAULT_POSITION_MAIA_MODEL
}

const getResolvedPositionName = (name?: string): string =>
  name?.trim() || DEFAULT_POSITION_NAME

export const buildAnalysisPositionLink = (
  options: PositionLinkOptions,
): string => {
  const params = new URLSearchParams()
  const name = getResolvedPositionName(options.name)
  const normalizedFen = normalizeFen(options.fen)
  const trimmedPgn = options.pgn?.trim()

  params.set('name', name)
  if (trimmedPgn) {
    params.set('pgn', trimmedPgn)
  } else {
    params.set('fen', normalizedFen)
  }

  return `/analysis/custom?${params.toString()}`
}

export const buildPositionDrillLink = (
  options: PositionLinkOptions,
): string => {
  const params = new URLSearchParams()
  const name = getResolvedPositionName(options.name)
  const normalizedFen = normalizeFen(options.fen)
  params.set('customFen', normalizedFen)
  params.set('customName', name)
  params.set('tab', 'custom')

  return `/drills?${params.toString()}`
}

export const buildPositionPlayLink = (options: PositionLinkOptions): string => {
  const params = new URLSearchParams()
  const normalizedFen = normalizeFen(options.fen)
  const forcedPlayerColor =
    options.forcedPlayerColor ?? inferPlayerColorFromFen(normalizedFen)

  params.set('fen', normalizedFen)
  params.set('maiaVersion', 'maia_kdd_1500')
  params.set('timeControl', '10+5')
  if (options.returnTo) {
    params.set('returnTo', options.returnTo)
  }
  if (options.challengeId) {
    params.set('challengeId', options.challengeId)
  }
  params.set('forcedColor', forcedPlayerColor)
  if (options.modalTitle) {
    params.set('modalTitle', options.modalTitle)
  }
  if (options.modalSubtitle) {
    params.set('modalSubtitle', options.modalSubtitle)
  }

  return `/play?${params.toString()}`
}
