import { act, renderHook } from '@testing-library/react'
import { markAppHydrated } from 'src/components/Common/PageShell'
import { useStartConfirmation } from './useStartConfirmation'

// In order: until _app marks the app hydrated, a page is one opened by loading
// it; after that, any page is one reached by a click in the site.
describe('useStartConfirmation', () => {
  it('asks on a page opened by a link, a bookmark or a refresh, until the visitor confirms', () => {
    const { result, rerender } = renderHook(() => useStartConfirmation())
    expect(result.current.mustConfirm).toBe(true)

    act(() => result.current.confirm())
    expect(result.current.mustConfirm).toBe(false)

    // The page's later games start without asking again.
    rerender()
    expect(result.current.mustConfirm).toBe(false)
  })

  it('keeps asking on that page after the app has hydrated, until confirmed', () => {
    const { result } = renderHook(() => useStartConfirmation())
    markAppHydrated()
    expect(result.current.mustConfirm).toBe(true)
  })

  it("doesn't ask on a page reached by a click in the site", () => {
    markAppHydrated()
    const { result } = renderHook(() => useStartConfirmation())
    expect(result.current.mustConfirm).toBe(false)
  })
})
