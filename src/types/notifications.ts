/**
 * A notification under the bell in the header. (Not `Notification`: that is
 * the browser's own type, for notifications of the operating system.)
 */
export interface SiteNotification {
  id: string
  /**
   * What it is about: 'announcement' (from the team, to everyone) or
   * 'leaderboard' (the player entered one). The backend may add kinds; one
   * the site doesn't know is shown like an announcement.
   */
  kind: string
  title: string
  body?: string
  /** Where clicking it leads: a page of the site ("/leaderboard") or an https address. */
  link?: string
  /** ISO 8601, in UTC. */
  createdAt: string
  /** Whether this account has read it. */
  read: boolean
}

export interface SiteNotificationList {
  /** Newest first. */
  notifications: SiteNotification[]
  /** Of all the account's notifications, not only those listed. */
  unreadCount: number
}
