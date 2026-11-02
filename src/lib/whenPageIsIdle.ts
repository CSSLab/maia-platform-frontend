// Runs `start` once the page has loaded and the browser is idle (or after
// `timeout` ms of the page staying busy). Returns a function that cancels it.
export const whenPageIsIdle = (start: () => void, timeout = 2000) => {
  let idleId: number | undefined
  let timeoutId: number | undefined
  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(start, { timeout })
    } else {
      timeoutId = window.setTimeout(start, 200)
    }
  }
  if (document.readyState === 'complete') {
    schedule()
  } else {
    window.addEventListener('load', schedule, { once: true })
  }
  return () => {
    window.removeEventListener('load', schedule)
    if (idleId !== undefined) window.cancelIdleCallback(idleId)
    if (timeoutId !== undefined) window.clearTimeout(timeoutId)
  }
}
