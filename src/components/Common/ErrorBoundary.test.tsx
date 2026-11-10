import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/',
    asPath: '/',
    query: {},
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(undefined),
    events: { on: jest.fn(), off: jest.fn() },
  }),
}))
jest.mock('next/dynamic', () => () => () => null)
jest.mock('src/lib/analytics', () => ({
  trackErrorEncountered: jest.fn(),
}))

const Broken = () => {
  throw new Error('removeChild failed')
}

describe('ErrorBoundary', () => {
  it('shows the error screen, header included, and closes without failing', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { unmount } = render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
    // The header's cleanup clears the play dialog through ModalContext.
    expect(() => unmount()).not.toThrow()
    spy.mockRestore()
  })
})
