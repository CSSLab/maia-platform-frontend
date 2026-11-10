import {
  formatMaiaName,
  formatSavedName,
  getMaiaModelVersion,
} from './maiaNames'

describe('formatMaiaName', () => {
  it('names the model that was playing when the game was created', () => {
    expect(formatMaiaName('maia_kdd_1100', '2024-10-12T20:42:05.452000')).toBe(
      'Maia-1 1100',
    )
    expect(formatMaiaName('maia_kdd_1500', '2025-11-03T12:00:00.000000')).toBe(
      'Maia-2 1500',
    )
    expect(formatMaiaName('maia_kdd_2200', '2026-07-25T06:08:11.208000')).toBe(
      'Maia-3 2200',
    )
  })

  it('reads backend times as UTC', () => {
    // 16:35 UTC is 12:35 in Toronto: read as local time, it would be Maia-1.
    expect(getMaiaModelVersion('2025-07-12T16:40:00.000000')).toBe('Maia-2')
    expect(getMaiaModelVersion('2025-07-12T16:30:00.000000')).toBe('Maia-1')
    expect(getMaiaModelVersion('2026-02-09T09:41:00')).toBe('Maia-2')
    expect(getMaiaModelVersion('2026-02-09T09:43:00')).toBe('Maia-3')
    expect(getMaiaModelVersion('2026-02-09T04:43:00-05:00')).toBe('Maia-3')
  })

  it('takes a game without a time to be a current one', () => {
    expect(formatMaiaName('maia_kdd_1100')).toBe('Maia-3 1100')
    expect(formatMaiaName('maia_kdd_1100', null)).toBe('Maia-3 1100')
    expect(formatMaiaName('maia_kdd_1100', 'not a date')).toBe('Maia-3 1100')
  })
})

describe('formatSavedName', () => {
  it('names the model in saved names of played games', () => {
    const before = '2025-08-25T13:26:51.281000'
    expect(formatSavedName('You vs. Maia 1100', 'play', before)).toBe(
      'You vs. Maia-2 1100',
    )
    expect(formatSavedName('maia 1500 vs. You', 'brain', before)).toBe(
      'Maia-2 1500 vs. You',
    )
    expect(formatSavedName('Best win vs Maia-2 1100', 'play', before)).toBe(
      'Best win vs Maia-2 1100',
    )
  })

  it('leaves custom games and empty names alone', () => {
    expect(formatSavedName('Maia 1100 vs Leela', 'custom', undefined)).toBe(
      'Maia 1100 vs Leela',
    )
    expect(formatSavedName(undefined, 'play', undefined)).toBeUndefined()
  })
})
