import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationsRead,
} from 'src/api'
import { savedResponses } from 'src/lib/savedResponses'
import { SiteNotification } from 'src/types'

/**
 * How long an unread count is used before the backend is asked again. The
 * count is wanted on every page, and every request through the site's host is
 * billed, so one answer serves all of this browser's tabs for this long.
 */
export const UNREAD_COUNT_MAX_AGE_MS = 10 * 60 * 1000

// Most notifications one list asks for; the backend's own limit is 50.
const LIST_LENGTH = 30

const savedCounts = savedResponses<number>({
  name: 'unreadNotifications',
  maxAgeMs: UNREAD_COUNT_MAX_AGE_MS,
  // The account signed in and the guest account it replaced.
  maxEntries: 2,
})

// Tells this browser's other tabs when a count changes, so that the bell of a
// tab left open doesn't keep a number its owner has already read elsewhere.
const CHANNEL_NAME = 'maia.notifications'
type CountMessage = { clientId: string; unreadCount: number }

const openChannel = () => {
  try {
    return typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return null
  }
}

export type NotificationsStatus = 'loading' | 'ready' | 'error'

/**
 * The notifications of the account `clientId` (the visitor's, guests have one
 * too), for the bell in the header.
 *
 * The unread count is asked for when the account is known, when the tab is
 * shown again and every ten minutes while it is shown, and an answer less
 * than ten minutes old, from any tab, is used instead of asking.
 *
 * The list is fetched each time the bell is opened. Opening it is reading
 * it: what the list shows as unread is marked read on the backend then, but
 * stays marked as new in the list until the bell is closed.
 */
export const useNotifications = (clientId?: string) => {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<SiteNotification[]>([])
  const [status, setStatus] = useState<NotificationsStatus>('loading')
  const [open, setOpen] = useState(false)
  // Counts the tries at fetching the list while the bell is open (see retry).
  const [attempt, setAttempt] = useState(0)

  // The account the state above belongs to: an answer that arrives after the
  // visitor signed in or out is someone else's.
  const account = useRef(clientId)
  account.current = clientId
  const channel = useRef<BroadcastChannel | null>(null)

  const applyCount = useCallback(
    (forClientId: string, count: number, tell = true) => {
      savedCounts.set(forClientId, count)
      if (tell) {
        const message: CountMessage = {
          clientId: forClientId,
          unreadCount: count,
        }
        try {
          channel.current?.postMessage(message)
        } catch {
          // The other tabs find out at their next check.
        }
      }
      if (account.current === forClientId) setUnreadCount(count)
    },
    [],
  )

  const refreshCount = useCallback(async () => {
    if (!clientId) return
    const saved = savedCounts.get(clientId)
    if (saved !== undefined) {
      setUnreadCount(saved)
      return
    }
    try {
      applyCount(clientId, await fetchUnreadNotificationCount())
    } catch {
      // No number on the bell; asked again at the next check.
    }
  }, [clientId, applyCount])

  // A new account starts from nothing.
  useEffect(() => {
    setUnreadCount(0)
    setNotifications([])
    setStatus('loading')
  }, [clientId])

  useEffect(() => {
    if (!clientId) return
    refreshCount()

    const whenShown = () => {
      if (document.visibilityState === 'visible') refreshCount()
    }
    document.addEventListener('visibilitychange', whenShown)
    // Just after the saved answer has aged out, so the check asks again.
    const timer = setInterval(whenShown, UNREAD_COUNT_MAX_AGE_MS + 1000)
    return () => {
      document.removeEventListener('visibilitychange', whenShown)
      clearInterval(timer)
    }
  }, [clientId, refreshCount])

  useEffect(() => {
    const opened = openChannel()
    channel.current = opened
    if (!opened) return
    opened.onmessage = (event: MessageEvent<CountMessage>) => {
      const message = event.data
      if (
        message &&
        typeof message.clientId === 'string' &&
        typeof message.unreadCount === 'number'
      ) {
        applyCount(message.clientId, message.unreadCount, false)
      }
    }
    return () => {
      channel.current = null
      opened.close()
    }
  }, [applyCount])

  // Opening the bell: fetch the list, then mark what it shows as read.
  useEffect(() => {
    if (!open || !clientId) return
    let current = true
    const load = async () => {
      let unreadIds: string[]
      try {
        const list = await fetchNotifications(LIST_LENGTH)
        if (!current) return
        setNotifications(list.notifications)
        setStatus('ready')
        applyCount(clientId, list.unreadCount)
        unreadIds = list.notifications.filter((n) => !n.read).map((n) => n.id)
      } catch {
        if (current) setStatus('error')
        return
      }
      if (unreadIds.length === 0) return
      try {
        applyCount(clientId, await markNotificationsRead(unreadIds))
      } catch {
        // Still unread on the backend: the number stays, and they are
        // marked the next time the bell is opened.
      }
    }
    load()
    return () => {
      current = false
    }
  }, [open, clientId, attempt, applyCount])

  // Closing it: what was new has been seen.
  useEffect(() => {
    if (open) return
    setNotifications((shown) =>
      shown.some((n) => !n.read)
        ? shown.map((n) => ({ ...n, read: true }))
        : shown,
    )
  }, [open])

  /** Fetches the list again, after it couldn't be. */
  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((tries) => tries + 1)
  }, [])

  return { unreadCount, notifications, status, open, setOpen, retry }
}
