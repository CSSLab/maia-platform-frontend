import {
  countPieces,
  createTablebaseClient,
  formatTablebaseMove,
  formatTablebaseSummary,
  isTablebasePosition,
  parseTablebaseResponse,
  TablebaseResult,
  TABLEBASE_URL,
} from './tablebase'

const KP_FEN = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'

// Trimmed from a real response for KP_FEN (moves keep Lichess's order).
const KP_RESPONSE = {
  checkmate: false,
  stalemate: false,
  dtz: 9,
  precise_dtz: 9,
  dtm: 43,
  category: 'win',
  moves: [
    {
      uci: 'e1d2',
      san: 'Kd2',
      zeroing: false,
      checkmate: false,
      stalemate: false,
      dtz: -8,
      precise_dtz: -8,
      dtm: -42,
      category: 'loss',
    },
    {
      uci: 'e2e3',
      san: 'e3',
      zeroing: true,
      checkmate: false,
      stalemate: false,
      dtz: 0,
      precise_dtz: 0,
      dtm: 0,
      category: 'draw',
    },
  ],
}

const result = (overrides: Partial<TablebaseResult>): TablebaseResult => ({
  fen: KP_FEN,
  category: 'win',
  dtm: null,
  dtz: null,
  checkmate: false,
  stalemate: false,
  moves: [],
  ...overrides,
})

describe('countPieces / isTablebasePosition', () => {
  it('counts both sides, kings included', () => {
    expect(countPieces(KP_FEN)).toBe(3)
    expect(
      countPieces('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).toBe(32)
  })

  it('takes positions with 7 pieces or fewer', () => {
    expect(isTablebasePosition(KP_FEN)).toBe(true)
    expect(isTablebasePosition('4k3/ppp5/8/8/8/8/PP6/4K3 w - - 0 1')).toBe(true)
    expect(isTablebasePosition('4k3/pppp4/8/8/8/8/PP6/4K3 w - - 0 1')).toBe(
      false,
    )
  })
})

describe('parseTablebaseResponse', () => {
  it('reads the position and flips each move to the side playing it', () => {
    const parsed = parseTablebaseResponse(KP_FEN, KP_RESPONSE)
    expect(parsed).toMatchObject({
      fen: KP_FEN,
      category: 'win',
      dtm: 43,
      dtz: 9,
    })
    expect(parsed?.moves).toEqual([
      {
        uci: 'e1d2',
        san: 'Kd2',
        category: 'win',
        // 42 plies after the move, plus the move itself.
        dtm: 43,
        dtz: -8,
        checkmate: false,
        stalemate: false,
      },
      {
        uci: 'e2e3',
        san: 'e3',
        category: 'draw',
        dtm: null,
        dtz: 0,
        checkmate: false,
        stalemate: false,
      },
    ])
  })

  it('scores a losing move as mated, and a mating move as mate in one', () => {
    const parsed = parseTablebaseResponse(KP_FEN, {
      category: 'win',
      moves: [
        {
          uci: 'h7h8',
          san: 'h8=Q#',
          category: 'loss',
          dtm: 0,
          checkmate: true,
        },
        { uci: 'a1a2', san: 'Ra2', category: 'win', dtm: 29, dtz: 3 },
      ],
    })
    expect(parsed?.moves[0]).toMatchObject({ category: 'win', dtm: 1 })
    expect(parsed?.moves[1]).toMatchObject({ category: 'loss', dtm: -30 })
  })

  it('returns null for unknown positions and unexpected shapes', () => {
    expect(parseTablebaseResponse(KP_FEN, { category: 'unknown' })).toBeNull()
    expect(parseTablebaseResponse(KP_FEN, { category: 'huh' })).toBeNull()
    expect(parseTablebaseResponse(KP_FEN, null)).toBeNull()
    expect(parseTablebaseResponse(KP_FEN, 'error')).toBeNull()
  })

  it('skips malformed moves', () => {
    const parsed = parseTablebaseResponse(KP_FEN, {
      category: 'draw',
      moves: [
        { uci: 'e1d1' },
        null,
        { uci: 'e1f1', san: 'Kf1', category: 'draw' },
      ],
    })
    expect(parsed?.moves.map((move) => move.uci)).toEqual(['e1f1'])
  })
})

describe('formatTablebaseSummary', () => {
  it('gives mate distances in full moves when DTM is known', () => {
    expect(formatTablebaseSummary(result({ category: 'win', dtm: 43 }))).toBe(
      'Win · mate in 22',
    )
    expect(formatTablebaseSummary(result({ category: 'loss', dtm: -42 }))).toBe(
      'Loss · mated in 21',
    )
  })

  it('falls back to DTZ, and gives draws no distance', () => {
    expect(formatTablebaseSummary(result({ category: 'loss', dtz: -14 }))).toBe(
      'Loss · DTZ 14',
    )
    expect(
      formatTablebaseSummary(result({ category: 'draw', dtz: 0, dtm: 0 })),
    ).toBe('Draw')
    expect(formatTablebaseSummary(result({ category: 'win' }))).toBe('Win')
  })

  it('names the 50-move-rule categories and finished games', () => {
    expect(
      formatTablebaseSummary(result({ category: 'cursed-win', dtz: 101 })),
    ).toBe('Cursed win · DTZ 101')
    expect(formatTablebaseSummary(result({ category: 'maybe-loss' }))).toBe(
      'Loss or 50-move draw',
    )
    expect(
      formatTablebaseSummary(result({ category: 'loss', checkmate: true })),
    ).toBe('Checkmate')
    expect(
      formatTablebaseSummary(result({ category: 'draw', stalemate: true })),
    ).toBe('Stalemate · Draw')
  })
})

describe('formatTablebaseMove', () => {
  const move = {
    uci: 'e1d2',
    san: 'Kd2',
    dtm: null,
    dtz: null,
    checkmate: false,
    stalemate: false,
  }

  it('labels moves for the side playing them', () => {
    expect(formatTablebaseMove({ ...move, category: 'win', dtm: 43 })).toBe(
      'Win #22',
    )
    expect(formatTablebaseMove({ ...move, category: 'loss', dtm: -30 })).toBe(
      'Loss #15',
    )
    expect(formatTablebaseMove({ ...move, category: 'win', dtz: -8 })).toBe(
      'Win DTZ 8',
    )
    expect(formatTablebaseMove({ ...move, category: 'draw', dtz: 0 })).toBe(
      'Draw',
    )
    expect(formatTablebaseMove({ ...move, category: 'cursed-win' })).toBe(
      'Cursed',
    )
    expect(
      formatTablebaseMove({ ...move, category: 'win', checkmate: true }),
    ).toBe('Mate')
  })
})

describe('createTablebaseClient', () => {
  const okResponse = (body: unknown) =>
    ({ ok: true, status: 200, json: async () => body }) as Response

  /** A fetch whose responses the test resolves one at a time. */
  const controlledFetch = () => {
    const calls: { url: string; resolve: (response: Response) => void }[] = []
    const fetchFn = jest.fn(
      (url: string) =>
        new Promise<Response>((resolve) => calls.push({ url, resolve })),
    )
    return { fetchFn, calls }
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('requests the position and caches the result', async () => {
    const fetchFn = jest.fn(async () => okResponse(KP_RESPONSE))
    const client = createTablebaseClient({ fetchFn })

    expect(client.peek(KP_FEN)).toBeUndefined()
    const first = await client.lookup(KP_FEN)
    const second = await client.lookup(KP_FEN)

    expect(first?.category).toBe('win')
    expect(second).toBe(first)
    expect(client.peek(KP_FEN)).toBe(first)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn.mock.calls[0]).toEqual([
      `${TABLEBASE_URL}?fen=${encodeURIComponent(KP_FEN)}`,
      expect.objectContaining({ signal: expect.any(Object) }),
    ])
  })

  it('keeps at most one request in flight', async () => {
    const { fetchFn, calls } = controlledFetch()
    const client = createTablebaseClient({ fetchFn })

    const a = client.lookup('8/8/8/8/8/8/8/K6k w - - 0 1')
    const b = client.lookup('8/8/8/8/8/8/8/K5k1 w - - 0 1')
    await flush()
    expect(calls).toHaveLength(1)

    calls[0].resolve(okResponse({ category: 'draw', moves: [] }))
    await expect(a).resolves.toMatchObject({ category: 'draw' })
    await flush()
    expect(calls).toHaveLength(2)

    calls[1].resolve(okResponse({ category: 'draw', moves: [] }))
    await expect(b).resolves.toMatchObject({ category: 'draw' })
  })

  it('answers a waiting lookup for the same position from the cache', async () => {
    const { fetchFn, calls } = controlledFetch()
    const client = createTablebaseClient({ fetchFn })

    const a = client.lookup(KP_FEN)
    const b = client.lookup(KP_FEN)
    await flush()
    calls[0].resolve(okResponse(KP_RESPONSE))

    const [resultA, resultB] = await Promise.all([a, b])
    expect(resultB).toBe(resultA)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('never sends a lookup that was aborted while waiting', async () => {
    const { fetchFn, calls } = controlledFetch()
    const client = createTablebaseClient({ fetchFn })

    const a = client.lookup(KP_FEN)
    const controller = new AbortController()
    const stale = client.lookup(
      '8/8/8/8/8/8/8/K6k w - - 0 1',
      controller.signal,
    )
    controller.abort()
    await flush()
    calls[0].resolve(okResponse(KP_RESPONSE))

    await a
    await expect(stale).rejects.toThrow('aborted')
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it("doesn't cache failures, and frees the slot after one", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValueOnce(okResponse(KP_RESPONSE))
    const client = createTablebaseClient({ fetchFn })

    await expect(client.lookup(KP_FEN)).rejects.toThrow('429')
    expect(client.peek(KP_FEN)).toBeUndefined()
    await expect(client.lookup(KP_FEN)).resolves.toMatchObject({
      category: 'win',
    })
  })

  it('caches positions the tables have no usable answer for', async () => {
    const fetchFn = jest.fn(async () => okResponse({ category: 'unknown' }))
    const client = createTablebaseClient({ fetchFn })

    await expect(client.lookup(KP_FEN)).resolves.toBeNull()
    expect(client.peek(KP_FEN)).toBeNull()
    await client.lookup(KP_FEN)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('forgets the oldest positions past the cache size', async () => {
    const fetchFn = jest.fn(async () => okResponse({ category: 'draw' }))
    const client = createTablebaseClient({ fetchFn, cacheSize: 2 })
    const fens = [
      '8/8/8/8/8/8/8/K1k5 w - - 0 1',
      '8/8/8/8/8/8/8/K2k4 w - - 0 1',
      '8/8/8/8/8/8/8/K3k3 w - - 0 1',
    ]

    for (const fen of fens) await client.lookup(fen)
    expect(client.peek(fens[0])).toBeUndefined()
    expect(client.peek(fens[2])).not.toBeUndefined()
  })
})
