import { render, screen } from '@testing-library/react'
import { Compose } from '../../src/components/Common/Compose'
import { ReactNode } from 'react'

describe('Compose Component', () => {
  const TestProvider1 = ({ children }: { children: ReactNode }) => (
    <div data-testid="provider-1">{children}</div>
  )

  const TestProvider2 = ({ children }: { children: ReactNode }) => (
    <div data-testid="provider-2">{children}</div>
  )

  it('should render children without any components', () => {
    render(
      <Compose components={[]}>
        <div data-testid="test-child">Test Content</div>
      </Compose>,
    )

    expect(screen.getByTestId('test-child')).toBeInTheDocument()
  })

  it('should wrap children with single component', () => {
    render(
      <Compose components={[TestProvider1]}>
        <div data-testid="test-child">Test Content</div>
      </Compose>,
    )

    expect(screen.getByTestId('provider-1')).toBeInTheDocument()
    expect(screen.getByTestId('test-child')).toBeInTheDocument()
  })

  it('should compose multiple components in correct order', () => {
    render(
      <Compose components={[TestProvider1, TestProvider2]}>
        <div data-testid="test-child">Test Content</div>
      </Compose>,
    )

    const provider1 = screen.getByTestId('provider-1')
    const provider2 = screen.getByTestId('provider-2')
    const child = screen.getByTestId('test-child')

    expect(provider1).toContainElement(provider2)
    expect(provider2).toContainElement(child)
  })

  it('should handle string children', () => {
    render(<Compose components={[TestProvider1]}>Plain text content</Compose>)

    expect(screen.getByTestId('provider-1')).toBeInTheDocument()
    expect(screen.getByText('Plain text content')).toBeInTheDocument()
  })
})
