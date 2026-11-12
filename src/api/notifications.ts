import { buildUrl } from './utils'
import { SiteNotification, SiteNotificationList } from 'src/types'

// The notifications under the bell in the header. Every account has them,
// guests too: the session cookie says whose they are.

/**
 * A link the site will put in an href: a path on this site or an https
 * address. The backend only stores those, and anything else is dropped here
 * too rather than trusted.
 */
export const safeNotificationLink = (link: unknown): string | undefined => {
  if (typeof link !== 'string') return undefined
  if (/^\/(?!\/)/.test(link) || /^https:\/\/\S+$/.test(link)) return link
  return undefined
}

const parseCount = (count: unknown): number =>
  typeof count === 'number' && Number.isFinite(count) && count > 0
    ? Math.floor(count)
    : 0

const parseNotification = (raw: unknown): SiteNotification | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const data = raw as Record<string, unknown>
  if (typeof data.id !== 'string' || typeof data.title !== 'string') {
    return undefined
  }
  return {
    id: data.id,
    kind: typeof data.kind === 'string' ? data.kind : 'announcement',
    title: data.title,
    body: typeof data.body === 'string' && data.body ? data.body : undefined,
    link: safeNotificationLink(data.link),
    createdAt: typeof data.created_at === 'string' ? data.created_at : '',
    read: data.read === true,
  }
}

const readJson = async (res: Response) => {
  if (!res.ok) throw new Error(`Notifications request failed: ${res.status}`)
  return (await res.json()) as Record<string, unknown>
}

/** The account's newest notifications. Asking for them doesn't mark them read. */
export const fetchNotifications = async (
  limit = 30,
): Promise<SiteNotificationList> => {
  const data = await readJson(
    await fetch(buildUrl(`notifications/list?limit=${limit}`), {
      cache: 'no-store',
    }),
  )
  const notifications = Array.isArray(data.notifications)
    ? data.notifications
        .map(parseNotification)
        .filter((n): n is SiteNotification => n !== undefined)
    : []
  return { notifications, unreadCount: parseCount(data.unread_count) }
}

/** How many notifications the account hasn't read: the number on the bell. */
export const fetchUnreadNotificationCount = async (): Promise<number> => {
  const data = await readJson(
    await fetch(buildUrl('notifications/unread_count'), { cache: 'no-store' }),
  )
  return parseCount(data.unread_count)
}

/** Marks these notifications read, and returns how many are still unread. */
export const markNotificationsRead = async (ids: string[]): Promise<number> => {
  const data = await readJson(
    await fetch(buildUrl('notifications/read'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }),
  )
  return parseCount(data.unread_count)
}
