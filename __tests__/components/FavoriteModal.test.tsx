import { render, screen, fireEvent } from '@testing-library/react'
import { FavoriteModal } from '../../src/components/Common/FavoriteModal'

describe('FavoriteModal', () => {
  const mockOnClose = jest.fn()
  const mockOnSave = jest.fn()
  const mockOnRemove = jest.fn()

  const defaultProps = {
    isOpen: true,
    currentName: 'Test Game',
    onClose: mockOnClose,
    onSave: mockOnSave,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(<FavoriteModal {...defaultProps} isOpen={false} />)

    expect(screen.queryByText('Edit Favourite Game')).not.toBeInTheDocument()
  })

  it('should render modal when isOpen is true', () => {
    render(<FavoriteModal {...defaultProps} />)

    expect(screen.getByText('Edit Favourite Game')).toBeInTheDocument()
    expect(screen.getByLabelText('Custom Name')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Game')).toBeInTheDocument()
  })

  it('should initialize input with currentName', () => {
    render(<FavoriteModal {...defaultProps} currentName="My Custom Game" />)

    expect(screen.getByDisplayValue('My Custom Game')).toBeInTheDocument()
  })

  it('should update input value when typing', () => {
    render(<FavoriteModal {...defaultProps} />)

    const input = screen.getByLabelText('Custom Name')
    fireEvent.change(input, { target: { value: 'New Game Name' } })

    expect(screen.getByDisplayValue('New Game Name')).toBeInTheDocument()
  })

  it('should call onClose when Cancel button clicked', () => {
    render(<FavoriteModal {...defaultProps} />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onSave and onClose when Save button clicked with valid name', () => {
    render(<FavoriteModal {...defaultProps} />)

    const input = screen.getByLabelText('Custom Name')
    fireEvent.change(input, { target: { value: 'Updated Game Name' } })
    fireEvent.click(screen.getByText('Save'))

    expect(mockOnSave).toHaveBeenCalledWith('Updated Game Name')
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should trim whitespace when saving', () => {
    render(<FavoriteModal {...defaultProps} />)

    const input = screen.getByLabelText('Custom Name')
    fireEvent.change(input, { target: { value: '  Spaced Game  ' } })
    fireEvent.click(screen.getByText('Save'))

    expect(mockOnSave).toHaveBeenCalledWith('Spaced Game')
  })

  it('should not call onSave when name is empty or only whitespace', () => {
    render(<FavoriteModal {...defaultProps} />)

    const input = screen.getByLabelText('Custom Name')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByText('Save'))

    expect(mockOnSave).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should disable Save button when name is empty or only whitespace', () => {
    render(<FavoriteModal {...defaultProps} />)

    const input = screen.getByLabelText('Custom Name')
    fireEvent.change(input, { target: { value: '   ' } })

    const saveButton = screen.getByText('Save')
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveClass('disabled:opacity-50')
  })

  it('should save when Enter key is pressed in input', () => {
    render(<FavoriteModal {...defaultProps} />)

    const input = screen.getByLabelText('Custom Name')
    fireEvent.change(input, { target: { value: 'Enter Saved Game' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockOnSave).toHaveBeenCalledWith('Enter Saved Game')
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should not save when non-Enter key is pressed', () => {
    render(<FavoriteModal {...defaultProps} />)

    const input = screen.getByLabelText('Custom Name')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(mockOnSave).not.toHaveBeenCalled()
  })

  describe('with onRemove prop', () => {
    it('should show Remove button when onRemove is provided', () => {
      render(<FavoriteModal {...defaultProps} onRemove={mockOnRemove} />)

      expect(screen.getByText('Remove')).toBeInTheDocument()
    })

    it('should not show Remove button when onRemove is not provided', () => {
      render(<FavoriteModal {...defaultProps} />)

      expect(screen.queryByText('Remove')).not.toBeInTheDocument()
    })

    it('should call onRemove and onClose when Remove button clicked', () => {
      render(<FavoriteModal {...defaultProps} onRemove={mockOnRemove} />)

      fireEvent.click(screen.getByText('Remove'))

      expect(mockOnRemove).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  it('should have correct modal structure and styling', () => {
    render(<FavoriteModal {...defaultProps} />)

    const modalOverlay = screen
      .getByText('Edit Favourite Game')
      .closest('.fixed')
    expect(modalOverlay).toHaveClass(
      'inset-0',
      'z-50',
      'bg-black',
      'bg-opacity-50',
    )

    const modalContent = screen
      .getByText('Edit Favourite Game')
      .closest('.rounded-lg')
    expect(modalContent).toHaveClass('bg-background-1', 'shadow-lg')
  })

  it('should have proper input styling and attributes', () => {
    render(<FavoriteModal {...defaultProps} />)

    const input = screen.getByLabelText('Custom Name')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute(
      'placeholder',
      'Enter custom name for this game',
    )
    expect(input).toHaveClass('bg-background-2', 'text-primary')
  })

  it('should handle button styling correctly', () => {
    render(<FavoriteModal {...defaultProps} onRemove={mockOnRemove} />)

    const cancelButton = screen.getByText('Cancel')
    expect(cancelButton).toHaveClass('border-white', 'text-secondary')

    const removeButton = screen.getByText('Remove')
    expect(removeButton).toHaveClass('border-white', 'text-white')

    const saveButton = screen.getByText('Save')
    expect(saveButton).toHaveClass('bg-human-4', 'text-primary', 'flex-1')
  })
})
