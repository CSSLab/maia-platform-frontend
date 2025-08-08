import { buildUrl } from '../utils'

// API Types for opening drill logging

export interface LogOpeningDrillRequest {
  opening_fen: string
  side_played: string
  opponent: string
  num_moves: number
  moves_played_uci: string[]
}

// API function to log a completed opening drill
export const logOpeningDrill = async (
  request: LogOpeningDrillRequest,
): Promise<void> => {
  const res = await fetch(buildUrl('opening/log_opening_drill'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (res.status === 401) {
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    throw new Error(`Failed to log opening drill: ${res.statusText}`)
  }
}
