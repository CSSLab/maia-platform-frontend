import { render } from '@testing-library/react'

import { useBoardWheelNavigation } from './useBoardWheelNavigation'

const Board = (props: {
  onNext: () => void
  onPrevious: () => void
  disabled?: boolean
}) => {
  const ref = useBoardWheelNavigation<HTMLDivElement>(props)
  return <div ref={ref} data-testid="board" />
}

const wheel = (target: Element, init: WheelEventInit) => {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

describe('useBoardWheelNavigation', () => {
  it('steps forward on wheel down and back on wheel up, without scrolling the page', () => {
    const onNext = jest.fn()
    const onPrevious = jest.fn()
    const { getByTestId } = render(
      <Board onNext={onNext} onPrevious={onPrevious} />,
    )

    const down = wheel(getByTestId('board'), { deltaY: 100 })
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(down.defaultPrevented).toBe(true)

    // Straight after: the same gesture, which reversed, so not yet.
    wheel(getByTestId('board'), { deltaY: -10 })
    expect(onPrevious).not.toHaveBeenCalled()
  })

  it('leaves the wheel alone when navigation is disabled', () => {
    const onNext = jest.fn()
    const { getByTestId } = render(
      <Board onNext={onNext} onPrevious={jest.fn()} disabled />,
    )

    const event = wheel(getByTestId('board'), { deltaY: 100 })
    expect(onNext).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('leaves zooming and sideways swipes alone', () => {
    const onNext = jest.fn()
    const { getByTestId } = render(
      <Board onNext={onNext} onPrevious={jest.fn()} />,
    )

    const zoom = wheel(getByTestId('board'), { deltaY: 100, ctrlKey: true })
    const swipe = wheel(getByTestId('board'), { deltaX: 50, deltaY: 5 })
    expect(onNext).not.toHaveBeenCalled()
    expect(zoom.defaultPrevented).toBe(false)
    expect(swipe.defaultPrevented).toBe(false)
  })
})
