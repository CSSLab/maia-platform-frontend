import { useRouter } from 'next/router'
import { useState } from 'react'

// "true" or "false" in the address; anything else (missing, misspelled,
// repeated) is the default.
export const parseQueryBoolean = (
  value: string | string[] | undefined,
  defaultValue: boolean,
): boolean => {
  if (value === 'true') return true
  if (value === 'false') return false
  return defaultValue
}

/**
 * A yes/no setting that starts from the page's address (`?name=false`) and
 * that the page can then change, such as a switch in the game's controls.
 *
 * A page opened by loading it (a link, a bookmark, a refresh) is first
 * rendered without the address's query, which Next fills in once the router
 * is ready: read into useState then, the setting was always the default. This
 * takes the address's value in the render where the router becomes ready,
 * before any effect runs, so what waits for router.isReady (starting a game)
 * never sees the default instead.
 *
 * The address's value is taken again whenever it changes, as when the setup
 * dialog sends the page its next game's settings; in between, the page's own
 * change stands.
 */
export const useQueryBoolean = (
  name: string,
  defaultValue: boolean,
): [boolean, (value: boolean) => void] => {
  const router = useRouter()
  const fromAddress = router.isReady
    ? parseQueryBoolean(router.query[name], defaultValue)
    : undefined

  const [value, setValue] = useState(fromAddress ?? defaultValue)
  const [taken, setTaken] = useState(fromAddress)
  if (fromAddress !== taken) {
    // Set while rendering: React renders again at once with the new value,
    // before anything is drawn or any effect runs.
    setTaken(fromAddress)
    if (fromAddress !== undefined) setValue(fromAddress)
  }

  return [value, setValue]
}
