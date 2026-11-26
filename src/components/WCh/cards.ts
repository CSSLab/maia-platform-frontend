/*
 * The share cards' addresses (the images come from /api/wch/card): one per
 * key moment, and one for a whole game.
 */
import { PLAYERS } from './data'
import type { RecapGame, RecapMoment } from './recap'
import { surname } from './recap'

export const SITE = 'https://www.maiachess.com'

const resultWords = (g: RecapGame) =>
  g.result === '1-0'
    ? `${surname(g.white)} won`
    : g.result === '0-1'
      ? `${surname(g.black)} won`
      : 'Draw'

export const gameTitle = (g: RecapGame) =>
  `${surname(g.white)} vs ${surname(g.black)}: ${resultWords(g).toLowerCase()} in ${g.moves}`

const kicker = (n: number) => `World Championship 2026 · Game ${n}`

/** The card for a key moment: the position before the move, the move drawn. */
export const momentCard = (g: RecapGame, m: RecapMoment, absolute = false) => {
  const q = new URLSearchParams({
    kicker: `WCh 2026 Game ${g.n} · ${m.headline}`,
    title: m.label,
    stat: m.stat,
    statLabel: m.statLabel,
    sub: m.detail,
    fen: m.fenBefore,
    from: m.uci.slice(0, 2),
    to: m.uci.slice(2, 4),
  })
  if (m.color === 'black') q.set('flip', '1')
  return `${absolute ? SITE : ''}/api/wch/card?${q.toString()}`
}

/** The card for a whole game: how often each player's own model called him. */
export const gameCard = (g: RecapGame, absolute = false) => {
  const q = new URLSearchParams({
    kicker: kicker(g.n),
    title: `${resultWords(g)} in ${g.moves} moves, through Maia's eyes`,
  })
  g.sides.forEach((s) =>
    q.append(
      'row',
      `${PLAYERS[s.id].short}|own model ${s.maia}/${s.moves}, Stockfish ${s.stockfish}/${s.moves}`,
    ),
  )
  return `${absolute ? SITE : ''}/api/wch/card?${q.toString()}`
}

/** The recap page for a game, and for one of its moments. */
export const recapPath = (n: number, m?: RecapMoment) =>
  m ? `/wch/recap/${n}/${m.index}` : `/wch/recap/${n}`
