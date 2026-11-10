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
  /** A drill of the opening the game was, when it was one the site drills. */
  drill?: { href: string; name: string }
  returnTo?: () => void
  returnToLabel?: string
}

// The panel sits in the game page's narrow side column on desktops (inside
// its padding): one short line a button.
const actionClass =
  'flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors duration-200 md:text-[13px]'
const primaryClass = `${actionClass} bg-human-4 text-white hover:bg-human-3`
const secondaryClass = `${actionClass} border border-white/10 text-white/80 hover:border-white/20 hover:bg-white/5 hover:text-white`
// The further options under the two buttons: quiet text links.
const optionClass =
  'block text-center text-[11px] leading-snug text-white/55 underline decoration-white/20 underline-offset-2 transition-colors duration-200 hover:text-white/90 hover:decoration-white/50 md:text-xs'

/**
 * What to do next when a game against Maia ends: analyze it or play again,
 * and, as quieter links under those, practice the moments it went wrong
 * (once that exists for it) or drill its opening (when the site drills it);
 * for a guest, a line to sign in. Each action is reported once as shown,
 * and when pressed.
 */
export const PostGamePanel: React.FC<Props> = ({
  gameId,
  gameType,
  playAgain,
  practiceHref,
  drill,
  returnTo,
  returnToLabel = 'Return',
}: Props) => {
  const { user } = useContext(AuthContext)
  // `user` is null until the account has loaded.
  const isGuest = !!user && !user.lichessId

  const ctas: PostGameCta[] = [
    ...(gameId ? (['analyze'] as const) : []),
    ...(playAgain ? (['play_again'] as const) : []),
    ...(gameId && practiceHref ? (['practice'] as const) : []),
    ...(gameId && drill ? (['drill_opening'] as const) : []),
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
          Analyze
        </button>
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
      {(ctas.includes('practice') || ctas.includes('drill_opening')) && (
        <div className="mt-1 flex flex-col gap-1">
          {ctas.includes('practice') && practiceHref && (
            <a
              href={practiceHref}
              onClick={() => click('practice')}
              className={optionClass}
            >
              Practice your mistakes
            </a>
          )}
          {ctas.includes('drill_opening') && drill && (
            <a
              href={drill.href}
              onClick={() => click('drill_opening')}
              title={`Drill the ${drill.name} against Maia`}
              className={optionClass}
            >
              Drill the {drill.name}
            </a>
          )}
        </div>
      )}
      {/* Guests only. A first sign-in keeps the guest's rating and games.
          It comes back to /play: this page, without its game, would start a
          new one. */}
      {isGuest && (
        <div
          className="mt-2 flex flex-col gap-1.5"
          onClickCapture={() => trackSigninPromptClicked('post_game')}
        >
          <p className="text-center text-[11px] leading-snug text-white/50">
            Keep your rating and games
          </p>
          <LichessSignInButton
            source="game_over"
            returnTo="/play"
            className="whitespace-nowrap px-2 text-xs md:text-[13px]"
          />
        </div>
      )}
    </div>
  )
}
