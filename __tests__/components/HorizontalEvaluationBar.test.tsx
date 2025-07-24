import { render, screen } from '@testing-library/react'
import { HorizontalEvaluationBar } from '../../src/components/Analysis/HorizontalEvaluationBar'

describe('HorizontalEvaluationBar Component', () => {
  it('should render with default props', () => {
    const { container } = render(<HorizontalEvaluationBar />)

    const mainContainer = container.firstChild
    expect(mainContainer).toBeInTheDocument()
    expect(mainContainer).toHaveClass(
      'relative',
      'flex',
      'h-6',
      'w-[75vh]',
      'max-w-[75vw]',
    )
  })

  it('should render with custom label', () => {
    const label = 'Test Evaluation'
    render(<HorizontalEvaluationBar label={label} />)

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText(label)).toHaveClass(
      'z-10',
      'ml-2',
      'whitespace-nowrap',
      'text-xs',
    )
  })

  it('should calculate correct width for value in range', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={0} max={10} value={5} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ width: '50%' })
  })

  it('should handle minimum value', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={0} max={100} value={0} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ width: '0%' })
  })

  it('should handle maximum value', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={0} max={100} value={100} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ width: '100%' })
  })

  it('should clamp width values above 100%', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={0} max={10} value={15} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ width: '100%' })
  })

  it('should clamp width values below 0%', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={0} max={10} value={-5} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ width: '0%' })
  })

  it('should handle negative range values', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={-50} max={50} value={0} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ width: '50%' })
  })

  it('should handle undefined value gracefully', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={10} max={100} value={undefined} />,
    )

    // When value is undefined, it should use min value (10)
    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ width: '0%' })
  })

  it('should handle decimal values', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={0} max={1} value={0.75} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ width: '75%' })
  })

  it('should apply correct CSS classes to container', () => {
    const { container } = render(<HorizontalEvaluationBar />)

    const mainContainer = container.firstChild
    expect(mainContainer).toHaveClass(
      'relative',
      'flex',
      'h-6',
      'w-[75vh]',
      'max-w-[75vw]',
      'flex-col',
      'justify-center',
      'overflow-hidden',
      'rounded-sm',
      'bg-engine-3/30',
    )
  })

  it('should apply correct CSS classes to the bar element', () => {
    const { container } = render(<HorizontalEvaluationBar />)

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveClass(
      'absolute',
      'bottom-0',
      'left-0',
      'z-0',
      'h-full',
      'w-full',
      'transform',
      'rounded-r-sm',
      'bg-engine-3',
      'duration-300',
    )
  })

  it('should handle edge case with same min and max values', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={50} max={50} value={50} />,
    )

    // When min === max, the result should be clamped appropriately
    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toBeInTheDocument()
  })

  it('should render label with correct positioning', () => {
    const label = 'Position Evaluation'
    render(<HorizontalEvaluationBar label={label} />)

    const labelElement = screen.getByText(label)
    expect(labelElement).toHaveClass(
      'z-10',
      'ml-2',
      'whitespace-nowrap',
      'text-xs',
    )
  })

  it('should not render label when not provided', () => {
    const { container } = render(<HorizontalEvaluationBar />)

    const labelElement = container.querySelector('p')
    expect(labelElement).toHaveTextContent('')
  })

  it('should handle very large numbers', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={0} max={1000000} value={500000} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ width: '50%' })
  })

  it('should handle fractional percentages correctly', () => {
    const { container } = render(
      <HorizontalEvaluationBar min={0} max={3} value={1} />,
    )

    const bar = container.querySelector('.absolute.bottom-0')
    expect(bar).toHaveStyle({ width: '33.33333333333333%' })
  })
})
