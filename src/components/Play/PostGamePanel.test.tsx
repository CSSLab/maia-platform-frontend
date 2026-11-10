import { fireEvent, render, screen } from '@testing-library/react'
import { AuthContext } from 'src/contexts/AuthContext'
import {
  trackPostGameCtaClicked,
  trackPostGameCtaShown,
  trackSigninPromptClicked,
  trackSigninPromptShown,
} from 'src/lib/analytics'
import { PostGamePanel } from './PostGamePanel'

jest.mock('src/lib/analytics', () => ({
  trackPostGameCtaShown: jest.fn(),
  trackPostGameCtaClicked: jest.fn(),
  trackSigninPromptShown: jest.fn(),
  trackSigninPromptClicked: jest.fn(),
}))

const guest = { clientId: 'c', displayName: 'Guest' }
const linked = { clientId: 'c', displayName: 'alice', lichessId: 'alice' }

const renderPanel = (
  props: Partial<React.ComponentProps<typeof PostGamePanel>> = {},
  user: typeof guest | typeof linked | null = linked,
) =>
  render(
    <AuthContext.Provider
      value={{ user, connectLichess: jest.fn(), logout: jest.fn() }}
    >
      <PostGamePanel gameId="g1" gameType="play" {...props} />
    </AuthContext.Provider>,
  )

describe('PostGamePanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reports each action once as shown', () => {
    const playAgain = jest.fn()
    const { rerender } = renderPanel({ playAgain })
    rerender(
      <AuthContext.Provider
        value={{ user: linked, connectLichess: jest.fn(), logout: jest.fn() }}
      >
        <PostGamePanel gameId="g1" gameType="play" playAgain={playAgain} />
      </AuthContext.Provider>,
    )
    expect((trackPostGameCtaShown as jest.Mock).mock.calls).toEqual([
      ['analyze', 'g1', 'play'],
      ['play_again', 'g1', 'play'],
    ])
  })

  it('hides practice until there is one to go to', () => {
    renderPanel({ playAgain: jest.fn() })
    expect(screen.queryByText('Practice your mistakes')).toBeNull()

    jest.clearAllMocks()
    renderPanel({ practiceHref: '/practice?game=g1' })
    expect(screen.getByText('Practice your mistakes')).toBeTruthy()
    expect(trackPostGameCtaShown).toHaveBeenCalledWith('practice', 'g1', 'play')
  })

  it("offers practice and a drill of the game's opening as quieter links", () => {
    renderPanel({ playAgain: jest.fn() })
    expect(screen.queryByText(/^Drill the/)).toBeNull()

    jest.clearAllMocks()
    renderPanel({
      practiceHref: '/practice?game=g1',
      drill: { href: '/drills?opening=italian-game', name: 'Italian Game' },
      playAgain: jest.fn(),
    })
    const link = screen.getByText('Drill the Italian Game').closest('a')!
    expect(link.getAttribute('href')).toBe('/drills?opening=italian-game')
    expect(
      (trackPostGameCtaShown as jest.Mock).mock.calls.map(([cta]) => cta),
    ).toEqual(['analyze', 'play_again', 'practice', 'drill_opening'])

    fireEvent.click(link)
    expect(trackPostGameCtaClicked).toHaveBeenCalledWith(
      'drill_opening',
      'g1',
      'play',
    )
  })

  it('reports a press and acts on it', () => {
    const playAgain = jest.fn()
    const open = jest.spyOn(window, 'open').mockImplementation(() => null)
    renderPanel({ playAgain, gameType: 'brain' })

    fireEvent.click(screen.getByText('Play again'))
    expect(playAgain).toHaveBeenCalledTimes(1)
    expect(trackPostGameCtaClicked).toHaveBeenCalledWith(
      'play_again',
      'g1',
      'brain',
    )

    fireEvent.click(screen.getByText('Analyze'))
    expect(open).toHaveBeenCalledWith('/analysis/g1/brain', '_blank')
  })

  it('asks guests only to sign in, and reports it', () => {
    renderPanel({}, linked)
    expect(screen.queryByText('Sign in with Lichess')).toBeNull()
    expect(trackSigninPromptShown).not.toHaveBeenCalled()

    renderPanel({}, guest)
    expect(screen.getByText('Keep your rating and games')).toBeTruthy()
    expect(trackSigninPromptShown).toHaveBeenCalledTimes(1)
    expect(trackSigninPromptShown).toHaveBeenCalledWith('post_game')

    fireEvent.click(screen.getByText('Sign in with Lichess'))
    expect(trackSigninPromptClicked).toHaveBeenCalledWith('post_game')
  })
})
