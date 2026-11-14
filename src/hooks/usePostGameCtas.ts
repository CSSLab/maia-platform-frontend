import { useEffect, useRef } from 'react'
import {
  PlayGameType,
  PostGameCta,
  trackPostGameCtaClicked,
  trackPostGameCtaShown,
} from 'src/lib/analytics'

/**
 * Reports each of what a finished game offers next once as shown, and gives
 * the click to report when one is pressed. `ctas` is empty until the game is
 * over.
 */
export const usePostGameCtas = (
  gameId: string,
  gameType: PlayGameType,
  isBrain: boolean,
  ctas: PostGameCta[],
) => {
  const reported = useRef<{ gameId: string; ctas: Set<PostGameCta> }>({
    gameId: '',
    ctas: new Set(),
  })
  const key = ctas.join()
  useEffect(() => {
    if (!gameId) return
    if (reported.current.gameId !== gameId) {
      reported.current = { gameId, ctas: new Set() }
    }
    for (const cta of ctas) {
      if (reported.current.ctas.has(cta)) continue
      reported.current.ctas.add(cta)
      trackPostGameCtaShown(cta, gameId, gameType, isBrain)
    }
  }, [gameId, key])

  return (cta: PostGameCta) =>
    trackPostGameCtaClicked(cta, gameId, gameType, isBrain)
}
