import { fireEvent, render, screen } from '@testing-library/react'

import { capture } from 'src/lib/posthogClient'

import {
  ChallengeFeedback,
  ChallengeShareModal,
  attempts,
  resultText,
} from './ChallengeShare'

jest.mock('src/lib/posthogClient', () => ({ capture: jest.fn() }))

describe('sharing a challenge', () => {
  it('says how it went', () => {
    expect(
      resultText(1, { outcome: 'win', passed: true, level: 1500, moves: 15 }),
    ).toBe(
      'I passed World Championship Challenge 1: I beat Maia 1500 in 15 moves. Can you?',
    )
    expect(
      resultText(3, { outcome: 'draw', passed: true, level: 1500, moves: 40 }),
    ).toBe(
      'I passed World Championship Challenge 3: I held Maia 1500 to a draw in 40 moves. Can you?',
    )
    expect(resultText(2, { outcome: 'loss', passed: false, level: 600 })).toBe(
      'Maia 600 beat me in World Championship Challenge 2. Can you do better?',
    )
  })

  it('marks each try at the challenge', () => {
    expect(
      attempts({
        tries: 4,
        wins: 1,
        draws: 1,
        beaten: [1500],
        history: 'ldlp',
      }),
    ).toBe('Attempts: 🟥🟨🟥✅')
    expect(attempts({ tries: 0, wins: 0, draws: 0, beaten: [] })).toBe('')
  })

  it('tells the player whether they passed', () => {
    const { rerender } = render(
      <ChallengeFeedback
        round={2}
        game={{ outcome: 'draw', passed: false, level: 2000, moves: 30 }}
        drawPasses={false}
      />,
    )
    expect(screen.getByText('Game 2 Challenge not passed')).toBeTruthy()
    expect(screen.getByText(/You need a win to pass/)).toBeTruthy()
    rerender(
      <ChallengeFeedback
        round={1}
        game={{ outcome: 'win', passed: true, level: 1500, moves: 15 }}
        drawPasses={false}
      />,
    )
    expect(screen.getByText('Game 1 Challenge passed')).toBeTruthy()
    expect(screen.getByText('You beat Maia 1500 in 15 moves.')).toBeTruthy()
  })

  it('counts the dialog being opened and what was shared', () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn(() => Promise.resolve()) },
    })
    render(
      <ChallengeShareModal
        round={1}
        game={{ outcome: 'win', passed: true, level: 1500, moves: 15 }}
        tallies={{}}
        from="after_game"
        onClose={() => undefined}
      />,
    )
    expect(capture).toHaveBeenCalledWith('wch_challenge_share_opened', {
      round: 1,
      from: 'after_game',
      has_result: true,
    })
    fireEvent.click(screen.getByText('Copy'))
    expect(capture).toHaveBeenCalledWith('wch_challenge_shared', {
      round: 1,
      method: 'copy',
      shared: 'result',
      passed: true,
    })
  })
})
