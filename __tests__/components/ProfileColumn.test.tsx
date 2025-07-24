import { render, screen } from '@testing-library/react'
import { ProfileColumn } from '../../src/components/Profile/ProfileColumn'

// Mock icon for testing
const MockIcon = () => <div data-testid="mock-icon">🏆</div>

describe('ProfileColumn Component', () => {
  const defaultProps = {
    icon: <MockIcon />,
    name: 'Blitz',
    data: {
      rating: 1500,
      highest: 1650,
      hours: 120,
      games: 100,
      wins: 60,
      draws: 10,
      losses: 30,
    },
  }

  it('should render profile column with basic information', () => {
    render(<ProfileColumn {...defaultProps} />)

    expect(screen.getByTestId('mock-icon')).toBeInTheDocument()
    expect(screen.getByText('Blitz')).toBeInTheDocument()
    expect(screen.getByText('1500')).toBeInTheDocument()
    expect(screen.getByText('1650')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('should display win/draw/loss statistics with percentages', () => {
    render(<ProfileColumn {...defaultProps} />)

    expect(screen.getByText(/Wins: 60/)).toBeInTheDocument()
    expect(screen.getByText(/60%/)).toBeInTheDocument()
    expect(screen.getByText(/Draws: 10/)).toBeInTheDocument()
    expect(screen.getByText(/10%/)).toBeInTheDocument()
    expect(screen.getByText(/Losses: 30/)).toBeInTheDocument()
    expect(screen.getByText(/30%/)).toBeInTheDocument()
  })

  it('should calculate losses correctly when not provided', () => {
    const propsWithoutLosses = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        losses: undefined,
      },
    }
    render(<ProfileColumn {...propsWithoutLosses} />)

    // Should calculate losses as games - wins - draws = 100 - 60 - 10 = 30
    expect(screen.getByText(/Losses: 30/)).toBeInTheDocument()
  })

  it('should handle zero draws gracefully', () => {
    const propsWithoutDraws = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        draws: 0,
        losses: 40,
      },
    }
    render(<ProfileColumn {...propsWithoutDraws} />)

    expect(screen.queryByText(/Draws:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Wins: 60/)).toBeInTheDocument()
    expect(screen.getByText(/Losses: 40/)).toBeInTheDocument() // 100 - 60 - 0 = 40
  })

  it('should handle undefined draws', () => {
    const propsWithUndefinedDraws = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        draws: undefined,
        losses: 40,
      },
    }
    render(<ProfileColumn {...propsWithUndefinedDraws} />)

    expect(screen.queryByText(/Draws:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Losses: 40/)).toBeInTheDocument() // 100 - 60 - 0 = 40
  })

  it('should render progress bars with correct widths', () => {
    const { container } = render(<ProfileColumn {...defaultProps} />)

    const winsBar = container.querySelector(
      '.bg-green-500\\/70[style*="width"]',
    )
    const drawsBar = container.querySelector(
      '.bg-yellow-500\\/70[style*="width"]',
    )
    const lossesBar = container.querySelector(
      '.bg-red-500\\/70[style*="width"]',
    )

    expect(winsBar).toHaveStyle({ width: '60%' })
    expect(drawsBar).toHaveStyle({ width: '10%' })
    expect(lossesBar).toHaveStyle({ width: '30%' })
  })

  it('should not render wins bar when wins is 0', () => {
    const propsWithNoWins = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        wins: 0,
        losses: 100,
      },
    }
    const { container } = render(<ProfileColumn {...propsWithNoWins} />)

    const winsBar = container.querySelector(
      '.bg-green-500\\/70[style*="width"]',
    )
    expect(winsBar).not.toBeInTheDocument()
  })

  it('should not render draws bar when draws is 0', () => {
    const propsWithNoDraws = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        draws: 0,
      },
    }
    const { container } = render(<ProfileColumn {...propsWithNoDraws} />)

    const drawsBar = container.querySelector(
      '.bg-yellow-500\\/70[style*="width"]',
    )
    expect(drawsBar).not.toBeInTheDocument()
  })

  it('should not render losses bar when losses is 0', () => {
    const propsWithNoLosses = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        wins: 100,
        draws: 0,
        losses: 0,
      },
    }
    const { container } = render(<ProfileColumn {...propsWithNoLosses} />)

    const lossesProgressBar = container.querySelector(
      '.bg-red-500\\/70[style*="width"]',
    )
    expect(lossesProgressBar).not.toBeInTheDocument()
  })

  it('should handle edge case with zero games', () => {
    const propsWithZeroGames = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      },
    }
    render(<ProfileColumn {...propsWithZeroGames} />)

    expect(screen.getByText('0')).toBeInTheDocument() // games count
    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName === 'P' && element?.textContent === 'Wins: 0 (0%)'
        )
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName === 'P' && element?.textContent === 'Losses: 0 (0%)'
        )
      }),
    ).toBeInTheDocument()
  })

  it('should round percentages correctly', () => {
    const propsWithOddNumbers = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        games: 7,
        wins: 3, // 3/7 = 42.857... should round to 43%
        draws: 1, // 1/7 = 14.285... should round to 14%
        losses: 3, // 3/7 = 42.857... should round to 43%
      },
    }
    render(<ProfileColumn {...propsWithOddNumbers} />)

    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName === 'P' && element?.textContent === 'Wins: 3 (43%)'
        )
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName === 'P' && element?.textContent === 'Draws: 1 (14%)'
        )
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName === 'P' && element?.textContent === 'Losses: 3 (43%)'
        )
      }),
    ).toBeInTheDocument()
  })

  it('should apply correct CSS classes to main container', () => {
    const { container } = render(<ProfileColumn {...defaultProps} />)

    const mainContainer = container.firstElementChild
    expect(mainContainer).toHaveClass(
      'flex',
      'w-full',
      'flex-col',
      'overflow-hidden',
      'rounded',
      'border',
      'border-white',
      'border-opacity-10',
    )
  })

  it('should apply correct CSS classes to header section', () => {
    const { container } = render(<ProfileColumn {...defaultProps} />)

    const header = container.querySelector('.bg-background-1')
    expect(header).toHaveClass(
      'flex',
      'flex-row',
      'items-center',
      'justify-start',
      'gap-3',
      'bg-background-1',
      'px-4',
      'py-3',
    )
  })

  it('should apply correct CSS classes to icon container', () => {
    const { container } = render(<ProfileColumn {...defaultProps} />)

    const iconContainer = container.querySelector('.h-\\[20px\\].w-\\[20px\\]')
    expect(iconContainer).toHaveClass(
      'h-[20px]',
      'w-[20px]',
      'md:h-[24px]',
      'md:w-[24px]',
    )
  })

  it('should apply correct CSS classes to name text', () => {
    render(<ProfileColumn {...defaultProps} />)

    const nameElement = screen.getByText('Blitz')
    expect(nameElement).toHaveClass('text-xl', 'font-bold', 'md:text-2xl')
  })

  it('should apply correct styles to rating value', () => {
    render(<ProfileColumn {...defaultProps} />)

    const ratingElement = screen.getByText('1500')
    expect(ratingElement).toHaveClass('text-xl', 'xl:text-2xl')
    expect(ratingElement.closest('div')).toHaveClass('text-human-1')
  })

  it('should handle very high numbers correctly', () => {
    const propsWithHighNumbers = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        rating: 2800,
        highest: 3000,
        games: 99999,
        wins: 60000,
      },
    }
    render(<ProfileColumn {...propsWithHighNumbers} />)

    expect(screen.getByText('2800')).toBeInTheDocument()
    expect(screen.getByText('3000')).toBeInTheDocument()
    expect(screen.getByText('99999')).toBeInTheDocument()
    expect(screen.getByText(/Wins: 60000/)).toBeInTheDocument()
  })
})
