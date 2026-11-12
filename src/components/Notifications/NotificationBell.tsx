import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TimeAgo } from 'src/components/Common/TimeAgo'
import { NotificationsStatus } from 'src/hooks/useNotifications'
import {
  trackNotificationClicked,
  trackNotificationsOpened,
} from 'src/lib/analytics'
import { SiteNotification } from 'src/types'

interface Props {
  unreadCount: number
  notifications: SiteNotification[]
  status: NotificationsStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  onRetry: () => void
}

// The badge has room for one digit.
const badgeText = (count: number) => (count > 9 ? '9+' : `${count}`)

// A kind the site doesn't know is shown like an announcement.
const NotificationIcon = ({ kind }: { kind: string }) =>
  kind === 'leaderboard' ? (
    <span className="material-symbols-outlined material-symbols-filled !text-xl text-yellow-500">
      trophy
    </span>
  ) : (
    <span className="material-symbols-outlined !text-xl text-primary/70">
      campaign
    </span>
  )

const NotificationRow = ({
  notification,
  onFollow,
}: {
  notification: SiteNotification
  onFollow: () => void
}) => {
  const { kind, title, body, link, createdAt, read } = notification
  const content = (
    <>
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
        <NotificationIcon kind={kind} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`text-sm leading-snug ${read ? 'font-medium text-primary/80' : 'font-semibold text-primary'}`}
        >
          {title}
        </span>
        {body && (
          <span className="text-xs leading-snug text-secondary">{body}</span>
        )}
        <TimeAgo time={createdAt} className="text-[11px] text-secondary/70" />
      </span>
      {!read && (
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500"
          role="img"
          aria-label="New"
        />
      )}
    </>
  )
  const className = `flex w-full items-start gap-3 px-4 py-3 text-left ${read ? '' : 'bg-white/[0.04]'}`

  if (!link) return <div className={className}>{content}</div>
  const follow = () => {
    trackNotificationClicked(kind, !read)
    onFollow()
  }
  return link.startsWith('/') ? (
    <Link
      href={link}
      onClick={follow}
      className={`${className} transition-colors hover:bg-glass-strong`}
    >
      {content}
    </Link>
  ) : (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      onClick={follow}
      className={`${className} transition-colors hover:bg-glass-strong`}
    >
      {content}
    </a>
  )
}

/**
 * The bell in the header: the number of unread notifications on it, and the
 * list of them under it. `useNotifications` holds what it shows.
 */
export const NotificationBell = ({
  unreadCount,
  notifications,
  status,
  open,
  onOpenChange,
  onRetry,
}: Props) => {
  const root = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Closed by a click or tap outside it, by Escape, and by leaving the page.
  useEffect(() => {
    if (!open) return
    const close = () => onOpenChange(false)
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node | null)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    router.events.on('routeChangeStart', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      router.events.off('routeChangeStart', close)
    }
  }, [open, onOpenChange, router.events])

  const toggle = () => {
    if (!open) trackNotificationsOpened(unreadCount)
    onOpenChange(!open)
  }

  return (
    <div ref={root} className="relative flex items-center">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifications"
        className={`relative flex items-center transition-colors duration-200 hover:text-primary ${open ? 'text-primary' : 'text-primary/80'}`}
      >
        <span
          className={`material-symbols-outlined text-2xl ${open ? 'material-symbols-filled' : ''}`}
        >
          notifications
        </span>
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            aria-hidden
            className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-backdrop"
          >
            {badgeText(unreadCount)}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            // On a phone, a sheet across the screen under the header; from
            // the `sm` width up, a panel hanging from the bell.
            className="fixed inset-x-2 top-14 z-50 flex max-h-[min(32rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-md border border-glass-border bg-backdrop shadow-xl shadow-black/40 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-glass-border px-4 py-2.5">
              <h3 className="text-sm font-semibold text-primary">
                Notifications
              </h3>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close notifications"
                className="flex items-center text-primary/60 transition-colors hover:text-primary sm:hidden"
              >
                <span className="material-symbols-outlined !text-xl">
                  close
                </span>
              </button>
            </div>

            {notifications.length > 0 ? (
              <ul className="divide-y divide-glass-border overflow-y-auto">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <NotificationRow
                      notification={notification}
                      onFollow={() => onOpenChange(false)}
                    />
                  </li>
                ))}
              </ul>
            ) : status === 'error' ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <p className="text-sm text-secondary">
                  Couldn&apos;t load your notifications.
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-md border border-glass-border bg-white/5 px-3 py-1 text-sm text-primary/90 transition-colors hover:border-white/20 hover:bg-white/10"
                >
                  Try again
                </button>
              </div>
            ) : status === 'loading' ? (
              <div
                className="flex items-center justify-center px-4 py-8"
                role="status"
                aria-label="Loading notifications"
              >
                <span className="material-symbols-outlined animate-spin text-2xl text-secondary">
                  progress_activity
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
                <span className="material-symbols-outlined !text-3xl text-secondary/60">
                  notifications
                </span>
                <p className="text-sm text-secondary">
                  You&apos;re all caught up.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
