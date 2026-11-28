import { fitsLabel } from './ui'

describe('a win chance shows its number', () => {
  it('whenever its segment has room', () => {
    // 8% of a 500px board-side bar is 40px: room enough.
    expect(fitsLabel(0.08, 500, true)).toBe(true)
    // 3% of it is 15px: just enough.
    expect(fitsLabel(0.03, 500, true)).toBe(true)
    // 2% is 10px: no room.
    expect(fitsLabel(0.02, 500, true)).toBe(false)
    // Across a 200px bar, 9% is 18px: enough; 8% is not.
    expect(fitsLabel(0.09, 200, false)).toBe(true)
    expect(fitsLabel(0.08, 200, false)).toBe(false)
    // Under half a percent rounds to 0: never shown.
    expect(fitsLabel(0.004, 5000, true)).toBe(false)
  })
})
