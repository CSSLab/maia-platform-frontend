import { savedResponses } from './savedResponses'

describe('savedResponses', () => {
  let now = 1_000_000
  beforeEach(() => {
    localStorage.clear()
    now = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => jest.restoreAllMocks())

  it('keeps an answer until it is too old', () => {
    const saved = savedResponses<number>({ name: 't', maxAgeMs: 1000 })
    expect(saved.get('a')).toBeUndefined()
    saved.set('a', 5)
    now += 999
    expect(saved.get('a')).toBe(5)
    now += 1
    expect(saved.get('a')).toBeUndefined()
  })

  it('is shared with later pages through localStorage', () => {
    savedResponses<string>({ name: 't', maxAgeMs: 1000 }).set('a', 'x')
    const later = savedResponses<string>({ name: 't', maxAgeMs: 1000 })
    expect(later.get('a')).toBe('x')
    expect(
      savedResponses<string>({ name: 'other', maxAgeMs: 1000 }).get('a'),
    ).toBeUndefined()
  })

  it('keeps only the most recent entries', () => {
    const saved = savedResponses<number>({
      name: 't',
      maxAgeMs: 10_000,
      maxEntries: 2,
    })
    saved.set('a', 1)
    now += 1
    saved.set('b', 2)
    now += 1
    saved.set('c', 3)
    expect([saved.get('a'), saved.get('b'), saved.get('c')]).toEqual([
      undefined,
      2,
      3,
    ])
  })

  it('works without localStorage', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const saved = savedResponses<number>({ name: 't', maxAgeMs: 1000 })
    saved.set('a', 1)
    expect(saved.get('a')).toBe(1)
  })

  it('ignores a clock that has gone back', () => {
    const saved = savedResponses<number>({ name: 't', maxAgeMs: 1000 })
    saved.set('a', 1)
    now -= 5000
    expect(saved.get('a')).toBeUndefined()
  })
})
