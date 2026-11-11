import { formatNewsDate, isExternalLink } from './format'

describe('formatNewsDate', () => {
  it('writes the day it names, whatever the reader\u2019s time zone', () => {
    expect(formatNewsDate('2026-11-06')).toBe('Nov 6, 2026')
    expect(formatNewsDate('2025-01-01')).toBe('Jan 1, 2025')
  })
})

describe('isExternalLink', () => {
  it('tells full URLs from pages of the site', () => {
    expect(isExternalLink('https://arxiv.org/abs/2006.01855')).toBe(true)
    expect(isExternalLink('/analysis')).toBe(false)
    expect(isExternalLink('/blog/maia-v1')).toBe(false)
  })
})
