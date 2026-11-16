import {
  ChartLine,
  buildLayout,
  nearestMove,
  spread,
} from './movesByRatingLayout'

const line = (
  key: string,
  values: (i: number) => number,
  color = '#41ab5d',
): ChartLine => ({
  key,
  san: key,
  color,
  values: Array.from({ length: 21 }, (_, i) => values(i)),
})

describe('the moves-by-rating layout', () => {
  const big = line('Qe2', (i) => 10 + 4.4 * i, '#90d289')
  const red = line('Nd2', (i) => Math.max(0.5, 17 - 0.8 * i), '#cb181d')
  const castle = line('O-O', (i) => Math.max(0.2, 11 - 0.6 * i), '#238b45')
  const rook = line('Rh2', (i) => Math.max(0.1, 5.5 - 0.3 * i))
  const tiny = line('Kd2', () => 2)

  it('leaves off moves that never reach 5%', () => {
    const l = buildLayout([big, red, castle, rook, tiny], 1900, 'O-O', 400, 230)
    expect(l.kept.map((m) => m.key)).not.toContain('Kd2')
    expect(l.kept.map((m) => m.key)).toContain('Rh2')
  })

  it("colours the chosen rating's three most played moves and Stockfish's best, most played first", () => {
    const l = buildLayout([big, red, castle, rook], 1900, 'Rh2', 400, 230)
    expect(l.focus.map((m) => m.key)).toEqual(['Qe2', 'Nd2', 'O-O', 'Rh2'])
    const l2 = buildLayout([big, red, castle, rook], 1900, undefined, 400, 230)
    expect(l2.grey.map((m) => m.key)).toEqual(['Rh2'])
  })

  it('names at the chosen rating only moves with clear room, and every coloured move at the right', () => {
    const l = buildLayout([big, red, castle, rook], 1900, 'O-O', 400, 230)
    expect(l.markerLabels.map((m) => m.key)).toContain('Qe2')
    expect(l.markerLabels.length).toBeLessThan(l.focus.length)
    expect(l.rightLabels.map((r) => r.key).sort()).toEqual(
      l.focus.map((m) => m.key).sort(),
    )
  })

  it('puts the shares with the right names when the chosen rating is at the edge', () => {
    const l = buildLayout([big, red, castle], 2600, undefined, 400, 230)
    expect(l.edge).toBe(true)
    expect(l.markerLabels).toEqual([])
  })

  it('finds the move nearest the pointer, within 14px of its line', () => {
    const l = buildLayout([big, red], 1500, undefined, 400, 230)
    expect(nearestMove(l, l.x(10), l.y(big.values[10]) + 3)).toBe('Qe2')
    expect(nearestMove(l, l.x(10), l.y(30))).toBeNull()
  })

  it('spreads labels at least the gap apart', () => {
    const s = spread([{ y: 100 }, { y: 101 }, { y: 102 }], 12, 0, 300)
    expect(s.map((it) => it.ly)).toEqual([100, 112, 124])
  })
})
