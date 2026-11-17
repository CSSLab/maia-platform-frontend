import {
  ChartLine,
  buildLayout,
  interiorPeak,
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
  const hump = line('cxd4', (i) => 55 - 0.4 * (i - 11) ** 2, '#238b45')

  it('draws every move it is given, most played at the chosen rating first, and names each at its end', () => {
    const l = buildLayout([tiny, big, red, castle, rook], 1900, 400, 230)
    expect(l.kept.map((m) => m.key)).toEqual([
      'Qe2',
      'Nd2',
      'O-O',
      'Kd2',
      'Rh2',
    ])
    expect(l.rightLabels.map((r) => r.key).sort()).toEqual(
      ['Kd2', 'Nd2', 'O-O', 'Qe2', 'Rh2'].sort(),
    )
  })

  it('keeps the plot area the same at every rating', () => {
    const at = (r: number) => buildLayout([big, red, castle], r, 400, 230)
    for (const r of [600, 1500, 2400, 2600]) {
      expect(at(r).x(0)).toBe(at(1500).x(0))
      expect(at(r).x(20)).toBe(at(1500).x(20))
    }
  })

  it('gives shares at the chosen rating only where there is clear room', () => {
    const l = buildLayout([big, red, castle, rook], 1900, 400, 230)
    expect(l.markerLabels.map((m) => m.key)).toContain('Qe2')
    expect(l.markerLabels.length).toBeLessThan(l.kept.length)
  })

  it('gives the shares at the last rating to the left, away from the names', () => {
    const l = buildLayout([big, red], 2600, 400, 230)
    expect(l.markerLabels.length).toBeGreaterThan(0)
    expect(l.markerLabels.every((m) => m.side < 0)).toBe(true)
  })

  it('names a move at a strong peak inside the range, also at the chosen rating', () => {
    expect(interiorPeak(hump.values)).toBe(11)
    expect(interiorPeak(big.values)).toBe(-1)
    for (const rating of [2300, 1700]) {
      const l = buildLayout([hump, big], rating, 400, 230)
      expect(l.peakLabels.map((p) => p.key)).toContain('cxd4')
    }
  })

  it('finds the move nearest the pointer, within 14px of its line', () => {
    const l = buildLayout([big, red], 1500, 400, 230)
    expect(nearestMove(l, l.x(10), l.y(big.values[10]) + 3)).toBe('Qe2')
    expect(nearestMove(l, l.x(10), l.y(30))).toBeNull()
  })

  it('spreads labels at least the gap apart', () => {
    const s = spread([{ y: 100 }, { y: 101 }, { y: 102 }], 12, 0, 300)
    expect(s.map((it) => it.ly)).toEqual([100, 112, 124])
  })
})
