import { act, renderHook } from '@testing-library/react'
import { useEffect } from 'react'
import { parseQueryBoolean, useQueryBoolean } from './useQueryBoolean'

// The router as a page sees it: a page opened by loading it is first rendered
// with isReady false and an empty query, then again once Next has read the
// address.
let router: { isReady: boolean; query: Record<string, string | string[]> }
jest.mock('next/router', () => ({ useRouter: () => router }))

beforeEach(() => {
  router = { isReady: false, query: {} }
})

describe('parseQueryBoolean', () => {
  it('reads "true" and "false", and anything else as the default', () => {
    expect(parseQueryBoolean('true', false)).toBe(true)
    expect(parseQueryBoolean('false', true)).toBe(false)
    expect(parseQueryBoolean(undefined, true)).toBe(true)
    expect(parseQueryBoolean('', false)).toBe(false)
    expect(parseQueryBoolean('no', true)).toBe(true)
    expect(parseQueryBoolean(['false', 'false'], true)).toBe(true)
  })
})

describe('useQueryBoolean', () => {
  it("takes a loaded page's address value once the router is ready", () => {
    const { result, rerender } = renderHook(() =>
      useQueryBoolean('simulateMaiaTime', true),
    )
    expect(result.current[0]).toBe(true)

    router = { isReady: true, query: { simulateMaiaTime: 'false' } }
    rerender()
    expect(result.current[0]).toBe(false)
  })

  it('never lets an effect see the default once the router is ready', () => {
    // As /play/maia starts its game: in an effect that waits for isReady.
    const seenWhenReady: boolean[] = []
    const { rerender } = renderHook(() => {
      const [value] = useQueryBoolean('simulateMaiaTime', true)
      const ready = router.isReady
      useEffect(() => {
        if (ready) seenWhenReady.push(value)
      }, [ready, value])
    })

    router = { isReady: true, query: { simulateMaiaTime: 'false' } }
    rerender()
    expect(seenWhenReady).toEqual([false])
  })

  it('is the default when the address leaves it out', () => {
    router = { isReady: true, query: {} }
    const { result } = renderHook(() =>
      useQueryBoolean('simulateMaiaTime', true),
    )
    expect(result.current[0]).toBe(true)
  })

  it('reads a page reached by a click in the site, ready from its first render', () => {
    router = { isReady: true, query: { simulateMaiaTime: 'false' } }
    const { result } = renderHook(() =>
      useQueryBoolean('simulateMaiaTime', true),
    )
    expect(result.current[0]).toBe(false)
  })

  it("keeps the page's own change while the address's value stays", () => {
    router = { isReady: true, query: { simulateMaiaTime: 'false' } }
    const { result, rerender } = renderHook(() =>
      useQueryBoolean('simulateMaiaTime', true),
    )

    // The switch in the game's controls.
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)

    // Another part of the address changes (the game's id is added).
    router = { isReady: true, query: { simulateMaiaTime: 'false', id: 'g1' } }
    rerender()
    expect(result.current[0]).toBe(true)
  })

  it("takes the address's value again when it changes on the same page", () => {
    // "Play again": the setup dialog sends the page its next game's settings
    // without the page being drawn afresh.
    router = { isReady: true, query: { simulateMaiaTime: 'true', id: 'g1' } }
    const { result, rerender } = renderHook(() =>
      useQueryBoolean('simulateMaiaTime', true),
    )
    expect(result.current[0]).toBe(true)

    router = { isReady: true, query: { simulateMaiaTime: 'false' } }
    rerender()
    expect(result.current[0]).toBe(false)
  })
})
