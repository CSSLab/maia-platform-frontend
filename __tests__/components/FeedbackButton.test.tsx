import { render, screen } from '@testing-library/react'
import { FeedbackButton } from '../../src/components/Common/FeedbackButton'
import { AuthContext } from '../../src/contexts'

describe('FeedbackButton', () => {
  const renderWithAuthContext = (user: any) => {
    const mockAuthContext = {
      user,
      setUser: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
    }

    return render(
      <AuthContext.Provider value={mockAuthContext}>
        <FeedbackButton />
      </AuthContext.Provider>,
    )
  }

  it('should render button when user has lichessId', () => {
    const userWithLichessId = {
      lichessId: 'testuser123',
      username: 'TestUser',
    }

    renderWithAuthContext(userWithLichessId)

    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('feedback')).toBeInTheDocument()
  })

  it('should not render when user has no lichessId', () => {
    const userWithoutLichessId = {
      username: 'TestUser',
      // no lichessId
    }

    renderWithAuthContext(userWithoutLichessId)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should not render when user is null', () => {
    renderWithAuthContext(null)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should not render when user is undefined', () => {
    renderWithAuthContext(undefined)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should not render when lichessId is empty string', () => {
    const userWithEmptyLichessId = {
      lichessId: '',
      username: 'TestUser',
    }

    renderWithAuthContext(userWithEmptyLichessId)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should have correct button ID', () => {
    const userWithLichessId = {
      lichessId: 'testuser123',
    }

    renderWithAuthContext(userWithLichessId)

    expect(screen.getByRole('button')).toHaveAttribute('id', 'feedback-button')
  })

  it('should have correct styling classes', () => {
    const userWithLichessId = {
      lichessId: 'testuser123',
    }

    renderWithAuthContext(userWithLichessId)

    const button = screen.getByRole('button')
    expect(button).toHaveClass(
      'fixed',
      'bottom-6',
      'right-6',
      'z-10',
      'flex',
      'h-12',
      'w-12',
      'items-center',
      'justify-center',
      'rounded-full',
      'bg-human-4',
      'transition-all',
      'duration-200',
      'hover:scale-105',
      'hover:bg-human-3',
    )
  })

  it('should contain feedback icon with correct styling', () => {
    const userWithLichessId = {
      lichessId: 'testuser123',
    }

    renderWithAuthContext(userWithLichessId)

    const icon = screen.getByText('feedback')
    expect(icon).toHaveClass('material-symbols-outlined', 'text-white')
  })

  it('should render with complete user object', () => {
    const completeUser = {
      lichessId: 'user123',
      username: 'CompleteUser',
      email: 'user@example.com',
      avatar: 'avatar-url',
    }

    renderWithAuthContext(completeUser)

    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should handle truthy lichessId values', () => {
    const userWithNumericLichessId = {
      lichessId: '12345',
    }

    renderWithAuthContext(userWithNumericLichessId)

    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
