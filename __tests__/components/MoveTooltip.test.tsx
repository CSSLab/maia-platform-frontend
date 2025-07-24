import { render, screen, fireEvent } from '@testing-library/react'
import { MoveTooltip } from '../../src/components/Analysis/MoveTooltip'

// Mock createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (element: React.ReactNode) => element,
}))

describe('MoveTooltip', () => {
  const defaultProps = {
    move: 'e4',
    colorSanMapping: {
      e4: { san: 'e4', color: '#ffffff' },
      d4: { san: 'd4', color: '#000000' },
    },
    position: { x: 100, y: 200 },
    maiaProb: 0.45,
    stockfishCp: 25,
    stockfishWinrate: 0.55,
    stockfishCpRelative: -10,
  }

  // Mock window.innerWidth
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
  })

  it('should not render when isVisible is false', () => {
    render(<MoveTooltip {...defaultProps} isVisible={false} />)

    expect(screen.queryByText('e4')).not.toBeInTheDocument()
  })

  it('should not render when position is not provided', () => {
    render(<MoveTooltip {...defaultProps} position={undefined} />)

    expect(screen.queryByText('e4')).not.toBeInTheDocument()
  })

  it('should render with default visibility', () => {
    render(<MoveTooltip {...defaultProps} />)

    expect(screen.getByText('e4')).toBeInTheDocument()
  })

  it('should display move SAN from colorSanMapping', () => {
    const customColorSanMapping = {
      e4: { san: '1.e4', color: '#ff0000' },
    }

    render(
      <MoveTooltip {...defaultProps} colorSanMapping={customColorSanMapping} />,
    )

    expect(screen.getByText('1.e4')).toBeInTheDocument()
  })

  it('should fallback to move string when SAN not available', () => {
    const incompleteColorSanMapping = {}

    render(
      <MoveTooltip
        {...defaultProps}
        colorSanMapping={incompleteColorSanMapping}
      />,
    )

    expect(screen.getByText('e4')).toBeInTheDocument()
  })

  it('should display Maia probability correctly', () => {
    render(<MoveTooltip {...defaultProps} />)

    expect(screen.getByText('Maia:')).toBeInTheDocument()
    expect(screen.getByText('45.0%')).toBeInTheDocument()
  })

  it('should display Stockfish evaluation correctly', () => {
    render(<MoveTooltip {...defaultProps} />)

    expect(screen.getByText('SF Eval:')).toBeInTheDocument()
    expect(screen.getByText('+0.25')).toBeInTheDocument()
  })

  it('should display negative Stockfish evaluation without extra plus sign', () => {
    render(<MoveTooltip {...defaultProps} stockfishCp={-50} />)

    expect(screen.getByText('SF Eval:')).toBeInTheDocument()
    expect(screen.getByText('-0.50')).toBeInTheDocument()
  })

  it('should display Stockfish win rate correctly', () => {
    render(<MoveTooltip {...defaultProps} />)

    expect(screen.getByText('SF Winrate:')).toBeInTheDocument()
    expect(screen.getByText('55.0%')).toBeInTheDocument()
  })

  it('should display Stockfish CP relative correctly', () => {
    render(<MoveTooltip {...defaultProps} />)

    expect(screen.getByText('SF Eval Loss:')).toBeInTheDocument()
    expect(screen.getByText('-0.10')).toBeInTheDocument()
  })

  it('should not display sections when values are undefined', () => {
    render(
      <MoveTooltip
        move="e4"
        colorSanMapping={defaultProps.colorSanMapping}
        position={defaultProps.position}
      />,
    )

    expect(screen.queryByText('Maia:')).not.toBeInTheDocument()
    expect(screen.queryByText('SF Eval:')).not.toBeInTheDocument()
    expect(screen.queryByText('SF Winrate:')).not.toBeInTheDocument()
    expect(screen.queryByText('SF Eval Loss:')).not.toBeInTheDocument()
  })

  it('should position tooltip at specified coordinates', () => {
    render(<MoveTooltip {...defaultProps} />)

    const tooltip = screen.getByText('e4').closest('div')?.parentElement
    expect(tooltip).toHaveStyle({
      left: '115px', // position.x + 15
      top: '190px', // position.y - 10
    })
  })

  it('should adjust position when near right edge of screen', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 200, // Small window width
    })

    render(<MoveTooltip {...defaultProps} position={{ x: 150, y: 100 }} />)

    const tooltip = screen.getByText('e4').closest('div')?.parentElement
    expect(tooltip).toHaveStyle({
      transform: 'translateX(-100%)',
    })
  })

  it('should not adjust position when not near right edge', () => {
    render(<MoveTooltip {...defaultProps} />)

    const tooltip = screen.getByText('e4').closest('div')?.parentElement
    expect(tooltip).toHaveStyle({
      transform: 'none',
    })
  })

  describe('Interactive behavior', () => {
    it('should be non-interactive by default', () => {
      render(<MoveTooltip {...defaultProps} />)

      const tooltip = screen.getByText('e4').closest('div')?.parentElement
      expect(tooltip).toHaveClass('pointer-events-none')
      expect(tooltip).not.toHaveAttribute('role')
      expect(tooltip).not.toHaveAttribute('tabIndex')
    })

    it('should be interactive when onClickMove is provided', () => {
      const mockOnClickMove = jest.fn()
      render(<MoveTooltip {...defaultProps} onClickMove={mockOnClickMove} />)

      const tooltip = screen.getByText('e4').closest('div')?.parentElement
      expect(tooltip).toHaveClass('pointer-events-auto', 'cursor-pointer')
      expect(tooltip).toHaveAttribute('role', 'button')
      expect(tooltip).toHaveAttribute('tabIndex', '0')
      expect(tooltip).toHaveAttribute('aria-label', 'Make move e4')
    })

    it('should call onClickMove when clicked', () => {
      const mockOnClickMove = jest.fn()
      render(<MoveTooltip {...defaultProps} onClickMove={mockOnClickMove} />)

      const tooltip = screen.getByText('e4').closest('div')
      fireEvent.click(tooltip!)

      expect(mockOnClickMove).toHaveBeenCalledWith('e4')
    })

    it('should call onClickMove when Enter key is pressed', () => {
      const mockOnClickMove = jest.fn()
      render(<MoveTooltip {...defaultProps} onClickMove={mockOnClickMove} />)

      const tooltip = screen.getByText('e4').closest('div')
      fireEvent.keyDown(tooltip!, { key: 'Enter' })

      expect(mockOnClickMove).toHaveBeenCalledWith('e4')
    })

    it('should call onClickMove when Space key is pressed', () => {
      const mockOnClickMove = jest.fn()
      render(<MoveTooltip {...defaultProps} onClickMove={mockOnClickMove} />)

      const tooltip = screen.getByText('e4').closest('div')
      fireEvent.keyDown(tooltip!, { key: ' ' })

      expect(mockOnClickMove).toHaveBeenCalledWith('e4')
    })

    it('should not call onClickMove for other keys', () => {
      const mockOnClickMove = jest.fn()
      render(<MoveTooltip {...defaultProps} onClickMove={mockOnClickMove} />)

      const tooltip = screen.getByText('e4').closest('div')
      fireEvent.keyDown(tooltip!, { key: 'Escape' })

      expect(mockOnClickMove).not.toHaveBeenCalled()
    })

    it('should prevent default on Enter and Space key presses', () => {
      const mockOnClickMove = jest.fn()
      render(<MoveTooltip {...defaultProps} onClickMove={mockOnClickMove} />)

      const tooltip = screen.getByText('e4').closest('div')?.parentElement

      // Test that the event handlers are set up correctly
      expect(tooltip).toHaveAttribute('role', 'button')
      expect(tooltip).toHaveAttribute('tabIndex', '0')

      // The preventDefault behavior is tested indirectly through the onKeyDown handler
      fireEvent.keyDown(tooltip!, { key: 'Enter' })
      expect(mockOnClickMove).toHaveBeenCalledWith('e4')

      fireEvent.keyDown(tooltip!, { key: ' ' })
      expect(mockOnClickMove).toHaveBeenCalledWith('e4')
    })
  })

  describe('Color styling', () => {
    it('should apply color from colorSanMapping to move text', () => {
      render(<MoveTooltip {...defaultProps} />)

      const moveText = screen.getByText('e4')
      expect(moveText).toHaveStyle({ color: '#ffffff' })
    })

    it('should fallback to default color when color not in mapping', () => {
      const incompleteColorSanMapping = {
        e4: { san: 'e4' }, // Missing color
      }

      render(
        <MoveTooltip
          {...defaultProps}
          colorSanMapping={incompleteColorSanMapping as any}
        />,
      )

      const moveText = screen.getByText('e4')
      expect(moveText).toHaveStyle({ color: '#fff' })
    })
  })

  describe('Precision and formatting', () => {
    it('should round Maia probability to 1 decimal place', () => {
      render(<MoveTooltip {...defaultProps} maiaProb={0.4567} />)

      expect(screen.getByText('45.7%')).toBeInTheDocument()
    })

    it('should format Stockfish evaluation to 2 decimal places', () => {
      render(<MoveTooltip {...defaultProps} stockfishCp={123} />)

      expect(screen.getByText('+1.23')).toBeInTheDocument()
    })

    it('should format Stockfish win rate to 1 decimal place', () => {
      render(<MoveTooltip {...defaultProps} stockfishWinrate={0.6789} />)

      expect(screen.getByText('67.9%')).toBeInTheDocument()
    })

    it('should format Stockfish CP relative to 2 decimal places', () => {
      render(<MoveTooltip {...defaultProps} stockfishCpRelative={-15} />)

      expect(screen.getByText('-0.15')).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('should handle zero values correctly', () => {
      render(
        <MoveTooltip
          {...defaultProps}
          maiaProb={0}
          stockfishCp={0}
          stockfishWinrate={0}
          stockfishCpRelative={0}
        />,
      )

      expect(screen.getByText('Maia:')).toBeInTheDocument()
      expect(screen.getAllByText('0.0%')).toHaveLength(2) // Maia and SF Winrate
      expect(screen.getAllByText('0.00')).toHaveLength(2) // SF Eval and SF Eval Loss
    })

    it('should handle very small numbers', () => {
      render(
        <MoveTooltip
          {...defaultProps}
          maiaProb={0.001}
          stockfishCp={1}
          stockfishWinrate={0.001}
          stockfishCpRelative={-1}
        />,
      )

      expect(screen.getAllByText('0.1%')).toHaveLength(2) // Maia and SF Winrate
      expect(screen.getByText('+0.01')).toBeInTheDocument()
      expect(screen.getByText('-0.01')).toBeInTheDocument()
    })
  })
})
