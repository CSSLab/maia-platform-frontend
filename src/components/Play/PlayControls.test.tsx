import { act, fireEvent, render, screen } from '@testing-library/react'
import { Chess } from 'chess.ts'
import { GameTree } from 'src/types'
import { PlayControls } from './PlayControls'
import { AuthContext } from 'src/contexts/AuthContext'

// The components index pulls in modules Jest can't parse (react-markdown);
// only the resign dialog is used here.
jest.mock('src/components', () => ({ ResignationConfirmModal: () => null }))

const game = {
  id: 'game',
  turn: 'white' as const,
  tree: new GameTree(new Chess().fen()),
}

const renderControls = (takeBack = jest.fn(), addTime = jest.fn()) => {
  render(
    <PlayControls
      game={game}
      playerActive={true}
      gameOver={false}
      practice={true}
      takeBack={takeBack}
      addTime={addTime}
    />,
  )
  return { takeBack, addTime }
}

describe('PlayControls practice buttons', () => {
  afterEach(() => jest.useRealTimers())

  it('takes a move back only on the confirming second tap', () => {
    const { takeBack } = renderControls()

    fireEvent.click(screen.getByText('Takeback'))
    expect(takeBack).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Confirm takeback'))
    expect(takeBack).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Takeback')).toBeTruthy()
  })

  it('adds time only on the confirming second tap', () => {
    const { addTime } = renderControls()

    fireEvent.click(screen.getByText('+15s'))
    expect(addTime).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Confirm +15s'))
    expect(addTime).toHaveBeenCalledTimes(1)
  })

  it('goes back to the plain button if the second tap does not come', () => {
    jest.useFakeTimers()
    const { takeBack } = renderControls()

    fireEvent.click(screen.getByText('Takeback'))
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    fireEvent.click(screen.getByText('Takeback'))
    expect(takeBack).not.toHaveBeenCalled()
  })
})

describe('PlayControls sign-in prompt after a game', () => {
  const connectLichess = jest.fn()
  const renderOver = (
    user: { clientId: string; displayName: string; lichessId?: string } | null,
    gameOver = true,
  ) =>
    render(
      <AuthContext.Provider value={{ user, connectLichess, logout: jest.fn() }}>
        <PlayControls
          game={game}
          playerActive={false}
          gameOver={gameOver}
          playAgain={jest.fn()}
        />
      </AuthContext.Provider>,
    )

  beforeEach(() => connectLichess.mockClear())

  it('asks a guest to sign in, coming back to /play', () => {
    renderOver({ clientId: 'c', displayName: '' })
    fireEvent.click(screen.getByText('Sign in with Lichess'))
    expect(connectLichess).toHaveBeenCalledWith('game_over', '/play')
  })

  it('does not ask a signed-in player', () => {
    renderOver({ clientId: 'c', displayName: 'alice', lichessId: 'alice' })
    expect(screen.queryByText('Sign in with Lichess')).toBeNull()
  })

  it('does not ask before the account has loaded, or during a game', () => {
    renderOver(null)
    expect(screen.queryByText('Sign in with Lichess')).toBeNull()
    renderOver({ clientId: 'c', displayName: '' }, false)
    expect(screen.queryByText('Sign in with Lichess')).toBeNull()
  })
})
