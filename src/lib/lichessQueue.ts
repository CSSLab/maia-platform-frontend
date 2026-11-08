/**
 * Lichess asks API clients to make one request at a time (a 429 then costs a
 * minute). Requests to its per-user games export from this page (the
 * profile's game list, the last-game card, practice) wait for each other
 * here, each until its reply has been read in full.
 */
let tail: Promise<unknown> = Promise.resolve()

export const queueLichessRequest = <T>(
  request: () => Promise<T>,
): Promise<T> => {
  const run = tail.then(request, request)
  tail = run.catch(() => undefined)
  return run
}
