import fs from 'node:fs'
import { TYPICAL_DANGER_BY_LEVEL } from 'src/constants/typicalDanger'
import {
  buildHumanBarSetup,
  evalAfterMoveFromLine,
  evaluationOrder,
  fenAfterMove,
  float32ToBase64LE,
  likelyMoves,
  parsePgnHeaders,
  engineChance,
  parsePgnMainline,
  usualBlunderRiskIn5,
} from './humanBar'
import {
  encodeSideToMoveScore,
  HUMAN_BAR_ENGINE,
} from './engine/stockfishBatch'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const PGN = `[Event "rated blitz game"]
[Site "https://lichess.org/game/W2114ZgI"]
[White "maximayoz"]
[Black "alex_ast"]
[Result "0-1"]
[UTCDate "2025.12.02"]
[UTCTime "10:55:10"]
[WhiteElo "1857"]
[BlackElo "1874"]
[Variant "Standard"]
[TimeControl "180+2"]

1. b3 { [%clk 0:03:00] } 1... e5 { [%clk 0:03:00] } 2. Bb2 { [%eval 0.1] [%clk 0:03:02] } (2. e4 { [%clk 0:09:09] } e6) 2... d5 $2 { [%clk 0:00:05.3] } 0-1
`

describe('human bar PGN parsing', () => {
  it('reads headers', () => {
    const headers = parsePgnHeaders(PGN)
    expect(headers.White).toBe('maximayoz')
    expect(headers.TimeControl).toBe('180+2')
  })

  it('reads main-line moves and clocks, skipping variations', () => {
    expect(parsePgnMainline(PGN)).toEqual([
      { san: 'b3', clock: 180 },
      { san: 'e5', clock: 180 },
      { san: 'Bb2', clock: 182 },
      { san: 'd5', clock: 5.3 },
    ])
  })

  it('builds the game header and clocks', () => {
    const setup = buildHumanBarSetup(PGN, 'W2114ZgI', 4, START)
    expect(setup).toEqual({
      ok: true,
      clocks: [180, 180, 182, 5.3],
      game: {
        white: 'maximayoz',
        black: 'alex_ast',
        white_elo: 1857,
        black_elo: 1874,
        time_control: '180+2',
        event: 'rated blitz game',
        start_ms: Date.UTC(2025, 11, 2, 10, 55, 10),
        site: 'https://lichess.org/game/W2114ZgI',
      },
    })
  })

  it('refuses games without clocks, ratings or matching moves', () => {
    const noClocks = PGN.replace(/\[%clk [^\]]*\]/g, '')
    expect(buildHumanBarSetup(noClocks, 'x', 4, START).ok).toBe(false)
    const noElo = PGN.replace('[WhiteElo "1857"]', '[WhiteElo "?"]')
    expect(buildHumanBarSetup(noElo, 'x', 4, START).ok).toBe(false)
    expect(buildHumanBarSetup(PGN, 'x', 5, START).ok).toBe(false)
    expect(buildHumanBarSetup(undefined, 'x', 4, START).ok).toBe(false)
  })
})

describe('human bar encodings', () => {
  it('encodes float32 little-endian base64', () => {
    const encoded = float32ToBase64LE(Float32Array.from([1, -2.5]))
    const bytes = Buffer.from(encoded, 'base64')
    expect(bytes.length).toBe(8)
    expect(bytes.readFloatLE(0)).toBe(1)
    expect(bytes.readFloatLE(4)).toBe(-2.5)
  })

  it('encodes mates as sign * (10000 - |N|) for the side to move', () => {
    const base = { depth: 1, nodes: 1, bestmove: null }
    expect(encodeSideToMoveScore({ ...base, cp: 23, mate: null })).toBe(23)
    expect(encodeSideToMoveScore({ ...base, cp: null, mate: 3 })).toBe(9997)
    expect(encodeSideToMoveScore({ ...base, cp: null, mate: -2 })).toBe(-9998)
    expect(encodeSideToMoveScore({ ...base, cp: null, mate: 0 })).toBe(-10000)
  })
})

describe('human bar evaluation order', () => {
  it('starts at the current position, then looks ahead, then fills outward', () => {
    expect(evaluationOrder(3, 8, 2)).toEqual([3, 4, 5, 2, 1, 6, 0, 7])
    expect(evaluationOrder(0, 4, 2)).toEqual([0, 1, 2, 3])
    expect(evaluationOrder(5, 6, 2)).toEqual([5, 4, 3, 2, 1, 0])
  })

  it('covers every position exactly once', () => {
    const order = evaluationOrder(17, 40, 2)
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 40 }, (_, i) => i),
    )
  })
})

describe('human bar engine label', () => {
  it('names the net the site ships, which the server has a map for', () => {
    const net = HUMAN_BAR_ENGINE.split('-')[1]
    expect(fs.existsSync(`public/stockfish/nn-${net}.nnue`)).toBe(true)
  })
})

describe('usual blunder risk', () => {
  it('reads the band for the rating and time control', () => {
    expect(usualBlunderRiskIn5(1900, '180+2')).toBeCloseTo(0.3, 3)
    expect(usualBlunderRiskIn5(1900, '60+0')).toBeCloseTo(0.336, 3)
    expect(usualBlunderRiskIn5(1900, '600+0')).toBeCloseTo(0.285, 3)
  })
  it('interpolates between bands and stays in range at the ends', () => {
    expect(usualBlunderRiskIn5(1800, '180+2')).toBeCloseTo(0.3125, 3)
    const blitz = TYPICAL_DANGER_BY_LEVEL.blitz
    expect(usualBlunderRiskIn5(800, '180+2')).toBe(blitz[0][2])
    expect(usualBlunderRiskIn5(3000, '180+2')).toBe(blitz[blitz.length - 1][2])
  })
})

describe('engine chance', () => {
  it('gives even players even chances at an even eval, and sums to 1', () => {
    const [w, d, b] = engineChance(0, 1900, 1900, '180+2')
    expect(w).toBeCloseTo(b, 5)
    expect(w + d + b).toBeCloseTo(1, 5)
    expect(d).toBeGreaterThan(0.03)
    expect(d).toBeLessThan(0.1)
  })
  it('moves with the eval and the rating gap', () => {
    const at = (pawns: number, gap = 0) =>
      engineChance(pawns, 1900 + gap, 1900, '180+2')[0]
    expect(at(-4)).toBeLessThan(at(0))
    expect(at(0)).toBeLessThan(at(4))
    expect(at(0, 200)).toBeGreaterThan(at(0))
  })
})

describe('one-move mix inputs', () => {
  it("takes Maia's moves until they cover 95%, at most 12", () => {
    expect(likelyMoves({ a: 0.5, b: 0.3, c: 0.16, d: 0.04 })).toEqual([
      { uci: 'a', prob: 0.5 },
      { uci: 'b', prob: 0.3 },
      { uci: 'c', prob: 0.16 },
    ])
    const flat: Record<string, number> = {}
    for (let i = 0; i < 20; i++) flat[`m${i}`] = 0.05
    expect(likelyMoves(flat)).toHaveLength(12)
    expect(likelyMoves({ a: 1, b: 0 })).toEqual([{ uci: 'a', prob: 1 }])
  })

  it('plays a UCI move, promotions and castling included', () => {
    expect(fenAfterMove(START, 'e2e4')).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    )
    expect(fenAfterMove(START, 'e2e5')).toBeNull()
    expect(fenAfterMove('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1', 'b7b8n')).toBe(
      '1N2k3/8/8/8/8/8/8/4K3 b - - 0 1',
    )
    expect(fenAfterMove('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1g1')).toBe(
      'r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1',
    )
  })

  it('turns a line of the position before into the eval after the move', () => {
    // White to move played into +0.8 for White: Black to move after it.
    expect(evalAfterMoveFromLine(80, undefined, false)).toBe(-80)
    expect(evalAfterMoveFromLine(-35, undefined, true)).toBe(-35)
    // White mates: Black, to move after the move, is getting mated.
    expect(evalAfterMoveFromLine(10000, 3, false)).toBe(-(10000 - 3))
    expect(evalAfterMoveFromLine(-10000, -2, true)).toBe(-(10000 - 2))
  })
})
