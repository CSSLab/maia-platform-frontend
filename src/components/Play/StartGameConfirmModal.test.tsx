import { fireEvent, render, screen } from '@testing-library/react'
import { StartGameConfirmModal } from './StartGameConfirmModal'

describe('StartGameConfirmModal', () => {
  it('shows nothing while closed', () => {
    const { container } = render(
      <StartGameConfirmModal
        isOpen={false}
        onStart={jest.fn()}
        onCancel={jest.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('starts the game, or leaves without starting one', () => {
    const onStart = jest.fn()
    const onCancel = jest.fn()
    render(
      <StartGameConfirmModal isOpen onStart={onStart} onCancel={onCancel} />,
    )

    expect(
      screen.getByRole('dialog', { name: 'Start a new game?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'If you have a game in progress, starting this one resigns it.',
      ),
    ).toBeInTheDocument()
    const start = screen.getByRole('button', { name: 'Start game' })
    expect(start).toHaveFocus()

    fireEvent.click(start)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
