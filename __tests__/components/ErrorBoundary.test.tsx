import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../../src/components/Common/ErrorBoundary'

// Mock dependencies
jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

jest.mock('next/font/google', () => ({
  Open_Sans: () => ({ className: 'open-sans-mock' }),
}))

jest.mock('@react-chess/chessground', () => {
  return function Chessground() {
    return <div data-testid="chessground" />
  }
})

jest.mock('../../src/components/Common/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}))

jest.mock('../../src/components/Common/Footer', () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}))

jest.mock('../../src/lib/analytics', () => ({
  trackErrorEncountered: jest.fn(),
}))

// Component that throws an error for testing
const ThrowError = ({
  shouldThrow,
  errorMessage,
}: {
  shouldThrow: boolean
  errorMessage?: string
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage || 'Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary Component', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    jest.clearAllMocks()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child component</div>
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Child component')).toBeInTheDocument()
  })

  it('should render error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText(/We're sorry for the inconvenience/),
    ).toBeInTheDocument()
    expect(screen.getByText('Return to Home')).toBeInTheDocument()
    expect(screen.getByText('Get Help on Discord')).toBeInTheDocument()
  })

  it('should render unauthorized UI for unauthorized errors', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Unauthorized" />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Unauthorized Access')).toBeInTheDocument()
    expect(screen.getByText(/You do not have permission/)).toBeInTheDocument()
    expect(screen.getByText('Click here to go home')).toBeInTheDocument()
  })

  it('should include header and footer in error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('should render chessboard in error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('chessground')).toBeInTheDocument()
  })

  it('should display error details in expandable section', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Custom test error" />
      </ErrorBoundary>,
    )

    expect(
      screen.getByText('Technical Details (click to expand)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/If you continue to experience this issue/),
    ).toBeInTheDocument()
  })

  it('should call trackErrorEncountered when error occurs', () => {
    const { trackErrorEncountered: mockTrackErrorEncountered } =
      jest.requireMock('../../src/lib/analytics')

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Test tracking error" />
      </ErrorBoundary>,
    )

    expect(mockTrackErrorEncountered).toHaveBeenCalledWith(
      'Error',
      expect.any(String),
      'component_error',
      'Test tracking error',
    )
  })

  it('should handle tracking errors gracefully', () => {
    const { trackErrorEncountered: mockTrackErrorEncountered } =
      jest.requireMock('../../src/lib/analytics')
    mockTrackErrorEncountered.mockImplementation(() => {
      throw new Error('Tracking failed')
    })

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to track error:',
      expect.any(Error),
    )
  })

  it('should display timestamp in error details', () => {
    const mockDate = new Date('2023-01-01T12:00:00.000Z')
    const dateSpy = jest
      .spyOn(global, 'Date')
      .mockImplementation(() => mockDate)

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(
      screen.getByText(/Timestamp: 2023-01-01T12:00:00.000Z/),
    ).toBeInTheDocument()

    dateSpy.mockRestore()
  })

  it('should log errors to console', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Console test error" />
      </ErrorBoundary>,
    )

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Error caught in getDerivedStateFromError:',
      expect.any(Error),
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Error caught in componentDidCatch:',
      expect.any(Error),
      expect.any(Object),
    )
  })

  it('should apply correct CSS classes', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )

    const errorContainer = container.firstChild
    expect(errorContainer).toHaveClass('open-sans-mock', 'app-container')
  })

  it('should handle errors with missing stack trace', () => {
    const errorWithoutStack = new Error('No stack error')
    delete (errorWithoutStack as any).stack

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="No stack error" />
      </ErrorBoundary>,
    )

    // Should still render the error UI
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
  })

  it('should handle unknown errors gracefully', () => {
    // Simulate an error with no name or message
    const errorBoundary = new ErrorBoundary({ children: null })
    const unknownError = { toString: () => 'Unknown error object' } as any

    const result = ErrorBoundary.getDerivedStateFromError(unknownError)

    expect(result).toEqual({ hasError: true, error: unknownError })
  })

  it('should provide correct links in error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )

    const homeLink = screen.getByText('Return to Home').closest('a')
    const discordLink = screen.getByText('Get Help on Discord').closest('a')

    expect(homeLink).toHaveAttribute('href', '/')
    expect(discordLink).toHaveAttribute('href', 'https://discord.gg/hHb6gqFpxZ')
    expect(discordLink).toHaveAttribute('target', '_blank')
    expect(discordLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('should handle window object being undefined during SSR', () => {
    const originalWindow = global.window
    delete (global as any).window

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )

    const { trackErrorEncountered: mockTrackErrorEncountered } =
      jest.requireMock('../../src/lib/analytics')
    expect(mockTrackErrorEncountered).toHaveBeenCalledWith(
      'Error',
      expect.any(String),
      'component_error',
      'Test error',
    )

    global.window = originalWindow
  })
})
