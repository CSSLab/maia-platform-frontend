import { fireEvent, render, screen } from '@testing-library/react'
import { ServerGame } from 'src/lib/serverGames'
import { GameInProgressModal } from './GameInProgressModal'

const game = (fields: Partial<ServerGame> = {}): ServerGame => ({
  game_id: 'abc123',
  game_type: 'play',
  player_color: 'white',
  maia_name: 'maia_kdd_1500',
  time_control: '3+0',
  sample_moves: false,
  practice: false,
  fen: '8/8/8/4k3/8/8/4K3/7R w - - 0 1',
  moves: [],
  move_times: [],
  ply: 22,
  to_move: 'white',
  state: 'not_over',
  winner: '',
  clock: null,
  bot_move: null,
  rating: null,
  ...fields,
})

describe('GameInProgressModal', () => {
  it('shows nothing without a game in progress', () => {
    const { container } = render(
      <GameInProgressModal
        resigning={false}
        onContinue={jest.fn()}
        onStartNew={jest.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('names the game, and goes on with it or starts the new one', () => {
    const onContinue = jest.fn()
    const onStartNew = jest.fn()
    render(
      <GameInProgressModal
        game={game()}
        resigning={false}
        onContinue={onContinue}
        onStartNew={onStartNew}
      />,
    )

    expect(
      screen.getByRole('dialog', { name: 'You have a game in progress' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Maia 1500, 3+0, move 12')).toBeInTheDocument()
    // A game from a set position isn't rated.
    expect(screen.getByText(/It's unrated/)).toBeInTheDocument()

    // The answer that loses nothing has the focus.
    const goOn = screen.getByRole('button', { name: 'Continue it' })
    expect(goOn).toHaveFocus()
    fireEvent.click(goOn)
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onStartNew).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Start new game' }))
    expect(onStartNew).toHaveBeenCalledTimes(1)
  })

  it('says that resigning a rated game counts', () => {
    render(
      <GameInProgressModal
        game={game({ fen: '' })}
        resigning={false}
        onContinue={jest.fn()}
        onStartNew={jest.fn()}
      />,
    )
    expect(
      screen.getByText(/the loss counts for your rating/),
    ).toBeInTheDocument()
  })

  it('takes no second answer while the game is being resigned', () => {
    render(
      <GameInProgressModal
        game={game()}
        resigning
        onContinue={jest.fn()}
        onStartNew={jest.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Continue it' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled()
  })
})
