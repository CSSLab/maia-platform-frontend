import { act, fireEvent, render, screen } from '@testing-library/react'
import { MaiaDownloadPrompt } from './MaiaDownloadPrompt'
import {
  downloadsWithoutAsking,
  startMaiaDownload,
} from 'src/lib/engine/maiaDownloadPrompt'
import { MaiaStatus } from 'src/types'

jest.mock('src/lib/engine/maiaDownloadPrompt', () => ({
  ...jest.requireActual('src/lib/engine/maiaDownloadPrompt'),
  downloadsWithoutAsking: jest.fn(),
  startMaiaDownload: jest.fn().mockResolvedValue(true),
}))

jest.mock('src/lib/analytics', () => ({
  trackDownloadModelModalShown: jest.fn(),
}))

const setup = (
  status: MaiaStatus,
  {
    withoutAsking = true,
    wanted,
  }: {
    withoutAsking?: boolean
    wanted?: boolean
  } = {},
) => {
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
  })

  it('blocks the page on a phone until Maia is downloaded', async () => {
    setup('no-cache', { withoutAsking: false })
    expect(screen.getByTestId('download-modal')).toBeInTheDocument()
    expect(screen.getByText('Return Home')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Continue without Maia' }),
    ).not.toBeInTheDocument()
    expect(startMaiaDownload).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Download/ }))
    })
    expect(startMaiaDownload).toHaveBeenCalledWith(expect.any(Function), 'wall')
  })

  it('blocks the page on a phone even before the page wants Maia', () => {
    setup('no-cache', { withoutAsking: false, wanted: false })
    expect(screen.getByTestId('download-modal')).toBeInTheDocument()
  })

  it('downloads without asking on a desktop, and does not block', async () => {
    const { downloadModel } = setup('no-cache')
    await act(async () => undefined)
    expect(startMaiaDownload).toHaveBeenCalledTimes(1)
    expect(startMaiaDownload).toHaveBeenCalledWith(downloadModel, 'auto')
    expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument()
  })

  it('does nothing on a desktop until the page wants Maia', async () => {
    setup('no-cache', { wanted: false })
    await act(async () => undefined)
    expect(startMaiaDownload).not.toHaveBeenCalled()
    expect(screen.queryByTestId('maia-download-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument()
  })

  it('shows a card, not the prompt, during a desktop download', () => {
    setup('downloading')
    expect(screen.getByTestId('maia-download-card')).toBeInTheDocument()
    expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument()
  })

  it('offers to try again after a failed download', async () => {
    const downloadModel = jest.fn().mockResolvedValue(false)
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
