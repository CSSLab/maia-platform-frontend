import { fireEvent, render, screen } from '@testing-library/react'

import { Rating } from './Rating'

describe('Rating', () => {
  it('follows a provisional rating with "?"', () => {
    const { container } = render(<Rating rating={1650} provisional />)
    expect(container).toHaveTextContent(/^1650\?$/)
  })

  it('shows a settled rating alone', () => {
    const { container } = render(<Rating rating={1650} provisional={false} />)
    expect(container).toHaveTextContent(/^1650$/)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says what the "?" means when it is hovered, focused or tapped', () => {
    render(<Rating rating={1650} provisional />)
    const mark = screen.getByRole('button', {
      name: 'This rating is provisional: too few recent results.',
    })
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.mouseEnter(mark)
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'This rating is provisional: too few recent results.',
    )
    fireEvent.mouseLeave(mark)
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.focus(mark)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.blur(mark)

    fireEvent.click(mark)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('tells the rating\'s owner how to remove the "?"', () => {
    render(<Rating rating={1480} provisional own unit="puzzles" />)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Your rating is provisional because you haven’t solved many puzzles recently. Solve more to remove the “?”.',
    )
  })
})
