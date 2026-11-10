import { ReactNode, useContext, useState } from 'react'

import { WindowSizeContext } from 'src/contexts'

// Set by _app's first effect, once React has hydrated the server's HTML.
let appHydrated = false
export const markAppHydrated = () => {
  appHydrated = true
}

interface Props {
  // The window width from which the page shows its desktop layout, and the
  // classes that show each layout from or below it (written out for
  // Tailwind).
  desktopFrom: number
  desktopClassName: string
  mobileClassName: string
  desktop: ReactNode
  mobile: ReactNode
}

/**
 * A page's shell: its layout before its data has loaded. In the server's
 * HTML it has both the desktop and the phone layout, and CSS shows the one
 * the page will use. A shell first rendered while the app hydrates that HTML
 * is left exactly as the server drew it: an empty dangerouslySetInnerHTML
 * keeps the server's children, which React then neither renders nor
 * hydrates, so on a direct visit the shell costs no script time. One first
 * rendered later, as after a link within the app, renders only the layout
 * for the window. Either way it does nothing when clicked; it is replaced
 * once the page's data has loaded.
 */
export const PageShell: React.FC<Props> = ({
  desktopFrom,
  desktopClassName,
  mobileClassName,
  desktop,
  mobile,
}) => {
  const [keepServerHtml] = useState(
    () => typeof window !== 'undefined' && !appHydrated,
  )
  const { width } = useContext(WindowSizeContext)

  if (keepServerHtml) {
    return (
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: '' }} />
    )
  }

  return (
    <div>
      {(width === 0 || width >= desktopFrom) && (
        <div className={desktopClassName}>{desktop}</div>
      )}
      {(width === 0 || width < desktopFrom) && (
        <div className={mobileClassName}>{mobile}</div>
      )}
    </div>
  )
}
