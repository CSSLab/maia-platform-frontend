import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const PROVISIONAL_EXPLANATION =
  'Provisional rating: there are too few recent rated results to be sure of it. It settles with more play.'

const TOOLTIP_WIDTH = 224
const EDGE_MARGIN = 8

/**
 * The "?" after a provisional rating, as on Lichess. Hovering, focusing or
 * tapping it says what it means.
 */
export const ProvisionalMark = () => {
  const markRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)

  const show = useCallback(() => {
    const rect = markRef.current?.getBoundingClientRect()
    if (!rect) return
    const half = TOOLTIP_WIDTH / 2 + EDGE_MARGIN
    setAnchor({
      x: Math.min(
        Math.max(rect.left + rect.width / 2, half),
        Math.max(half, window.innerWidth - half),
      ),
      y: rect.top,
    })
  }, [])
  const hide = useCallback(() => setAnchor(null), [])

  return (
    <button
      ref={markRef}
      type="button"
      aria-label={PROVISIONAL_EXPLANATION}
      className="cursor-help opacity-70 outline-none focus-visible:underline"
      onClick={show}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      ?
      {anchor &&
        // In the body: the cards ratings sit in clip what overflows them.
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded border border-glass-border bg-backdrop px-3 py-2 text-left text-xs font-normal normal-case leading-snug text-white/90 shadow-lg"
            style={{ left: anchor.x, top: anchor.y - 6, width: TOOLTIP_WIDTH }}
          >
            {PROVISIONAL_EXPLANATION}
          </span>,
          document.body,
        )}
    </button>
  )
}

interface Props {
  rating: number
  provisional?: boolean
}

/** A player's rating; a provisional one is followed by "?". */
export const Rating = ({ rating, provisional }: Props) => (
  <>
    {rating}
    {provisional ? <ProvisionalMark /> : null}
  </>
)
