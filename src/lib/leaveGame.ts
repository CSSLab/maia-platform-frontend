/**
 * Thrown to call off a page change when a player chose to stay in their game
 * (see GameplayInterface). It isn't a failure, so it isn't reported as one.
 */
export const LEAVE_GAME_ABORT = 'Stayed in the game: route change called off'

/**
 * Where a player was going, as the page's first path segment only ("/profile",
 * not "/profile/<name>"): the rest of an address can name a person.
 */
export const leaveGameDestination = (url: string) =>
  '/' + (url.split(/[?#]/)[0].split('/')[1] ?? '')
