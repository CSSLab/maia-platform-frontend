import { act, renderHook } from '@testing-library/react'

import type { TablebaseClient, TablebaseResult } from 'src/lib/tablebase'
import { TABLEBASE_DEBOUNCE_MS, useTablebase } from './useTablebase'

const KP_FEN = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'
const KP_FEN_2 = '4k3/8/8/8/8/8/3KP3/8 b - - 1 1'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const resultFor = (fen: string): TablebaseResult => ({
  fen,
  category: 'win',
  dtm: 43,
  dtz: 9,
  checkmate: false,
  stalemate: false,
  moves: [],
})

/** A client that answers every lookup at once and caches it. */
const fakeClient = () => {
  const cache = new Map<string, TablebaseResult | null>()
  const client: TablebaseClient & { lookup: jest.Mock } = {
    peek: (fen) => (cache.has(fen) ? cache.get(fen) : undefined),
    lookup: jest.fn(async (fen: string) => {
      const result = resultFor(fen)
      cache.set(fen, result)
      return result
    }),
  }
  return client
}

describe('useTablebase', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('looks the position up once it has been shown for a moment', async () => {
    const client = fakeClient()
    const { result } = renderHook(() => useTablebase(KP_FEN, true, client))

    expect(result.current).toBeNull()
    expect(client.lookup).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(TABLEBASE_DEBOUNCE_MS)
    })
    expect(client.lookup).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual(resultFor(KP_FEN))
  })

  it('skips positions passed through quickly (e.g. holding an arrow key)', async () => {
    const client = fakeClient()
    const { rerender, result } = renderHook(
      ({ fen }) => useTablebase(fen, true, client),
      { initialProps: { fen: KP_FEN } },
    )

    act(() => {
      jest.advanceTimersByTime(TABLEBASE_DEBOUNCE_MS / 2)
    })
    rerender({ fen: KP_FEN_2 })
    await act(async () => {
      jest.advanceTimersByTime(TABLEBASE_DEBOUNCE_MS)
    })

    expect(client.lookup).toHaveBeenCalledTimes(1)
    expect(client.lookup.mock.calls[0][0]).toBe(KP_FEN_2)
    expect(result.current?.fen).toBe(KP_FEN_2)
  })

  it('shows a position already looked up at once', async () => {
    const client = fakeClient()
    await client.lookup(KP_FEN)
    client.lookup.mockClear()

    const { result } = renderHook(() => useTablebase(KP_FEN, true, client))
    expect(result.current).toEqual(resultFor(KP_FEN))
    act(() => {
      jest.advanceTimersByTime(TABLEBASE_DEBOUNCE_MS)
    })
    expect(client.lookup).not.toHaveBeenCalled()
  })

  it("doesn't look up positions with too many pieces, or when disabled", () => {
    const client = fakeClient()
    renderHook(() => useTablebase(START_FEN, true, client))
    const { result } = renderHook(() => useTablebase(KP_FEN, false, client))
    act(() => {
      jest.advanceTimersByTime(TABLEBASE_DEBOUNCE_MS * 2)
    })
    expect(client.lookup).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it('shows nothing when the lookup fails', async () => {
    const client = fakeClient()
    client.lookup.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useTablebase(KP_FEN, true, client))

    await act(async () => {
      jest.advanceTimersByTime(TABLEBASE_DEBOUNCE_MS)
    })
    expect(result.current).toBeNull()
  })
})
