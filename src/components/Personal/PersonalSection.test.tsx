import { fireEvent, render, screen } from '@testing-library/react'
import { AuthContext } from 'src/contexts/AuthContext'
import {
  trackLastGameAnalyzeClicked,
  trackLastGameCardShown,
  trackLastGameMomentClicked,
  trackSigninTeaserClicked,
} from 'src/lib/analytics'
import { useLastGame, useMomentFinder } from 'src/hooks/useLastGameMoments'
import { PersonalSection } from './PersonalSection'

jest.mock('src/lib/analytics', () => ({
  trackLastGameCardShown: jest.fn(),
  trackLastGameAnalyzeClicked: jest.fn(),
  trackLastGameMomentClicked: jest.fn(),
  trackProgressStripShown: jest.fn(),
  trackSigninTeaserClicked: jest.fn(),
  trackDownloadModelModalShown: jest.fn(),
}))
jest.mock('src/hooks/useLastGameMoments', () => ({
  useLastGame: jest.fn(),
  useMomentFinder: jest.fn(),
}))
// Engines start only inside it: the test sees when it's there.
jest.mock('./PersonalEngines', () => ({
  PersonalEngines: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="engines">{children}</div>
  ),
}))
jest.mock('./ProgressStrip', () => ({ ProgressStrip: () => null }))
jest.mock('@react-chess/chessground', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode
    href: string
    onClick?: () => void
  }) => (
    <a href={href} onClick={(e) => (e.preventDefault(), onClick?.())}>
      {children}
    </a>
  ),
}))

const withUser = (
  user: { clientId: string; displayName: string; lichessId?: string } | null,
) =>
  render(
    <AuthContext.Provider
      value={{ user, connectLichess: jest.fn(), logout: jest.fn() }}
    >
      <PersonalSection location="home" />
    </AuthContext.Provider>,
  )

const moment = {
  moveIndex: 8,
  fen: 'f',
  playedMove: 'd8g5',
  playedSan: 'Qg5',
  bestMove: 'd4f3',
  bestSan: 'Nf3+',
  winrateLoss: 0.3,
  kind: 'blunder' as const,
  moveLabel: '4…',
}

describe('PersonalSection', () => {
  beforeEach(() => jest.clearAllMocks())

  it('asks a guest to sign in, and reports the press', () => {
    withUser({ clientId: 'c', displayName: 'Guest' })
    expect(
      screen.getByText('Sign in with Lichess to get your games analyzed'),
    ).toBeTruthy()
    fireEvent.click(screen.getByText('Sign in with Lichess'))
    expect(trackSigninTeaserClicked).toHaveBeenCalledWith('home')
  })

  it('reports the card once when it settles, and a moment opened', () => {
    ;(useLastGame as jest.Mock).mockReturnValue({
      update: jest.fn(),
      state: {
        status: 'done',
        game: { id: 'g', opponentRating: 1800, speed: 'blitz', result: 'loss' },
        entry: {
          gameId: 'g',
          gameType: 'lichess',
          color: 'black',
          moments: [moment],
          usedMaia: false,
          savedAt: 0,
        },
      },
    })
    const { rerender } = withUser({
      clientId: 'c',
      displayName: 'alice',
      lichessId: 'alice',
    })
    rerender(
      <AuthContext.Provider
        value={{
          user: { clientId: 'c', displayName: 'alice', lichessId: 'alice' },
          connectLichess: jest.fn(),
          logout: jest.fn(),
        }}
      >
        <PersonalSection location="home" />
      </AuthContext.Provider>,
    )
    expect(screen.getByText('Your last game')).toBeTruthy()
    expect(screen.getAllByTestId('moment-board')).toHaveLength(1)
    expect(screen.getByText('vs 1800 · blitz · You lost')).toBeTruthy()
    expect(trackLastGameCardShown).toHaveBeenCalledTimes(1)
    expect(trackLastGameCardShown).toHaveBeenCalledWith(true, false, 'home')

    fireEvent.click(screen.getByText('Qg5??'))
    expect(trackLastGameMomentClicked).toHaveBeenCalledWith(0, 'home')
    expect(screen.getByText('Qg5??').closest('a')?.getAttribute('href')).toBe(
      '/analysis/g/lichess?ply=7',
    )
  })

  it('analyses nothing until asked, then starts the engines', () => {
    ;(useLastGame as jest.Mock).mockReturnValue({
      update: jest.fn(),
      state: {
        status: 'not_analysed',
        game: { id: 'g', opponentRating: 1800, speed: 'blitz', result: 'win' },
      },
    })
    ;(useMomentFinder as jest.Mock).mockReturnValue({
      state: { status: 'analyzing', progress: { done: 3, total: 20 } },
      maia: { status: 'no-cache' },
    })
    withUser({ clientId: 'c', displayName: 'alice', lichessId: 'alice' })
    expect(screen.queryByTestId('engines')).toBeNull()
    expect(useMomentFinder).not.toHaveBeenCalled()
    expect(trackLastGameCardShown).toHaveBeenCalledWith(false, false, 'home')

    fireEvent.click(screen.getByText('Find key moments'))
    expect(trackLastGameAnalyzeClicked).toHaveBeenCalledWith('moments', 'home')
    expect(screen.getByTestId('engines')).toBeTruthy()
    expect(screen.getByText('Finding the key moments…')).toBeTruthy()
    expect(screen.queryByText('Find key moments')).toBeNull()
  })
})
