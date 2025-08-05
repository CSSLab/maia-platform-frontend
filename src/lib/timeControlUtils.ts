/**
 * Utility functions for time control conversion between custom values and preset formats
 */

import { TimeControl, TimeControlOptions } from 'src/types'

export interface CustomTimeControl {
  minutes: number
  increment: number
}

/**
 * Convert custom time control values to the closest preset TimeControl format
 */
export const customToPresetTimeControl = (
  minutes: number,
  increment: number,
): TimeControl => {
  const customFormat = `${minutes}+${increment}`

  // Check if it matches any existing preset
  if (TimeControlOptions.includes(customFormat as TimeControl)) {
    return customFormat as TimeControl
  }

  // For custom values that don't match presets, return the custom format
  // The game logic will need to handle this appropriately
  return customFormat as TimeControl
}

/**
 * Parse a TimeControl string into custom time control values
 */
export const parseTimeControl = (
  timeControl: TimeControl,
): CustomTimeControl => {
  if (timeControl === 'unlimited') {
    return { minutes: 0, increment: 0 }
  }

  const [minutesStr, incrementStr] = timeControl.split('+')
  return {
    minutes: parseInt(minutesStr, 10) || 0,
    increment: parseInt(incrementStr, 10) || 0,
  }
}

/**
 * Check if a time control is a preset option
 */
export const isPresetTimeControl = (timeControl: TimeControl): boolean => {
  return TimeControlOptions.includes(timeControl)
}

/**
 * Get preset time control options with labels
 */
export const getPresetOptions = () => {
  return TimeControlOptions.map((option) => ({
    value: option,
    label: option === 'unlimited' ? 'Unlimited' : option,
  }))
}
