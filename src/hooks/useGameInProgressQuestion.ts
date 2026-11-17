import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { resignServerGame } from 'src/api/serverGames'
import { isAppHydrated } from 'src/components/Common/PageShell'
import { trackGameInProgressPromptAnswered } from 'src/lib/analytics'
import { ServerGame, isAskedForGame } from 'src/lib/serverGames'
import { PlayGameConfig } from 'src/types'

/**
 * Whether this page was opened by going to its address: a link (from another
 * site or app too), a bookmark, or the address typed. Not a reload, nor the
 * browser bringing the page back (back, forward, a restored tab), nor a click
 * in the site.
 */
const openedByFollowingLink = () => {
  if (typeof window === 'undefined' || isAppHydrated()) return false
  try {
    const [navigation] = window.performance.getEntriesByType(
      'navigation',
    ) as PerformanceNavigationTiming[]
    return navigation?.type === 'navigate'
  } catch {
    // No navigation timing here: as a reload, which goes on with the game.
    return false
  }
}

export interface GameInProgressQuestion {
  game: ServerGame
  // Whether it is the game the page's address asks for.
  askedFor: boolean
  /** Goes on with the game in progress. */
  continueIt: () => void
  /** Starts the game the page was opened for (the other has been resigned). */
  startNew: () => void
}

/**
 * A play page asks the server for a game, and a player with a game in
 * progress is answered with that one (the server holds one game for each
 * player). Coming back to the game, that is what's wanted: a reload, or the
 * browser reopened, goes on with it. But a link to a new game then led to
 * the old one, and the new game couldn't be started. So the page asks which
 * it is to be when it can't be coming back:
 *
 * - the game in progress isn't the one the address asks for (another
 *   position, opponent or time control), or
 * - the page was opened by following a link (see above), which may be to a
 *   game with the same settings again.
 */
export const useGameInProgressQuestion = () => {
  // Decided on the page's first render, as in useStartConfirmation.
  const [followedLink] = useState(openedByFollowingLink)
  const [question, setQuestion] = useState<GameInProgressQuestion>()
  const [resigning, setResigning] = useState(false)

  /**
   * Whether to ask before going on with `game`, the page having asked for
   * the game in `asked`. `firstGame`: the page hasn't had a game yet.
   */
  const mustAsk = useCallback(
    (game: ServerGame, asked: PlayGameConfig, firstGame: boolean) =>
      (followedLink && firstGame) || !isAskedForGame(game, asked),
    [followedLink],
  )

  const close = useCallback(() => setQuestion(undefined), [])

  const answered = (question: GameInProgressQuestion, startedNew: boolean) =>
    trackGameInProgressPromptAnswered(
      question.game.game_id,
      question.game.game_type === 'play' ? 'vs_maia' : 'hand_and_brain',
      startedNew,
      question.game.ply,
      question.askedFor,
    )

  const continueIt = () => {
    if (!question || resigning) return
    answered(question, false)
    setQuestion(undefined)
    question.continueIt()
  }

  const startNew = () => {
    if (!question || resigning) return
    setResigning(true)
    // A game that is over by now (on time, say) is answered as it is.
    resignServerGame(question.game.game_id)
      .then(() => {
        answered(question, true)
        setQuestion(undefined)
        question.startNew()
      })
      .catch(() => toast.error("Couldn't resign the game. Please try again."))
      .finally(() => setResigning(false))
  }

  return {
    question,
    resigning,
    mustAsk,
    ask: setQuestion,
    close,
    continueIt,
    startNew,
  }
}
