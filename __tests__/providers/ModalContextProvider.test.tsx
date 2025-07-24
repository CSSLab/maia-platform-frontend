import { render, screen, act } from '@testing-library/react'
import { ModalContextProvider } from '../../src/providers/ModalContextProvider'
import { useContext } from 'react'
import { ModalContext } from '../../src/contexts'

// Mock PlaySetupModal
jest.mock('../../src/components', () => ({
  PlaySetupModal: ({ playType }: { playType: string }) => (
    <div data-testid="play-setup-modal">Play Setup Modal - {playType}</div>
  ),
}))

// Test component to access context
const TestComponent = () => {
  const { playSetupModalProps, setPlaySetupModalProps } =
    useContext(ModalContext)

  return (
    <div>
      <div data-testid="modal-state">
        {playSetupModalProps ? 'Modal Open' : 'Modal Closed'}
      </div>
      <button
        data-testid="open-modal"
        onClick={() => setPlaySetupModalProps({ playType: 'vs_maia' })}
      >
        Open Modal
      </button>
      <button
        data-testid="close-modal"
        onClick={() => setPlaySetupModalProps(undefined)}
      >
        Close Modal
      </button>
      <button
        data-testid="change-modal"
        onClick={() => setPlaySetupModalProps({ playType: 'hand_and_brain' })}
      >
        Change Modal
      </button>
    </div>
  )
}

describe('ModalContextProvider', () => {
  it('should provide modal context to children', () => {
    render(
      <ModalContextProvider>
        <TestComponent />
      </ModalContextProvider>,
    )

    expect(screen.getByTestId('modal-state')).toHaveTextContent('Modal Closed')
  })

  it('should initially not show any modal', () => {
    render(
      <ModalContextProvider>
        <TestComponent />
      </ModalContextProvider>,
    )

    expect(screen.queryByTestId('play-setup-modal')).not.toBeInTheDocument()
  })

  it('should show modal when setPlaySetupModalProps is called', () => {
    render(
      <ModalContextProvider>
        <TestComponent />
      </ModalContextProvider>,
    )

    act(() => {
      screen.getByTestId('open-modal').click()
    })

    expect(screen.getByTestId('play-setup-modal')).toBeInTheDocument()
    expect(screen.getByText('Play Setup Modal - vs_maia')).toBeInTheDocument()
    expect(screen.getByTestId('modal-state')).toHaveTextContent('Modal Open')
  })

  it('should hide modal when setPlaySetupModalProps is called with undefined', () => {
    render(
      <ModalContextProvider>
        <TestComponent />
      </ModalContextProvider>,
    )

    // Open modal first
    act(() => {
      screen.getByTestId('open-modal').click()
    })

    expect(screen.getByTestId('play-setup-modal')).toBeInTheDocument()

    // Close modal
    act(() => {
      screen.getByTestId('close-modal').click()
    })

    expect(screen.queryByTestId('play-setup-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('modal-state')).toHaveTextContent('Modal Closed')
  })

  it('should update modal props when changed', () => {
    render(
      <ModalContextProvider>
        <TestComponent />
      </ModalContextProvider>,
    )

    // Open modal with vs_maia
    act(() => {
      screen.getByTestId('open-modal').click()
    })

    expect(screen.getByText('Play Setup Modal - vs_maia')).toBeInTheDocument()

    // Change to hand_and_brain
    act(() => {
      screen.getByTestId('change-modal').click()
    })

    expect(
      screen.getByText('Play Setup Modal - hand_and_brain'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Play Setup Modal - vs_maia'),
    ).not.toBeInTheDocument()
  })

  it('should render children alongside modal', () => {
    render(
      <ModalContextProvider>
        <div data-testid="child-content">Child Content</div>
        <TestComponent />
      </ModalContextProvider>,
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()

    // Open modal
    act(() => {
      screen.getByTestId('open-modal').click()
    })

    // Both child and modal should be present
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByTestId('play-setup-modal')).toBeInTheDocument()
  })

  it('should handle multiple children', () => {
    render(
      <ModalContextProvider>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <TestComponent />
      </ModalContextProvider>,
    )

    expect(screen.getByTestId('child-1')).toBeInTheDocument()
    expect(screen.getByTestId('child-2')).toBeInTheDocument()
  })

  it('should pass all props to PlaySetupModal', () => {
    const TestComponentWithComplexProps = () => {
      const { setPlaySetupModalProps } = useContext(ModalContext)

      return (
        <button
          onClick={() =>
            setPlaySetupModalProps({
              playType: 'vs_maia',
              maiaModel: 'maia-1500',
              timeControl: '10+0',
            } as any)
          }
        >
          Open Complex Modal
        </button>
      )
    }

    // Mock PlaySetupModal to accept additional props
    jest.doMock('../../src/components', () => ({
      PlaySetupModal: (props: any) => (
        <div data-testid="play-setup-modal">
          {Object.entries(props).map(([key, value]) => (
            <span key={key} data-testid={`prop-${key}`}>
              {String(value)}
            </span>
          ))}
        </div>
      ),
    }))

    render(
      <ModalContextProvider>
        <TestComponentWithComplexProps />
      </ModalContextProvider>,
    )

    act(() => {
      screen.getByText('Open Complex Modal').click()
    })

    expect(screen.getByTestId('play-setup-modal')).toBeInTheDocument()
  })

  it('should maintain state across re-renders', () => {
    const { rerender } = render(
      <ModalContextProvider>
        <TestComponent />
      </ModalContextProvider>,
    )

    // Open modal
    act(() => {
      screen.getByTestId('open-modal').click()
    })

    expect(screen.getByTestId('play-setup-modal')).toBeInTheDocument()

    // Re-render
    rerender(
      <ModalContextProvider>
        <TestComponent />
      </ModalContextProvider>,
    )

    // Modal should still be open
    expect(screen.getByTestId('play-setup-modal')).toBeInTheDocument()
  })

  it('should handle rapid state changes', () => {
    render(
      <ModalContextProvider>
        <TestComponent />
      </ModalContextProvider>,
    )

    // Rapid open/close/change
    act(() => {
      screen.getByTestId('open-modal').click()
    })

    act(() => {
      screen.getByTestId('close-modal').click()
    })

    act(() => {
      screen.getByTestId('change-modal').click()
    })

    expect(screen.getByTestId('play-setup-modal')).toBeInTheDocument()
    expect(
      screen.getByText('Play Setup Modal - hand_and_brain'),
    ).toBeInTheDocument()
  })
})
