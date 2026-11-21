import React, { useCallback, useEffect, useRef } from 'react'
import {
  resolveValue,
  Toast,
  ToastBar,
  ToastPosition,
  useToaster,
} from 'react-hot-toast'

/**
 * The site's toasts, laid out as react-hot-toast's own <Toaster> lays them
 * out, except for when they wait.
 *
 * <Toaster> holds every toast on screen while the pointer is over them, from
 * mouseenter to mouseleave. A phone sends mouseenter when a toast is tapped
 * but often never sends the mouseleave, so a tapped toast, and every toast
 * after it, stayed up until the page was reloaded. Here only a mouse holds
 * them: a toast on a touch screen always leaves after its time.
 */

const EDGE = 16
const GUTTER = 8

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const ToastSlot = ({
  toast,
  position,
  offset,
  onHeight,
  children,
}: {
  toast: Toast
  position: ToastPosition
  offset: number
  onHeight: (id: string, height: number) => void
  children: React.ReactNode
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const { id } = toast

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => onHeight(id, el.getBoundingClientRect().height)
    measure()
    // A toast's text can change after it is shown (toast(..., { id })).
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [id, onHeight])

  const top = position.includes('top')
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: position.includes('center')
          ? 'center'
          : position.includes('right')
            ? 'flex-end'
            : undefined,
        transform: `translateY(${offset * (top ? 1 : -1)}px)`,
        transition: reducedMotion()
          ? undefined
          : 'all 230ms cubic-bezier(.21,1.02,.73,1)',
        zIndex: toast.visible ? 9999 : undefined,
        ...(top ? { top: 0 } : { bottom: 0 }),
      }}
    >
      <div style={{ pointerEvents: toast.visible ? 'auto' : 'none' }}>
        {children}
      </div>
    </div>
  )
}

export const AppToaster = ({
  position = 'bottom-right',
}: {
  position?: ToastPosition
}) => {
  const { toasts, handlers } = useToaster()
  const { startPause, endPause, calculateOffset, updateHeight } = handlers

  const onPointerEnter = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') startPause()
    },
    [startPause],
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: EDGE,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={endPause}
    >
      {toasts.map((t) => {
        const at = t.position || position
        return (
          <ToastSlot
            key={t.id}
            toast={t}
            position={at}
            offset={calculateOffset(t, {
              gutter: GUTTER,
              defaultPosition: position,
            })}
            onHeight={updateHeight}
          >
            {t.type === 'custom' ? (
              resolveValue(t.message, t)
            ) : (
              <ToastBar toast={t} position={at} />
            )}
          </ToastSlot>
        )
      })}
    </div>
  )
}
