import { render, screen, fireEvent } from '@testing-library/react'
import toast from 'react-hot-toast'
import { ExportGame } from '../../src/components/Common/ExportGame'

// Mock dependencies
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
}))

jest.mock('../../src/hooks/useBaseTreeController', () => ({
  useBaseTreeController: jest.fn(),
}))

jest.mock('../../src/types', () => ({
  GameTree: jest.fn().mockImplementation((fen) => {
    const headers = new Map()
    return {
      setHeader: jest.fn((key, value) => {
        headers.set(key, value)
      }),
      getRoot: () => ({ fen }),
      toMoveArray: () => ['e4', 'e5'],
      toTimeArray: () => [1000, 1000],
      addMovesToMainLine: jest.fn(),
      toPGN: () => {
        const event = headers.get('Event') || 'Test Game'
        const site = headers.get('Site') || 'https://maiachess.com/'
        const white = headers.get('White') || 'Player1'
        const black = headers.get('Black') || 'Player2'
        return `[Event "${event}"]\n[Site "${site}"]\n[White "${white}"]\n[Black "${black}"]\n\n1. e4 e5 *`
      },
    }
  }),
  GameNode: jest.fn(),
}))

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
})

describe('ExportGame', () => {
  const mockController = {
    currentNode: {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    },
    gameTree: {
      getRoot: () => ({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      }),
      toMoveArray: () => ['e4', 'e5'],
      toTimeArray: () => [1000, 1000],
    },
  }

  const mockAnalyzedGame = {
    id: 'game-123',
    moves: ['e4', 'e5'],
    termination: {
      result: '1-0',
      condition: 'checkmate',
    },
    tree: mockController.gameTree,
  }

  const mockPlayedGame = {
    id: 'game-456',
    moves: ['e4', 'e5'],
    termination: {
      result: '0-1',
      condition: 'resignation',
    },
  }

  const mockCurrentNode = {
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
  }

  const { useBaseTreeController } = jest.requireMock(
    '../../src/hooks/useBaseTreeController',
  )

  beforeEach(() => {
    jest.clearAllMocks()
    useBaseTreeController.mockReturnValue(mockController)
    ;(navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined)
  })

  describe('Analysis type', () => {
    const analysisProps = {
      game: mockAnalyzedGame,
      whitePlayer: 'White Player',
      blackPlayer: 'Black Player',
      event: 'Test Tournament',
      type: 'analysis' as const,
      currentNode: mockCurrentNode,
    }

    it('should render FEN and PGN sections', () => {
      render(<ExportGame {...analysisProps} />)

      expect(screen.getByText('FEN')).toBeInTheDocument()
      expect(screen.getByText('PGN')).toBeInTheDocument()
    })

    it('should display current node FEN', () => {
      render(<ExportGame {...analysisProps} />)

      expect(screen.getByText(mockCurrentNode.fen)).toBeInTheDocument()
    })

    it('should display generated PGN', () => {
      render(<ExportGame {...analysisProps} />)

      expect(
        screen.getByText(/\[Event "Test Tournament"\]/),
      ).toBeInTheDocument()
      expect(screen.getByText(/\[White "White Player"\]/)).toBeInTheDocument()
    })

    it('should copy FEN to clipboard when FEN copy button clicked', async () => {
      render(<ExportGame {...analysisProps} />)

      const fenCopyButton = screen.getAllByRole('button')[0]
      fireEvent.click(fenCopyButton)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        mockCurrentNode.fen,
      )
      expect(toast.success).toHaveBeenCalledWith('Copied to clipboard')
    })

    it('should copy PGN to clipboard when PGN copy button clicked', async () => {
      render(<ExportGame {...analysisProps} />)

      const pgnCopyButton = screen.getAllByRole('button')[2]
      fireEvent.click(pgnCopyButton)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('[Event "Test Tournament"]'),
      )
      expect(toast.success).toHaveBeenCalledWith('Copied to clipboard')
    })

    it('should copy FEN when FEN container clicked', async () => {
      render(<ExportGame {...analysisProps} />)

      const fenContainer = screen.getAllByRole('button')[1]
      fireEvent.click(fenContainer)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        mockCurrentNode.fen,
      )
    })

    it('should copy PGN when PGN container clicked', async () => {
      render(<ExportGame {...analysisProps} />)

      const pgnContainer = screen.getAllByRole('button')[3]
      fireEvent.click(pgnContainer)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('[Event "Test Tournament"]'),
      )
    })
  })

  describe('Play type', () => {
    const playProps = {
      game: mockPlayedGame,
      gameTree: mockController.gameTree,
      whitePlayer: 'Player 1',
      blackPlayer: 'Maia',
      event: 'Casual Game',
      type: 'play' as const,
      currentNode: mockCurrentNode,
    }

    it('should use controller for play type', () => {
      render(<ExportGame {...playProps} />)

      expect(useBaseTreeController).toHaveBeenCalledWith('play')
      expect(screen.getByText('FEN')).toBeInTheDocument()
    })

    it('should not show toast for play type', async () => {
      render(<ExportGame {...playProps} />)

      const fenCopyButton = screen.getAllByRole('button')[0]
      fireEvent.click(fenCopyButton)

      expect(navigator.clipboard.writeText).toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  describe('Turing type', () => {
    const turingProps = {
      game: mockPlayedGame,
      whitePlayer: 'Human',
      blackPlayer: 'AI',
      event: 'Turing Test',
      type: 'turing' as const,
      currentNode: mockCurrentNode,
    }

    it('should use controller for turing type', () => {
      render(<ExportGame {...turingProps} />)

      expect(useBaseTreeController).toHaveBeenCalledWith('turing')
      expect(screen.getByText('FEN')).toBeInTheDocument()
    })

    it('should not show toast for turing type', async () => {
      render(<ExportGame {...turingProps} />)

      const fenCopyButton = screen.getAllByRole('button')[0]
      fireEvent.click(fenCopyButton)

      expect(navigator.clipboard.writeText).toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  it('should handle game without termination', () => {
    const gameWithoutTermination = {
      ...mockAnalyzedGame,
      termination: undefined,
    }
    const props = {
      game: gameWithoutTermination,
      whitePlayer: 'White',
      blackPlayer: 'Black',
      event: 'Ongoing Game',
      type: 'analysis' as const,
      currentNode: mockCurrentNode,
    }

    render(<ExportGame {...props} />)

    expect(screen.getByText('FEN')).toBeInTheDocument()
    expect(screen.getByText('PGN')).toBeInTheDocument()
  })

  it('should handle game with termination but no condition', () => {
    const gameWithPartialTermination = {
      ...mockAnalyzedGame,
      termination: { result: '1/2-1/2', condition: undefined },
    }
    const props = {
      game: gameWithPartialTermination,
      whitePlayer: 'White',
      blackPlayer: 'Black',
      event: 'Draw Game',
      type: 'analysis' as const,
      currentNode: mockCurrentNode,
    }

    render(<ExportGame {...props} />)

    expect(screen.getByText('FEN')).toBeInTheDocument()
    expect(screen.getByText('PGN')).toBeInTheDocument()
  })
})
