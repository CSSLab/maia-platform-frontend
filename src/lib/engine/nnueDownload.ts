/**
 * Downloads Stockfish's NNUE nets (75 MB and 3.5 MB for sf17-79).
 *
 * A single 75 MB request from one host failed often enough to be the main
 * complaint about the analysis page ("Failed to load Stockfish engine: Failed
 * to fetch"): nothing retried a dropped connection, a stalled download hung
 * forever, and raw.githubusercontent.com rate-limits anonymous traffic. So a
 * net is now fetched from a list of free hosts in turn: the npm package
 * maia-stockfish-nets through jsDelivr and unpkg, then
 * raw.githubusercontent.com. On each host a dropped or stalled download is
 * retried, resuming where it stopped (HTTP Range) when the host sent the file
 * uncompressed, and a finished net must match the SHA-256 prefix in its name
 * before it is used or cached.
 */

export type NnueSource = {
  name: string
  url: (file: string) => string
}

export type NnueDownloadOptions = {
  signal?: AbortSignal
  /** Time allowed until response headers arrive. */
  headerTimeoutMs?: number
  /** A download that receives nothing for this long is aborted and resumed. */
  stallTimeoutMs?: number
  /** Tries per URL in a row that bring no new bytes before the next host. */
  attemptsPerUrl?: number
  retryDelayMs?: (failures: number) => number
  onProgress?: (loaded: number, total: number | null) => void
  fetchImpl?: typeof fetch
}

/** Sizes of the nets sf17-79 asks for. */
export const KNOWN_NETS: Record<string, number> = {
  'nn-1111cefa1111.nnue': 74874478,
  'nn-37f18f62d772.nnue': 3519630,
}

// jsDelivr serves files of up to 20 MB from GitHub but much larger ones from
// npm, so the nets are published unchanged as an npm package.
const NPM_PACKAGE = 'maia-stockfish-nets@17.0.0'
// The commit that last had the nets in public/stockfish.
export const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/e23a50e/public/stockfish'

const atBase = (name: string, base: string): NnueSource => ({
  name,
  url: (file) => `${base}/${file}`,
})

/**
 * `NEXT_PUBLIC_STOCKFISH_NNUE_SOURCES` replaces the hosts with a comma-separated
 * list of base URLs; `NEXT_PUBLIC_STOCKFISH_NNUE_BASE_URL` alone means a single
 * self-hosted copy.
 */
export const getNnueSources = (
  sourcesEnv = process.env.NEXT_PUBLIC_STOCKFISH_NNUE_SOURCES,
  baseUrlEnv = process.env.NEXT_PUBLIC_STOCKFISH_NNUE_BASE_URL,
): NnueSource[] => {
  if (sourcesEnv) {
    return sourcesEnv
      .split(',')
      .map((base) => base.trim())
      .filter(Boolean)
      .map((base) => atBase(base, base))
  }
  if (baseUrlEnv) return [atBase(baseUrlEnv, baseUrlEnv)]
  return [
    atBase('jsdelivr', `https://cdn.jsdelivr.net/npm/${NPM_PACKAGE}`),
    atBase('unpkg', `https://unpkg.com/${NPM_PACKAGE}`),
    atBase('github', GITHUB_RAW_BASE),
  ]
}

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} from ${url}`)
  }
}

export class CorruptNetError extends Error {}

export class NnueDownloadError extends Error {
  constructor(
    readonly file: string,
    readonly failures: { source: string; error: string }[],
  ) {
    super(
      `Could not download ${file}: ${failures
        .map((f) => `${f.source}: ${f.error}`)
        .join('; ')}`,
    )
  }
}

class StallError extends Error {}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

// 404, 403 and the like will not change on a retry; move on to the next host.
const isRetryable = (error: unknown) =>
  !(error instanceof HttpStatusError) ||
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

// 0.5, 1 and 2 s: a host that is down costs 3.5 s before the next one.
const defaultRetryDelayMs = (failures: number) =>
  Math.min(500 * 2 ** (failures - 1), 4000)

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(id)
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    })
  })

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError')
  }
}

const concat = (chunks: Uint8Array[], length: number): Uint8Array => {
  if (chunks.length === 1 && chunks[0].byteLength === length) return chunks[0]
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/**
 * Fetches one URL, resuming with a Range request after a dropped or stalled
 * connection. Gives up after `attemptsPerUrl` tries in a row that brought no
 * new bytes, or at once on a status that a retry will not fix.
 *
 * Chrome, Firefox and Safari send a simple Range header without a CORS
 * preflight; a browser that did preflight it would fail on
 * raw.githubusercontent.com (403) and jsDelivr (no
 * Access-Control-Allow-Headers). So after two resumes that got no response at
 * all, the next try starts the URL again without a Range header.
 *
 * Ranges only make sense against the file's own bytes. jsDelivr sends a net
 * brotli-compressed, with the compressed size as Content-Length, and answers
 * a Range request with a slice of the compressed bytes. So a body that
 * arrived encoded is not checked against Content-Length, and is fetched
 * again from the start rather than resumed.
 *
 * With `into`, the body is written straight into that buffer, so a 75 MB net
 * is held once rather than as chunks plus a joined copy, and a body that
 * ends before filling it was cut short. That check is the one that works for
 * an encoded body: Firefox ends a cut-off brotli response without an error.
 */
export const fetchResumable = async (
  url: string,
  options: NnueDownloadOptions & {
    onBytes?: (received: number) => void
    into?: Uint8Array
  },
): Promise<Uint8Array> => {
  const {
    signal,
    headerTimeoutMs = 30000,
    stallTimeoutMs = 20000,
    attemptsPerUrl = 4,
    retryDelayMs = defaultRetryDelayMs,
    fetchImpl = fetch,
    onBytes,
    into,
  } = options
  let chunks: Uint8Array[] = []
  let received = 0
  let total: number | null = null
  let resumable = true
  const write = (chunk: Uint8Array) => {
    if (into) {
      if (received + chunk.byteLength > into.byteLength) {
        throw new CorruptNetError(`${url} sent more than expected`)
      }
      into.set(chunk, received)
    } else {
      chunks.push(chunk)
    }
    received += chunk.byteLength
    if (total !== null && received > total) {
      // Decoded from an encoding the host's CORS headers did not show.
      total = null
      resumable = false
    }
    onBytes?.(received)
  }
  let failures = 0
  let rangeWithoutResponse = 0

  for (;;) {
    throwIfAborted(signal)
    if (!resumable || rangeWithoutResponse >= 2) {
      chunks = []
      received = 0
      rangeWithoutResponse = 0
    }
    const controller = new AbortController()
    const onAbort = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', onAbort)
    let timer: ReturnType<typeof setTimeout> | null = null
    let stalled = false
    let responded = false
    const arm = (ms: number) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        stalled = true
        controller.abort()
      }, ms)
    }
    const before = received

    try {
      arm(headerTimeoutMs)
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: received > 0 ? { Range: `bytes=${received}-` } : undefined,
      })
      responded = true
      if (received > 0 && response.status === 200) {
        // The host ignored the Range header: start this URL again.
        chunks = []
        received = 0
      } else if (!response.ok) {
        throw new HttpStatusError(response.status, url)
      }
      if (response.status === 200) {
        const encoding = response.headers.get('content-encoding')
        const length = Number(response.headers.get('content-length'))
        resumable = !encoding || encoding === 'identity'
        total = resumable && length > 0 ? length : null
      }
      // jsDelivr slices its compressed copy even when the file came
      // uncompressed (a proxy may strip Accept-Encoding); its Content-Range
      // then shows a start or size that does not fit.
      const size = into?.byteLength ?? total
      const range = /^bytes (\d+)-\d+\/(\d+)$/.exec(
        response.headers.get('content-range') ?? '',
      )
      if (
        response.status === 206 &&
        range &&
        (Number(range[1]) !== received ||
          (size !== null && Number(range[2]) !== size))
      ) {
        resumable = false
        void response.body?.cancel().catch(() => undefined)
        throw new Error(`${url} answered Range from a different copy`)
      }

      if (!response.body) {
        write(new Uint8Array(await response.arrayBuffer()))
      } else {
        const reader = response.body.getReader()
        arm(stallTimeoutMs)
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          write(value)
          arm(stallTimeoutMs)
        }
      }
      const expected = into ? into.byteLength : total
      if (expected !== null && received < expected) {
        throw new Error(`connection closed at ${received} of ${expected} bytes`)
      }
      return into ?? concat(chunks, received)
    } catch (error) {
      throwIfAborted(signal)
      const reason = stalled
        ? new StallError(`${url} stopped sending data`)
        : error
      if (!isRetryable(reason) || reason instanceof CorruptNetError) {
        throw reason
      }
      // Bytes that will be fetched again are not progress.
      failures = resumable && received > before ? 1 : failures + 1
      if (failures >= attemptsPerUrl) throw reason
      rangeWithoutResponse =
        before > 0 && !responded ? rangeWithoutResponse + 1 : 0
      console.warn(
        `Stockfish net download interrupted (${errorText(reason)}); ` +
          (resumable ? `resuming at ${received} bytes` : 'starting again'),
      )
      await sleep(retryDelayMs(failures), signal)
    } finally {
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
}

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12)

/** Stockfish names a net `nn-` + the first 12 hex digits of its SHA-256. */
export const verifyNet = async (file: string, net: Uint8Array) => {
  const size = KNOWN_NETS[file]
  if (size && net.byteLength !== size) {
    throw new CorruptNetError(
      `${file} is ${net.byteLength} bytes, expected ${size}`,
    )
  }
  const hash = /^nn-([0-9a-f]{12})\.nnue$/.exec(file)?.[1]
  const subtle = globalThis.crypto?.subtle
  if (!hash || !subtle) return
  const digest = await subtle.digest('SHA-256', net)
  if (toHex(digest) !== hash) {
    throw new CorruptNetError(`${file} does not match its SHA-256`)
  }
}

/** Downloads `file` from the first source that delivers an intact copy. */
export const downloadNnue = async (
  file: string,
  sources: NnueSource[],
  options: NnueDownloadOptions = {},
): Promise<ArrayBuffer> => {
  const failures: { source: string; error: string }[] = []
  const total = KNOWN_NETS[file] ?? null

  for (const source of sources) {
    throwIfAborted(options.signal)
    try {
      const net = await fetchResumable(source.url(file), {
        ...options,
        // A net of known size is written into one buffer as it arrives.
        into: total === null ? undefined : new Uint8Array(total),
        onBytes: (received) => options.onProgress?.(received, total),
      })
      await verifyNet(file, net)
      return net.byteOffset === 0 && net.byteLength === net.buffer.byteLength
        ? (net.buffer as ArrayBuffer)
        : (net.slice().buffer as ArrayBuffer)
    } catch (error) {
      throwIfAborted(options.signal)
      failures.push({ source: source.name, error: errorText(error) })
      console.warn(
        `Stockfish net ${file} failed from ${source.name}: ${errorText(error)}`,
      )
      options.onProgress?.(0, total)
    }
  }
  throw new NnueDownloadError(file, failures)
}
