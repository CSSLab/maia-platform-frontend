import { useContext } from 'react'
import { AuthContext } from 'src/contexts/AuthContext'
import { PersonalEngines } from './PersonalEngines'
import { LastGameCard } from './LastGameCard'
import { SignInTeaser } from './SignInTeaser'

interface Props {
  location: 'home' | 'profile'
}

/**
 * The visitor's own section on the home page and profile: their last game's
 * key moments, or, for a guest, a line to sign in in its place.
 */
export const PersonalSection = ({ location }: Props) => {
  const { user } = useContext(AuthContext)

  // Until the account has loaded.
  if (!user) {
    return (
      <div
        className="h-24 w-full animate-pulse rounded-lg border border-glass-border bg-glass"
        aria-busy="true"
      />
    )
  }

  if (!user.lichessId) return <SignInTeaser location={location} />

  return (
    <PersonalEngines>
      <LastGameCard lichessId={user.lichessId} />
    </PersonalEngines>
  )
}
