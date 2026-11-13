import { capture } from 'src/lib/posthogClient'
import {
  trackDownloadModelCompleted,
  trackDownloadModelInitiated,
} from './analytics'

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
