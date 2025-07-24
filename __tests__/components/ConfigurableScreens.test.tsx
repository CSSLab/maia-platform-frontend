import { render, screen, fireEvent } from '@testing-library/react'
import { ConfigurableScreens } from '../../src/components/Analysis/ConfigurableScreens'

// Mock dependencies
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, layoutId }: any) => (
      <div className={className} data-layout-id={layoutId}>
        {children}
      </div>
    ),
  },
}))

jest.mock('../../src/components/Analysis/ConfigureAnalysis', () => ({
  ConfigureAnalysis: ({
    currentMaiaModel,
    setCurrentMaiaModel,
    launchContinue,
    MAIA_MODELS,
    game,
    onDeleteCustomGame,
  }: any) => (
    <div data-testid="configure-analysis">
      <div>Current Model: {currentMaiaModel}</div>
      <button onClick={() => setCurrentMaiaModel('maia-1500')}>
        Change Model
      </button>
      <button onClick={launchContinue}>Launch Continue</button>
      {onDeleteCustomGame && (
        <button onClick={onDeleteCustomGame}>Delete Custom Game</button>
      )}
      <div>Available Models: {MAIA_MODELS.join(', ')}</div>
      <div>Game ID: {game.id}</div>
    </div>
  ),
}))

jest.mock('../../src/components/Common/ExportGame', () => ({
  ExportGame: ({
    game,
    currentNode,
    whitePlayer,
    blackPlayer,
    event,
    type,
  }: any) => (
    <div data-testid="export-game">
      <div>Game: {game.id}</div>
      <div>White: {whitePlayer}</div>
      <div>Black: {blackPlayer}</div>
      <div>Event: {event}</div>
      <div>Type: {type}</div>
      <div>Current Node: {currentNode.fen}</div>
    </div>
  ),
}))

describe('ConfigurableScreens', () => {
  const mockGame = {
    id: 'game-123',
    whitePlayer: { name: 'Player 1' },
    blackPlayer: { name: 'Player 2' },
  }

  const mockCurrentNode = {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  }

  const mockProps = {
    currentMaiaModel: 'maia-1100',
    setCurrentMaiaModel: jest.fn(),
    launchContinue: jest.fn(),
    MAIA_MODELS: ['maia-1100', 'maia-1500', 'maia-1900'],
    game: mockGame,
    currentNode: mockCurrentNode,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render both tab buttons', () => {
    render(<ConfigurableScreens {...mockProps} />)

    expect(screen.getByText('Configure')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('should default to Configure tab', () => {
    render(<ConfigurableScreens {...mockProps} />)

    expect(screen.getByTestId('configure-analysis')).toBeInTheDocument()
    expect(screen.queryByTestId('export-game')).not.toBeInTheDocument()
  })

  it('should show Configure tab as selected by default', () => {
    render(<ConfigurableScreens {...mockProps} />)

    const configureTab = screen.getByText('Configure').closest('div')
    expect(configureTab).toHaveClass('bg-white/5')
    expect(
      configureTab?.querySelector('[data-layout-id="selectedScreen"]'),
    ).toBeInTheDocument()
  })

  it('should switch to Export tab when clicked', () => {
    render(<ConfigurableScreens {...mockProps} />)

    fireEvent.click(screen.getByText('Export'))

    expect(screen.getByTestId('export-game')).toBeInTheDocument()
    expect(screen.queryByTestId('configure-analysis')).not.toBeInTheDocument()
  })

  it('should update tab selection styling when Export is clicked', () => {
    render(<ConfigurableScreens {...mockProps} />)

    fireEvent.click(screen.getByText('Export'))

    const exportTab = screen.getByText('Export').closest('div')
    const configureTab = screen.getByText('Configure').closest('div')

    expect(exportTab).toHaveClass('bg-white/5')
    expect(configureTab).not.toHaveClass('bg-white/5')
    expect(
      exportTab?.querySelector('[data-layout-id="selectedScreen"]'),
    ).toBeInTheDocument()
  })

  it('should switch tabs using keyboard Enter key', () => {
    render(<ConfigurableScreens {...mockProps} />)

    const exportTab = screen.getByText('Export').closest('div')
    fireEvent.keyDown(exportTab!, { key: 'Enter' })

    expect(screen.getByTestId('export-game')).toBeInTheDocument()
    expect(screen.queryByTestId('configure-analysis')).not.toBeInTheDocument()
  })

  it('should not switch tabs on other key presses', () => {
    render(<ConfigurableScreens {...mockProps} />)

    const exportTab = screen.getByText('Export').closest('div')
    fireEvent.keyDown(exportTab!, { key: 'Space' })

    expect(screen.getByTestId('configure-analysis')).toBeInTheDocument()
    expect(screen.queryByTestId('export-game')).not.toBeInTheDocument()
  })

  describe('Configure Tab', () => {
    it('should pass all props to ConfigureAnalysis', () => {
      render(<ConfigurableScreens {...mockProps} />)

      expect(screen.getByText('Current Model: maia-1100')).toBeInTheDocument()
      expect(
        screen.getByText('Available Models: maia-1100, maia-1500, maia-1900'),
      ).toBeInTheDocument()
      expect(screen.getByText('Game ID: game-123')).toBeInTheDocument()
    })

    it('should call setCurrentMaiaModel when model is changed', () => {
      render(<ConfigurableScreens {...mockProps} />)

      fireEvent.click(screen.getByText('Change Model'))

      expect(mockProps.setCurrentMaiaModel).toHaveBeenCalledWith('maia-1500')
    })

    it('should call launchContinue when button is clicked', () => {
      render(<ConfigurableScreens {...mockProps} />)

      fireEvent.click(screen.getByText('Launch Continue'))

      expect(mockProps.launchContinue).toHaveBeenCalledTimes(1)
    })

    it('should show delete button when onDeleteCustomGame is provided', () => {
      const mockOnDeleteCustomGame = jest.fn()
      render(
        <ConfigurableScreens
          {...mockProps}
          onDeleteCustomGame={mockOnDeleteCustomGame}
        />,
      )

      expect(screen.getByText('Delete Custom Game')).toBeInTheDocument()
    })

    it('should call onDeleteCustomGame when delete button is clicked', () => {
      const mockOnDeleteCustomGame = jest.fn()
      render(
        <ConfigurableScreens
          {...mockProps}
          onDeleteCustomGame={mockOnDeleteCustomGame}
        />,
      )

      fireEvent.click(screen.getByText('Delete Custom Game'))

      expect(mockOnDeleteCustomGame).toHaveBeenCalledTimes(1)
    })

    it('should not show delete button when onDeleteCustomGame is not provided', () => {
      render(<ConfigurableScreens {...mockProps} />)

      expect(screen.queryByText('Delete Custom Game')).not.toBeInTheDocument()
    })
  })

  describe('Export Tab', () => {
    it('should pass correct props to ExportGame', () => {
      render(<ConfigurableScreens {...mockProps} />)

      fireEvent.click(screen.getByText('Export'))

      expect(screen.getByText('Game: game-123')).toBeInTheDocument()
      expect(screen.getByText('White: Player 1')).toBeInTheDocument()
      expect(screen.getByText('Black: Player 2')).toBeInTheDocument()
      expect(screen.getByText('Event: Analysis')).toBeInTheDocument()
      expect(screen.getByText('Type: analysis')).toBeInTheDocument()
      expect(
        screen.getByText(`Current Node: ${mockCurrentNode.fen}`),
      ).toBeInTheDocument()
    })

    it('should wrap ExportGame in proper styling container', () => {
      render(<ConfigurableScreens {...mockProps} />)

      fireEvent.click(screen.getByText('Export'))

      const exportContainer = screen.getByTestId('export-game').parentElement
      expect(exportContainer).toHaveClass('flex', 'w-full', 'flex-col', 'p-4')
    })
  })

  describe('Styling and Layout', () => {
    it('should have correct container classes', () => {
      render(<ConfigurableScreens {...mockProps} />)

      const mainContainer = screen
        .getByText('Configure')
        .closest('.flex.w-full.flex-1')
      expect(mainContainer).toHaveClass(
        'flex-col',
        'overflow-hidden',
        'bg-background-1/60',
      )
    })

    it('should have correct tab container styling', () => {
      render(<ConfigurableScreens {...mockProps} />)

      const configureButton = screen.getByText('Configure').closest('div')
      const tabContainer = configureButton?.parentElement
      expect(tabContainer).toHaveClass('border-b', 'border-white/10')
    })

    it('should have correct content area styling', () => {
      render(<ConfigurableScreens {...mockProps} />)

      const configureAnalysis = screen.getByTestId('configure-analysis')
      const contentContainer = configureAnalysis.closest('.red-scrollbar')
      expect(contentContainer).toHaveClass(
        'flex',
        'flex-col',
        'items-start',
        'justify-start',
        'overflow-y-scroll',
        'bg-backdrop/30',
      )
    })

    it('should apply hover styles to unselected tabs', () => {
      render(<ConfigurableScreens {...mockProps} />)

      const exportTab = screen.getByText('Export').closest('div')
      expect(exportTab).toHaveClass('hover:bg-white', 'hover:bg-opacity-[0.02]')
      expect(exportTab).not.toHaveClass('bg-white/5')
    })

    it('should have proper accessibility attributes', () => {
      render(<ConfigurableScreens {...mockProps} />)

      const configureTab = screen.getByText('Configure').closest('div')
      const exportTab = screen.getByText('Export').closest('div')

      expect(configureTab).toHaveAttribute('tabIndex', '0')
      expect(configureTab).toHaveAttribute('role', 'button')
      expect(exportTab).toHaveAttribute('tabIndex', '0')
      expect(exportTab).toHaveAttribute('role', 'button')
    })

    it('should have motion layout animation', () => {
      render(<ConfigurableScreens {...mockProps} />)

      const selectedIndicator = screen
        .getByText('Configure')
        .closest('div')
        ?.querySelector('[data-layout-id="selectedScreen"]')

      expect(selectedIndicator).toBeInTheDocument()
      expect(selectedIndicator).toHaveClass(
        'absolute',
        'bottom-0',
        'left-0',
        'h-[1px]',
        'w-full',
        'bg-white',
      )
    })
  })

  describe('Tab Switching Behavior', () => {
    it('should maintain component state when switching between tabs', () => {
      render(<ConfigurableScreens {...mockProps} />)

      // Start with Configure tab
      expect(screen.getByTestId('configure-analysis')).toBeInTheDocument()

      // Switch to Export
      fireEvent.click(screen.getByText('Export'))
      expect(screen.getByTestId('export-game')).toBeInTheDocument()

      // Switch back to Configure
      fireEvent.click(screen.getByText('Configure'))
      expect(screen.getByTestId('configure-analysis')).toBeInTheDocument()
    })

    it('should only show one tab content at a time', () => {
      render(<ConfigurableScreens {...mockProps} />)

      fireEvent.click(screen.getByText('Export'))

      expect(screen.getByTestId('export-game')).toBeInTheDocument()
      expect(screen.queryByTestId('configure-analysis')).not.toBeInTheDocument()
    })
  })
})
