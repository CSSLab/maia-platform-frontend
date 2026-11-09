import { LichessSignInButton } from 'src/components/Common/LichessSignInButton'

interface Props {
  location: 'home' | 'profile'
  onClick?: () => void
}

/** In the last-game card's place, for guests. */
export const SignInTeaser = ({ location, onClick }: Props) => (
  <section
    className="flex flex-col items-center gap-3 rounded-xl border border-glass-border bg-glass px-4 py-3 backdrop-blur-md md:flex-row md:justify-between"
    data-testid="signin-teaser"
  >
    <p className="text-center text-sm text-white/70 md:text-left">
      Sign in with Lichess to get your games analyzed
    </p>
    <div onClickCapture={onClick}>
      <LichessSignInButton
        source="last_game_teaser"
        className="whitespace-nowrap"
      />
    </div>
  </section>
)
