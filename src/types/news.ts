/** One headline in the homepage's news box. */
export interface NewsItem {
  /** The day it happened, as "2026-11-06". */
  date: string
  title: string
  /** A sentence or two under the headline, for the ones that need it. */
  description?: string
  /** Where the headline leads: a page of the site ("/analysis") or a full URL. */
  href?: string
}
