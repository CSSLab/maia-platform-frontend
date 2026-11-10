import { ReactNode, useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** What a rated result is called in a mode: a game, or a puzzle. */
export type RatedUnit = 'games' | 'puzzles'

const playMore = (unit?: RatedUnit) =>
  unit === 'puzzles'
    ? 'Solve more puzzles'
    : unit === 'games'
      ? 'Play more games'
      : 'Play more'

/** How a rating gets settled, said to the player whose rating it is. */
export const settleAdvice = (unit?: RatedUnit) =>
  `${playMore(unit)} to settle your rating.`

/** What the "?" after a rating means, to its owner (`own`) or to a visitor. */
export const provisionalExplanation = (own?: boolean, unit?: RatedUnit) =>
  own
    ? `Your rating is provisional. ${playMore(unit)} to settle it.`
    : 'This rating is provisional. It hasn’t settled yet.'

const TOOLTIP_WIDTH = 224
const EDGE_MARGIN = 8

interface TooltipProps {
  /** What the tooltip says. */
  text: string
  /** Read out instead of the children, when they don't say enough alone. */
  label?: string
  className?: string
  children: ReactNode
}

/**
 * Text that explains itself: hovering, focusing or tapping it shows `text`
 * above it.
 */
export const Tooltip = ({ text, label, className, children }: TooltipProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)

  const show = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
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
      ref={triggerRef}
      type="button"
      aria-label={label}
      className={`cursor-help outline-none ${className ?? ''}`}
      onClick={show}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {anchor &&
        // In the body: the cards ratings sit in clip what overflows them.
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded border border-glass-border bg-backdrop px-3 py-2 text-left text-xs font-normal normal-case leading-snug text-white/90 shadow-lg"
            style={{ left: anchor.x, top: anchor.y - 6, width: TOOLTIP_WIDTH }}
          >
            {text}
          </span>,
          document.body,
        )}
    </button>
  )
}

interface MarkProps {
  /** Whether the rating is the reader's own. */
  own?: boolean
  unit?: RatedUnit
}

/**
 * The "?" after a provisional rating, as on Lichess. Hovering, focusing or
 * tapping it says what it means.
 */
export const ProvisionalMark = ({ own, unit }: MarkProps) => {
  const explanation = provisionalExplanation(own, unit)
  return (
    <Tooltip
      text={explanation}
      label={explanation}
      className="opacity-70 focus-visible:underline"
    >
      ?
    </Tooltip>
  )
}

interface Props extends MarkProps {
  rating: number
  provisional?: boolean
}

/** A player's rating; a provisional one is followed by "?". */
export const Rating = ({ rating, provisional, own, unit }: Props) => (
  <>
    {rating}
    {provisional ? <ProvisionalMark own={own} unit={unit} /> : null}
  </>
)
