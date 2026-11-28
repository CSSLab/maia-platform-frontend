import { fireEvent, render, screen } from '@testing-library/react'
import { PlayedLike } from './PlayedLike'
import {
  PLAYED_LIKE_LEVELS,
  PlayedLikeMove,
  estimatePlayedLike,
} from 'src/lib/playedLike'

const flat = PLAYED_LIKE_LEVELS.map(() => 0.3)
const good = PLAYED_LIKE_LEVELS.map((r) => 0.05 + 0.5 * ((r - 600) / 2000))
const blunder = PLAYED_LIKE_LEVELS.map((r) => 0.2 * Math.exp(-(r - 600) / 400))

const moves = (probs: number[][]): PlayedLikeMove[] =>
  probs.map((p, i) => ({
    ply: 20 + 2 * i,
    moveNumber: 11 + i,
    san: `N${i}`,
    uci: 'g1f3',
    probs: p,
    nLegal: 30,
  }))

describe('PlayedLike', () => {
  it('says when there are too few moves', () => {
    render(<PlayedLike estimate={null} color="white" playerName="Ana" />)
    expect(screen.getByText(/Not enough moves/)).toBeInTheDocument()
  })

  it('shows the estimate, the range and the moves each way', () => {
    const estimate = estimatePlayedLike(
      moves([...Array(15).fill(flat), good, good, blunder]),
    )!
    const onSelectPly = jest.fn()
    render(
      <PlayedLike
        estimate={estimate}
        color="white"
        playerName="Ana"
        playerRating={1500}
        onSelectPly={onSelectPly}
      />,
    )
    expect(screen.getByText('Ana played like')).toBeInTheDocument()
    expect(screen.getByText(`~${estimate.rounded}`)).toBeInTheDocument()
    expect(screen.getByText(/^likely \d+–\d+$/)).toBeInTheDocument()
    expect(screen.getByText('Moves that raised it')).toBeInTheDocument()
    expect(screen.getByText('Moves that lowered it')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Players who play 28\. N17 here/))
    expect(onSelectPly).toHaveBeenCalledWith(54)
  })
})
