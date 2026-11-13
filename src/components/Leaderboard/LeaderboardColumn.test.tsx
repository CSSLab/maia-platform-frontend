import { render, screen } from '@testing-library/react'

import { LeaderboardColumn } from './LeaderboardColumn'

describe('LeaderboardColumn', () => {
  it("says the board's window: who is listed played within it", () => {
    render(<LeaderboardColumn id="regular" name="Regular" windowDays={7} />)
    expect(screen.getByText('Active in the last 7 days')).toBeInTheDocument()
  })

  it('says a widened window as the backend sends it', () => {
    render(<LeaderboardColumn id="brain" name="Brain" windowDays={90} />)
    expect(screen.getByText('Active in the last 90 days')).toBeInTheDocument()
  })

  it('says nothing about a window the backend has not sent', () => {
    render(<LeaderboardColumn id="hand" name="Hand" />)
    expect(screen.queryByText(/Active in the last/)).toBeNull()
  })
})
