import { useEffect, useRef, useState } from 'react'

import { createWheelStepper, wheelDeltaPx } from 'src/lib/wheelNavigation'

interface Options {
  onNext: () => void
  onPrevious: () => void
  /** E.g. while Learn from mistakes has navigation locked. */
  disabled?: boolean
}

/**
 * Scrolling the wheel over the board steps through the moves (down = next,
 * up = previous), like Lichess, and doesn't scroll the page while the
 * pointer is over the board. Returns a ref callback for the board's
 * container.
 */
export const useBoardWheelNavigation = <T extends HTMLElement = HTMLElement>({
  onNext,
  onPrevious,
  disabled = false,
}: Options) => {
  // A callback ref in state rather than a ref object, so the listener moves
  // with the board when the page swaps between its desktop and phone layouts.
  const [element, setElement] = useState<T | null>(null)
  const handlers = useRef({ onNext, onPrevious })

  useEffect(() => {
    handlers.current = { onNext, onPrevious }
  }, [onNext, onPrevious])

  useEffect(() => {
    if (!element || disabled) return

    const step = createWheelStepper()
    const handleWheel = (event: WheelEvent) => {
      // Ctrl + wheel (and a trackpad pinch, which arrives as one) zooms the
      // page, and a mostly sideways swipe isn't a request to change moves.
      if (event.ctrlKey || event.metaKey) return
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

      event.preventDefault()
      const direction = step(
        wheelDeltaPx(event.deltaY, event.deltaMode),
        event.timeStamp,
      )
      if (direction > 0) handlers.current.onNext()
      else if (direction < 0) handlers.current.onPrevious()
    }

    // React's onWheel is passive, so it can't keep the page from scrolling.
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [element, disabled])

  return setElement
}
