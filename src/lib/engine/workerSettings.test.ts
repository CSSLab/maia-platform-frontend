import {
  defaultMaiaWorkers,
  maxMaiaWorkers,
  readMaiaWorkerSettings,
  MAIA_WORKER_SETTINGS_KEY,
} from './workerSettings'

describe('Maia worker settings', () => {
  it('uses device cores while retaining a responsive core', () => {
    expect(maxMaiaWorkers(2)).toBe(1)
    expect(defaultMaiaWorkers(4)).toBe(2)
    expect(maxMaiaWorkers(16)).toBe(4)
    expect(defaultMaiaWorkers(undefined)).toBe(2)
  })

  it('clamps stale or invalid stored counts to the current device', () => {
    const storage = {
      getItem: (key: string) =>
        key === MAIA_WORKER_SETTINGS_KEY
          ? JSON.stringify({ enabled: false, count: 99 })
          : null,
    }
    expect(readMaiaWorkerSettings(3, storage)).toEqual({
      enabled: false,
      count: 2,
    })
    expect(
      readMaiaWorkerSettings(8, {
        getItem: () => '{bad json',
      }),
    ).toEqual({ enabled: true, count: 2 })
  })
})
