import { capture } from 'src/lib/posthogClient'
import {
  trackDownloadModelCompleted,
  trackDownloadModelInitiated,
  trackLeaveGamePromptAnswered,
  trackPuzzleSolutionShown,
} from './analytics'
import { leaveGameDestination } from './leaveGame'

jest.mock('src/lib/posthogClient', () => ({ capture: jest.fn() }))

describe('Maia download events', () => {
  beforeEach(() => jest.clearAllMocks())

  it('name the model browsers download, and its size', () => {
    trackDownloadModelInitiated('/analysis', 'wall')
    trackDownloadModelCompleted(12, '/analysis')
    expect((capture as jest.Mock).mock.calls).toEqual([
      [
        'download_model_initiated',
        {
          model_type: 'maia3',
          model_size_mb: 42,
          page: '/analysis',
          trigger: 'wall',
        },
      ],
      [
        'download_model_completed',
        { model_type: 'maia3', download_time_seconds: 12, page: '/analysis' },
      ],
    ])
  })
})

describe('the answer to leaving a game in progress', () => {
  beforeEach(() => jest.clearAllMocks())

  it('says whether the player stayed, and where they were going', () => {
    trackLeaveGamePromptAnswered(
      'g1',
      'vs_maia',
      true,
      23,
      leaveGameDestination('/profile/alice?tab=games'),
    )
    expect(capture).toHaveBeenCalledWith('leave_game_prompt_answered', {
      game_id: 'g1',
      game_type: 'vs_maia',
      stayed: true,
      ply_count: 23,
      destination: '/profile',
    })
  })

  it('keeps only the first part of the address', () => {
    expect(leaveGameDestination('/')).toBe('/')
    expect(leaveGameDestination('/analysis/abc123/play')).toBe('/analysis')
    expect(leaveGameDestination('/puzzles#x')).toBe('/puzzles')
  })
})

it('reports a puzzle given up, with the wrong moves before it', () => {
  jest.clearAllMocks()
  trackPuzzleSolutionShown('p1', 2, { seconds: 40, hiddenSeconds: 0 })
  expect(capture).toHaveBeenCalledWith('puzzle_solution_shown', {
    puzzle_id: 'p1',
    wrong_guesses: 2,
    time_taken_seconds: 40,
    time_hidden_seconds: 0,
  })
})
