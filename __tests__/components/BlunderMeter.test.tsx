import { render, screen, fireEvent } from '@testing-library/react'
import { BlunderMeter } from '../../src/components/Analysis/BlunderMeter'
import { WindowSizeContext } from '../../src/contexts'

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, animate }: any) => (
      <div className={className} style={animate}>
        {children}
      </div>
    ),
    p: ({ children, className }: any) => (
      <p className={className}>{children}</p>
    ),
  },
}))

// Mock MoveTooltip
jest.mock('../../src/components/Analysis/MoveTooltip', () => ({
  MoveTooltip: ({ move, position, onClickMove }: any) => (
    <div data-testid="move-tooltip">
      <span>Tooltip for {move}</span>
      {onClickMove && (
        <button onClick={() => onClickMove(move)} data-testid="tooltip-click">
          Click Move
        </button>
      )}
    </div>
  ),
}))

describe('BlunderMeter', () => {
  const mockData = {
    goodMoves: {
      moves: [
        { move: 'e4', probability: 45 },
        { move: 'd4', probability: 30 },
        { move: 'Nf3', probability: 15 },
      ],
      probability: 90,
    },
    okMoves: {
      moves: [
        { move: 'e3', probability: 8 },
        { move: 'c4', probability: 2 },
      ],
      probability: 10,
    },
    blunderMoves: {
      moves: [],
      probability: 0,
    },
  }

  const mockColorSanMapping = {
    e4: { san: 'e4', color: 'white' },
    d4: { san: 'd4', color: 'white' },
    Nf3: { san: 'Nf3', color: 'white' },
    e3: { san: 'e3', color: 'white' },
    c4: { san: 'c4', color: 'white' },
  }

  const mockMoveEvaluation = {
    maia: {
      policy: {
        e4: 0.45,
        d4: 0.3,
        Nf3: 0.15,
      },
    },
    stockfish: {
      cp_vec: {
        e4: 25,
        d4: 20,
        Nf3: 15,
      },
      winrate_vec: {
        e4: 0.55,
        d4: 0.52,
        Nf3: 0.51,
      },
      cp_relative_vec: {
        e4: 0,
        d4: -5,
        Nf3: -10,
      },
    },
  }

  const defaultProps = {
    data: mockData,
    colorSanMapping: mockColorSanMapping,
    hover: jest.fn(),
    makeMove: jest.fn(),
    moveEvaluation: mockMoveEvaluation,
  }

  const renderWithWindowSize = (isMobile = false, props = {}) => {
    const windowSizeContext = {
      isMobile,
      windowSize: {
        width: isMobile ? 375 : 1024,
        height: isMobile ? 667 : 768,
      },
    }

    return render(
      <WindowSizeContext.Provider value={windowSizeContext}>
        <BlunderMeter {...defaultProps} {...props} />
      </WindowSizeContext.Provider>,
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Desktop Layout', () => {
    it('should render desktop layout when not mobile', () => {
      renderWithWindowSize(false)

      expect(screen.getByText('Blunder Meter')).toBeInTheDocument()
      expect(screen.getByText('Best Moves')).toBeInTheDocument()
      expect(screen.getByText('OK Moves')).toBeInTheDocument()
      expect(screen.getByText('Blunders')).toBeInTheDocument()
    })

    it('should display move probabilities', () => {
      renderWithWindowSize(false)

      expect(screen.getByText('90%')).toBeInTheDocument() // Good moves
      expect(screen.getByText('10%')).toBeInTheDocument() // OK moves
      expect(screen.getByText('0%')).toBeInTheDocument() // Blunders
    })

    it('should display individual moves with percentages', () => {
      renderWithWindowSize(false)

      expect(screen.getByText('e4 (45%)')).toBeInTheDocument()
      expect(screen.getByText('d4 (30%)')).toBeInTheDocument()
      expect(screen.getByText('Nf3 (15%)')).toBeInTheDocument()
    })

    it('should call hover function on mouse enter', () => {
      const mockHover = jest.fn()
      renderWithWindowSize(false, { hover: mockHover })

      const moveButton = screen.getByText('e4 (45%)')
      fireEvent.mouseEnter(moveButton)

      expect(mockHover).toHaveBeenCalledWith('e4')
    })

    it('should call hover with no args on mouse leave', () => {
      const mockHover = jest.fn()
      renderWithWindowSize(false, { hover: mockHover })

      const moveButton = screen.getByText('e4 (45%)')
      fireEvent.mouseLeave(moveButton)

      expect(mockHover).toHaveBeenCalledWith()
    })

    it('should call makeMove on click in desktop', () => {
      const mockMakeMove = jest.fn()
      renderWithWindowSize(false, { makeMove: mockMakeMove })

      const moveButton = screen.getByText('e4 (45%)')
      fireEvent.click(moveButton)

      expect(mockMakeMove).toHaveBeenCalledWith('e4')
    })

    it('should show tooltip on hover with move evaluation', () => {
      renderWithWindowSize(false)

      const moveButton = screen.getByText('e4 (45%)')
      fireEvent.mouseEnter(moveButton, { clientX: 100, clientY: 200 })

      expect(screen.getByTestId('move-tooltip')).toBeInTheDocument()
      expect(screen.getByText('Tooltip for e4')).toBeInTheDocument()
    })

    it('should filter moves with probability >= 8%', () => {
      renderWithWindowSize(false)

      expect(screen.getByText('e3 (8%)')).toBeInTheDocument()
      expect(screen.queryByText('c4 (2%)')).not.toBeInTheDocument()
    })

    it('should hide container styling when showContainer is false', () => {
      renderWithWindowSize(false, { showContainer: false })

      const container = screen.getByText('Blunder Meter').closest('div')
      expect(container).not.toHaveClass('bg-background-1/60')
    })
  })

  describe('Mobile Layout', () => {
    it('should render mobile layout when mobile', () => {
      renderWithWindowSize(true)

      expect(screen.getByText('Blunder Meter')).toBeInTheDocument()
      // Mobile layout has move lists
      expect(screen.getByText('Best Moves')).toBeInTheDocument()
    })

    it('should show horizontal meters in mobile', () => {
      renderWithWindowSize(true)

      // Should have percentage displays in horizontal format
      expect(screen.getByText('90%')).toBeInTheDocument()
      expect(screen.getByText('10%')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('should require two clicks to make move in mobile', () => {
      const mockMakeMove = jest.fn()
      const mockHover = jest.fn()
      renderWithWindowSize(true, { makeMove: mockMakeMove, hover: mockHover })

      const moveButton = screen.getByText('e4 (45%)')

      // First click should show tooltip
      fireEvent.click(moveButton, { clientX: 100, clientY: 200 })
      expect(mockHover).toHaveBeenCalledWith('e4')
      expect(mockMakeMove).not.toHaveBeenCalled()

      // Second click should make move
      fireEvent.click(moveButton)
      expect(mockMakeMove).toHaveBeenCalledWith('e4')
    })

    it('should show tooltip with click button in mobile', () => {
      renderWithWindowSize(true)

      const moveButton = screen.getByText('e4 (45%)')
      fireEvent.click(moveButton, { clientX: 100, clientY: 200 })

      expect(screen.getByTestId('move-tooltip')).toBeInTheDocument()
      expect(screen.getByTestId('tooltip-click')).toBeInTheDocument()
    })

    it('should make move when tooltip is clicked in mobile', () => {
      const mockMakeMove = jest.fn()
      renderWithWindowSize(true, { makeMove: mockMakeMove })

      const moveButton = screen.getByText('e4 (45%)')
      fireEvent.click(moveButton, { clientX: 100, clientY: 200 })

      const tooltipClick = screen.getByTestId('tooltip-click')
      fireEvent.click(tooltipClick)

      expect(mockMakeMove).toHaveBeenCalledWith('e4')
    })

    it('should not show tooltips on hover in mobile', () => {
      renderWithWindowSize(true)

      const moveButton = screen.getByText('e4 (45%)')
      fireEvent.mouseEnter(moveButton, { clientX: 100, clientY: 200 })

      expect(screen.queryByTestId('move-tooltip')).not.toBeInTheDocument()
    })
  })

  describe('Move Filtering and Display', () => {
    it('should limit moves to first 6', () => {
      const dataWithManyMoves = {
        ...mockData,
        goodMoves: {
          moves: Array.from({ length: 10 }, (_, i) => ({
            move: `move${i}`,
            probability: 10 - i,
          })),
          probability: 90,
        },
      }

      renderWithWindowSize(false, { data: dataWithManyMoves })

      // Should only show first 6 moves with probability >= 8
      expect(screen.getByText('move0 (10%)')).toBeInTheDocument()
      expect(screen.getByText('move1 (9%)')).toBeInTheDocument()
      expect(screen.getByText('move2 (8%)')).toBeInTheDocument()
      expect(screen.queryByText('move3 (7%)')).not.toBeInTheDocument()
    })

    it('should use move SAN from colorSanMapping', () => {
      const customColorSanMapping = {
        ...mockColorSanMapping,
        e4: { san: '1.e4', color: 'white' },
      }

      renderWithWindowSize(false, { colorSanMapping: customColorSanMapping })

      expect(screen.getByText('1.e4 (45%)')).toBeInTheDocument()
    })

    it('should fallback to move string when SAN not available', () => {
      const incompleteColorSanMapping = {
        d4: { san: 'd4', color: 'white' },
        // e4 missing
      }

      renderWithWindowSize(false, {
        colorSanMapping: incompleteColorSanMapping,
      })

      expect(screen.getByText('e4 (45%)')).toBeInTheDocument() // Should use move string
    })
  })

  describe('Tooltip Behavior', () => {
    it('should clear tooltip when colorSanMapping changes', () => {
      const { rerender } = renderWithWindowSize(false)

      const moveButton = screen.getByText('e4 (45%)')
      fireEvent.mouseEnter(moveButton, { clientX: 100, clientY: 200 })

      expect(screen.getByTestId('move-tooltip')).toBeInTheDocument()

      // Change colorSanMapping
      rerender(
        <WindowSizeContext.Provider
          value={{ isMobile: false, windowSize: { width: 1024, height: 768 } }}
        >
          <BlunderMeter
            {...defaultProps}
            colorSanMapping={{
              ...mockColorSanMapping,
              newMove: { san: 'newMove', color: 'white' },
            }}
          />
        </WindowSizeContext.Provider>,
      )

      expect(screen.queryByTestId('move-tooltip')).not.toBeInTheDocument()
    })

    it('should not show tooltip without move evaluation', () => {
      renderWithWindowSize(false, { moveEvaluation: null })

      const moveButton = screen.getByText('e4 (45%)')
      fireEvent.mouseEnter(moveButton, { clientX: 100, clientY: 200 })

      expect(screen.queryByTestId('move-tooltip')).not.toBeInTheDocument()
    })
  })

  describe('Empty States', () => {
    it('should handle empty move arrays', () => {
      const emptyData = {
        goodMoves: { moves: [], probability: 0 },
        okMoves: { moves: [], probability: 0 },
        blunderMoves: { moves: [], probability: 0 },
      }

      renderWithWindowSize(false, { data: emptyData })

      expect(screen.getByText('Best Moves')).toBeInTheDocument()
      expect(screen.getAllByText('0%')).toHaveLength(3) // One for each category
    })

    it('should handle missing probability values', () => {
      const dataWithoutProbs = {
        goodMoves: {
          moves: [{ move: 'e4', probability: undefined }],
          probability: 50,
        },
        okMoves: { moves: [], probability: 50 },
        blunderMoves: { moves: [], probability: 0 },
      }

      renderWithWindowSize(false, { data: dataWithoutProbs })

      // Should handle undefined probability gracefully
      expect(screen.getByText('Blunder Meter')).toBeInTheDocument()
    })
  })
})
