import { useContext, useEffect, useRef } from 'react'

import { AuthContext } from 'src/contexts/AuthContext'
import { LichessSignInButton } from 'src/components/Common/LichessSignInButton'
import {
  PlayGameType,
  PostGameCta,
  trackPostGameCtaClicked,
  trackPostGameCtaShown,
  trackSigninPromptClicked,
  trackSigninPromptShown,
} from 'src/lib/analytics'

interface Props {
  gameId: string
  gameType: PlayGameType
  /** The setup dialog, starting from this game's settings. */
  playAgain?: () => void
  /** The practice of this game's mistakes, once there is one to go to. */
  practiceHref?: string
  returnTo?: () => void
  returnToLabel?: string
}

// The panel sits in the game page's narrow side column on desktops (inside
// its padding): labels may wrap, so they're small and tight.
const actionClass =
  'flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-center text-xs font-semibold leading-tight transition-colors duration-200 md:text-[13px]'
const primaryClass = `${actionClass} border-human-4 bg-human-4 text-white hover:bg-human-4/90`
const secondaryClass = `${actionClass} border-glass-border bg-glass text-white/90 hover:bg-glass-stronger`

/**
 * What to do next when a game against Maia ends: analyze it, practice the
 * moment it went wrong (once that exists for it), or play again; and, for a
 * guest, a line to sign in. Each action is reported once as shown, and when
 * pressed.
 */
export const PostGamePanel: React.FC<Props> = ({
  gameId,
  gameType,
  playAgain,
  practiceHref,
  returnTo,
  returnToLabel = 'Return',
}: Props) => {
  const { user } = useContext(AuthContext)
  // `user` is null until the account has loaded.
  const isGuest = !!user && !user.lichessId

  const ctas: PostGameCta[] = [
    ...(gameId ? (['analyze'] as const) : []),
    ...(gameId && practiceHref ? (['practice'] as const) : []),
    ...(playAgain ? (['play_again'] as const) : []),
  ]
  const ctaKey = ctas.join()

  const reported = useRef<{ gameId: string; ctas: Set<PostGameCta> }>({
    gameId: '',
    ctas: new Set(),
  })
  useEffect(() => {
    if (!gameId) return
    if (reported.current.gameId !== gameId) {
      reported.current = { gameId, ctas: new Set() }
    }
    for (const cta of ctas) {
      if (reported.current.ctas.has(cta)) continue
      reported.current.ctas.add(cta)
      trackPostGameCtaShown(cta, gameId, gameType)
    }
  }, [gameId, ctaKey])

  const promptReported = useRef('')
  useEffect(() => {
    if (!isGuest || !gameId || promptReported.current === gameId) return
    promptReported.current = gameId
    trackSigninPromptShown('post_game')
  }, [isGuest, gameId])

  const click = (cta: PostGameCta) =>
    trackPostGameCtaClicked(cta, gameId, gameType)

  return (
    <div className="flex flex-col gap-2" data-testid="post-game-panel">
      {ctas.includes('analyze') && (
        <button
          type="button"
          onClick={() => {
            click('analyze')
            window.open(`/analysis/${gameId}/${gameType}`, '_blank')
          }}
          className={primaryClass}
        >
          <span className="material-symbols-outlined shrink-0 !text-sm">
            analytics
          </span>
          Analyze this game
        </button>
      )}
      {ctas.includes('practice') && practiceHref && (
        <a
          href={practiceHref}
          onClick={() => click('practice')}
          className={secondaryClass}
        >
          <span className="material-symbols-outlined shrink-0 !text-sm">
            target
          </span>
          Practice the moment you went wrong
        </a>
      )}
      {ctas.includes('play_again') && playAgain && (
        <button
          type="button"
          onClick={() => {
            click('play_again')
            playAgain()
          }}
          className={secondaryClass}
        >
          <span className="material-symbols-outlined shrink-0 !text-sm">
            refresh
          </span>
          Play again
        </button>
      )}
      {returnTo && (
        <button type="button" onClick={returnTo} className={secondaryClass}>
          {returnToLabel}
        </button>
      )}
      {/* Guests only. A first sign-in keeps the guest's rating and games.
          It comes back to /play: this page, without its game, would start a
          new one. */}
      {isGuest && (
        <div
          className="mt-1 flex flex-col gap-2 border-t border-glass-border pt-2"
          onClickCapture={() => trackSigninPromptClicked('post_game')}
        >
          <p className="text-center text-xs leading-snug text-white/70">
            Sign in with Lichess to keep your rating and games.
          </p>
          <LichessSignInButton
            source="game_over"
            returnTo="/play"
            className="px-2 text-xs md:text-[13px]"
          />
        </div>
      )}
    </div>
  )
}
