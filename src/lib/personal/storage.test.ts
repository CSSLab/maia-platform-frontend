import { localDay, previousDay, readJson, writeJson } from './storage'

describe('storage', () => {
  afterEach(() => jest.restoreAllMocks())

  it('reads back what it wrote', () => {
    writeJson('local', 'k', { a: 1 })
    expect(readJson('local', 'k')).toEqual({ a: 1 })
  })

  it('keeps working in memory when storage throws', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => writeJson('local', 'blocked', [1, 2])).not.toThrow()
    expect(readJson('local', 'blocked')).toEqual([1, 2])
  })

  it('ignores what is not JSON', () => {
    window.localStorage.setItem('bad', '{')
    expect(readJson('local', 'bad')).toBe(null)
  })

  it('counts local days', () => {
    expect(localDay(new Date(2026, 0, 1, 23, 59).getTime())).toBe('2026-01-01')
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
  })
})
