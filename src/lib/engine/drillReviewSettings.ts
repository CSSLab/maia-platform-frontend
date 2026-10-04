export type DrillReviewDepth = 12 | 18

export const DRILL_REVIEW_DEPTH_KEY = 'maia.drillReviewDepth'
export const DRILL_REVIEW_DEPTH_EVENT = 'maia-drill-review-depth-changed'
export const DEFAULT_DRILL_REVIEW_DEPTH: DrillReviewDepth = 18

export const readDrillReviewDepth = (
  storage?: Pick<Storage, 'getItem'>,
): DrillReviewDepth => {
  try {
    return storage?.getItem(DRILL_REVIEW_DEPTH_KEY) === '12'
      ? 12
      : DEFAULT_DRILL_REVIEW_DEPTH
  } catch {
    return DEFAULT_DRILL_REVIEW_DEPTH
  }
}

export const getDrillReviewDepth = (): DrillReviewDepth => {
  if (typeof window === 'undefined') return DEFAULT_DRILL_REVIEW_DEPTH
  try {
    return readDrillReviewDepth(window.localStorage)
  } catch {
    return DEFAULT_DRILL_REVIEW_DEPTH
  }
}

export const saveDrillReviewDepth = (depth: DrillReviewDepth): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      DRILL_REVIEW_DEPTH_KEY,
      String(depth === 12 ? 12 : DEFAULT_DRILL_REVIEW_DEPTH),
    )
    window.dispatchEvent(new CustomEvent(DRILL_REVIEW_DEPTH_EVENT))
  } catch {
    // Storage restrictions must not block drill review.
  }
}
