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
      engine={{ status, progress: 0, downloadModel, downloadFailed: false }}
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

  it("can't start a second download while one is under way", () => {
    setup('downloading', { withoutAsking: false })
    const button = screen.getByRole('button', { name: /Downloading/ })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(startMaiaDownload).not.toHaveBeenCalled()
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
    render(
      <MaiaDownloadPrompt
        engine={{
          status: 'error',
          progress: 0,
          downloadModel,
          downloadFailed: true,
        }}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(startMaiaDownload).toHaveBeenCalledWith(downloadModel, 'tap')
  })

  // A phone's prompt goes away when its download fails; the card that
  // replaces it, maybe on another screen, never saw the download.
  it('offers to try again after a phone prompt failed', () => {
    ;(downloadsWithoutAsking as jest.Mock).mockReturnValue(false)
    render(
      <MaiaDownloadPrompt
        engine={{
          status: 'error',
          progress: 0,
          downloadModel: jest.fn(),
          downloadFailed: true,
        }}
        wanted={false}
      />,
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument()
  })

  it('says nothing of a download when Maia failed some other way', () => {
    render(
      <MaiaDownloadPrompt
        engine={{
          status: 'error',
          progress: 0,
          downloadModel: jest.fn(),
          downloadFailed: false,
        }}
      />,
    )
    expect(screen.queryByTestId('maia-download-card')).not.toBeInTheDocument()
  })

  it('shows nothing once Maia is ready', () => {
    setup('ready')
    expect(screen.queryByTestId('maia-download-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('download-modal')).not.toBeInTheDocument()
  })
})
