import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Highlight } from '../../src/components/Analysis/Highlight'

// Mock dependencies
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

jest.mock('../../src/components/Analysis/MoveTooltip', () => ({
  MoveTooltip: ({ move, onClickMove }: any) => (
    <div
      data-testid="move-tooltip"
      onClick={() => onClickMove?.(move)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClickMove?.(move)
        }
      }}
      role="button"
      tabIndex={0}
    >
      Tooltip for {move}
    </div>
  ),
}))

jest.mock('../../src/components/Analysis/InteractiveDescription', () => ({
  InteractiveDescription: () => <div data-testid="interactive-description" />,
}))

jest.mock('../../src/contexts', () => {
  return {
    WindowSizeContext: React.createContext({
      windowSize: { width: 1024, height: 768 },
      isMobile: false,
    }),
  }
})

describe('Highlight Component', () => {
  const mockProps = {
    currentMaiaModel: 'maia_kdd_1500',
    setCurrentMaiaModel: jest.fn(),
    moveEvaluation: {
      maia: {
        value: 0.65,
      },
      stockfish: {
        model_optimal_cp: 50,
        depth: 20,
        cp_relative_vec: {
          e2e4: 0,
          d2d4: -25,
        },
      },
    },
    colorSanMapping: {
      e2e4: { san: 'e4', color: '#ff6b6b' },
      d2d4: { san: 'd4', color: '#4ecdc4' },
      g1f3: { san: 'Nf3', color: '#45b7d1' },
    },
    recommendations: {
      maia: [
        { move: 'e2e4', prob: 0.45 },
        { move: 'd2d4', prob: 0.35 },
        { move: 'g1f3', prob: 0.15 },
      ],
      stockfish: [
        { move: 'e2e4', cp: 50, winrate: 0.55, cp_relative: 0 },
        { move: 'd2d4', cp: 25, winrate: 0.52, cp_relative: -25 },
        { move: 'g1f3', cp: 15, winrate: 0.51, cp_relative: -35 },
      ],
      isBlackTurn: false,
    },
    hover: jest.fn(),
    makeMove: jest.fn(),
    boardDescription: {
      segments: [
        { type: 'text', content: 'This is a good move because ' },
        { type: 'move', san: 'e4', uci: 'e2e4' },
        { type: 'text', content: ' controls the center.' },
      ],
    },
    currentNode: {
      moveNumber: 1,
      turn: 'w',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render both Maia and Stockfish sections', () => {
    render(<Highlight {...mockProps} />)

    expect(screen.getByText('Maia 1500')).toBeInTheDocument()
    expect(screen.getByText('Stockfish 17')).toBeInTheDocument()
  })

  it('should display white win percentage from Maia evaluation', () => {
    render(<Highlight {...mockProps} />)

    expect(screen.getByText('White Win %')).toBeInTheDocument()
    expect(screen.getByText('59.2%')).toBeInTheDocument() // Stockfish win rate for first 10 ply
  })

  it('should display Stockfish evaluation', () => {
    render(<Highlight {...mockProps} />)

    expect(screen.getByText('SF Eval (d20)')).toBeInTheDocument()
    expect(screen.getByText('+0.50')).toBeInTheDocument()
  })

  it('should render Maia model selector when not on home page', () => {
    render(<Highlight {...mockProps} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(select.tagName).toBe('SELECT')
    expect(select).toHaveValue('maia_kdd_1500')
  })

  it('should render static Maia model label on home page', () => {
    render(<Highlight {...mockProps} isHomePage={true} />)

    expect(screen.getByText('Maia 1500')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('maia_kdd_1500')).not.toBeInTheDocument()
  })

  it('should call setCurrentMaiaModel when model is changed', () => {
    render(<Highlight {...mockProps} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'maia_kdd_1900' } })

    expect(mockProps.setCurrentMaiaModel).toHaveBeenCalledWith('maia_kdd_1900')
  })

  it('should display Maia move recommendations', () => {
    render(<Highlight {...mockProps} />)

    expect(screen.getByText('Human Moves')).toBeInTheDocument()

    // Check that moves appear (there may be duplicates between Maia and Stockfish sections)
    expect(screen.getAllByText('e4')).toHaveLength(2) // Both in Maia and Stockfish sections
    expect(screen.getAllByText('d4')).toHaveLength(2) // Both in Maia and Stockfish sections
    expect(screen.getAllByText('Nf3')).toHaveLength(2) // Both in Maia and Stockfish sections

    // Check probabilities (unique to Maia section)
    expect(screen.getByText('45.0%')).toBeInTheDocument()
    expect(screen.getByText('35.0%')).toBeInTheDocument()
    expect(screen.getByText('15.0%')).toBeInTheDocument()
  })

  it('should display Stockfish move recommendations', () => {
    render(<Highlight {...mockProps} />)

    expect(screen.getByText('Engine Moves')).toBeInTheDocument()
    expect(screen.getByText('+0.50')).toBeInTheDocument()
    expect(screen.getByText('+0.25')).toBeInTheDocument()
    expect(screen.getByText('+0.15')).toBeInTheDocument()
  })

  it('should call hover and makeMove on desktop click', () => {
    render(<Highlight {...mockProps} />)

    const maiaMove = screen.getAllByText('e4')[0]
    fireEvent.click(maiaMove)

    expect(mockProps.makeMove).toHaveBeenCalledWith('e2e4')
  })

  it('should show tooltip on hover for desktop', async () => {
    render(<Highlight {...mockProps} />)

    const maiaMove = screen.getAllByText('e4')[0]
    fireEvent.mouseEnter(maiaMove, { clientX: 100, clientY: 200 })

    expect(mockProps.hover).toHaveBeenCalledWith('e2e4')
  })

  it('should hide tooltip on mouse leave', () => {
    render(<Highlight {...mockProps} />)

    const maiaMove = screen.getAllByText('e4')[0]
    fireEvent.mouseEnter(maiaMove, { clientX: 100, clientY: 200 })
    fireEvent.mouseLeave(maiaMove)

    expect(mockProps.hover).toHaveBeenCalledWith()
  })

  it('should render interactive description when segments exist', () => {
    render(<Highlight {...mockProps} />)

    expect(screen.getByTestId('interactive-description')).toBeInTheDocument()
  })

  it('should not render interactive description when no segments', () => {
    const propsWithoutDescription = {
      ...mockProps,
      boardDescription: { segments: [] },
    }
    render(<Highlight {...propsWithoutDescription} />)

    expect(
      screen.queryByTestId('interactive-description'),
    ).not.toBeInTheDocument()
  })

  it('should handle missing move evaluations gracefully', () => {
    const propsWithoutEvaluation = {
      ...mockProps,
      moveEvaluation: {},
    }
    render(<Highlight {...propsWithoutEvaluation} />)

    // Should show ... for White Win % when no evaluation data
    expect(screen.getAllByText('...')).toHaveLength(2) // White Win % and SF Eval sections
  })

  it('should display correct move colors from colorSanMapping', () => {
    render(<Highlight {...mockProps} />)

    const maiaMove = screen.getAllByText('e4')[0]
    expect(maiaMove.closest('button')).toHaveStyle({ color: '#ff6b6b' })
  })

  it('should handle moves without color mapping', () => {
    const propsWithMissingColors = {
      ...mockProps,
      colorSanMapping: {},
      recommendations: {
        ...mockProps.recommendations,
        maia: [{ move: 'a2a3', prob: 0.1 }],
      },
    }
    render(<Highlight {...propsWithMissingColors} />)

    const move = screen.getByText('a2a3')
    expect(move.closest('button')).toHaveStyle({ color: '#fff' })
  })

  it('should use Stockfish win rate for first 10 ply', () => {
    const firstPlyProps = {
      ...mockProps,
      currentNode: {
        moveNumber: 1,
        turn: 'w',
      },
    }
    render(<Highlight {...firstPlyProps} />)

    // Should use Stockfish cp converted to winrate instead of Maia value
    expect(screen.getByText('59.2%')).toBeInTheDocument()
  })

  it('should limit Maia recommendations to 4 moves', () => {
    const propsWithManyMoves = {
      ...mockProps,
      recommendations: {
        ...mockProps.recommendations,
        maia: [
          { move: 'e2e4', prob: 0.3 },
          { move: 'd2d4', prob: 0.25 },
          { move: 'g1f3', prob: 0.2 },
          { move: 'c2c4', prob: 0.15 },
          { move: 'b1c3', prob: 0.1 },
          { move: 'a2a3', prob: 0.05 },
        ],
      },
    }
    render(<Highlight {...propsWithManyMoves} />)

    // Should only show first 4 moves
    expect(screen.getByText('30.0%')).toBeInTheDocument()
    expect(screen.getByText('25.0%')).toBeInTheDocument()
    expect(screen.getByText('20.0%')).toBeInTheDocument()
    expect(screen.getByText('15.0%')).toBeInTheDocument()
    expect(screen.queryByText('10.0%')).not.toBeInTheDocument()
  })

  it('should limit Stockfish recommendations to 4 moves', () => {
    const propsWithManyMoves = {
      ...mockProps,
      recommendations: {
        ...mockProps.recommendations,
        stockfish: [
          { move: 'e2e4', cp: 50, winrate: 0.55, cp_relative: 0 },
          { move: 'd2d4', cp: 40, winrate: 0.54, cp_relative: -10 },
          { move: 'g1f3', cp: 30, winrate: 0.53, cp_relative: -20 },
          { move: 'c2c4', cp: 20, winrate: 0.52, cp_relative: -30 },
          { move: 'b1c3', cp: 10, winrate: 0.51, cp_relative: -40 },
        ],
      },
    }
    render(<Highlight {...propsWithManyMoves} />)

    // Should only show first 4 moves
    expect(screen.getByText('+0.50')).toBeInTheDocument()
    expect(screen.getByText('+0.40')).toBeInTheDocument()
    expect(screen.getByText('+0.30')).toBeInTheDocument()
    expect(screen.getByText('+0.20')).toBeInTheDocument()
    expect(screen.queryByText('+0.10')).not.toBeInTheDocument()
  })

  it('should handle negative centipawn evaluations', () => {
    const propsWithNegativeEval = {
      ...mockProps,
      moveEvaluation: {
        ...mockProps.moveEvaluation,
        stockfish: {
          model_optimal_cp: -75,
          depth: 20,
        },
      },
      recommendations: {
        ...mockProps.recommendations,
        stockfish: [{ move: 'e2e4', cp: -50, winrate: 0.45, cp_relative: 0 }],
      },
    }
    render(<Highlight {...propsWithNegativeEval} />)

    expect(screen.getByText('-0.75')).toBeInTheDocument()
    expect(screen.getByText('-0.50')).toBeInTheDocument()
  })
})
