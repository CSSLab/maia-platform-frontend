import { act, fireEvent, render, screen } from '@testing-library/react'
import toast from 'react-hot-toast'

import { AppToaster } from './AppToaster'

const MESSAGE = 'Your last game ran out of time while you were away'

// jsdom has no PointerEvent, so fireEvent's pointer events would carry no
// pointerType.
class TestPointerEvent extends MouseEvent {
  pointerType: string
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerType = init.pointerType ?? ''
  }
}

beforeAll(() => {
  window.PointerEvent ??= TestPointerEvent as typeof PointerEvent
})

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  act(() => {
    toast.remove()
    jest.runOnlyPendingTimers()
  })
  jest.useRealTimers()
})

const showToast = () => {
  render(<AppToaster />)
  act(() => {
    toast(MESSAGE, { duration: 8000 })
  })
  return screen.getByText(MESSAGE)
}

// Past the toast's 8 s, then the second it takes to leave (timed from the
// render after it was dismissed).
const waitOut = () => {
  act(() => {
    jest.advanceTimersByTime(9000)
  })
  act(() => {
    jest.advanceTimersByTime(2000)
  })
}

describe('AppToaster', () => {
  it('lets a toast go after its time', () => {
    showToast()
    waitOut()
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
  })

  it('lets a tapped toast go after its time', () => {
    const shown = showToast()
    // What a phone sends for a tap: the pointer comes, the mouse events the
    // page is also sent come, and no mouseleave follows.
    fireEvent.pointerOver(shown, { pointerType: 'touch' })
    fireEvent.mouseOver(shown)
    fireEvent.click(shown)
    waitOut()
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
  })

  it('holds a toast while the mouse is over it', () => {
    const shown = showToast()
    fireEvent.pointerOver(shown, { pointerType: 'mouse' })
    waitOut()
    expect(screen.getByText(MESSAGE)).toBeInTheDocument()

    fireEvent.pointerOut(shown, { pointerType: 'mouse' })
    waitOut()
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
  })
})
