import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useRouter } from 'next/router'
import { Header } from '../../src/components/Common/Header'
import {
  AuthContext,
  ModalContext,
  WindowSizeContext,
} from '../../src/contexts'

// Mock Next.js components and hooks
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height }: any) => (
    <img src={src} alt={alt} width={width} height={height} />
  ),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock Icons
jest.mock('../../src/components/Common/Icons', () => ({
  DiscordIcon: <svg data-testid="discord-icon">Discord</svg>,
}))

describe('Header', () => {
  const mockRouter = {
    pathname: '/',
    events: {
      on: jest.fn(),
      off: jest.fn(),
    },
  }

  const mockSetPlaySetupModalProps = jest.fn()
  const mockConnectLichess = jest.fn()
  const mockLogout = jest.fn()

  const mockAuthContext = {
    user: null,
    setUser: jest.fn(),
    connectLichess: mockConnectLichess,
    logout: mockLogout,
  }

  const mockModalContext = {
    playSetupModalProps: undefined,
    setPlaySetupModalProps: mockSetPlaySetupModalProps,
  }

  const mockWindowSizeContext = {
    isMobile: false,
    windowSize: { width: 1024, height: 768 },
  }

  const renderHeader = (overrides = {}) => {
    const authContext = { ...mockAuthContext, ...overrides.auth }
    const modalContext = { ...mockModalContext, ...overrides.modal }
    const windowSizeContext = {
      ...mockWindowSizeContext,
      ...overrides.windowSize,
    }

    return render(
      <WindowSizeContext.Provider value={windowSizeContext}>
        <AuthContext.Provider value={authContext}>
          <ModalContext.Provider value={modalContext}>
            <Header />
          </ModalContext.Provider>
        </AuthContext.Provider>
      </WindowSizeContext.Provider>,
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)

    // Mock document.body.style
    Object.defineProperty(document.body, 'style', {
      value: { overflow: '' },
      writable: true,
    })
  })

  describe('Desktop Layout', () => {
    it('should render desktop layout when not mobile', () => {
      renderHeader()

      expect(screen.getByText('Maia Chess')).toBeInTheDocument()
      expect(screen.getByAltText('Maia Logo')).toBeInTheDocument()
      expect(screen.getByText('Analysis')).toBeInTheDocument()
      expect(screen.getByText('Puzzles')).toBeInTheDocument()
    })

    it('should render sign in button when user not authenticated', () => {
      renderHeader()

      expect(screen.getByText('Sign in')).toBeInTheDocument()
    })

    it('should call connectLichess when sign in button clicked', () => {
      renderHeader()

      fireEvent.click(screen.getByText('Sign in'))
      expect(mockConnectLichess).toHaveBeenCalledTimes(1)
    })

    it('should render user info when authenticated', () => {
      const user = { lichessId: 'testuser', displayName: 'Test User' }
      renderHeader({ auth: { user } })

      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText('View Info')).toBeInTheDocument()
    })

    it('should render Play dropdown for authenticated users', () => {
      const user = { lichessId: 'testuser', displayName: 'Test User' }
      renderHeader({ auth: { user } })

      expect(screen.getByText('Play')).toBeInTheDocument()
    })

    it('should render Lichess link for unauthenticated users', () => {
      renderHeader()

      const playLink = screen.getByRole('link', { name: 'Play' })
      expect(playLink).toHaveAttribute('href', 'https://lichess.org/@/maia1')
    })

    it('should highlight current page in navigation', () => {
      ;(useRouter as jest.Mock).mockReturnValue({
        ...mockRouter,
        pathname: '/analysis',
      })

      renderHeader()

      const analysisLink = screen.getByRole('link', { name: 'Analysis' })
      expect(analysisLink).toHaveClass('bg-background-1')
    })

    it('should open play modal when Play Maia clicked', () => {
      const user = { lichessId: 'testuser', displayName: 'Test User' }
      renderHeader({ auth: { user } })

      // Hover over Play to show dropdown
      const playButton = screen.getByText('Play')
      fireEvent.mouseEnter(playButton.parentElement!)

      fireEvent.click(screen.getByText('Play Maia'))
      expect(mockSetPlaySetupModalProps).toHaveBeenCalledWith({
        playType: 'againstMaia',
      })
    })

    it('should open hand and brain modal when clicked', () => {
      const user = { lichessId: 'testuser', displayName: 'Test User' }
      renderHeader({ auth: { user } })

      const playButton = screen.getByText('Play')
      fireEvent.mouseEnter(playButton.parentElement!)

      fireEvent.click(screen.getByText('Play Hand and Brain'))
      expect(mockSetPlaySetupModalProps).toHaveBeenCalledWith({
        playType: 'handAndBrain',
      })
    })

    it('should show user dropdown on hover', () => {
      const user = { lichessId: 'testuser', displayName: 'Test User' }
      renderHeader({ auth: { user } })

      expect(screen.getByText('Profile')).toBeInTheDocument()
      expect(screen.getByText('Logout')).toBeInTheDocument()
    })

    it('should call logout when logout clicked', () => {
      const user = { lichessId: 'testuser', displayName: 'Test User' }
      renderHeader({ auth: { user } })

      fireEvent.click(screen.getByText('Logout'))
      expect(mockLogout).toHaveBeenCalledTimes(1)
    })

    it('should render More dropdown with external links', () => {
      renderHeader()

      expect(screen.getByText('More')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute(
        'href',
        '/blog',
      )
      expect(screen.getByRole('link', { name: 'Watch' })).toHaveAttribute(
        'href',
        'https://twitch.tv/maiachess',
      )
      expect(screen.getByRole('link', { name: 'Feedback' })).toHaveAttribute(
        'href',
        'https://forms.gle/XYeoTJF4YgUu4Vq28',
      )
    })

    it('should render Discord icon link', () => {
      renderHeader()

      const discordLink = screen.getByTestId('discord-icon').closest('a')
      expect(discordLink).toHaveAttribute(
        'href',
        'https://discord.gg/Az93GqEAs7',
      )
    })
  })

  describe('Mobile Layout', () => {
    it('should render mobile layout when mobile', () => {
      renderHeader({ windowSize: { isMobile: true } })

      expect(screen.getByText('Maia Chess')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /menu/ })).toBeInTheDocument()
    })

    it('should show mobile menu when menu button clicked', () => {
      renderHeader({ windowSize: { isMobile: true } })

      const menuButton = screen.getByRole('button', { name: /menu/ })
      fireEvent.click(menuButton)

      expect(screen.getByText('Analysis')).toBeInTheDocument()
      expect(screen.getByText('Puzzles')).toBeInTheDocument()
    })

    it('should hide mobile menu when close button clicked', () => {
      renderHeader({ windowSize: { isMobile: true } })

      // Open menu
      const menuButton = screen.getByRole('button', { name: /menu/ })
      fireEvent.click(menuButton)

      // Close menu
      const closeButton = screen.getAllByRole('button', { name: /menu/ })[1] // Second menu button is close
      fireEvent.click(closeButton)

      // Check that overflow is reset
      expect(document.body.style.overflow).toBe('unset')
    })

    it('should set body overflow when menu is open', () => {
      renderHeader({ windowSize: { isMobile: true } })

      const menuButton = screen.getByRole('button', { name: /menu/ })
      fireEvent.click(menuButton)

      expect(document.body.style.overflow).toBe('hidden')
    })

    it('should render mobile play options for authenticated users', () => {
      const user = { lichessId: 'testuser', displayName: 'Test User' }
      renderHeader({ windowSize: { isMobile: true }, auth: { user } })

      const menuButton = screen.getByRole('button', { name: /menu/ })
      fireEvent.click(menuButton)

      // In mobile menu, check for the specific play options that should be available
      expect(screen.getByText('Play Maia')).toBeInTheDocument()
      expect(screen.getByText('Play Hand and Brain')).toBeInTheDocument()
    })

    it('should start games from mobile menu', () => {
      const user = { lichessId: 'testuser', displayName: 'Test User' }
      renderHeader({ windowSize: { isMobile: true }, auth: { user } })

      const menuButton = screen.getByRole('button', { name: /menu/ })
      fireEvent.click(menuButton)

      fireEvent.click(screen.getByText('Play Maia'))
      expect(mockSetPlaySetupModalProps).toHaveBeenCalledWith({
        playType: 'againstMaia',
      })
    })
  })

  describe('Router Events', () => {
    it('should register router event listener', () => {
      renderHeader()

      expect(mockRouter.events.on).toHaveBeenCalledWith(
        'routeChangeStart',
        expect.any(Function),
      )
    })

    it('should unregister router event listener on unmount', () => {
      const { unmount } = renderHeader()

      unmount()

      expect(mockRouter.events.off).toHaveBeenCalledWith(
        'routeChangeStart',
        expect.any(Function),
      )
    })

    it('should close mobile menu on route change', () => {
      renderHeader({ windowSize: { isMobile: true } })

      // Open menu
      const menuButton = screen.getByRole('button', { name: /menu/ })
      fireEvent.click(menuButton)

      // Simulate route change
      const routeChangeHandler = mockRouter.events.on.mock.calls[0][1]
      act(() => {
        routeChangeHandler()
      })

      expect(document.body.style.overflow).toBe('unset')
    })
  })

  describe('Effect Cleanup', () => {
    it('should clear play setup modal on unmount', () => {
      const { unmount } = renderHeader()

      unmount()

      expect(mockSetPlaySetupModalProps).toHaveBeenCalledWith(undefined)
    })

    it('should reset body overflow on unmount', () => {
      const { unmount } = renderHeader({ windowSize: { isMobile: true } })

      // Open menu
      const menuButton = screen.getByRole('button', { name: /menu/ })
      fireEvent.click(menuButton)

      unmount()

      expect(document.body.style.overflow).toBe('unset')
    })
  })

  describe('Blur Handling', () => {
    it('should blur active element when starting game', () => {
      const user = { lichessId: 'testuser', displayName: 'Test User' }
      const mockBlur = jest.fn()

      // Mock document.activeElement
      const mockElement = document.createElement('div')
      mockElement.blur = mockBlur
      Object.defineProperty(document, 'activeElement', {
        value: mockElement,
        writable: true,
      })

      renderHeader({ auth: { user } })

      const playButton = screen.getByText('Play')
      fireEvent.mouseEnter(playButton.parentElement!)
      fireEvent.click(screen.getByText('Play Maia'))

      expect(mockBlur).toHaveBeenCalledTimes(1)
    })
  })
})
