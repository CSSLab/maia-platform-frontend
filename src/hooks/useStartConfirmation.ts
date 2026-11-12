import { useCallback, useState } from 'react'
import { isAppHydrated } from 'src/components/Common/PageShell'

/**
 * Whether a play page has to ask before it starts a game with start_game,
 * which resigns the player's game in progress (and rates the loss).
 *
 * A page opened by loading it (a link, from another site too, a bookmark or a
 * refresh) asks: any site can link to /play/maia or /play/hb, and starting at
 * once let it make a visitor resign. A page reached by a click in the site
 * starts at once, since the visitor has just chosen to play. Once the visitor
 * has confirmed, the page's later games start without asking.
 *
 * Games the server holds (/play/games) don't need this: starting one answers
 * with the game in progress instead of resigning it.
 */
export const useStartConfirmation = () => {
  // Decided on the page's first render, which for a page opened by loading
  // it happens while the app hydrates (src/components/Common/PageShell).
  const [openedByPageLoad] = useState(
    () => typeof window !== 'undefined' && !isAppHydrated(),
  )
  const [confirmed, setConfirmed] = useState(false)
  const confirm = useCallback(() => setConfirmed(true), [])
  return { mustConfirm: openedByPageLoad && !confirmed, confirm }
}
