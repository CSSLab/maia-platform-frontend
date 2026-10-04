import {
  DRILL_REVIEW_DEPTH_KEY,
  readDrillReviewDepth,
  saveDrillReviewDepth,
} from './drillReviewSettings'

describe('drill review depth', () => {
  it('keeps thorough analysis by default and accepts only the fast preset', () => {
    expect(readDrillReviewDepth()).toBe(18)
    expect(readDrillReviewDepth({ getItem: () => '12' })).toBe(12)
    expect(readDrillReviewDepth({ getItem: () => 'invalid' })).toBe(18)
  })

  it('persists the selected depth for the next drill review', () => {
    saveDrillReviewDepth(12)
    expect(window.localStorage.getItem(DRILL_REVIEW_DEPTH_KEY)).toBe('12')
    expect(readDrillReviewDepth(window.localStorage)).toBe(12)
  })
})
