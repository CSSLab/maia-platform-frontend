/**
 * A browser run by a program, such as a crawler, a link scanner or a test
 * script. Such browsers say so (navigator.webdriver) or name themselves; one
 * seen on the site padded its name with spaces. A program that hides this
 * isn't caught here: the site's host (Vercel) challenges or blocks those.
 */
const AUTOMATED_AGENT =
  /headless|bot\/|crawl|spider|slurp|lighthouse|phantomjs|puppeteer|playwright|selenium/i

export const looksAutomated = () => {
  if (typeof navigator === 'undefined') return false
  const agent = navigator.userAgent ?? ''
  return (
    navigator.webdriver === true ||
    AUTOMATED_AGENT.test(agent) ||
    agent !== agent.trim()
  )
}
