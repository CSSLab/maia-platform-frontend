/** "Nov 6, 2026" for "2026-11-06". The date is a day, parsed as UTC midnight. */
export const formatNewsDate = (date: string): string =>
  new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

/** Whether a headline's link leaves the site. */
export const isExternalLink = (href: string): boolean =>
  /^https?:\/\//i.test(href)
