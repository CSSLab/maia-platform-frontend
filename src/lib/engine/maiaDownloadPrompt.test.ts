jest.mock('src/lib/analytics', () => ({
  trackDownloadModelCompleted: jest.fn(),
  trackDownloadModelFailed: jest.fn(),
  trackDownloadModelInitiated: jest.fn(),
}))

type Prompt = typeof import('./maiaDownloadPrompt')

const load = () => {
  let loaded = {} as Prompt
  jest.isolateModules(() => {
    loaded = jest.requireActual<Prompt>('./maiaDownloadPrompt')
  })
  return loaded
}

const setPhone = (phone: boolean) => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: phone })
  Object.defineProperty(window.screen, 'width', {
    value: phone ? 390 : 1600,
    configurable: true,
  })
  Object.defineProperty(window.screen, 'height', {
    value: phone ? 844 : 1000,
    configurable: true,
  })
}

const setConnection = (connection?: {
  saveData?: boolean
  effectiveType?: string
}) => {
  Object.defineProperty(navigator, 'connection', {
    value: connection,
    configurable: true,
  })
}

const setPersist = (persist?: () => Promise<boolean>) => {
  Object.defineProperty(navigator, 'storage', {
    value: persist ? { persist } : undefined,
    configurable: true,
  })
}

describe('maiaDownloadPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    setPhone(false)
    setConnection(undefined)
    setPersist(undefined)
  })

  describe('maiaPromptVariant', () => {
    it('keeps a visitor in one group across visits', () => {
      const first = load().maiaPromptVariant()
      expect(load().maiaPromptVariant()).toBe(first)
      expect(window.localStorage.getItem('maia.downloadPromptVariant')).toBe(
        first,
      )
    })

    it('splits new visitors in two', () => {
      const random = jest.spyOn(Math, 'random')
      random.mockReturnValue(0.25)
      expect(load().maiaPromptVariant()).toBe('wall')
      window.localStorage.clear()
      random.mockReturnValue(0.75)
      expect(load().maiaPromptVariant()).toBe('no_wall')
      random.mockRestore()
    })
  })

  describe('downloadsWithoutAsking', () => {
    it('is true on a desktop', () => {
      expect(load().downloadsWithoutAsking()).toBe(true)
    })

    it('is false in a browser run by a program', () => {
      const agent = navigator.userAgent
      const setAgent = (value: string) =>
        Object.defineProperty(navigator, 'userAgent', {
          value,
          configurable: true,
        })
      const setWebdriver = (value: boolean) =>
        Object.defineProperty(navigator, 'webdriver', {
          value,
          configurable: true,
        })
      const chrome =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
      try {
        setAgent(chrome)
        expect(load().downloadsWithoutAsking()).toBe(true)
        setWebdriver(true)
        expect(load().downloadsWithoutAsking()).toBe(false)
        setWebdriver(false)
        setAgent(chrome.replace('Chrome/', 'HeadlessChrome/'))
        expect(load().downloadsWithoutAsking()).toBe(false)
        setAgent(`  ${chrome}  `)
        expect(load().downloadsWithoutAsking()).toBe(false)
        setAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')
        expect(load().downloadsWithoutAsking()).toBe(false)
      } finally {
        setAgent(agent)
        setWebdriver(false)
      }
    })

    it('is false on a phone', () => {
      setPhone(true)
      expect(load().downloadsWithoutAsking()).toBe(false)
    })

    it('is false when saving data or on a very slow connection', () => {
      setConnection({ saveData: true })
      expect(load().downloadsWithoutAsking()).toBe(false)
      setConnection({ effectiveType: '2g' })
      expect(load().downloadsWithoutAsking()).toBe(false)
      setConnection({ effectiveType: '4g' })
      expect(load().downloadsWithoutAsking()).toBe(true)
    })
  })

  describe('downloadTimeLeft', () => {
    it('waits until the pace means something', () => {
      const { downloadTimeLeft } = load()
      expect(downloadTimeLeft(1, 5)).toBeNull()
      expect(downloadTimeLeft(50, 1)).toBeNull()
      expect(downloadTimeLeft(100, 10)).toBeNull()
    })

    it('rounds to something easy to read', () => {
      const { downloadTimeLeft } = load()
      expect(downloadTimeLeft(90, 9)).toBe('a few seconds left')
      expect(downloadTimeLeft(50, 11)).toBe('about 15 s left')
      expect(downloadTimeLeft(10, 30)).toBe('about 5 min left')
    })
  })

  describe('startMaiaDownload', () => {
    it('counts a failed download as failed', async () => {
      const analytics = jest.requireMock('src/lib/analytics')
      const { startMaiaDownload } = load()
      await startMaiaDownload(async () => false, 'tap')
      expect(analytics.trackDownloadModelFailed).toHaveBeenCalledTimes(1)
      expect(analytics.trackDownloadModelCompleted).not.toHaveBeenCalled()
      await startMaiaDownload(async () => true, 'tap')
      expect(analytics.trackDownloadModelCompleted).toHaveBeenCalledTimes(1)
    })
  })

  describe('keeping the model', () => {
    it('asks the browser once', async () => {
      const persist = jest.fn().mockResolvedValue(true)
      setPersist(persist)
      const { protectMaiaModel } = load()
      expect(await protectMaiaModel()).toBe(true)
      expect(await protectMaiaModel()).toBeNull()
      expect(persist).toHaveBeenCalledTimes(1)
    })

    it('reports a model the browser has lost, once', async () => {
      const { protectMaiaModel, takeLostMaiaModelAge } = load()
      expect(takeLostMaiaModelAge()).toBeNull()
      await protectMaiaModel()
      window.localStorage.setItem(
        'maia.modelSavedAt',
        String(Date.now() - 3 * 86_400_000),
      )
      expect(takeLostMaiaModelAge()).toBe(3)
      expect(takeLostMaiaModelAge()).toBeNull()
    })

    it('does not count a model the visitor deleted as lost', async () => {
      const { protectMaiaModel, takeLostMaiaModelAge, forgetMaiaModelSaved } =
        load()
      await protectMaiaModel()
      forgetMaiaModelSaved()
      expect(takeLostMaiaModelAge()).toBeNull()
    })
  })
})
