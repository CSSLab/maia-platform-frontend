import { render, screen, fireEvent } from '@testing-library/react'
import { ContinueAgainstMaia } from '../../src/components/Common/ContinueAgainstMaia'

// Mock analytics
jest.mock('../../src/lib/analytics', () => ({
  trackContinueAgainstMaiaClicked: jest.fn(),
}))

describe('ContinueAgainstMaia', () => {
  const mockLaunchContinue = jest.fn()
  const { trackContinueAgainstMaiaClicked } = jest.requireMock(
    '../../src/lib/analytics',
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render button with correct text and icon', () => {
    render(<ContinueAgainstMaia launchContinue={mockLaunchContinue} />)

    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('Play position against Maia')).toBeInTheDocument()
    expect(screen.getByText('swords')).toBeInTheDocument()
  })

  it('should call launchContinue when clicked', () => {
    render(<ContinueAgainstMaia launchContinue={mockLaunchContinue} />)

    fireEvent.click(screen.getByRole('button'))
    expect(mockLaunchContinue).toHaveBeenCalledTimes(1)
  })

  it('should track analytics with default values when clicked', () => {
    render(<ContinueAgainstMaia launchContinue={mockLaunchContinue} />)

    fireEvent.click(screen.getByRole('button'))
    expect(trackContinueAgainstMaiaClicked).toHaveBeenCalledWith('puzzles', '')
  })

  it('should track analytics with custom sourcePage', () => {
    render(
      <ContinueAgainstMaia
        launchContinue={mockLaunchContinue}
        sourcePage="openings"
      />,
    )

    fireEvent.click(screen.getByRole('button'))
    expect(trackContinueAgainstMaiaClicked).toHaveBeenCalledWith('openings', '')
  })

  it('should track analytics with custom currentFen', () => {
    const customFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    render(
      <ContinueAgainstMaia
        launchContinue={mockLaunchContinue}
        currentFen={customFen}
      />,
    )

    fireEvent.click(screen.getByRole('button'))
    expect(trackContinueAgainstMaiaClicked).toHaveBeenCalledWith(
      'puzzles',
      customFen,
    )
  })

  it('should use default background styling when no background prop provided', () => {
    render(<ContinueAgainstMaia launchContinue={mockLaunchContinue} />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-human-4', 'hover:bg-human-3')
  })

  it('should use custom background styling when background prop provided', () => {
    render(
      <ContinueAgainstMaia
        launchContinue={mockLaunchContinue}
        background="bg-custom-color"
      />,
    )

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-custom-color')
    expect(button).not.toHaveClass('bg-human-4', 'hover:bg-human-3')
  })

  it('should have correct button structure and styling', () => {
    render(<ContinueAgainstMaia launchContinue={mockLaunchContinue} />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass(
      'flex',
      'w-full',
      'items-center',
      'gap-1.5',
      'rounded',
      'px-3',
      'py-2',
      'transition',
      'duration-200',
    )
  })

  it('should call both analytics and launchContinue when clicked', () => {
    const mockLaunchContinueLocal = jest.fn()
    render(<ContinueAgainstMaia launchContinue={mockLaunchContinueLocal} />)

    fireEvent.click(screen.getByRole('button'))

    expect(trackContinueAgainstMaiaClicked).toHaveBeenCalledTimes(1)
    expect(mockLaunchContinueLocal).toHaveBeenCalledTimes(1)
  })
})
