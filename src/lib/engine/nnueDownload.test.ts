import { createHash, randomBytes, webcrypto } from 'node:crypto'
import { ReadableStream } from 'node:stream/web'
import {
  CorruptNetError,
  downloadNnue,
  fetchResumable,
  getNnueSources,
  KNOWN_NETS,
  NnueDownloadError,
  NnueSource,
} from './nnueDownload'

// A fake net whose name carries its SHA-256 prefix, as Stockfish's do.
const NET = new Uint8Array(randomBytes(100_000))
const same = (a: ArrayBuffer, b: Uint8Array) => {
  const bytes = new Uint8Array(a)
  return bytes.byteLength === b.byteLength && bytes.every((v, i) => v === b[i])
}

// jsdom has no SubtleCrypto; the hash check needs one.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    })
  }
})
const FILE = `nn-${createHash('sha256').update(NET).digest('hex').slice(0, 12)}.nnue`

type Fault =
  | 'ok'
  | 'refuse'
  | 'ignore-range'
  | { status: number }
  | { drop: number }
  | { stall: number }
  // The body ends early without an error, as Firefox ends a cut-off brotli body.
  | { cut: number }

// The parts of a Response that the downloader reads.
const response = (
  status: number,
  body: ReadableStream<Uint8Array> | null,
  length: number,
  encoding: string | null = null,
  contentRange: string | null = null,
) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    get: (name: string) =>
      name === 'content-length'
        ? String(length)
        : name === 'content-encoding'
          ? encoding
          : name === 'content-range'
            ? contentRange
            : null,
  },
  body,
  arrayBuffer: async () => new ArrayBuffer(length),
})

// How jsDelivr sends a net: brotli-compressed, with the compressed size as
// Content-Length, and a Range request answered with a slice of the
// compressed bytes. The fake's "compressed" size is 80% of the net's.
// 'br-sent-plain': the client was sent the file uncompressed (a proxy
// stripped Accept-Encoding), but ranges still slice the compressed copy.
type Encoding = 'br' | 'hidden-br' | 'br-sent-plain'

/**
 * A fetch that serves `bodies` in 1000-byte chunks, honouring Range, with one
 * fault taken from `faults[url]` per request.
 */
const fakeFetch = (
  bodies: Record<string, Uint8Array>,
  faults: Record<string, Fault[]> = {},
  encodings: Record<string, Encoding> = {},
) => {
  const calls: { url: string; range: string | null }[] = []
  const fetchImpl = async (url: string, init?: RequestInit) => {
    const range =
      (init?.headers as Record<string, string> | undefined)?.Range ?? null
    calls.push({ url, range })
    const fault = faults[url]?.shift() ?? 'ok'
    if (fault === 'refuse') throw new TypeError('Failed to fetch')
    if (typeof fault === 'object' && 'status' in fault) {
      return response(fault.status, null, 2)
    }
    const ranged = range !== null && fault !== 'ignore-range'
    const start = ranged ? Number(/bytes=(\d+)-/.exec(range ?? '')?.[1]) : 0
    const encoding = encodings[url]
    const compressed = Math.floor(bodies[url].byteLength * 0.8)
    const body =
      encoding && ranged
        ? new Uint8Array(randomBytes(compressed - start))
        : bodies[url].subarray(start)
    const drop = typeof fault === 'object' && 'drop' in fault
    const cut = typeof fault === 'object' && 'cut' in fault
    const limit =
      typeof fault === 'object' && 'drop' in fault
        ? fault.drop
        : typeof fault === 'object' && 'stall' in fault
          ? fault.stall
          : typeof fault === 'object' && 'cut' in fault
            ? fault.cut
            : Infinity
    let sent = 0
    let failStream: (error: unknown) => void = () => undefined
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        failStream = (error) => controller.error(error)
        init?.signal?.addEventListener('abort', () =>
          failStream(new DOMException('aborted', 'AbortError')),
        )
      },
      // One chunk per read, so a drop or stall comes after the bytes before it.
      pull(controller) {
        if (sent >= body.byteLength) return controller.close()
        if (sent >= limit) {
          if (drop) return controller.error(new TypeError('network error'))
          if (cut) return controller.close()
          return new Promise(() => undefined) // a stall
        }
        const end = Math.min(sent + 1000, limit, body.byteLength)
        controller.enqueue(body.slice(sent, end))
        sent = end
      },
    })
    if (encoding && encoding !== 'br-sent-plain' && !ranged) {
      const shown = encoding === 'br' ? 'br' : null
      return response(200, stream, compressed, shown)
    }
    if (ranged) {
      const size = encoding ? compressed : bodies[url].byteLength
      const contentRange = `bytes ${start}-${size - 1}/${size}`
      return response(206, stream, body.byteLength, null, contentRange)
    }
    return response(200, stream, body.byteLength)
  }
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls }
}

const source = (name: string): NnueSource => ({
  name,
  url: (file) => `https://${name}/${file}`,
})

const fast = { retryDelayMs: () => 1, stallTimeoutMs: 50 }

describe('downloadNnue', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  const A = `https://a/${FILE}`
  const B = `https://b/${FILE}`

  it('downloads a net and checks its hash', async () => {
    const { fetchImpl, calls } = fakeFetch({ [A]: NET })
    const net = await downloadNnue(FILE, [source('a')], { fetchImpl })
    expect(same(net, NET)).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('resumes a dropped download where it stopped', async () => {
    const { fetchImpl, calls } = fakeFetch(
      { [A]: NET },
      { [A]: [{ drop: 30000 }] },
    )
    const net = await downloadNnue(FILE, [source('a')], { ...fast, fetchImpl })
    expect(same(net, NET)).toBe(true)
    expect(calls.map((c) => c.range)).toEqual([null, 'bytes=30000-'])
  })

  it('resumes a download that stalls', async () => {
    const { fetchImpl, calls } = fakeFetch(
      { [A]: NET },
      { [A]: [{ stall: 20000 }] },
    )
    const net = await downloadNnue(FILE, [source('a')], { ...fast, fetchImpl })
    expect(same(net, NET)).toBe(true)
    expect(calls.map((c) => c.range)).toEqual([null, 'bytes=20000-'])
  })

  it('starts again when a host ignores Range', async () => {
    const { fetchImpl } = fakeFetch(
      { [A]: NET },
      { [A]: [{ drop: 30000 }, 'ignore-range'] },
    )
    const net = await downloadNnue(FILE, [source('a')], { ...fast, fetchImpl })
    expect(same(net, NET)).toBe(true)
  })

  it('starts again without Range when resumed requests get no response', async () => {
    const { fetchImpl, calls } = fakeFetch(
      { [A]: NET },
      { [A]: [{ drop: 30000 }, 'refuse', 'refuse'] },
    )
    const net = await downloadNnue(FILE, [source('a')], { ...fast, fetchImpl })
    expect(same(net, NET)).toBe(true)
    expect(calls.map((c) => c.range)).toEqual([
      null,
      'bytes=30000-',
      'bytes=30000-',
      null,
    ])
  })

  it('retries a rate-limited host, then uses the next one', async () => {
    const { fetchImpl, calls } = fakeFetch(
      { [A]: NET, [B]: NET },
      { [A]: Array(4).fill({ status: 429 }) },
    )
    const net = await downloadNnue(FILE, [source('a'), source('b')], {
      ...fast,
      fetchImpl,
    })
    expect(same(net, NET)).toBe(true)
    expect(calls.filter((c) => c.url === A)).toHaveLength(4)
    expect(calls.filter((c) => c.url === B)).toHaveLength(1)
  })

  it('moves to the next host at once after a 404', async () => {
    const { fetchImpl, calls } = fakeFetch(
      { [A]: NET, [B]: NET },
      { [A]: [{ status: 404 }] },
    )
    await downloadNnue(FILE, [source('a'), source('b')], { ...fast, fetchImpl })
    expect(calls.map((c) => c.url)).toEqual([A, B])
  })

  it('rejects a corrupt copy and uses the next host', async () => {
    const corrupt = NET.slice()
    corrupt[500] ^= 1
    const { fetchImpl } = fakeFetch({ [A]: corrupt, [B]: NET })
    const net = await downloadNnue(FILE, [source('a'), source('b')], {
      ...fast,
      fetchImpl,
    })
    expect(same(net, NET)).toBe(true)
  })

  it('reports progress', async () => {
    const { fetchImpl } = fakeFetch({ [A]: NET })
    const progress: number[] = []
    await downloadNnue(FILE, [source('a')], {
      fetchImpl,
      onProgress: (loaded) => progress.push(loaded),
    })
    expect(progress.length).toBeGreaterThan(10)
    expect(progress[progress.length - 1]).toBe(NET.byteLength)
  })

  it('reports every host when all of them fail', async () => {
    const { fetchImpl } = fakeFetch(
      {},
      { [A]: Array(4).fill('refuse'), [B]: [{ status: 403 }] },
    )
    const download = downloadNnue(FILE, [source('a'), source('b')], {
      ...fast,
      fetchImpl,
    })
    await expect(download).rejects.toBeInstanceOf(NnueDownloadError)
    await expect(download).rejects.toThrow(/a: Failed to fetch; b: HTTP 403/)
  })

  it('accepts a compressed net whose Content-Length is the compressed size', async () => {
    const { fetchImpl, calls } = fakeFetch({ [A]: NET }, {}, { [A]: 'br' })
    const net = await downloadNnue(FILE, [source('a')], { fetchImpl })
    expect(same(net, NET)).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('accepts a compressed net when CORS hides Content-Encoding', async () => {
    const { fetchImpl } = fakeFetch({ [A]: NET }, {}, { [A]: 'hidden-br' })
    const net = await downloadNnue(FILE, [source('a')], { fetchImpl })
    expect(same(net, NET)).toBe(true)
  })

  it('starts a dropped compressed download again rather than resuming it', async () => {
    for (const encoding of ['br', 'hidden-br'] as const) {
      const { fetchImpl, calls } = fakeFetch(
        { [A]: NET },
        { [A]: [{ drop: encoding === 'br' ? 30000 : 90000 }] },
        { [A]: encoding },
      )
      const net = await downloadNnue(FILE, [source('a')], {
        ...fast,
        fetchImpl,
      })
      expect(same(net, NET)).toBe(true)
      expect(calls.map((c) => c.range)).toEqual([null, null])
    }
  })

  it('starts again when a resumed range comes from a compressed copy', async () => {
    const { fetchImpl, calls } = fakeFetch(
      { [A]: NET },
      { [A]: [{ drop: 30000 }] },
      { [A]: 'br-sent-plain' },
    )
    const net = await downloadNnue(FILE, [source('a')], { ...fast, fetchImpl })
    expect(same(net, NET)).toBe(true)
    expect(calls.map((c) => c.range)).toEqual([null, 'bytes=30000-', null])
  })

  it('fetches a known net again when its compressed body ends early', async () => {
    KNOWN_NETS[FILE] = NET.byteLength
    try {
      const { fetchImpl, calls } = fakeFetch(
        { [A]: NET, [B]: NET },
        { [A]: [{ cut: 30000 }] },
        { [A]: 'br' },
      )
      const net = await downloadNnue(FILE, [source('a'), source('b')], {
        ...fast,
        fetchImpl,
      })
      expect(same(net, NET)).toBe(true)
      expect(calls.map((c) => [c.url, c.range])).toEqual([
        [A, null],
        [A, null],
      ])
    } finally {
      delete KNOWN_NETS[FILE]
    }
  })

  it('gives up on a compressed download that keeps dropping', async () => {
    const { fetchImpl, calls } = fakeFetch(
      { [A]: NET, [B]: NET },
      { [A]: Array(10).fill({ drop: 30000 }) },
      { [A]: 'br' },
    )
    const net = await downloadNnue(FILE, [source('a'), source('b')], {
      ...fast,
      fetchImpl,
    })
    expect(same(net, NET)).toBe(true)
    expect(calls.filter((c) => c.url === A)).toHaveLength(4)
  })

  it('stops when aborted', async () => {
    const { fetchImpl } = fakeFetch({ [A]: NET }, { [A]: [{ stall: 20000 }] })
    const controller = new AbortController()
    const download = downloadNnue(FILE, [source('a')], {
      fetchImpl,
      signal: controller.signal,
    })
    controller.abort()
    await expect(download).rejects.toThrow()
  })
})

describe('fetchResumable into a buffer', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  const A = 'https://a/net'

  it('writes a resumed download straight into the buffer', async () => {
    const { fetchImpl, calls } = fakeFetch(
      { [A]: NET },
      { [A]: [{ drop: 30000 }] },
    )
    const into = new Uint8Array(NET.byteLength)
    const got = await fetchResumable(A, { ...fast, fetchImpl, into })
    expect(got.buffer).toBe(into.buffer)
    expect(same(into.buffer, NET)).toBe(true)
    expect(calls.map((c) => c.range)).toEqual([null, 'bytes=30000-'])
  })

  it('resumes a body that ends before filling the buffer', async () => {
    const { fetchImpl, calls } = fakeFetch(
      { [A]: NET },
      { [A]: [{ cut: 30000 }] },
    )
    const into = new Uint8Array(NET.byteLength)
    await fetchResumable(A, { ...fast, fetchImpl, into })
    expect(same(into.buffer, NET)).toBe(true)
    expect(calls.map((c) => c.range)).toEqual([null, 'bytes=30000-'])
  })

  it('rejects a host that sends more than the buffer holds', async () => {
    const { fetchImpl } = fakeFetch({ [A]: NET })
    const into = new Uint8Array(NET.byteLength - 1)
    await expect(
      fetchResumable(A, { ...fast, fetchImpl, into }),
    ).rejects.toBeInstanceOf(CorruptNetError)
  })
})

describe('getNnueSources', () => {
  it('tries jsDelivr and unpkg for the npm package, then GitHub', () => {
    const urls = getNnueSources('', '').map((s) =>
      s.url('nn-1111cefa1111.nnue'),
    )
    expect(urls).toEqual([
      'https://cdn.jsdelivr.net/npm/maia-stockfish-nets@17.0.0/nn-1111cefa1111.nnue',
      'https://unpkg.com/maia-stockfish-nets@17.0.0/nn-1111cefa1111.nnue',
      expect.stringMatching(
        /^https:\/\/raw\.githubusercontent\.com\/.*\/nn-1111cefa1111\.nnue$/,
      ),
    ])
  })

  it('reads a list of hosts from the environment', () => {
    const sources = getNnueSources('http://x/a, http://x/b', '')
    expect(sources.map((s) => s.url('nn-1111cefa1111.nnue'))).toEqual([
      'http://x/a/nn-1111cefa1111.nnue',
      'http://x/b/nn-1111cefa1111.nnue',
    ])
  })
})
