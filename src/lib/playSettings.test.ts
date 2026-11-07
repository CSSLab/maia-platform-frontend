import {
  MAIA_VERSIONS,
  SavedPlaySettings,
  loadPlaySettings,
  playSetupInitialState,
  savePlaySettings,
  validatePlaySettings,
} from './playSettings'

const saved: SavedPlaySettings = {
  maiaVersion: 'maia_kdd_1500',
  timeControl: '5+2',
  timeMinutes: 5,
  incrementSeconds: 2,
  simulateMaiaTime: false,
  practice: true,
  maiaPartnerVersion: 'maia_kdd_1900',
  isBrain: true,
}

beforeEach(() => window.localStorage.clear())

describe('validatePlaySettings', () => {
  it('keeps valid fields', () => {
    expect(validatePlaySettings(saved)).toEqual(saved)
    expect(validatePlaySettings({ timeControl: 'unlimited' })).toEqual({
      timeControl: 'unlimited',
    })
    expect(validatePlaySettings({ timeControl: '0+1' })).toEqual({
      timeControl: '0+1',
    })
  })

  it('drops invalid fields only', () => {
    expect(
      validatePlaySettings({
        ...saved,
        maiaVersion: 'maia_kdd_9999',
        timeControl: '0+0',
        timeMinutes: 11,
        incrementSeconds: '2',
        practice: 'yes',
        extra: 1,
      }),
    ).toEqual({
      simulateMaiaTime: false,
      maiaPartnerVersion: 'maia_kdd_1900',
      isBrain: true,
    })
    expect(validatePlaySettings({ timeControl: 'blitz' })).toEqual({})
  })

  it('ignores what is not an object', () => {
    expect(validatePlaySettings(null)).toEqual({})
    expect(validatePlaySettings('settings')).toEqual({})
    expect(validatePlaySettings(3)).toEqual({})
  })
})

describe('loadPlaySettings and savePlaySettings', () => {
  it('keep vs Maia and Hand & Brain apart', () => {
    savePlaySettings('againstMaia', { ...saved, maiaVersion: 'maia_kdd_600' })
    savePlaySettings('handAndBrain', { ...saved, maiaVersion: 'maia_kdd_2600' })
    expect(loadPlaySettings('againstMaia').maiaVersion).toBe('maia_kdd_600')
    expect(loadPlaySettings('handAndBrain').maiaVersion).toBe('maia_kdd_2600')
  })

  it('round-trips the settings', () => {
    savePlaySettings('againstMaia', saved)
    expect(loadPlaySettings('againstMaia')).toEqual(saved)
  })

  it('give nothing when nothing (or something broken) was saved', () => {
    expect(loadPlaySettings('againstMaia')).toEqual({})
    window.localStorage.setItem('maia-play-settings-againstMaia', '{oops')
    expect(loadPlaySettings('againstMaia')).toEqual({})
    window.localStorage.setItem(
      'maia-play-settings-againstMaia',
      JSON.stringify({ maiaVersion: 'gone', practice: true }),
    )
    expect(loadPlaySettings('againstMaia')).toEqual({ practice: true })
  })

  it('cope with storage being unavailable', () => {
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied')
      })
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('denied')
      })
    expect(() => savePlaySettings('againstMaia', saved)).not.toThrow()
    expect(loadPlaySettings('againstMaia')).toEqual({})
    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe('playSetupInitialState', () => {
  it('uses the defaults when nothing is given or saved', () => {
    expect(playSetupInitialState({ playType: 'againstMaia' }, {})).toEqual({
      maiaVersion: MAIA_VERSIONS[0],
      maiaPartnerVersion: MAIA_VERSIONS[0],
      timeControl: '3+0',
      timeMinutes: 3,
      incrementSeconds: 0,
      isBrain: false,
      simulateMaiaTime: true,
      practice: false,
      fen: undefined,
    })
  })

  it('starts from the saved settings', () => {
    expect(playSetupInitialState({ playType: 'handAndBrain' }, saved)).toEqual({
      maiaVersion: 'maia_kdd_1500',
      maiaPartnerVersion: 'maia_kdd_1900',
      timeControl: '5+2',
      timeMinutes: 5,
      incrementSeconds: 2,
      isBrain: true,
      simulateMaiaTime: false,
      practice: true,
      fen: undefined,
    })
  })

  it('lets props take precedence over the saved settings', () => {
    const state = playSetupInitialState(
      {
        playType: 'againstMaia',
        maiaVersion: 'maia_kdd_1100',
        timeControl: '10+0',
        simulateMaiaTime: true,
        practice: false,
        isBrain: false,
      },
      saved,
    )
    expect(state).toMatchObject({
      maiaVersion: 'maia_kdd_1100',
      timeControl: '10+0',
      timeMinutes: 10,
      incrementSeconds: 0,
      simulateMaiaTime: true,
      practice: false,
      isBrain: false,
    })
  })

  it("keeps the sliders' saved minutes and increment for Unlimited", () => {
    const state = playSetupInitialState(
      { playType: 'againstMaia' },
      { timeControl: 'unlimited', timeMinutes: 45, incrementSeconds: 15 },
    )
    expect(state).toMatchObject({
      timeControl: 'unlimited',
      timeMinutes: 45,
      incrementSeconds: 15,
    })
    expect(
      playSetupInitialState(
        { playType: 'againstMaia' },
        {
          timeControl: 'unlimited',
        },
      ),
    ).toMatchObject({ timeMinutes: 180, incrementSeconds: 0 })
  })

  it('treats a time control from the URL that is not one as Unlimited', () => {
    expect(
      playSetupInitialState(
        { playType: 'againstMaia', timeControl: 'nonsense' as '3+0' },
        {},
      ).timeControl,
    ).toBe('unlimited')
  })

  it('starts from a given position', () => {
    const fen = '8/8/8/4k3/8/8/8/4K2R w K - 0 1'
    expect(
      playSetupInitialState({ playType: 'againstMaia', startFen: fen }, {}).fen,
    ).toBe(fen)
  })

  it('treats an empty starting position from the URL as none', () => {
    expect(
      playSetupInitialState({ playType: 'againstMaia', startFen: '' }, {}).fen,
    ).toBeUndefined()
  })
})
