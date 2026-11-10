import { looksAutomated } from './looksAutomated'

const setAgent = (agent: string, webdriver = false) => {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => agent,
  })
  Object.defineProperty(navigator, 'webdriver', {
    configurable: true,
    get: () => webdriver,
  })
}

const chrome =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'

describe('looksAutomated', () => {
  it('passes an ordinary browser', () => {
    setAgent(chrome)
    expect(looksAutomated()).toBe(false)
  })

  it('catches a browser driven by a program', () => {
    setAgent(chrome, true)
    expect(looksAutomated()).toBe(true)
  })

  it('catches crawlers and headless browsers by name', () => {
    setAgent(chrome.replace('Chrome/', 'HeadlessChrome/'))
    expect(looksAutomated()).toBe(true)
    setAgent('Mozilla/5.0 (compatible; bingbot/2.0)')
    expect(looksAutomated()).toBe(true)
  })

  it('catches a name padded with spaces', () => {
    setAgent(` ${chrome} `)
    expect(looksAutomated()).toBe(true)
  })
})
