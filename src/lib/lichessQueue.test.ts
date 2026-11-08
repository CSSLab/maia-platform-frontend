import { queueLichessRequest } from './lichessQueue'

describe('queueLichessRequest', () => {
  it('runs requests one after another, past failures', async () => {
    const order: string[] = []
    let releaseFirst = () => undefined as void
    const first = queueLichessRequest(
      () =>
        new Promise<void>((resolve) => {
          order.push('first start')
          releaseFirst = () => {
            order.push('first end')
            resolve()
          }
        }),
    )
    const failing = queueLichessRequest(async () => {
      order.push('second')
      throw new Error('429')
    })
    const third = queueLichessRequest(async () => order.push('third'))
    await Promise.resolve()
    expect(order).toEqual(['first start'])
    releaseFirst()
    await first
    await expect(failing).rejects.toThrow('429')
    await third
    expect(order).toEqual(['first start', 'first end', 'second', 'third'])
  })
})
