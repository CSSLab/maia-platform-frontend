import { render, screen } from '@testing-library/react'
import { VerticalEvaluationBar } from '../../src/components/Analysis/VerticalEvaluationBar'

describe('VerticalEvaluationBar Component', () => {
  it('should render with default props', () => {
    const { container } = render(<VerticalEvaluationBar />)

    const mainContainer = container.firstElementChild
    expect(mainContainer).toBeInTheDocument()
    expect(mainContainer).toHaveClass(
      'relative',
      'flex',
      'h-[75vh]',
      'max-h-[75vw]',
      'w-6',
    )
  })

  it('should render with custom label', () => {
    const label = 'Test Evaluation'
    render(<VerticalEvaluationBar label={label} />)

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText(label)).toHaveClass(
      '-rotate-90',
      'whitespace-nowrap',
      'text-xs',
    )
  })

  it('should calculate correct height for value in range', () => {
    const { container } = render(
      <VerticalEvaluationBar min={0} max={10} value={5} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ height: '50%' })
  })

  it('should handle minimum value', () => {
    const { container } = render(
      <VerticalEvaluationBar min={0} max={100} value={0} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ height: '0%' })
  })

  it('should handle maximum value', () => {
    const { container } = render(
      <VerticalEvaluationBar min={0} max={100} value={100} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ height: '100%' })
  })

  it('should handle negative range values', () => {
    const { container } = render(
      <VerticalEvaluationBar min={-50} max={50} value={0} />,
    )

    // With the current formula: ((0 ?? -50 - (-50)) / (50 - (-50))) * 100 = ((0 - (-50)) / 100) * 100 = 50%
    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ height: '50%' })
  })

  it('should handle undefined value gracefully', () => {
    const { container } = render(
      <VerticalEvaluationBar min={0} max={100} value={undefined} />,
    )

    // When value is undefined, it should use (min - min) which is 0
    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ height: '0%' })
  })

  it('should handle decimal values', () => {
    const { container } = render(
      <VerticalEvaluationBar min={0} max={1} value={0.75} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ height: '75%' })
  })

  it('should apply correct CSS classes to container', () => {
    const { container } = render(<VerticalEvaluationBar />)

    const mainContainer = container.firstChild
    expect(mainContainer).toHaveClass(
      'relative',
      'flex',
      'h-[75vh]',
      'max-h-[75vw]',
      'w-6',
      'flex-col',
      'justify-end',
      'overflow-hidden',
      'rounded-sm',
      'bg-human-3/30',
    )
  })

  it('should apply correct CSS classes to the bar element', () => {
    const { container } = render(<VerticalEvaluationBar />)

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveClass(
      'absolute',
      'bottom-0',
      'left-0',
      'z-0',
      'h-full',
      'w-full',
      'transform',
      'rounded-t-sm',
      'bg-human-3',
      'duration-300',
    )
  })

  it('should handle edge case with same min and max values', () => {
    const { container } = render(
      <VerticalEvaluationBar min={50} max={50} value={50} />,
    )

    // When min === max, division by zero should be handled
    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toBeInTheDocument()
  })

  it('should render label with correct positioning', () => {
    const label = 'Position Evaluation'
    render(<VerticalEvaluationBar label={label} />)

    const labelElement = screen.getByText(label)
    expect(labelElement).toHaveClass(
      'z-10',
      'mb-3',
      '-rotate-90',
      'whitespace-nowrap',
      'text-xs',
    )
  })

  it('should not render label when not provided', () => {
    const { container } = render(<VerticalEvaluationBar />)

    const labelElement = container.querySelector('p')
    expect(labelElement).toHaveTextContent('')
  })
})
