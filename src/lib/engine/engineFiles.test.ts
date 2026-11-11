type EngineFiles = typeof import('./engineFiles')

const baseFor = () => {
  let base = ''
  jest.isolateModules(() => {
    base = jest.requireActual<EngineFiles>('./engineFiles').ENGINE_FILES_BASE
  })
  return base
}

describe('ENGINE_FILES_BASE', () => {
  const saved = process.env.NEXT_PUBLIC_ENGINE_FILES_VERSION
  afterEach(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_ENGINE_FILES_VERSION
    else process.env.NEXT_PUBLIC_ENGINE_FILES_VERSION = saved
  })

  it('names the version of the files', () => {
    process.env.NEXT_PUBLIC_ENGINE_FILES_VERSION = 'abc123'
    expect(baseFor()).toBe('/v/abc123')
  })

  it('is public/ itself without one', () => {
    delete process.env.NEXT_PUBLIC_ENGINE_FILES_VERSION
    expect(baseFor()).toBe('')
  })
})

export {}
