import type { LivePly } from './game1'
import { summarize } from './summary'

const ply = (i: number, over: Partial<LivePly>): LivePly =>
  ({
    index: i,
    moveNumber: Math.floor(i / 2) + 1,
    color: i % 2 ? 'black' : 'white',
    mover: i % 2 ? 'gukesh' : 'sindarov',
    san: `m${i}`,
    uci: '',
    fenBefore: '',
    fen: '',
    candidates: [],
    sf: '',
    rank: 1,
    pPlayed: 0.5,
    crowdPlayed: 0,
    crowdTop: '',
    guesses: 0,
    eval: 0,
    think: 30,
    clockWhite: 0,
    clockBlack: 0,
    ...over,
  }) as LivePly

describe('the game from Maia’s point of view', () => {
  it('counts the moves each side’s Maia and Stockfish called', () => {
    const s = summarize([
      ply(0, { rank: 1, sf: 'm0' }),
      ply(1, { rank: 3, sf: 'x' }),
      ply(2, { rank: 2, sf: 'm2' }),
      ply(3, { rank: 0 }),
    ])
    expect(s.sides.white).toEqual({
      moves: 2,
      maiaTop: 1,
      sfMoves: 2,
      sfTop: 2,
    })
    expect(s.sides.black).toEqual({
      moves: 1,
      maiaTop: 0,
      sfMoves: 1,
      sfTop: 0,
    })
  })

  it('lists the moves Maia least expected, least first', () => {
    const s = summarize([
      ply(0, { rank: 4, pPlayed: 0.08 }),
      ply(1, { rank: 7, pPlayed: 0.01 }),
      ply(2, { rank: 2, pPlayed: 0.3 }),
      ply(3, { rank: 0, pPlayed: 0 }),
    ])
    expect(s.surprises.map((p) => p.index)).toEqual([1, 0])
  })

  it('finds swings in the mover’s chances, biggest first', () => {
    const s = summarize([
      ply(0, { bar: { W: 0.3, D: 0.4, B: 0.3 } }),
      ply(1, { bar: { W: 0.2, D: 0.4, B: 0.4 } }),
      ply(2, { bar: { W: 0.21, D: 0.4, B: 0.39 } }),
      ply(3, { bar: { W: 0.05, D: 0.3, B: 0.65 } }),
    ])
    // Black's 1…: 0.3 -> 0.4 (+0.1); White's 2.: +0.01; Black's 2…: +0.31.
    expect(s.swings.map((w) => w.ply.index)).toEqual([3, 1])
    expect(s.swings[0]).toMatchObject({ before: 0.39, after: 0.65 })
  })

  it('lists the most dangerous positions and the longest thinks', () => {
    const s = summarize([
      ply(0, { risk: 0.01, think: 600 }),
      ply(1, { risk: 0.12, think: 90 }),
      ply(2, { risk: 0.05, think: 1500 }),
    ])
    expect(s.dangerous.map((r) => r.ply.index)).toEqual([1, 2])
    expect(s.thinks.map((p) => p.index)).toEqual([2, 0])
  })
})
