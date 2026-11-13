import { fireEvent, render, screen } from '@testing-library/react'

import { ProfileColumn } from './ProfileColumn'

const DATA = {
  rating: 1650,
  highest: 1700,
  hours: 0,
  games: 12,
  wins: 7,
}

// The card's "Rating" value.
const rating = () => screen.getByText('Rating').nextElementSibling

describe('ProfileColumn', () => {
  it('marks a provisional rating with "?", and says it\'s provisional', () => {
    render(
      <ProfileColumn
        icon="chess_knight"
        name="Regular"
        data={DATA}
        certainty={{ provisional: true }}
      />,
    )
    expect(rating()).toHaveTextContent(/^1650\?$/)
    expect(screen.getByText('Provisional')).toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByRole('button', { name: /provisional/ }))
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'This rating is provisional: too few recent games.',
    )
  })

  it('shows an established rating without "?"', () => {
    render(
      <ProfileColumn
        icon="chess_knight"
        name="Regular"
        data={DATA}
        certainty={{ provisional: false }}
      />,
    )
    expect(rating()).toHaveTextContent(/^1650$/)
    expect(screen.getByText('Established')).toBeInTheDocument()
  })
})
