import { waitForStockfishReady } from './waitForStockfishReady'

describe('waiting for Stockfish', () => {
  it('waits past the old five-second cutoff until the engine becomes ready', async () => {
    let ready = false
    let waits = 0
    const result = await waitForStockfishReady(
      { isReady: () => ready, getInitializationError: () => null },
      () => false,
      async () => {
        waits++
        if (waits === 60) ready = true
      },
    )

    expect(result).toBe(true)
    expect(waits).toBe(60)
  })

  it('stops waiting when analysis is cancelled or initialization fails', async () => {
    let cancelled = false
    const engine = {
      isReady: () => false,
      getInitializationError: () => null,
    }
    expect(
      await waitForStockfishReady(
        engine,
        () => cancelled,
        async () => {
          cancelled = true
        },
      ),
    ).toBe(false)

    expect(
      await waitForStockfishReady(
        { ...engine, getInitializationError: () => 'Model failed' },
        () => false,
        async () => {
          throw new Error('Should not wait after failure')
        },
      ),
    ).toBe(false)
  })
})
