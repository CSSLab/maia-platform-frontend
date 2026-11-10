import { useContext } from 'react'
import { AuthContext } from 'src/contexts/AuthContext'
import { SignInSource } from 'src/lib/analytics'

interface Props {
  source: SignInSource
  // A path on this site to come back to; the current page without it.
  returnTo?: string
  className?: string
}

/** "Sign in with Lichess", with Lichess's logo. */
export const LichessSignInButton = ({ source, returnTo, className }: Props) => {
  const { connectLichess } = useContext(AuthContext)
  return (
    <button
      type="button"
      onClick={() => connectLichess(source, returnTo)}
      className={`flex items-center justify-center gap-2 rounded-md border border-glass-border bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white ${className ?? ''}`}
    >
      <img
        src="/assets/icons/lichess.svg"
        className="h-4 w-4 shrink-0"
        alt=""
        aria-hidden
      />
      Sign in with Lichess
    </button>
  )
}
