import { fireEvent, render, screen } from '@testing-library/react'
import { ComponentProps } from 'react'
import { SiteNotification } from 'src/types'
import { NotificationBell } from './NotificationBell'

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/',
    events: { on: jest.fn(), off: jest.fn() },
  }),
}))
jest.mock('src/lib/analytics', () => ({
  trackNotificationsOpened: jest.fn(),
  trackNotificationClicked: jest.fn(),
}))

const notification = (
  overrides: Partial<SiteNotification> = {},
): SiteNotification => ({
  id: 'a',
  kind: 'announcement',
  title: 'Maia 3 is here',
  createdAt: '2026-11-12T15:04:05.000Z',
  read: false,
  ...overrides,
})

const onOpenChange = jest.fn()
const onRetry = jest.fn()

const renderBell = (
  props: Partial<ComponentProps<typeof NotificationBell>> = {},
) =>
  render(
    <NotificationBell
      unreadCount={0}
      notifications={[]}
      status="ready"
      open={false}
      onOpenChange={onOpenChange}
      onRetry={onRetry}
      {...props}
    />,
  )

beforeEach(() => jest.clearAllMocks())

describe('the bell', () => {
  it('has no badge when nothing is unread', () => {
    renderBell()
    expect(
      screen.getByRole('button', { name: 'Notifications' }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('notification-badge')).toBeNull()
  })

  it.each([
    [1, '1'],
    [9, '9'],
    [10, '9+'],
    [250, '9+'],
  ])('shows %i unread as %s', (unreadCount, text) => {
    renderBell({ unreadCount })
    expect(screen.getByTestId('notification-badge')).toHaveTextContent(text)
    expect(
      screen.getByRole('button', {
        name: `Notifications, ${unreadCount} unread`,
      }),
    ).toBeInTheDocument()
  })

  it('opens and closes on a click', () => {
    const { rerender } = renderBell()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(onOpenChange).toHaveBeenLastCalledWith(true)

    rerender(
      <NotificationBell
        unreadCount={0}
        notifications={[]}
        status="ready"
        open
        onOpenChange={onOpenChange}
        onRetry={onRetry}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('closes on Escape and on a press outside it, not on one inside', () => {
    renderBell({ open: true })
    fireEvent.pointerDown(screen.getByRole('dialog'))
    expect(onOpenChange).not.toHaveBeenCalled()

    fireEvent.pointerDown(document.body)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)

    onOpenChange.mockClear()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })
})

describe('the list', () => {
  it('is not rendered while closed', () => {
    renderBell({ notifications: [notification()] })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('marks the unread ones as new', () => {
    renderBell({
      open: true,
      notifications: [
        notification({ id: 'a', title: 'Unread one' }),
        notification({ id: 'b', title: 'Read one', read: true }),
      ],
    })
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Unread one')
    expect(items[0].querySelector('[aria-label="New"]')).not.toBeNull()
    expect(items[1].querySelector('[aria-label="New"]')).toBeNull()
  })

  it('links to a page of the site, and closes when it is followed', () => {
    renderBell({
      open: true,
      notifications: [
        notification({
          kind: 'leaderboard',
          title: "You're on the leaderboard",
          body: 'You are #3 on the Puzzles leaderboard.',
          link: '/leaderboard',
        }),
      ],
    })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/leaderboard')
    expect(link).not.toHaveAttribute('target')
    expect(link).toHaveTextContent('You are #3 on the Puzzles leaderboard.')
    fireEvent.click(link)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('opens another site in a new tab', () => {
    renderBell({
      open: true,
      notifications: [notification({ link: 'https://lichess.org/@/maia1' })],
    })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://lichess.org/@/maia1')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('is plain text without a link', () => {
    renderBell({ open: true, notifications: [notification()] })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Maia 3 is here')).toBeInTheDocument()
  })

  it('says so when there is nothing', () => {
    renderBell({ open: true })
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument()
  })

  it('shows that it is loading', () => {
    renderBell({ open: true, status: 'loading' })
    expect(
      screen.getByRole('status', { name: 'Loading notifications' }),
    ).toBeInTheDocument()
  })

  it('offers another try when it could not load', () => {
    renderBell({ open: true, status: 'error' })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('keeps showing the last list while a newer one loads or fails', () => {
    for (const status of ['loading', 'error'] as const) {
      const { unmount } = renderBell({
        open: true,
        status,
        notifications: [notification()],
      })
      expect(screen.getByText('Maia 3 is here')).toBeInTheDocument()
      expect(screen.queryByRole('status')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
      unmount()
    }
  })
})
