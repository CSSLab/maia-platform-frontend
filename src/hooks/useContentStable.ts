import { useRef } from 'react'

/**
 * Returns the previous value while its content is unchanged. The analysis
 * page re-renders on every engine update; with stable values, memoised
 * children such as the moves-by-rating chart skip those that change nothing
 * they show.
 */
export const useContentStable = <T>(value: T): T => {
  const ref = useRef<{ key: string; value: T } | null>(null)
  const key = JSON.stringify(value) ?? ''
  if (!ref.current || ref.current.key !== key) ref.current = { key, value }
  return ref.current.value
}
