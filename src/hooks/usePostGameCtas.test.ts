import { renderHook } from '@testing-library/react'
import {
  PostGameCta,
  trackPostGameCtaClicked,
  trackPostGameCtaShown,
} from 'src/lib/analytics'
import { usePostGameCtas } from './usePostGameCtas'

jest.mock('src/lib/analytics', () => ({
  trackPostGameCtaShown: jest.fn(),
  trackPostGameCtaClicked: jest.fn(),
}))

const setup = (gameId: string, ctas: PostGameCta[]) =>
  renderHook(
    ({ gameId, ctas }) => usePostGameCtas(gameId, 'vs_maia', false, ctas),
    { initialProps: { gameId, ctas } },
  )

describe('usePostGameCtas', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reports each offer once a game, as shown', () => {
    const { rerender } = setup('g1', [])
    expect(trackPostGameCtaShown).not.toHaveBeenCalled()

    rerender({ gameId: 'g1', ctas: ['analyze', 'play_again'] })
    rerender({ gameId: 'g1', ctas: ['analyze', 'play_again'] })
    rerender({ gameId: 'g2', ctas: ['analyze'] })
    expect((trackPostGameCtaShown as jest.Mock).mock.calls).toEqual([
      ['analyze', 'g1', 'vs_maia', false],
      ['play_again', 'g1', 'vs_maia', false],
      ['analyze', 'g2', 'vs_maia', false],
    ])
  })

  it('reports a press', () => {
    const { result } = setup('g1', ['analyze'])
    result.current('analyze')
    expect(trackPostGameCtaClicked).toHaveBeenCalledWith(
      'analyze',
      'g1',
      'vs_maia',
      false,
    )
  })
})
