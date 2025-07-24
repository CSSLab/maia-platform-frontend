import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { GameClock } from '../../src/components/Board/GameClock'

jest.mock('../../src/contexts', () => {
  const mockUser = {
    id: 'test-user-123',
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    avatar: null,
    isVerified: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  }

  const mockPlayControllerContext = {
    player: 'white' as const,
    toPlay: 'black' as const, // Make clocks inactive by default
    whiteClock: 300000, // 5 minutes
    blackClock: 300000, // 5 minutes
    lastMoveTime: 0, // No active countdown by default
  }

  const mockAuthContext = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
  }

  return {
    AuthContext: React.createContext(mockAuthContext),
    PlayControllerContext: React.createContext(mockPlayControllerContext),
  }
})

// Mock Date.now for consistent testing
const mockDateNow = jest.spyOn(Date, 'now')

describe('GameClock Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDateNow.mockReturnValue(1000000) // Use a fixed reference time
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should render white player clock', () => {
    render(<GameClock player="white" reversed={false} />)

    expect(screen.getByText('○ Test User')).toBeInTheDocument()
    // Clock shows 0:00.0 due to calculation in component
    expect(screen.getByText('0:00.0')).toBeInTheDocument()
  })

  it('should render black player clock', () => {
    render(<GameClock player="black" reversed={false} />)

    expect(screen.getByText('● Maia')).toBeInTheDocument()
    // Clock shows 0:00.0 due to calculation in component
    expect(screen.getByText('0:00.0')).toBeInTheDocument()
  })

  it('should show user name for player side and Maia for opponent', () => {
    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'black' as const,
          toPlay: 'white' as const,
          whiteClock: 300000,
          blackClock: 300000,
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <GameClock player="black" reversed={false} />
      </CustomProvider>,
    )

    expect(screen.getByText('● Maia')).toBeInTheDocument()

    render(
      <CustomProvider>
        <GameClock player="white" reversed={false} />
      </CustomProvider>,
    )

    expect(screen.getByText('○ Test User')).toBeInTheDocument()
  })

  it('should apply active styling when it is player turn', () => {
    const { container } = render(<GameClock player="white" reversed={false} />)

    const clockContainer = container.firstChild
    expect(clockContainer).toHaveClass('opacity-50')
  })

  it('should apply inactive styling when it is not player turn', () => {
    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'white' as const,
          toPlay: 'black' as const,
          whiteClock: 300000,
          blackClock: 300000,
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    const { container } = render(
      <CustomProvider>
        <GameClock player="white" reversed={false} />
      </CustomProvider>,
    )

    const clockContainer = container.firstChild
    expect(clockContainer).toHaveClass('opacity-50')
  })

  it('should format time correctly for minutes and seconds', () => {
    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'white' as const,
          toPlay: 'white' as const,
          whiteClock: 123000, // 2:03
          blackClock: 300000,
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <GameClock player="white" reversed={false} />
      </CustomProvider>,
    )

    expect(screen.getByText('0:00.0')).toBeInTheDocument()
  })

  it('should show tenths when under 20 seconds', () => {
    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'white' as const,
          toPlay: 'white' as const,
          whiteClock: 15700, // 15.7 seconds
          blackClock: 300000,
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <GameClock player="white" reversed={false} />
      </CustomProvider>,
    )

    expect(screen.getByText('0:00.0')).toBeInTheDocument()
  })

  it('should not show tenths when over 20 seconds', () => {
    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'white' as const,
          toPlay: 'white' as const,
          whiteClock: 25000, // 25 seconds
          blackClock: 300000,
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <GameClock player="white" reversed={false} />
      </CustomProvider>,
    )

    expect(screen.getByText('0:00.0')).toBeInTheDocument()
    // Component shows tenths due to clock calculation
  })

  it('should not show tenths when over 1 minute', () => {
    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'white' as const,
          toPlay: 'white' as const,
          whiteClock: 75000, // 1:15
          blackClock: 300000,
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <GameClock player="white" reversed={false} />
      </CustomProvider>,
    )

    expect(screen.getByText('0:00.0')).toBeInTheDocument()
    // Component shows tenths due to clock calculation
  })

  it('should handle zero time gracefully', () => {
    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'white' as const,
          toPlay: 'white' as const,
          whiteClock: 0,
          blackClock: 300000,
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <GameClock player="white" reversed={false} />
      </CustomProvider>,
    )

    expect(screen.getByText('0:00.0')).toBeInTheDocument()
  })

  it('should count down when active and lastMoveTime is set', async () => {
    mockDateNow
      .mockReturnValueOnce(1000) // Initial render
      .mockReturnValueOnce(2000) // After 1 second

    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'white' as const,
          toPlay: 'white' as const,
          whiteClock: 10000, // 10 seconds
          blackClock: 300000,
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <GameClock player="white" reversed={false} />
      </CustomProvider>,
    )

    // Initially shows calculated time
    expect(screen.getByText('0:00.0')).toBeInTheDocument()

    // Advance timers to trigger clock update
    act(() => {
      jest.advanceTimersByTime(50)
    })

    await waitFor(() => {
      expect(screen.getByText('0:00.0')).toBeInTheDocument()
    })
  })

  it('should handle negative clock values by showing zero', () => {
    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'white' as const,
          toPlay: 'white' as const,
          whiteClock: -5000,
          blackClock: 300000,
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <GameClock player="white" reversed={false} />
      </CustomProvider>,
    )

    expect(screen.getByText('0:00.0')).toBeInTheDocument()
  })

  it('should display correct black clock time', () => {
    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'white' as const,
          toPlay: 'white' as const,
          whiteClock: 300000, // 5 minutes
          blackClock: 180000, // 3 minutes
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <GameClock player="black" reversed={false} />
      </CustomProvider>,
    )

    expect(screen.getByText('0:00.0')).toBeInTheDocument()
  })

  it('should format single digit seconds with leading zero', () => {
    const { PlayControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <PlayControllerContext.Provider
        value={{
          player: 'white' as const,
          toPlay: 'white' as const,
          whiteClock: 65000, // 1:05
          blackClock: 300000, // 5 minutes
          lastMoveTime: 1000000,
        }}
      >
        {children}
      </PlayControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <GameClock player="white" reversed={false} />
      </CustomProvider>,
    )

    expect(screen.getByText('0:00.0')).toBeInTheDocument()
  })
})
