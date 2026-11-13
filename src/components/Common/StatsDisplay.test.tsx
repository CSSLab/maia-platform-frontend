import { fireEvent, render, screen } from '@testing-library/react'

import { AllStats } from 'src/hooks/useStats'
import { StatsDisplay } from './StatsDisplay'

const stats = (overrides: Partial<AllStats>): AllStats => ({
  rating: 1500,
  lastRating: undefined,
  session: { gamesPlayed: 0, gamesWon: 0 },
  lifetime: { gamesPlayed: 3, gamesWon: 1 },
  ...overrides,
})

// The "Your rating" line: the number, then "?" if provisional, then the
// change from the last game.
const yourRating = () => screen.getByText('Your rating').nextElementSibling

describe('StatsDisplay', () => {
  it('marks a provisional rating, and the change after a game', () => {
    render(
      <StatsDisplay
        stats={stats({ rating: 1512, lastRating: 1500, provisional: true })}
        isGame
        hideSession
      />,
    )
    expect(yourRating()).toHaveTextContent(/^1512\?arrow_drop_up\+12$/)

    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Your rating is provisional because you haven’t played many games recently. Play more to remove the “?”.',
    )
  })

  it('shows a settled rating without "?"', () => {
    render(
      <StatsDisplay
        stats={stats({ rating: 1488, lastRating: 1500, provisional: false })}
        isGame
        hideSession
      />,
    )
    expect(yourRating()).toHaveTextContent(/^1488arrow_drop_down–12$/)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('speaks of puzzles on the puzzles page', () => {
    render(<StatsDisplay stats={stats({ provisional: true })} unit="puzzles" />)
    expect(
      screen.getByRole('button', { name: /Solve more to remove/ }),
    ).toBeInTheDocument()
  })
})
