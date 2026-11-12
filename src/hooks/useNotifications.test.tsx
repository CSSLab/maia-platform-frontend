import { act, renderHook, waitFor } from '@testing-library/react'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationsRead,
} from 'src/api'
import { SiteNotification } from 'src/types'
import { UNREAD_COUNT_MAX_AGE_MS, useNotifications } from './useNotifications'

jest.mock('src/api', () => ({
  fetchNotifications: jest.fn(),
  fetchUnreadNotificationCount: jest.fn(),
  markNotificationsRead: jest.fn(),
}))

const api = {
  list: fetchNotifications as jest.Mock,
  count: fetchUnreadNotificationCount as jest.Mock,
  markRead: markNotificationsRead as jest.Mock,
}

const notification = (id: string, read: boolean): SiteNotification => ({
  id,
  kind: 'announcement',
  title: `Notification ${id}`,
  createdAt: '2026-11-12T15:04:05.000Z',
  read,
})

// Each test is its own account: the saved counts are kept per account, in
// the module and in localStorage.
let accounts = 0
let clientId: string

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  clientId = `client-${++accounts}`
})

afterEach(() => {
  jest.useRealTimers()
})

describe('the unread count', () => {
  it('is asked for once the account is known', async () => {
    api.count.mockResolvedValue(3)
    const { result, rerender } = renderHook(
      ({ id }: { id?: string }) => useNotifications(id),
      { initialProps: {} },
    )
    expect(result.current.unreadCount).toBe(0)
    expect(api.count).not.toHaveBeenCalled()

    rerender({ id: clientId })
    await waitFor(() => expect(result.current.unreadCount).toBe(3))
    expect(api.count).toHaveBeenCalledTimes(1)
  })

  it('uses an answer from the last ten minutes instead of asking again', async () => {
    api.count.mockResolvedValue(2)
    const first = renderHook(() => useNotifications(clientId))
    await waitFor(() => expect(first.result.current.unreadCount).toBe(2))
    first.unmount()

    // The next page load.
    const second = renderHook(() => useNotifications(clientId))
    expect(second.result.current.unreadCount).toBe(2)
    expect(api.count).toHaveBeenCalledTimes(1)
  })

  it('is asked for again while the page stays open, but not while hidden', async () => {
    jest.useFakeTimers()
    api.count.mockResolvedValue(1)
    const { result } = renderHook(() => useNotifications(clientId))
    await act(async () => undefined)
    expect(result.current.unreadCount).toBe(1)

    const visibility = jest.spyOn(document, 'visibilityState', 'get')
    visibility.mockReturnValue('hidden')
    api.count.mockResolvedValue(4)
    await act(async () => {
      jest.advanceTimersByTime(UNREAD_COUNT_MAX_AGE_MS + 1000)
    })
    expect(api.count).toHaveBeenCalledTimes(1)

    // Shown again: asked at once, the saved answer being too old.
    visibility.mockReturnValue('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(api.count).toHaveBeenCalledTimes(2)
    expect(result.current.unreadCount).toBe(4)
    visibility.mockRestore()
  })

  it('stays off the bell when the backend cannot say', async () => {
    api.count.mockRejectedValue(new Error('404'))
    const { result } = renderHook(() => useNotifications(clientId))
    await waitFor(() => expect(api.count).toHaveBeenCalled())
    expect(result.current.unreadCount).toBe(0)
  })

  it("is not carried over to another account's bell", async () => {
    api.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0)
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useNotifications(id),
      { initialProps: { id: clientId } },
    )
    await waitFor(() => expect(result.current.unreadCount).toBe(5))

    // Signed out: the guest account that replaces it.
    rerender({ id: `${clientId}-guest` })
    expect(result.current.unreadCount).toBe(0)
    await waitFor(() => expect(api.count).toHaveBeenCalledTimes(2))
    expect(result.current.unreadCount).toBe(0)
  })
})

describe('opening the bell', () => {
  beforeEach(() => {
    api.count.mockResolvedValue(2)
  })

  it('lists the notifications and marks the unread ones read', async () => {
    api.list.mockResolvedValue({
      notifications: [
        notification('a', false),
        notification('b', false),
        notification('c', true),
      ],
      unreadCount: 2,
    })
    api.markRead.mockResolvedValue(0)
    const { result } = renderHook(() => useNotifications(clientId))
    await waitFor(() => expect(result.current.unreadCount).toBe(2))
    expect(result.current.status).toBe('loading')
    expect(api.list).not.toHaveBeenCalled()

    act(() => result.current.setOpen(true))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await waitFor(() => expect(result.current.unreadCount).toBe(0))
    expect(api.markRead).toHaveBeenCalledWith(['a', 'b'])
    // Still shown as new while the bell is open...
    expect(result.current.notifications.map((n) => n.read)).toEqual([
      false,
      false,
      true,
    ])

    // ...and as read once it is closed.
    act(() => result.current.setOpen(false))
    expect(result.current.notifications.map((n) => n.read)).toEqual([
      true,
      true,
      true,
    ])
  })

  it('marks nothing when everything listed is read', async () => {
    api.list.mockResolvedValue({
      notifications: [notification('a', true)],
      unreadCount: 0,
    })
    const { result } = renderHook(() => useNotifications(clientId))
    act(() => result.current.setOpen(true))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.unreadCount).toBe(0)
    expect(api.markRead).not.toHaveBeenCalled()
  })

  it('keeps the number when marking read fails', async () => {
    api.list.mockResolvedValue({
      notifications: [notification('a', false)],
      unreadCount: 1,
    })
    api.markRead.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useNotifications(clientId))
    act(() => result.current.setOpen(true))
    await waitFor(() => expect(api.markRead).toHaveBeenCalled())
    expect(result.current.unreadCount).toBe(1)
  })

  it('says when the list cannot be fetched, and fetches it again on retry', async () => {
    api.list.mockRejectedValueOnce(new Error('500'))
    const { result } = renderHook(() => useNotifications(clientId))
    act(() => result.current.setOpen(true))
    await waitFor(() => expect(result.current.status).toBe('error'))

    api.list.mockResolvedValue({ notifications: [], unreadCount: 0 })
    act(() => result.current.retry())
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(api.list).toHaveBeenCalledTimes(2)
  })

  it('waits for the account when opened before it is known', async () => {
    api.list.mockResolvedValue({ notifications: [], unreadCount: 0 })
    const { result, rerender } = renderHook(
      ({ id }: { id?: string }) => useNotifications(id),
      { initialProps: {} },
    )
    act(() => result.current.setOpen(true))
    expect(result.current.status).toBe('loading')
    expect(api.list).not.toHaveBeenCalled()

    rerender({ id: clientId })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(api.list).toHaveBeenCalledTimes(1)
  })
})
