import { render, screen } from '@testing-library/react'
import { WindowSizeContextProvider } from '../../src/providers/WindowSizeContextProvider'
import React, { useContext } from 'react'
import { WindowSizeContext } from '../../src/contexts'

// Mock the useWindowSize hook
jest.mock('../../src/hooks', () => ({
  useWindowSize: jest.fn(),
}))

// Test component to access the context
const TestComponent = () => {
  const { width, height, isMobile } = useContext(WindowSizeContext)
  return (
    <div>
      <span data-testid="width">{width}</span>
      <span data-testid="height">{height}</span>
      <span data-testid="isMobile">{isMobile.toString()}</span>
    </div>
  )
}

describe('WindowSizeContextProvider', () => {
  const { useWindowSize: mockUseWindowSize } =
    jest.requireMock('../../src/hooks')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should provide window size values to children', () => {
    mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 })

    render(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('width')).toHaveTextContent('1024')
    expect(screen.getByTestId('height')).toHaveTextContent('768')
  })

  it('should calculate isMobile as true for width <= 670', () => {
    mockUseWindowSize.mockReturnValue({ width: 640, height: 480 })

    render(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('isMobile')).toHaveTextContent('true')
  })

  it('should calculate isMobile as false for width > 670', () => {
    mockUseWindowSize.mockReturnValue({ width: 800, height: 600 })

    render(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('isMobile')).toHaveTextContent('false')
  })

  it('should calculate isMobile as false for width = 0', () => {
    mockUseWindowSize.mockReturnValue({ width: 0, height: 0 })

    render(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('isMobile')).toHaveTextContent('false')
  })

  it('should handle boundary case at width = 670', () => {
    mockUseWindowSize.mockReturnValue({ width: 670, height: 500 })

    render(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('isMobile')).toHaveTextContent('true')
  })

  it('should handle boundary case at width = 671', () => {
    mockUseWindowSize.mockReturnValue({ width: 671, height: 500 })

    render(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('isMobile')).toHaveTextContent('false')
  })

  it('should handle negative width values', () => {
    mockUseWindowSize.mockReturnValue({ width: -100, height: 500 })

    render(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('width')).toHaveTextContent('-100')
    expect(screen.getByTestId('isMobile')).toHaveTextContent('false')
  })

  it('should update context when window size changes', () => {
    mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 })

    const { rerender } = render(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('width')).toHaveTextContent('1024')
    expect(screen.getByTestId('isMobile')).toHaveTextContent('false')

    // Simulate window resize to mobile size
    mockUseWindowSize.mockReturnValue({ width: 480, height: 800 })

    rerender(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('width')).toHaveTextContent('480')
    expect(screen.getByTestId('isMobile')).toHaveTextContent('true')
  })

  it('should handle very large window sizes', () => {
    mockUseWindowSize.mockReturnValue({ width: 4000, height: 2000 })

    render(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('width')).toHaveTextContent('4000')
    expect(screen.getByTestId('height')).toHaveTextContent('2000')
    expect(screen.getByTestId('isMobile')).toHaveTextContent('false')
  })

  it('should memoize isMobile calculation correctly', () => {
    const spy = jest.spyOn(React, 'useMemo')
    mockUseWindowSize.mockReturnValue({ width: 800, height: 600 })

    render(
      <WindowSizeContextProvider>
        <TestComponent />
      </WindowSizeContextProvider>,
    )

    // useMemo should be called for isMobile calculation
    expect(spy).toHaveBeenCalled()

    spy.mockRestore()
  })

  it('should render children correctly', () => {
    mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 })

    render(
      <WindowSizeContextProvider>
        <div data-testid="child">Child Content</div>
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('child')).toHaveTextContent('Child Content')
  })

  it('should handle multiple children', () => {
    mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 })

    render(
      <WindowSizeContextProvider>
        <div data-testid="child1">Child 1</div>
        <div data-testid="child2">Child 2</div>
      </WindowSizeContextProvider>,
    )

    expect(screen.getByTestId('child1')).toHaveTextContent('Child 1')
    expect(screen.getByTestId('child2')).toHaveTextContent('Child 2')
  })
})
