import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MaiaDownloadPrompt } from './MaiaDownloadPrompt'
import { trackDownloadModelDismissed } from 'src/lib/analytics'
import {
  downloadsWithoutAsking,
  maiaPromptVariant,
  startMaiaDownload,
} from 'src/lib/engine/maiaDownloadPrompt'
import { MaiaStatus } from 'src/types'

jest.mock('src/lib/engine/maiaDownloadPrompt', () => ({
  ...jest.requireActual('src/lib/engine/maiaDownloadPrompt'),
  downloadsWithoutAsking: jest.fn(),
  maiaPromptVariant: jest.fn(),
  startMaiaDownload: jest.fn().mockResolvedValue(true),
}))

jest.mock('src/lib/analytics', () => ({
  trackDownloadModelDismissed: jest.fn(),
  trackDownloadModelModalShown: jest.fn(),
}))

const setup = (
  status: MaiaStatus,
  {
    variant = 'no_wall',
    withoutAsking = true,
    wanted,
  }: {
    variant?: 'wall' | 'no_wall'
    withoutAsking?: boolean
    wanted?: boolean
  } = {},
) => {
  ;(maiaPromptVariant as jest.Mock).mockReturnValue(variant)
  ;(downloadsWithoutAsking as jest.Mock).mockReturnValue(withoutAsking)
  const downloadModel = jest.fn().mockResolvedValue(true)
  const view = render(
    <MaiaDownloadPrompt
      engine={{ status, progress: 0, downloadModel }}
      wanted={wanted}
    />,
  )
  return { downloadModel, ...view }
}

describe('MaiaDownloadPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
  })

  it('blocks the page on a phone, with no way past it, in the full-page group', () => {
    setup('no-cache', { variant: 'wall', withoutAsking: false })
    expect(screen.getByTestId('download-modal')).toBeInTheDocument()
    expect(screen.getByText('Return Home')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Continue without Maia' }),
    ).not.toBeInTheDocument()
    expect(startMaiaDownload).not.toHaveBeenCalled()
  })

  it('downloads without asking on a desktop, even in the full-page group', async () => {
    const { downloadModel } = setup('no-cache', { variant: 'wall' })
    await act(async () => undefined)
    expect(startMaiaDownload).toHaveBeenCalledWith(downloadModel, 'auto')
    expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument()
  })

  it('downloads without asking on a desktop, and does not block', async () => {
    const { downloadModel } = setup('no-cache')
    await act(async () => undefined)
    expect(startMaiaDownload).toHaveBeenCalledTimes(1)
    expect(startMaiaDownload).toHaveBeenCalledWith(downloadModel, 'auto')
    expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument()
  })

  it('asks on a phone, with the large prompt and "Continue without Maia"', async () => {
    setup('no-cache', { withoutAsking: false })
    await act(async () => undefined)
    expect(startMaiaDownload).not.toHaveBeenCalled()
    expect(screen.getByTestId('download-modal')).toBeInTheDocument()
    expect(screen.queryByText('Return Home')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Download/ }))
    })
    expect(startMaiaDownload).toHaveBeenCalledWith(expect.any(Function), 'tap')
  })

  it('stays away after "Continue without Maia" until the session ends', async () => {
    setup('no-cache', { withoutAsking: false })
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Continue without Maia' }),
      )
    })
    expect(trackDownloadModelDismissed).toHaveBeenCalledTimes(1)
    // It fades out first.
    await waitFor(() =>
      expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument(),
    )

    const again = setup('no-cache', { withoutAsking: false })
    expect(
      again.container.querySelector('[data-testid=download-modal]'),
    ).toBeNull()
  })

  it('does nothing until the page wants Maia', async () => {
    setup('no-cache', { wanted: false })
    await act(async () => undefined)
    expect(startMaiaDownload).not.toHaveBeenCalled()
    expect(screen.queryByTestId('maia-download-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument()
  })

  it('shows a card, not the prompt, during a download', () => {
    setup('downloading')
    expect(screen.getByTestId('maia-download-card')).toBeInTheDocument()
    expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument()
  })

  it('offers to try again after a failed download', async () => {
    const downloadModel = jest.fn().mockResolvedValue(false)
    ;(maiaPromptVariant as jest.Mock).mockReturnValue('no_wall')
    ;(downloadsWithoutAsking as jest.Mock).mockReturnValue(true)
    const { rerender } = render(
      <MaiaDownloadPrompt
        engine={{ status: 'downloading', progress: 0, downloadModel }}
      />,
    )
    rerender(
      <MaiaDownloadPrompt
        engine={{ status: 'error', progress: 0, downloadModel }}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(startMaiaDownload).toHaveBeenCalledWith(downloadModel, 'tap')
  })

  it('shows nothing once Maia is ready', () => {
    setup('ready')
    expect(screen.queryByTestId('maia-download-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument()
  })
})
