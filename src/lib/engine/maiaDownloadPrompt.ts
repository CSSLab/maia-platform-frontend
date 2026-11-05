import { PHONE_BREAKPOINT_PX } from 'src/constants/common'
import {
  trackDownloadModelCompleted,
  trackDownloadModelFailed,
  trackDownloadModelInitiated,
} from 'src/lib/analytics'
import { registerProperties } from 'src/lib/posthogClient'

// How a visitor without the Maia model is asked for it. About 4 in 10 people
// who saw the full-page prompt never got past it, so half of new visitors now
// get the page at once. Each visitor stays in one group, and every event they
// send says which, so the two can be compared in PostHog.
export type MaiaPromptVariant = 'wall' | 'no_wall'

const VARIANT_KEY = 'maia.downloadPromptVariant'

let variant: MaiaPromptVariant | null = null

export const maiaPromptVariant = (): MaiaPromptVariant => {
  if (variant) return variant
  try {
    const stored = window.localStorage.getItem(VARIANT_KEY)
    if (stored === 'wall' || stored === 'no_wall') {
      variant = stored
    } else {
      variant = Math.random() < 0.5 ? 'wall' : 'no_wall'
      window.localStorage.setItem(VARIANT_KEY, variant)
    }
  } catch {
    variant = 'no_wall'
  }
  registerProperties({ maia_prompt_variant: variant })
  return variant
}

/** A touch screen whose shorter side is a phone's. */
export const isPhone = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches &&
  Math.min(window.screen.width, window.screen.height) <= PHONE_BREAKPOINT_PX

/**
 * The model is large. Phones may be on mobile data, and iPhones don't say
 * whether they are, so phones are asked. So is anyone whose browser asks to
 * save data or reports a very slow connection.
 */
export const downloadsWithoutAsking = () => {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }
  ).connection
  return (
    !isPhone() &&
    !connection?.saveData &&
    !connection?.effectiveType?.includes('2g')
  )
}

const SAVED_KEY = 'maia.modelSavedAt'

/**
 * Asks the browser to keep the model when it runs short of space, the first
 * time this browser is seen with it. Returns whether it agreed, or null if
 * nothing was asked. Chrome and Safari decide by themselves; Firefox would show
 * a permission popup, so it isn't asked.
 */
export const protectMaiaModel = async (): Promise<boolean | null> => {
  try {
    if (window.localStorage.getItem(SAVED_KEY)) return null
    window.localStorage.setItem(SAVED_KEY, String(Date.now()))
    if (/firefox/i.test(navigator.userAgent) || !navigator.storage?.persist) {
      return false
    }
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

/** Days since a model this browser no longer has was saved, once; else null. */
export const takeLostMaiaModelAge = (): number | null => {
  try {
    const saved = Number(window.localStorage.getItem(SAVED_KEY))
    if (!saved) return null
    window.localStorage.removeItem(SAVED_KEY)
    return Math.round((Date.now() - saved) / 86_400_000)
  } catch {
    return null
  }
}

/** The visitor deleted the model on purpose: that isn't losing it. */
export const forgetMaiaModelSaved = () => {
  try {
    window.localStorage.removeItem(SAVED_KEY)
  } catch {
    // Nothing to forget.
  }
}

/** What the download uses, sent compressed: 41.7 MB. */
export const MAIA_DOWNLOAD_MB = 42

export type MaiaDownloadTrigger = 'wall' | 'auto' | 'tap' | 'panel'

/** Starts the download and records how it went. */
export const startMaiaDownload = async (
  download: () => Promise<boolean>,
  trigger: MaiaDownloadTrigger,
) => {
  const page = window.location.pathname
  const startedAt = Date.now()
  trackDownloadModelInitiated(page, trigger)
  const downloaded = await download()
  if (downloaded) {
    trackDownloadModelCompleted((Date.now() - startedAt) / 1000, page)
  } else {
    trackDownloadModelFailed('download_error', 0, page)
  }
  return downloaded
}

/** "about 20 s left", from the pace so far. Null until that means anything. */
export const downloadTimeLeft = (percent: number, elapsedSeconds: number) => {
  if (percent < 3 || percent >= 100 || elapsedSeconds < 2) return null
  const seconds = (elapsedSeconds * (100 - percent)) / percent
  if (seconds < 8) return 'a few seconds left'
  if (seconds < 90) return `about ${Math.ceil(seconds / 5) * 5} s left`
  return `about ${Math.round(seconds / 60)} min left`
}
