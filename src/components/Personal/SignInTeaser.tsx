import { LichessSignInButton } from 'src/components/Common/LichessSignInButton'

interface Props {
  location: 'home' | 'profile'
  onClick?: () => void
}

/** In the last-game card's place, for guests. */
export const SignInTeaser = ({ location, onClick }: Props) => (
  <section
    className="flex flex-col gap-3 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur-md md:flex-row md:items-center md:justify-between"
    data-testid="signin-teaser"
  >
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-2xl text-white/60">
        analytics
      </span>
      <p className="text-sm text-white/80">
        Sign in with Lichess to get your games analyzed
      </p>
    </div>
    <div onClickCapture={onClick}>
      <LichessSignInButton
        source="last_game_teaser"
        className="w-full whitespace-nowrap md:w-auto"
      />
    </div>
  </section>
)
