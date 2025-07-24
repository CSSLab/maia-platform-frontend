import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { PromotionOverlay } from '../../src/components/Board/PromotionOverlay'

jest.mock('../../src/contexts', () => {
  const mockTreeControllerContext = {
    orientation: 'white' as const,
  }

  return {
    TreeControllerContext: React.createContext(mockTreeControllerContext),
  }
})

describe('PromotionOverlay Component', () => {
  const mockOnPlayerSelectPromotion = jest.fn()

  const defaultProps = {
    player: 'white' as const,
    file: 'e',
    onPlayerSelectPromotion: mockOnPlayerSelectPromotion,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render promotion overlay with backdrop', () => {
    const { container } = render(<PromotionOverlay {...defaultProps} />)

    const backdrop = container.querySelector('.bg-backdrop\\/80')
    expect(backdrop).toBeInTheDocument()
    expect(backdrop).toHaveClass('absolute', 'left-0', 'top-0', 'z-10')
  })

  it('should render all four promotion pieces for white', () => {
    render(<PromotionOverlay {...defaultProps} />)

    expect(screen.getByAltText('q')).toBeInTheDocument()
    expect(screen.getByAltText('n')).toBeInTheDocument()
    expect(screen.getByAltText('r')).toBeInTheDocument()
    expect(screen.getByAltText('b')).toBeInTheDocument()
  })

  it('should render white piece images when orientation is white', () => {
    render(<PromotionOverlay {...defaultProps} />)

    expect(screen.getByAltText('q')).toHaveAttribute(
      'src',
      '/assets/pieces/white queen.svg',
    )
    expect(screen.getByAltText('n')).toHaveAttribute(
      'src',
      '/assets/pieces/white knight.svg',
    )
    expect(screen.getByAltText('r')).toHaveAttribute(
      'src',
      '/assets/pieces/white rook.svg',
    )
    expect(screen.getByAltText('b')).toHaveAttribute(
      'src',
      '/assets/pieces/white bishop.svg',
    )
  })

  it('should render black piece images when orientation is black', () => {
    const { TreeControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <TreeControllerContext.Provider
        value={{
          orientation: 'black',
        }}
      >
        {children}
      </TreeControllerContext.Provider>
    )

    render(
      <CustomProvider>
        <PromotionOverlay {...defaultProps} />
      </CustomProvider>,
    )

    expect(screen.getByAltText('q')).toHaveAttribute(
      'src',
      '/assets/pieces/black queen.svg',
    )
    expect(screen.getByAltText('n')).toHaveAttribute(
      'src',
      '/assets/pieces/black knight.svg',
    )
    expect(screen.getByAltText('r')).toHaveAttribute(
      'src',
      '/assets/pieces/black rook.svg',
    )
    expect(screen.getByAltText('b')).toHaveAttribute(
      'src',
      '/assets/pieces/black bishop.svg',
    )
  })

  it('should call onPlayerSelectPromotion when queen is clicked', () => {
    render(<PromotionOverlay {...defaultProps} />)

    const queenButton = screen.getByAltText('q').closest('button')
    expect(queenButton).toBeInTheDocument()
    fireEvent.click(queenButton!)

    expect(mockOnPlayerSelectPromotion).toHaveBeenCalledWith('q')
  })

  it('should call onPlayerSelectPromotion when knight is clicked', () => {
    render(<PromotionOverlay {...defaultProps} />)

    const knightButton = screen.getByAltText('n').closest('button')
    expect(knightButton).toBeInTheDocument()
    fireEvent.click(knightButton!)

    expect(mockOnPlayerSelectPromotion).toHaveBeenCalledWith('n')
  })

  it('should call onPlayerSelectPromotion when rook is clicked', () => {
    render(<PromotionOverlay {...defaultProps} />)

    const rookButton = screen.getByAltText('r').closest('button')
    expect(rookButton).toBeInTheDocument()
    fireEvent.click(rookButton!)

    expect(mockOnPlayerSelectPromotion).toHaveBeenCalledWith('r')
  })

  it('should call onPlayerSelectPromotion when bishop is clicked', () => {
    render(<PromotionOverlay {...defaultProps} />)

    const bishopButton = screen.getByAltText('b').closest('button')
    expect(bishopButton).toBeInTheDocument()
    fireEvent.click(bishopButton!)

    expect(mockOnPlayerSelectPromotion).toHaveBeenCalledWith('b')
  })

  it('should reverse piece order when orientation is black', () => {
    const { TreeControllerContext } = jest.requireMock('../../src/contexts')

    const CustomProvider = ({ children }: { children: React.ReactNode }) => (
      <TreeControllerContext.Provider
        value={{
          orientation: 'black',
        }}
      >
        {children}
      </TreeControllerContext.Provider>
    )

    const { container } = render(
      <CustomProvider>
        <PromotionOverlay {...defaultProps} />
      </CustomProvider>,
    )

    const buttons = container.querySelectorAll('button')
    const images = container.querySelectorAll('img')

    // When black orientation, pieces should be in reverse order (b, r, n, q)
    expect(images[0]).toHaveAttribute('alt', 'b')
    expect(images[1]).toHaveAttribute('alt', 'r')
    expect(images[2]).toHaveAttribute('alt', 'n')
    expect(images[3]).toHaveAttribute('alt', 'q')
  })

  it('should apply correct CSS classes to piece buttons', () => {
    render(<PromotionOverlay {...defaultProps} />)

    const queenButton = screen.getByAltText('q').closest('button')
    expect(queenButton).toHaveClass(
      'flex',
      'h-1/4',
      'w-full',
      'items-center',
      'justify-center',
      'bg-engine-3',
      'hover:bg-engine-4',
    )
  })

  it('should apply correct CSS classes to piece images', () => {
    render(<PromotionOverlay {...defaultProps} />)

    const queenImage = screen.getByAltText('q')
    expect(queenImage).toHaveClass('h-20', 'w-20')
  })

  it('should apply correct CSS classes to overlay container', () => {
    const { container } = render(<PromotionOverlay {...defaultProps} />)

    const overlay = container.querySelector('.absolute')
    expect(overlay).toHaveClass(
      'absolute',
      'left-0',
      'top-0',
      'z-10',
      'flex',
      'h-full',
      'w-full',
      'flex-col',
      'items-center',
      'justify-center',
      'bg-backdrop/80',
    )
  })

  it('should apply correct CSS classes to piece container', () => {
    const { container } = render(<PromotionOverlay {...defaultProps} />)

    const pieceContainer = container.querySelector('.flex.h-1\\/2.w-1\\/2')
    expect(pieceContainer).toHaveClass(
      'flex',
      'h-1/2',
      'w-1/2',
      'flex-row',
      'items-center',
      'justify-center',
    )
  })

  it('should handle different file props without error', () => {
    const { rerender } = render(<PromotionOverlay {...defaultProps} file="a" />)
    expect(screen.getByAltText('q')).toBeInTheDocument()

    rerender(<PromotionOverlay {...defaultProps} file="h" />)
    expect(screen.getByAltText('q')).toBeInTheDocument()
  })

  it('should handle different player colors without affecting piece display', () => {
    render(<PromotionOverlay {...defaultProps} player="black" />)

    // Player color shouldn't affect piece color - orientation should
    expect(screen.getByAltText('q')).toHaveAttribute(
      'src',
      '/assets/pieces/white queen.svg',
    )
  })
})
