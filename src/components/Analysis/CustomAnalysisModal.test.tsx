import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { CustomAnalysisModal } from './CustomAnalysisModal'

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn() },
}))

const studyPgn = `[Event "Openings: Italian"]
[StudyName "Openings"]
[ChapterName "Italian"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 *


[Event "Openings: Scotch"]
[StudyName "Openings"]
[ChapterName "Scotch"]

1. e4 e5 2. Nf3 Nc6 3. d4 (3. Bb5) *
`

const respond = (status: number, body = '') =>
  jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  })

describe('CustomAnalysisModal with a Lichess study', () => {
  const originalFetch = global.fetch
  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it('lists a study’s chapters and imports the one picked', async () => {
    global.fetch = respond(200, studyPgn)
    const onSubmit = jest.fn()
    render(<CustomAnalysisModal onSubmit={onSubmit} onClose={jest.fn()} />)

    fireEvent.click(screen.getByText('Lichess Study'))
    fireEvent.change(screen.getByLabelText('Study Link:'), {
      target: { value: 'https://lichess.org/study/a1b2c3d4' },
    })
    fireEvent.click(screen.getByText('Load Study'))

    expect(global.fetch).toHaveBeenCalledWith(
      'https://lichess.org/api/study/a1b2c3d4.pgn?clocks=false',
      expect.anything(),
    )
    fireEvent.click(await screen.findByText('2. Scotch'))
    fireEvent.click(screen.getByText('Analyze'))

    expect(onSubmit).toHaveBeenCalledWith(
      'pgn',
      expect.stringContaining('3. d4 (3. Bb5)'),
      'Openings: Scotch',
    )
  })

  it('takes a study link pasted as PGN, and says when it’s private', async () => {
    global.fetch = respond(403)
    const onSubmit = jest.fn()
    render(<CustomAnalysisModal onSubmit={onSubmit} onClose={jest.fn()} />)

    fireEvent.change(screen.getByLabelText('PGN Data:'), {
      target: { value: 'lichess.org/study/a1b2c3d4/e5f6g7h8' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/private/),
      ),
    )
    expect(global.fetch).toHaveBeenCalledWith(
      'https://lichess.org/api/study/a1b2c3d4/e5f6g7h8.pgn?clocks=false',
      expect.anything(),
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
