import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { GameFeedback } from './GameFeedback'
import { sendGameFeedback } from 'src/api/play'
import {
  trackGameFeedbackGiven,
  trackGameFeedbackShown,
} from 'src/lib/analytics'

jest.mock('src/api/play', () => ({
  sendGameFeedback: jest.fn(() => Promise.resolve()),
}))
jest.mock('src/lib/analytics', () => ({
  trackGameFeedbackGiven: jest.fn(),
  trackGameFeedbackShown: jest.fn(),
}))

const send = sendGameFeedback as jest.Mock

// A new game for each test: what's said about a game is kept for the visit.
let gameId = ''
let games = 0

const panel = () =>
  render(<GameFeedback gameId={gameId} maiaVersion="maia_kdd_1500" />)

const radio = (group: string, value: number) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', {
    name: new RegExp(`^${value} of 5`),
  })

describe('GameFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    games += 1
    gameId = `game-${games}`
  })

  it('asks the three questions, and nothing has been sent', () => {
    panel()
    expect(
      screen.getByRole('radiogroup', {
        name: 'How much did you enjoy this game?',
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('radiogroup', { name: 'How human-like did Maia play?' }),
    ).toBeTruthy()
    // The bot's rating, from its name.
    expect(
      screen.getByRole('radiogroup', {
        name: 'How strong did Maia play for a 1500?',
      }),
    ).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(send).not.toHaveBeenCalled()
    expect(trackGameFeedbackShown).toHaveBeenCalledTimes(1)
  })

  it('sends a rating as soon as it is picked', async () => {
    panel()
    await act(async () => {
      fireEvent.click(radio('How human-like did Maia play?', 4))
    })
    expect(send).toHaveBeenCalledWith(gameId, { humanlike: 4 })
    expect(trackGameFeedbackGiven).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'humanlike', value: 4 }),
    )
    expect(
      radio('How human-like did Maia play?', 4).getAttribute('aria-checked'),
    ).toBe('true')
    // Picking the same rating again sends nothing more.
    await act(async () => {
      fireEvent.click(radio('How human-like did Maia play?', 4))
    })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('sends how strong Maia felt', async () => {
    panel()
    const strength = screen.getByRole('radiogroup', {
      name: 'How strong did Maia play for a 1500?',
    })
    await act(async () => {
      fireEvent.click(
        within(strength).getByRole('radio', { name: 'Too strong' }),
      )
    })
    expect(send).toHaveBeenCalledWith(gameId, { strength: 'too_strong' })
    expect(trackGameFeedbackGiven).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'strength', value: 'too_strong' }),
    )
    // Answering it is enough to be offered the comment.
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('then takes a comment, sent with the ratings, and says thanks', async () => {
    panel()
    await act(async () => {
      fireEvent.click(radio('How much did you enjoy this game?', 5))
    })
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  Played the opening like me!  ' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }))
    })
    expect(send).toHaveBeenLastCalledWith(gameId, {
      enjoyment: 5,
      comment: 'Played the opening like me!',
    })
    expect(screen.getByText(/Thanks for the feedback/)).toBeTruthy()
  })

  it('says so when it could not send', async () => {
    send.mockRejectedValueOnce(new Error('offline'))
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    panel()
    await act(async () => {
      fireEvent.click(radio('How much did you enjoy this game?', 2))
    })
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('finishes without a comment, sending nothing more', async () => {
    panel()
    await act(async () => {
      fireEvent.click(radio('How much did you enjoy this game?', 3))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }))
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Thanks for the feedback/)).toBeTruthy()
  })

  it('keeps what was said when it is drawn again (the layout changed)', async () => {
    const first = panel()
    await act(async () => {
      fireEvent.click(radio('How much did you enjoy this game?', 4))
    })
    first.unmount()

    const second = panel()
    expect(
      radio('How much did you enjoy this game?', 4).getAttribute(
        'aria-checked',
      ),
    ).toBe('true')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }))
    })
    second.unmount()

    panel()
    expect(screen.getByText(/Thanks for the feedback/)).toBeTruthy()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(send).toHaveBeenCalledTimes(1)
    expect(trackGameFeedbackShown).toHaveBeenCalledTimes(1)
  })
})
