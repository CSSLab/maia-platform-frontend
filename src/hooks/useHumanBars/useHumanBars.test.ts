import { FALLBACK_DEPTH, SITE_EVAL_FINAL_DEPTH, kidStage } from './useHumanBars'

describe('the stages of a priced move (deeper wins)', () => {
  it("puts the site's quick screening lines below the bars' own search", () => {
    expect(kidStage(-1)).toBe(0)
    expect(kidStage(6)).toBe(0)
    expect(kidStage(FALLBACK_DEPTH - 1)).toBe(0)
  })

  it("starts the next stage at the bars' own search and at the site's final depth", () => {
    expect(kidStage(FALLBACK_DEPTH)).toBe(1)
    expect(kidStage(SITE_EVAL_FINAL_DEPTH - 1)).toBe(1)
    expect(kidStage(SITE_EVAL_FINAL_DEPTH)).toBe(2)
    expect(kidStage(30)).toBe(2)
  })
})
