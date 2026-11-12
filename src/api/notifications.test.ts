import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationsRead,
  safeNotificationLink,
} from './notifications'

let fetchMock: jest.Mock

const replyWith = (body: unknown, ok = true, status = 200) =>
  fetchMock.mockReturnValueOnce(
    Promise.resolve({ ok, status, json: () => Promise.resolve(body) }),
  )

beforeEach(() => {
  fetchMock = jest.fn()
  globalThis.fetch = fetchMock
})

// What the backend sends (maia_api/notifications/notifications_schema.py).
const REPLY = {
  notifications: [
    {
      id: 'a1',
      kind: 'leaderboard',
      title: "You're on the leaderboard",
      body: 'You are #3 on the Puzzles leaderboard.',
      link: '/leaderboard',
      created_at: '2026-11-12T15:04:05.000Z',
      read: false,
    },
    {
      id: 'b2',
      kind: 'announcement',
      title: 'Maia 3 is here',
      body: null,
      link: null,
      created_at: '2026-11-10T09:00:00.000Z',
      read: true,
    },
  ],
  unread_count: 1,
}

describe('fetchNotifications', () => {
  it('reads the list as the backend sends it', async () => {
    replyWith(REPLY)
    expect(await fetchNotifications()).toEqual({
      notifications: [
        {
          id: 'a1',
          kind: 'leaderboard',
          title: "You're on the leaderboard",
          body: 'You are #3 on the Puzzles leaderboard.',
          link: '/leaderboard',
          createdAt: '2026-11-12T15:04:05.000Z',
          read: false,
        },
        {
          id: 'b2',
          kind: 'announcement',
          title: 'Maia 3 is here',
          body: undefined,
          link: undefined,
          createdAt: '2026-11-10T09:00:00.000Z',
          read: true,
        },
      ],
      unreadCount: 1,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/notifications/list?limit=30',
      { cache: 'no-store' },
    )
  })

  it('leaves out what it cannot show, and never passes on an unsafe link', async () => {
    replyWith({
      notifications: [
        null,
        { title: 'No id' },
        { id: 'x', title: 'Odd', link: 'javascript:alert(1)', read: 'yes' },
      ],
      unread_count: -4,
    })
    expect(await fetchNotifications(5)).toEqual({
      notifications: [
        {
          id: 'x',
          kind: 'announcement',
          title: 'Odd',
          body: undefined,
          link: undefined,
          createdAt: '',
          read: false,
        },
      ],
      unreadCount: 0,
    })
  })

  it('fails when the backend does, so the bell can say so', async () => {
    // A backend from before notifications answers 404.
    replyWith({ detail: 'Not Found' }, false, 404)
    await expect(fetchNotifications()).rejects.toThrow('404')
  })
})

describe('fetchUnreadNotificationCount', () => {
  it('reads the count', async () => {
    replyWith({ unread_count: 3 })
    expect(await fetchUnreadNotificationCount()).toBe(3)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/notifications/unread_count',
      { cache: 'no-store' },
    )
  })

  it('fails on an error reply', async () => {
    replyWith({ detail: 'Login required' }, false, 401)
    await expect(fetchUnreadNotificationCount()).rejects.toThrow('401')
  })
})

describe('markNotificationsRead', () => {
  it('posts the ids and returns what is still unread', async () => {
    replyWith({ unread_count: 2 })
    expect(await markNotificationsRead(['a1', 'b2'])).toBe(2)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"ids":["a1","b2"]}',
    })
  })
})

describe('safeNotificationLink', () => {
  it.each(['/leaderboard', '/blog/maia-3?x=1#top', 'https://lichess.org/'])(
    'keeps %s',
    (link) => expect(safeNotificationLink(link)).toBe(link),
  )

  it.each([
    'javascript:alert(1)',
    '//evil.example',
    'http://example.com',
    'https://',
    'leaderboard',
    '',
    null,
    undefined,
    7,
  ])('drops %p', (link) => expect(safeNotificationLink(link)).toBeUndefined())
})
