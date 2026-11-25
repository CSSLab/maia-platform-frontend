import Head from 'next/head'
import { useRouter } from 'next/router'
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Chess } from 'chess.ts'
import type { DrawShape } from 'chessground/draw'
import type { Key } from 'chessground/types'

import { AuthContext } from 'src/contexts/AuthContext'
import { ENGINE_PROVIDERS } from 'src/contexts/pageProviders'
import { MaiaEngineContext } from 'src/contexts/MaiaEngineContext'
import { LichessSignInButton } from 'src/components/Common/LichessSignInButton'
import { MaiaDownloadPrompt } from 'src/components/Common/MaiaDownloadPrompt'
import { UnderlineTabs } from 'src/components/Common/UnderlineTabs'
import {
  BASE_SECONDS,
  PlayerId,
  clockCurve,
  fmtClock,
  pct,
  sanToSquares,
} from 'src/components/WCh/data'
import {
  BLACK,
  Candidate,
  FIDE,
  GAME1,
  LivePly,
  NEXT,
  RATING_BANDS,
  TOP_GUESSERS,
  WHITE,
  WchNext,
  afterThinking,
  blunderRisk,
  byRating,
  fmtEval,
  tally,
} from 'src/components/WCh/game1'
import { barTimeControl } from 'src/components/WCh/live'
import {
  Pregame,
  RATING_KEYS,
  feedGame,
  openingTree,
  usualClock,
  usualRisk,
  usualThink,
} from 'src/components/WCh/feed'
import { buildLive } from 'src/components/WCh/liveAdapter'
import { summarize } from 'src/components/WCh/summary'
import { useWchFeed } from 'src/components/WCh/useWchFeed'
import {
  WchSource,
  endWchVisit,
  noteWchGame,
  noteWchGuess,
  noteWchHover,
  noteWchLayout,
  noteWchMove,
  noteWchSource,
  noteWchTab,
  startWchVisit,
} from 'src/components/WCh/visit'
import { trackWchGuess } from 'src/lib/analytics'
import { LiveStatus, useWchLive } from 'src/components/WCh/useWchLive'
import {
  LIVE_MAIA_ELO,
  LIVE_RATING_BANDS,
  useWchEngines,
} from 'src/components/WCh/useWchEngines'
import { Flag, MarkChip, WchBoard } from 'src/components/WCh/ui'

const MAIA = 'rgb(254 127 109)'
const CROWD = '#c8c2bd'
const ENGINE = 'rgb(90 157 215)'
const PANE_H = 150
/** Below this many guesses the page doesn't show the count. */
const MIN_SHOWN_GUESSES = 3
const BAR_W = 26
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// --avail-h / --avail-w: the visible area under and beside the page's top
// (the site header), measured on load and resize; clientWidth leaves out the
// scrollbar, which 100vw counts. Desktop: below the board go the labels row
// (24), the pane (8 + 150) and a 16 px margin; across, the page padding, the
// side columns, the bars and the gaps. Phones: the board is the width less
// the two bars, short enough to leave the players row and Maia's moves.
// Three columns from 1280 px (below, they can't fit beside a usable board);
// one centred column, at most 640 px wide, below that.
const WIDE_FROM = 1280
const NARROW_MAX = 640
const SIZE_CSS = `
.wch-root {
  --avail-h: calc(100vh - 70px);
  --avail-w: calc(100vw - 20px);
  --board: min(680px, calc(var(--avail-h) - 210px), calc(var(--avail-w) - 140px));
  --mboard: min(
    calc(min(var(--avail-w), ${NARROW_MAX}px) - 78px),
    max(280px, calc(var(--avail-h) - 210px))
  );
}
@media (min-width: ${WIDE_FROM}px) {
  .wch-root {
    --board: min(680px, calc(var(--avail-h) - 218px), calc(var(--avail-w) - 880px));
  }
}`
const COL_H = `calc(var(--board) + ${32 + PANE_H + 8}px)`

type Side = 'white' | 'black'
const surname = (id: 'gukesh' | 'sindarov') =>
  id === 'gukesh' ? 'Gukesh' : 'Sindarov'
const moveNo = (n: number, color: Side) =>
  `${n}${color === 'white' ? '.' : '…'}`

type PaneTab = 'chances' | 'risk' | 'clocks' | 'rating'
/** The feed's ratings for the played move (By rating, with the feed). */
const FEED_RATING_BANDS = RATING_KEYS.map(Number)

const PANE_TABS: { id: PaneTab; name: string }[] = [
  { id: 'chances', name: 'Win chances' },
  { id: 'risk', name: 'Blunder risk' },
  { id: 'clocks', name: 'Clocks' },
  { id: 'rating', name: 'By rating' },
]
// Phones: the tab names that fit beside "Maia views".
const SHORT_TAB: Record<PaneTab, string> = {
  chances: 'Chances',
  risk: 'Risk',
  clocks: 'Clocks',
  rating: 'Rating',
}
// Live without the research feed: no blunder-risk model in the browser.
const LIVE_TABS = PANE_TABS.filter((t) => t.id !== 'risk')

/** Everything the page's parts need to know about the game on show. */
interface WchData {
  mode: 'demo' | 'live'
  plies: LivePly[]
  next: WchNext
  /** plies.length: the index of the move to come. */
  LIVE: number
  white: PlayerId
  black: PlayerId
  /** The player-specific Maia models (demo, or live from the feed). */
  personal: boolean
  /** Visitors' guesses from a server (demo only so far). */
  hasCrowd: boolean
  /** Live from the research feed (blunder risk, the players' models). */
  feedOn: boolean
  /** The feed's pre-game bundle (usual blunder risk by phase). */
  pregame: Pregame | null
}

const WchCtx = React.createContext<WchData | null>(null)
const useWch = () => {
  const data = useContext(WchCtx)
  if (!data) throw new Error('useWch outside the page')
  return data
}

/** Maia's name for a player: his own model, or Maia at its live rating. */
const maiaName = (data: WchData, id: PlayerId) =>
  data.personal ? `Maia${surname(id)}` : 'Maia'

type Tally = {
  n: number
  maia: number
  crowd: number | null
  stockfish: number | null
}

export default function OraclePage() {
  const router = useRouter()
  const demo = router.query.demo === '1'
  const roundQ =
    typeof router.query.round === 'string' ? router.query.round : null
  const gameQ = typeof router.query.game === 'string' ? router.query.game : null
  // ?feed=<game id>: the game from the research feed alone (no broadcast),
  // e.g. its replays.
  const feedQ = typeof router.query.feed === 'string' ? router.query.feed : null

  const { user } = useContext(AuthContext)
  const maiaEngine = useContext(MaiaEngineContext)
  const [demoSignedIn, setDemoSignedIn] = useState(false)
  const signedIn = !!user?.lichessId || demoSignedIn

  const broadcast = useWchLive({
    enabled: router.isReady && !demo && !feedQ,
    round: roundQ,
    game: gameQ,
  })
  // The research feed for the game on show: its id is the Lichess game id.
  // The pre-game bundle may be named after the match game instead.
  const gameNo = broadcast.roundName?.match(/\d+/)?.[0] ?? '1'
  const feed = useWchFeed({
    gameId: demo ? null : (feedQ ?? broadcast.game?.gameId ?? null),
    pregameName: `gukesh_sindarov_g${gameNo}`,
    done: !feedQ && broadcast.status === 'finished',
  })
  const feedOn = !demo && feed.status === 'on' && feed.plies.size > 0
  const live = useMemo(() => {
    if (!feedQ) return broadcast
    const game = feedGame(feedQ, feed.manifest, feed.plies, {
      white: WHITE,
      black: BLACK,
    })
    return {
      ...broadcast,
      game,
      status: (!game
        ? feed.status === 'off'
          ? 'error'
          : 'loading'
        : game.result !== '*'
          ? 'finished'
          : 'live') as LiveStatus,
      roundName: 'Feed replay',
    }
  }, [feedQ, broadcast, feed.manifest, feed.plies, feed.status])
  const liveMoves = useMemo(() => live.game?.moves ?? [], [live.game])
  const LIVE = demo ? GAME1.length : liveMoves.length

  // The board shows the position after move `sel` (-1: the start), and the
  // panels are about the move made from it, the next one. After the last
  // move that's the live position, so it counts as live (sel = LIVE).
  const [selRaw, setSelRaw] = useState<number | 'live'>('live')
  const sel = selRaw === 'live' || selRaw >= LIVE - 1 ? LIVE : selRaw
  const isLive = sel === LIVE
  /** The last move on the board (-1: none). */
  const shown = isLive ? LIVE - 1 : sel
  /** The move the panels are about (LIVE: the one he's thinking about). */
  const panelIdx = isLive ? LIVE : sel + 1
  const [hoverSan, setHoverSan] = useState<string | null>(null)
  const [playedAt, setPlayedAt] = useState<number | null>(null)
  const played = playedAt !== null
  const setPlayed = (v: boolean) => setPlayedAt(v ? Date.now() : null)
  const [tab, setTab] = useState<PaneTab>('chances')

  // Guesses by ply, kept in this browser for the live game.
  const gameKey = demo ? 'demo' : (live.game?.gameId ?? 'game')
  const [guesses, setGuesses] = useState<Record<number, string>>({})
  useEffect(() => {
    if (demo) return
    try {
      const saved = window.localStorage.getItem(`wch-guesses:${gameKey}`)
      setGuesses(saved ? JSON.parse(saved) : {})
    } catch {
      setGuesses({})
    }
  }, [demo, gameKey])
  // For the guess event: the move being guessed (set once data is in).
  const guessMoveRef = useRef({
    moveNumber: 1,
    color: 'white' as Side,
    had: false,
    top: '',
  })
  const setGuess = useCallback(
    (san: string) => {
      if (!demo) {
        noteWchGuess()
        trackWchGuess({
          game_id: gameKey,
          move_number: guessMoveRef.current.moveNumber,
          color: guessMoveRef.current.color,
          changed: guessMoveRef.current.had,
          maia_top: guessMoveRef.current.top === san,
        })
      }
      setGuesses((g) => {
        const next = { ...g, [LIVE]: san }
        if (!demo)
          try {
            window.localStorage.setItem(
              `wch-guesses:${gameKey}`,
              JSON.stringify(next),
            )
          } catch {
            // Kept for the visit only.
          }
        return next
      })
    },
    [LIVE, demo, gameKey],
  )
  const guess = guesses[LIVE] ?? null

  // The clock: a tick a second.
  const [now, setNow] = useState(() => Date.now())
  const [mountedAt] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const [guessCount, setGuessCount] = useState(NEXT.guessesSoFar)
  // Demo: ?guesses=N shows the page with N guesses in (and no new ones).
  const fixedGuesses =
    typeof router.query.guesses === 'string'
      ? Math.max(0, parseInt(router.query.guesses, 10) || 0)
      : null
  useEffect(() => {
    if (fixedGuesses !== null) setGuessCount(fixedGuesses)
  }, [fixedGuesses])
  useEffect(() => {
    if (!demo || played || fixedGuesses !== null) return
    setGuessCount((g) => g + (Math.random() < 0.6 ? 1 : 0))
  }, [now, demo, played, fixedGuesses])

  // Both layouts are in the page (CSS shows one), but only one board may be
  // mounted: chessground's arrowhead markers have fixed ids, and a second
  // board's markers (in the hidden layout) would win and draw no heads.
  const [wide, setWide] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${WIDE_FROM}px)`)
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const set = () => {
      const el = rootRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const doc = document.documentElement
      el.style.setProperty('--avail-h', `${doc.clientHeight - top}px`)
      el.style.setProperty('--avail-w', `${doc.clientWidth}px`)
    }
    set()
    window.addEventListener('resize', set)
    return () => window.removeEventListener('resize', set)
  }, [])

  // The engines, on the live game's positions (the one on screen first).
  const liveFens = useMemo(
    () => [START_FEN, ...liveMoves.map((m) => m.fen)],
    [liveMoves],
  )
  // The position on the board, which the panel is about (its next move).
  const focusFen = demo
    ? null
    : sel >= LIVE
      ? (liveMoves[LIVE - 1]?.fen ?? START_FEN)
      : (liveMoves[sel]?.fen ?? START_FEN)
  // With the feed, its ratings; else the browser's.
  const ratingBands = demo
    ? RATING_BANDS
    : feedOn
      ? FEED_RATING_BANDS
      : LIVE_RATING_BANDS
  // In the browser only when there's no feed for this game, except Maia's
  // read at each rating (the feed has those for the played move only).
  const engines = useWchEngines({
    enabled: !demo && !!live.game && feed.status === 'off',
    fens: liveFens,
    focusFen,
    timeControl: barTimeControl(live.game?.timeControl ?? null),
    ratingFen: tab === 'rating' ? focusFen : null,
    ratingBands,
  })

  const ids = {
    white: live.game?.white ?? WHITE,
    black: live.game?.black ?? (live.game?.white === BLACK ? WHITE : BLACK),
  }
  const startClock = useMemo(() => {
    const base = live.game?.timeControl?.match(/^(?:\d+\/)?(\d+)/)?.[1]
    return base ? +base : BASE_SECONDS
  }, [live.game?.timeControl])

  // The pre-game opening tree (the own models before the feed has a move).
  const tree = useMemo(
    () => (demo ? null : openingTree(feed.pregame, ids.white)),
    [demo, feed.pregame, ids.white],
  )

  const built = useMemo(
    () =>
      demo
        ? { plies: GAME1, next: NEXT }
        : buildLive(
            live.game,
            engines,
            ids,
            startClock,
            feedOn ? feed.plies : undefined,
            tree,
          ),
    // engines.version: the engines' results change in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      demo,
      live.game,
      engines.version,
      ids.white,
      ids.black,
      startClock,
      feedOn,
      feed.plies,
      tree,
    ],
  )

  // Seconds the side to move has been thinking.
  const thinking: number | null = demo
    ? NEXT.thinkingFor! + Math.floor(((playedAt ?? now) - mountedAt) / 1000)
    : live.status === 'live' && live.lastMoveAt
      ? Math.max(0, Math.floor((now - live.lastMoveAt) / 1000))
      : null

  const data: WchData = {
    mode: demo ? 'demo' : 'live',
    plies: built.plies,
    next: { ...built.next, thinkingFor: thinking },
    LIVE,
    white: ids.white,
    black: ids.black,
    // The position on show: the own models (feed or tree), or Maia at 2600.
    personal:
      demo ||
      !!(panelIdx < built.plies.length
        ? built.plies[panelIdx]?.personal
        : built.next.personal),
    hasCrowd: demo,
    feedOn,
    pregame: feed.pregame,
  }
  const { plies, next } = data
  guessMoveRef.current = {
    moveNumber: next.moveNumber,
    color: next.color,
    had: guess !== null,
    top: next.candidates[0]?.san ?? '',
  }

  // The visit, for PostHog (src/components/WCh/visit.ts): one event when it
  // ends.
  useEffect(() => {
    if (!router.isReady) return
    startWchVisit(demo ? 'demo' : feedQ ? 'feed_replay' : 'live')
    return () => endWchVisit('navigated')
  }, [router.isReady, demo, feedQ])
  useEffect(() => {
    noteWchGame(demo ? 'demo' : (live.game?.gameId ?? null), live.status, LIVE)
  }, [demo, live.game?.gameId, live.status, LIVE])
  const source: WchSource | null = demo
    ? 'demo'
    : !next.candidates.length
      ? null
      : feedOn && feed.plies.has(LIVE)
        ? 'feed'
        : next.personal
          ? 'tree'
          : 'browser'
  useEffect(() => {
    if (source) noteWchSource(source)
  }, [source])
  useEffect(() => {
    if (wide !== null) noteWchLayout(wide)
  }, [wide])

  const go = useCallback(
    (i: number) => {
      setSelRaw(i >= LIVE - 1 ? 'live' : Math.max(-1, i))
      setHoverSan(null)
    },
    [LIVE],
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(shown - 1)
      if (e.key === 'ArrowRight') go(shown + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, shown])

  // Demo: the move the demo plays is Maia's first choice.
  const liveSan = demo ? NEXT.candidates[0].san : ''
  const liveAfter = useMemo(() => {
    if (!demo) return null
    const c = new Chess(NEXT.fen)
    const m = c.move(NEXT.candidates[0].san)
    return { fen: c.fen(), uci: m ? m.from + m.to : '' }
  }, [demo])
  const demoPlayed = demo && played

  const canGuess = isLive && signedIn && !demoPlayed && !next.over
  // The move the panels are about (null: the live one), and the one on the
  // board before it (null: the start, or live).
  const ply = isLive ? null : (plies[panelIdx] ?? null)
  const boardPly = isLive || shown < 0 ? null : (plies[shown] ?? null)
  const lastPly = plies[LIVE - 1] ?? null

  const boardFen = !isLive
    ? (boardPly?.fen ?? plies[0]?.fenBefore ?? next.fen)
    : demoPlayed && liveAfter
      ? liveAfter.fen
      : next.fen
  const lastMove = !isLive
    ? (boardPly?.uci ?? null)
    : demoPlayed && liveAfter
      ? liveAfter.uci
      : (lastPly?.uci ?? null)

  const dests = useMemo(() => {
    if (!canGuess) return undefined
    const c = new Chess(next.fen)
    const map = new Map<Key, Key[]>()
    c.moves({ verbose: true }).forEach((m) => {
      map.set(m.from as Key, [...(map.get(m.from as Key) ?? []), m.to as Key])
    })
    return map
  }, [canGuess, next.fen])

  const onBoardMove = (from: string, to: string) => {
    const c = new Chess(next.fen)
    const m = c.move({ from, to, promotion: 'q' } as never)
    if (m) setGuess(m.san)
  }

  // The position the right panel is about (before its move).
  const panelFen = ply ? ply.fenBefore : next.fen
  // Demo: while he thinks, the prediction shifts away from the quick moves.
  const liveCands = useMemo(
    () =>
      demo
        ? afterThinking(NEXT.candidates, thinking ?? 0).sort(
            (a, b) => b.maia - a.maia,
          )
        : next.candidates,
    [demo, thinking, next.candidates],
  )
  const panelCands = ply ? ply.candidates : liveCands
  const panelSf = ply ? ply.sf : next.sf
  const panelMover = ply ? ply.mover : next.mover

  const shapes = useMemo(() => {
    const out: DrawShape[] = []
    const arrow = (san: string, brush: string, w?: number) => {
      const sq = san ? sanToSquares(panelFen, san) : null
      if (sq)
        out.push({
          orig: sq[0] as Key,
          dest: sq[1] as Key,
          brush,
          ...(w ? { modifiers: { lineWidth: w } } : {}),
        })
    }
    if (hoverSan) {
      arrow(hoverSan, hoverSan === panelSf ? 'engine' : 'maia')
      return out
    }
    // After the move, the board shows the new position: arrows only before.
    if (isLive && (demoPlayed || next.over)) return out
    // An earlier position: the move he went on to play too, in white.
    const top = panelCands[0]?.san
    const playedSan = ply?.san
    if (playedSan && playedSan !== top && playedSan !== panelSf)
      arrow(playedSan, 'you')
    if (top) arrow(top, 'maia')
    if (panelSf && panelSf !== top) arrow(panelSf, 'engine', 8)
    if (isLive && guess && guess !== top && guess !== panelSf)
      arrow(guess, 'you')
    return out
  }, [
    hoverSan,
    isLive,
    demoPlayed,
    next.over,
    panelFen,
    panelCands,
    panelSf,
    ply,
    guess,
  ])

  const score: Tally = useMemo(() => {
    if (demo) {
      const base = tally(GAME1)
      const crowdTopLive = [...NEXT.candidates].sort(
        (a, b) => b.crowd - a.crowd,
      )[0]
      return played
        ? {
            n: base.n + 1,
            maia: base.maia + 1,
            crowd: base.crowd + (crowdTopLive.san === liveSan ? 1 : 0),
            stockfish: base.stockfish + (NEXT.sf === liveSan ? 1 : 0),
          }
        : base
    }
    // The feed keeps the count of moves and Stockfish's first choices;
    // Maia's are the move list's checks (ranked as the panel shows them).
    const called = feedOn ? feed.plies.get(LIVE)?.called?.all : null
    if (called)
      return {
        n: called.moves,
        maia: plies.filter((p) => p.rank === 1).length,
        crowd: null,
        stockfish: called.stockfish,
      }
    const known = plies.filter((p) => p.rank > 0)
    const sfKnown = plies.filter((p) => p.sf)
    return {
      n: known.length,
      maia: known.filter((p) => p.rank === 1).length,
      crowd: null,
      stockfish:
        sfKnown.length === plies.length
          ? sfKnown.filter((p) => p.sf === p.san).length
          : null,
    }
  }, [demo, played, plies, liveSan, feedOn, feed.plies, LIVE])

  // Your guesses that a move has settled.
  const you = useMemo(() => {
    if (demo)
      return guess && played
        ? { right: guess === liveSan ? 1 : 0, of: 1 }
        : null
    const settled = Object.entries(guesses).filter(([k]) => +k < LIVE)
    if (!settled.length) return null
    return {
      right: settled.filter(([k, san]) => plies[+k]?.san === san).length,
      of: settled.length,
    }
  }, [demo, guess, played, liveSan, guesses, LIVE, plies])

  // The bars and clocks: the position on the board.
  const shownPly = isLive ? lastPly : boardPly
  const bar = shownPly?.bar
  const evalNow = !isLive
    ? (boardPly?.eval ?? 0.2)
    : demoPlayed
      ? NEXT.candidates[0].eval
      : (lastPly?.eval ?? 0.2)

  const clockWhite = shownPly?.clockWhite ?? startClock
  const clockBlack = shownPly?.clockBlack ?? startClock
  const toMove: Side | null =
    isLive && !demoPlayed && !next.over && thinking !== null ? next.color : null
  const clockWhiteNow =
    clockWhite - (toMove === 'white' && thinking !== null ? thinking : 0)
  const clockBlackNow =
    clockBlack - (toMove === 'black' && thinking !== null ? thinking : 0)

  const hasRisk =
    feedOn || next.risk != null || plies.some((p) => p.risk != null)
  const tabs = demo || hasRisk ? PANE_TABS : LIVE_TABS
  const shownTab = tabs.some((t) => t.id === tab) ? tab : 'chances'
  useEffect(() => {
    noteWchTab(shownTab)
  }, [shownTab])
  useEffect(() => {
    if (!isLive) noteWchMove(sel)
  }, [isLive, sel])
  useEffect(() => {
    if (hoverSan) noteWchHover()
  }, [hoverSan])
  // At each rating: Maia's top three here and the move he played (or the
  // top four while he thinks), all from the browser's Maia. Without it yet,
  // the feed's numbers for the played move alone.
  const ratingRows = useMemo((): RatingRow[] | null => {
    if (demo) return byRating(panelCands)
    const playedSan = ply?.san ?? null
    const sans = panelCands.slice(0, 3).map((c) => c.san)
    if (playedSan && !sans.includes(playedSan)) sans.push(playedSan)
    else if (panelCands[3]) sans.push(panelCands[3].san)
    const reads = engines.byRating(panelFen)
    if (reads)
      return sans.map((san) => {
        const m = new Chess(panelFen).move(san)
        const uci = m ? m.from + m.to + (m.promotion ?? '') : ''
        return {
          san,
          shares: reads.map((r) => r.policy?.[uci] ?? 0),
          played: san === playedSan,
        }
      })
    if (feedOn && ply?.ratingShares)
      return [{ san: ply.san, shares: ply.ratingShares, played: true }]
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, panelCands, panelFen, engines.version, feedOn, ply])
  const ratingNote = ratingRows?.length
    ? ply
      ? `How likely players at each rating were to play each move here; he played ${moveNo(ply.moveNumber, ply.color)}${ply.san}`
      : 'How likely players at each rating are to play each move here'
    : null

  const title = demo
    ? 'Game 1 of 14, Geneva'
    : `${live.roundName ?? 'World Championship'}${
        live.status === 'waiting' && live.startsAt
          ? `, starts ${new Date(live.startsAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : ''
      }`

  const paneBody = (
    <>
      {shownTab === 'chances' ? (
        <ChancesChart sel={sel} onSelect={go} />
      ) : shownTab === 'risk' ? (
        feedOn ? (
          <FeedRiskChart sel={sel} onSelect={go} />
        ) : (
          <RiskChart sel={sel} onSelect={go} />
        )
      ) : shownTab === 'clocks' ? (
        <ClocksChart sel={sel} startClock={startClock} />
      ) : (
        <ByRating
          rows={ratingRows}
          bands={ratingBands}
          note={demo ? undefined : ratingNote}
          empty={
            engines.maiaStatus === 'no-cache' || engines.maiaStatus === 'error'
              ? 'Maia isn\u2019t loaded in this browser, so there are no ratings to show here yet'
              : 'Maia is reading the position at each rating…'
          }
        />
      )}
    </>
  )

  const footnote = demo
    ? 'Prototype with an illustrative game and made-up Maia, Stockfish and visitor numbers.'
    : feedOn || tree
      ? `Moves and clocks from the Lichess broadcast. Maia's predictions come from the players' past games only: they know nothing about either player's preparation for this match. Your guesses stay in this browser.`
      : `Moves and clocks from the Lichess broadcast. Maia (at ${LIVE_MAIA_ELO}) and Stockfish run in your browser; your guesses stay in this browser.`

  // The one-column layout (below WIDE_FROM), shown by CSS so it's right on
  // first paint.
  const mobileView = (
    <>
      <div className="flex h-11 items-center gap-2 px-2">
        <PlayerHalf
          id={ids.white}
          side="white"
          clock={clockWhiteNow}
          active={toMove === 'white'}
          thinking={thinking ?? 0}
        />
        <div className="w-[70px] shrink-0 text-center text-[10px] leading-3">
          <p className="font-semibold text-white/80">World Championship</p>
          <p className="mt-0.5 text-white/45">
            {demo ? '2026, Game 1' : (live.roundName ?? '2026')}
          </p>
        </div>
        <PlayerHalf
          id={ids.black}
          side="black"
          clock={clockBlackNow}
          active={toMove === 'black'}
          thinking={thinking ?? 0}
          alignRight
        />
      </div>
      <div className="flex items-stretch justify-center gap-1.5 px-2">
        <div className="flex w-6 shrink-0">
          <HumanBar bar={bar} size="100%" />
        </div>
        <div className="min-w-0" style={{ flex: '0 1 var(--mboard)' }}>
          {wide === false ? (
            <WchBoard
              key={dests ? 'guess' : 'view'}
              fen={boardFen}
              lastMove={lastMove}
              shapes={shapes}
              dests={dests}
              turnColor={dests ? next.color : undefined}
              onMove={onBoardMove}
              coordinates={false}
            />
          ) : (
            <div className="aspect-square w-full bg-white/[0.04]" />
          )}
        </div>
        <div className="flex w-6 shrink-0">
          <EvalBar ev={evalNow} size="100%" compact />
        </div>
      </div>
      <div className="mt-1.5 flex flex-col gap-1.5">
        <MobilePrediction
          ply={ply}
          cands={panelCands}
          sf={panelSf}
          mover={panelMover}
          signedIn={signedIn}
          onDemoSignIn={() => setDemoSignedIn(true)}
          guess={guess}
          onGuess={canGuess ? setGuess : undefined}
          played={demoPlayed}
          guessCount={guessCount}
          liveSan={liveSan}
          shownSan={hoverSan}
          onShow={setHoverSan}
          myGuess={ply ? (guesses[ply.index] ?? null) : null}
          onJump={(i) => go(i - 1)}
          onBack={next.over && !isLive ? () => go(LIVE) : undefined}
        />
        <MoveStrip
          sel={shown}
          live={isLive}
          onSelect={go}
          played={demoPlayed}
          liveSan={liveSan}
        />
        <div
          className="mx-2 flex flex-col overflow-hidden rounded-md border border-glass-border bg-glass"
          style={{ height: PANE_H + 10 }}
        >
          <div className="flex items-stretch border-b border-glass-border">
            <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto [&>div]:border-b-0 [&_p]:whitespace-nowrap">
              <UnderlineTabs
                tabs={tabs.map((t) => ({ ...t, name: SHORT_TAB[t.id] }))}
                selected={shownTab}
                onSelect={setTab}
                layoutId="wchPaneTabMobile"
              />
            </div>
            <span className="flex items-center whitespace-nowrap px-3 text-[13px] font-semibold text-human-1">
              Maia views
            </span>
          </div>
          <div className="min-h-0 flex-1 px-2 py-2">{paneBody}</div>
        </div>
        <div className="mx-2">
          <Leaders score={score} you={you} />
        </div>
        <p className="mx-3 text-xs text-white/35">
          {footnote} Photos: Dominik Töpfer / Lichess.{' '}
          {demo && !played ? (
            <button onClick={() => setPlayed(true)} className="underline">
              Demo: play his move
            </button>
          ) : null}
        </p>
      </div>
    </>
  )

  return (
    <WchCtx.Provider value={data}>
      <Head>
        <title>World Championship 2026 – Maia Chess</title>
        <meta name="robots" content="noindex" />
      </Head>
      <style>{SIZE_CSS}</style>
      {!demo ? (
        <MaiaDownloadPrompt engine={maiaEngine} blocking={false} />
      ) : null}
      <main ref={rootRef} className="wch-root w-full pb-10">
        <div className="mx-auto max-w-[640px] xl:hidden">{mobileView}</div>
        <div className="mx-auto hidden w-full max-w-[1680px] px-6 pt-3 xl:block">
          <div className="grid grid-cols-[280px_calc(var(--board)+76px)_minmax(380px,1fr)] gap-7">
            {/* Left: the match, the moves */}
            <section
              className="flex min-h-0 flex-col gap-3"
              style={{ height: COL_H }}
            >
              <Players
                title={title}
                score={demo ? '0–0' : null}
                clockWhite={clockWhiteNow}
                clockBlack={clockBlackNow}
                onMove={toMove}
                thinking={thinking ?? 0}
              />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
                <MoveList
                  sel={shown}
                  live={isLive}
                  onSelect={go}
                  played={demoPlayed}
                  liveSan={liveSan}
                  livePct={liveCands.find((c) => c.san === liveSan)?.maia ?? 0}
                />
                <p className="flex items-center justify-center gap-3 border-b border-glass-border py-1 text-[10px] text-white/45">
                  <span className="flex items-center gap-0.5">
                    <MaiaCheck /> Maia&apos;s first choice
                  </span>
                  <span>
                    <span className="text-white/60">#2</span> its second
                  </span>
                </p>
                <Controls sel={shown} go={go} />
              </div>
            </section>

            {/* Middle: bars, board, pane */}
            <section className="flex flex-col gap-2">
              <div>
                <div
                  className="grid h-7 items-end gap-3 text-[11px] font-semibold"
                  style={{
                    gridTemplateColumns: `${BAR_W}px var(--board) ${BAR_W}px`,
                  }}
                >
                  <span
                    className="whitespace-nowrap text-center leading-[13px]"
                    style={{ color: MAIA }}
                  >
                    <span className="block text-[13px] font-semibold">
                      Maia
                    </span>
                    <span className="block text-[10px] text-white/60">
                      Win %
                    </span>
                  </span>
                  <ArrowLegend white={isLive ? 'Your guess' : 'Played next'} />
                  <span
                    className="whitespace-nowrap text-center leading-[13px]"
                    style={{ color: ENGINE }}
                  >
                    <span className="block text-[13px] font-semibold">SF</span>
                    <span className="block text-[10px] text-white/60">
                      Eval
                    </span>
                  </span>
                </div>
                <div
                  className="mt-1 grid items-stretch gap-3"
                  style={{
                    gridTemplateColumns: `${BAR_W}px var(--board) ${BAR_W}px`,
                  }}
                >
                  <HumanBar bar={bar} />
                  <div className="max-w-full">
                    {wide === true ? (
                      <WchBoard
                        key={dests ? 'guess' : 'view'}
                        fen={boardFen}
                        lastMove={lastMove}
                        shapes={shapes}
                        dests={dests}
                        turnColor={dests ? next.color : undefined}
                        onMove={onBoardMove}
                      />
                    ) : (
                      <div className="aspect-square w-full bg-white/[0.04]" />
                    )}
                  </div>
                  <EvalBar ev={evalNow} />
                </div>
              </div>
              <div
                className="flex flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md"
                style={{ height: PANE_H }}
              >
                <div className="flex items-stretch border-b border-glass-border">
                  <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto [&>div]:border-b-0 [&_p]:whitespace-nowrap">
                    <UnderlineTabs
                      tabs={tabs}
                      selected={shownTab}
                      onSelect={setTab}
                      layoutId="wchPaneTab"
                    />
                  </div>
                  <span className="flex items-center whitespace-nowrap px-3 text-[13px] font-semibold text-human-1">
                    Maia views
                  </span>
                </div>
                <div className="min-h-0 flex-1 px-3 py-2">{paneBody}</div>
              </div>
            </section>

            {/* Right: the guess, Maia and Stockfish, the leaders */}
            <section
              className="flex min-h-0 flex-col gap-3"
              style={{ height: COL_H }}
            >
              <MovePanel
                ply={ply}
                cands={panelCands}
                sf={panelSf}
                signedIn={signedIn}
                onDemoSignIn={() => setDemoSignedIn(true)}
                guess={guess}
                onGuess={canGuess ? setGuess : undefined}
                played={demoPlayed}
                onPlay={() => setPlayed(true)}
                guessCount={guessCount}
                liveSan={liveSan}
                onShow={setHoverSan}
                hoverSan={hoverSan}
                myGuess={ply ? (guesses[ply.index] ?? null) : null}
                onJump={(i) => go(i - 1)}
                onBack={next.over && !isLive ? () => go(LIVE) : undefined}
                lastResult={
                  !demo && LIVE > 0 && guesses[LIVE - 1]
                    ? {
                        san: plies[LIVE - 1].san,
                        guess: guesses[LIVE - 1],
                      }
                    : null
                }
              />
              <Leaders score={score} you={you} />
            </section>
          </div>
          <p className="mt-5 text-xs text-white/35">
            {footnote} Photos: Dominik Töpfer / Lichess.
            {!demo && live.status === 'error' ? (
              <span className="ml-2 text-rose-300">
                Couldn&apos;t reach the broadcast: {live.error}
              </span>
            ) : null}
          </p>
        </div>
      </main>
    </WchCtx.Provider>
  )
}

OraclePage.providers = ENGINE_PROVIDERS

/* ------------------------------------------------------------------ */
/* Left column                                                          */

/** The player's colour: a white or black circle. */
const SideMark: React.FC<{ side: Side }> = ({ side }) => (
  <span
    title={side === 'white' ? 'White' : 'Black'}
    className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full ${
      side === 'white'
        ? 'bg-[#f1eee9]'
        : 'bg-[#141112] ring-1 ring-inset ring-white/50'
    }`}
  />
)

const Players: React.FC<{
  title: string
  /** The match score, when known. */
  score: string | null
  clockWhite: number
  clockBlack: number
  onMove: Side | null
  thinking: number
}> = ({ title, score, clockWhite, clockBlack, onMove, thinking }) => {
  const { white, black } = useWch()
  return (
    <div className="overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
      <div className="flex items-end justify-between border-b border-glass-border px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-white">
            World Championship 2026
          </p>
          <p className="text-xs text-white/50">{title}</p>
        </div>
        {score ? (
          <p className="text-right text-xs text-white/50">
            Match <span className="tabular-nums text-white/80">{score}</span>
          </p>
        ) : null}
      </div>
      <PlayerRow
        id={black}
        side="black"
        clock={clockBlack}
        active={onMove === 'black'}
        thinking={thinking}
      />
      <div className="mx-3 h-px bg-glass-border" />
      <PlayerRow
        id={white}
        side="white"
        clock={clockWhite}
        active={onMove === 'white'}
        thinking={thinking}
      />
    </div>
  )
}

const PlayerRow: React.FC<{
  id: 'gukesh' | 'sindarov'
  side: Side
  clock: number
  active: boolean
  thinking: number
}> = ({ id, side, clock, active, thinking }) => {
  const p = FIDE[id]
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.photo}
        alt={p.name}
        width={60}
        height={60}
        className="h-[60px] w-[60px] shrink-0 rounded-full bg-white/10 object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[15px] font-semibold leading-5 text-white">
          <SideMark side={side} />
          <span className="truncate">{p.name}</span>
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-white/55">
            <Flag fed={p.fed} />
            <span>{p.title}</span>
            <span className="tabular-nums">{p.rating}</span>
          </p>
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-[19px] font-semibold tabular-nums leading-6 ${
              active ? 'bg-emerald-400 text-black' : 'text-white/45'
            }`}
          >
            {fmtClock(clock)}
          </span>
        </div>
        <p
          className={`mt-0.5 h-4 text-right text-[11px] tabular-nums ${
            active ? 'text-emerald-300' : 'text-transparent'
          }`}
        >
          thinking {fmtClock(thinking)}
        </p>
      </div>
    </div>
  )
}

/**
 * Keeps a scrolled box at the right place: `place` runs when `deps` change,
 * and again whenever the box or what's in it changes size (the icon font
 * loading narrows the move chips, more moves come in), so the selection
 * doesn't drift out of view after the first placing.
 */
const useKeepInView = (
  ref: React.RefObject<HTMLDivElement | null>,
  place: (box: HTMLDivElement) => void,
  deps: unknown[],
) => {
  const placeRef = useRef(place)
  placeRef.current = place
  useEffect(() => {
    const box = ref.current
    if (!box) return
    const run = () => placeRef.current(box)
    run()
    let gone = false
    document.fonts?.ready.then(() => {
      if (!gone) run()
    })
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(run)
    ro.observe(box)
    Array.from(box.children).forEach((c) => ro.observe(c))
    return () => {
      gone = true
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

const MoveList: React.FC<{
  /** The last move on the board (-1: the start). */
  sel: number
  live: boolean
  onSelect: (i: number) => void
  played: boolean
  liveSan: string
  livePct: number
}> = ({ sel, live, onSelect, played, liveSan, livePct }) => {
  const { plies: GAME1, next: NEXT, LIVE } = useWch()
  const ref = useRef<HTMLDivElement>(null)
  // Live: the end of the list; otherwise the move on the board, in view.
  useKeepInView(
    ref,
    (list) => {
      if (live) {
        list.scrollTop = list.scrollHeight
        return
      }
      const el = list.querySelector<HTMLElement>('[data-sel="true"]')
      if (!el) return
      const top = el.offsetTop
      if (top < list.scrollTop) list.scrollTop = top
      else if (top + el.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = top + el.offsetHeight - list.clientHeight
    },
    [sel, live, LIVE],
  )
  const rows: number[] = []
  for (let i = 0; i < GAME1.length; i += 2) rows.push(i)
  return (
    <div
      ref={ref}
      className="red-scrollbar relative grid min-h-0 flex-1 auto-rows-min grid-cols-[2.25rem_1fr_1fr] overflow-y-auto border-b border-glass-border text-white/90"
    >
      {rows.map((i) => (
        <React.Fragment key={i}>
          <span className="flex h-7 items-center justify-center bg-glass-strong text-xs text-white/60">
            {i / 2 + 1}
          </span>
          <Cell
            p={GAME1[i]}
            active={!live && sel === i}
            onClick={() => onSelect(i)}
          />
          {GAME1[i + 1] ? (
            <Cell
              p={GAME1[i + 1]}
              active={!live && sel === i + 1}
              onClick={() => onSelect(i + 1)}
            />
          ) : (
            <span />
          )}
        </React.Fragment>
      ))}
      <span className="flex h-7 items-center justify-center bg-glass-strong text-xs text-white/60">
        {NEXT.moveNumber}
      </span>
      <button
        data-sel={live}
        onClick={() => onSelect(LIVE)}
        className={`flex h-7 items-center justify-between px-2 text-sm ${
          live
            ? 'bg-rose-500/20 ring-1 ring-inset ring-rose-400/60'
            : 'hover:bg-glass-stronger'
        }`}
      >
        {played ? (
          <>
            <span>{liveSan}</span>
            <MaiaHit p={livePct} />
          </>
        ) : (
          <span
            className={`flex items-center gap-1.5 text-xs ${
              live ? 'font-semibold text-rose-100' : 'text-rose-200/90'
            }`}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
            live
          </span>
        )}
      </button>
      <span />
    </div>
  )
}

const MaiaCheck = () => (
  <span
    title="Maia's first choice"
    className="material-symbols-outlined !text-[15px] text-human-1"
  >
    check
  </span>
)

/** A move Maia put first: a check and the probability it gave it. */
const MaiaHit: React.FC<{ p: number }> = ({ p }) => (
  <span className="flex items-center gap-0.5 text-[11px] tabular-nums text-human-1">
    <MaiaCheck />
    {pct(p)}
  </span>
)

/** Maia's probability for a move it didn't put first: rank and a bar. */
const MissBar: React.FC<{ rank: number; p: number }> = ({ rank, p }) => (
  <span
    className="flex items-center gap-1"
    title={
      rank
        ? `Maia's #${rank} choice, ${pct(p)}`
        : `Not in Maia's top choices, ${pct(p)}`
    }
  >
    <span className="text-[10px] tabular-nums text-white/55">
      {rank ? `#${rank}` : '–'}
    </span>
    <span className="relative h-1 w-6 overflow-hidden rounded-full bg-white/10">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${Math.max(p, 0.04) * 100}%`,
          background: 'rgb(254 127 109 / 0.7)',
        }}
      />
    </span>
  </span>
)

const Cell: React.FC<{
  p: LivePly
  active: boolean
  onClick: () => void
}> = ({ p, active, onClick }) => (
  <button
    data-sel={active}
    onClick={onClick}
    className={`flex h-7 min-w-0 items-center justify-between gap-1 px-2 text-sm hover:bg-glass-stronger ${
      active ? 'bg-glass-strong' : ''
    }`}
  >
    <span className="flex min-w-0 items-center gap-1 truncate">
      {p.san}
      {p.mark ? <MarkChip mark={p.mark} /> : null}
    </span>
    {p.rank === 1 ? (
      <MaiaHit p={p.pPlayed} />
    ) : (
      <MissBar rank={p.rank} p={p.pPlayed} />
    )}
  </button>
)

const Controls: React.FC<{ sel: number; go: (i: number) => void }> = ({
  sel,
  go,
}) => {
  const { LIVE } = useWch()
  return (
    <div className="grid grid-cols-4 text-white/70">
      {(
        [
          ['first_page', -1],
          ['arrow_back_ios', sel - 1],
          ['arrow_forward_ios', sel + 1],
          ['last_page', LIVE],
        ] as [string, number][]
      ).map(([icon, to]) => (
        <button
          key={icon}
          onClick={() => go(to)}
          className="flex h-8 items-center justify-center hover:bg-glass-stronger hover:text-white"
        >
          <span className="material-symbols-outlined !text-[18px]">{icon}</span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bars and legend around the board                                     */

const ArrowLegend: React.FC<{ white: string }> = ({ white }) => (
  <div className="flex items-center justify-center gap-4 text-[11px] font-normal text-white/60">
    {(
      [
        ['Maia', MAIA],
        ['Stockfish', ENGINE],
        [white, '#e8e8e8'],
      ] as [string, string][]
    ).map(([label, c]) => (
      <span key={label} className="flex items-center gap-1.5">
        <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden>
          <line x1="0" y1="4" x2="12" y2="4" stroke={c} strokeWidth="2.5" />
          <path d="M11 0.5 L17.5 4 L11 7.5 Z" fill={c} />
        </svg>
        {label}
      </span>
    ))}
  </div>
)

const HumanBar: React.FC<{
  bar?: { W: number; D: number; B: number }
  size?: string
}> = ({ bar, size = 'var(--board)' }) => {
  if (!bar)
    return (
      <div
        className="flex w-full items-center justify-center rounded border border-white/15 bg-white/[0.04] text-[11px] text-white/35"
        style={{ height: size }}
        title="Maia's win chances come in from move 6"
      >
        –
      </div>
    )
  const seg = (v: number, cls: string, label: string) => (
    <div
      className={`flex items-center justify-center text-[13px] font-bold tabular-nums transition-all duration-500 ${cls}`}
      style={{ height: `${v * 100}%` }}
      title={label}
    >
      {v >= 0.08 ? Math.round(v * 100) : ''}
    </div>
  )
  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded border border-white/25"
      style={{ height: size }}
    >
      {seg(bar.B, 'bg-[#2a2526] text-white', `Black wins ${pct(bar.B)}`)}
      {seg(bar.D, 'bg-[#8f8a88] text-black', `Draw ${pct(bar.D)}`)}
      {seg(bar.W, 'bg-[#f1eee9] text-black', `White wins ${pct(bar.W)}`)}
    </div>
  )
}

const EvalBar: React.FC<{ ev: number; size?: string; compact?: boolean }> = ({
  ev,
  size = 'var(--board)',
  compact = false,
}) => {
  const white = 0.5 + 0.5 * Math.tanh(ev / 3)
  return (
    <div
      className="relative flex w-full flex-col justify-end rounded border border-white/10 bg-[#1f2a36]"
      style={{ height: size }}
      title={`Stockfish ${fmtEval(ev)}`}
    >
      <div
        className="rounded-b bg-engine-2/80 transition-all duration-500"
        style={{ height: `${white * 100}%` }}
      />
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/25" />
      <span
        className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border border-engine-2/60 bg-[#141a21] py-px font-mono ${compact ? 'px-0.5 text-[9px]' : 'px-1 text-[10px]'} font-semibold tabular-nums text-white transition-all duration-500`}
        style={{ top: `${(1 - white) * 100}%` }}
      >
        {fmtEval(ev)}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pane under the board */

/** Measures its box so the charts draw at real pixel size. */
const Sized: React.FC<{
  children: (w: number, h: number) => React.ReactNode
}> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<[number, number]>([0, 0])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setSize([e.contentRect.width, e.contentRect.height]),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="h-full w-full">
      {size[0] > 0 ? children(size[0], size[1]) : null}
    </div>
  )
}

const PAD = { l: 44, r: 92, t: 4, b: 16 }

// n at least 1: a chart drawn before any move.
const frame = (w: number, h: number, moves: number) => {
  const n = Math.max(1, moves)
  return {
    x: (i: number) => PAD.l + (i / n) * (w - PAD.l - PAD.r),
    y: (v: number) => PAD.t + v * (h - PAD.t - PAD.b),
    plotW: w - PAD.l - PAD.r,
    bottom: h - PAD.b,
    index: (clientX: number, left: number) =>
      Math.round(((clientX - left - PAD.l) / (w - PAD.l - PAD.r)) * n),
  }
}

const MoveTicks: React.FC<{ x: (i: number) => number; y: number }> = ({
  x,
  y,
}) => (
  <>
    {[5, 10, 15, 20].map((m) => (
      <text
        key={m}
        x={x(m * 2 - 1)}
        y={y}
        fontSize={11}
        textAnchor="middle"
        fill="rgba(255,255,255,0.45)"
      >
        {m}
      </text>
    ))}
  </>
)

const ChancesChart: React.FC<{
  sel: number
  onSelect: (i: number) => void
}> = ({ sel, onSelect }) => {
  const { plies: GAME1, LIVE } = useWch()
  return (
    <Sized>
      {(w, h) => {
        // Known bars only (live, they come in as Maia and Stockfish finish).
        const known = GAME1.flatMap((p, k) =>
          p.bar ? [{ i: k + 1, b: p.bar }] : [],
        )
        if (known.length < 2)
          return (
            <div
              className="flex h-full items-center justify-center text-xs text-white/40"
              style={{ width: w }}
            >
              Maia&apos;s win chances fill in from move 6.
            </div>
          )
        const pts = known.map((k) => k.b)
        const at = known.map((k) => k.i)
        const n = Math.max(LIVE, 1)
        const f = frame(w, h, n)
        const cur = sel === LIVE ? LIVE : sel + 1
        // The bar at the move on show, or the last one before it.
        let k = 0
        at.forEach((p, i) => {
          if (p <= cur) k = i
        })
        const b = pts[k]
        const band = (top: (i: number) => number, bot: (i: number) => number) =>
          `M${pts.map((_, i) => `${f.x(at[i])},${f.y(top(i))}`).join('L')}L${pts
            .map((_, i) => `${f.x(at[i])},${f.y(bot(i))}`)
            .reverse()
            .join('L')}Z`
        const mid = (a: number, c: number) => f.y((a + c) / 2) + 4
        return (
          <svg
            width={w}
            height={h}
            className="cursor-pointer"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              onSelect(
                Math.max(-1, Math.min(LIVE, f.index(e.clientX, r.left) - 1)),
              )
            }}
          >
            <path
              d={band(
                () => 0,
                (i) => pts[i].B,
              )}
              fill="#3f3a3b"
            />
            <path
              d={band(
                (i) => pts[i].B,
                (i) => pts[i].B + pts[i].D,
              )}
              fill="#8f8a88"
            />
            <path
              d={band(
                (i) => pts[i].B + pts[i].D,
                () => 1,
              )}
              fill="#e6e3e0"
            />
            {[0.25, 0.5, 0.75].map((v) => (
              <line
                key={v}
                x1={PAD.l}
                x2={w - PAD.r}
                y1={f.y(v)}
                y2={f.y(v)}
                stroke="rgba(0,0,0,0.2)"
              />
            ))}
            <text
              x={PAD.l - 6}
              y={f.y(0) + 10}
              fontSize={11}
              textAnchor="end"
              fill="rgba(255,255,255,0.45)"
            >
              Black
            </text>
            <text
              x={PAD.l - 6}
              y={f.y(1)}
              fontSize={11}
              textAnchor="end"
              fill="rgba(255,255,255,0.45)"
            >
              White
            </text>
            <line
              x1={f.x(cur)}
              x2={f.x(cur)}
              y1={PAD.t}
              y2={f.bottom}
              stroke={MAIA}
              strokeWidth={2}
            />
            <MoveTicks x={f.x} y={h - 2} />
            <g fontSize={12} fontWeight={600}>
              <text
                x={w - PAD.r + 10}
                y={mid(0, b.B)}
                fill="rgba(255,255,255,0.75)"
              >
                Black {Math.round(b.B * 100)}%
              </text>
              <text
                x={w - PAD.r + 10}
                y={mid(b.B, b.B + b.D)}
                fill="rgba(255,255,255,0.6)"
              >
                Draw {Math.round(b.D * 100)}%
              </text>
              <text x={w - PAD.r + 10} y={mid(b.B + b.D, 1)} fill="#fff">
                White {Math.round(b.W * 100)}%
              </text>
            </g>
          </svg>
        )
      }}
    </Sized>
  )
}

const WHITE_INK = '#ececec'
const BLACK_INK = '#a49c98'

/**
 * Each player's risk of a blunder in the next few moves, as a multiple of
 * his own usual rate: one shared "usual" line, red where a player runs
 * above it.
 */
const RiskChart: React.FC<{ sel: number; onSelect: (i: number) => void }> = ({
  sel,
  onSelect,
}) => {
  const { plies: GAME1, LIVE, white: WHITE, black: BLACK } = useWch()
  return (
    <Sized>
      {(w, h) => {
        const n = GAME1.length
        const f = frame(w, h, n)
        // Multiple of usual, smoothed over three plies.
        const series = (side: Side) => {
          const raw = GAME1.map((p) => {
            const r = blunderRisk(p, side)
            return r.risk / r.usual
          })
          return raw.map((_, i) => {
            const win = raw.slice(Math.max(0, i - 1), i + 2)
            return win.reduce((a, b) => a + b, 0) / win.length
          })
        }
        const ws = series('white')
        const bs = series('black')
        const lo = 0.5
        const hi = Math.max(2.2, ...ws, ...bs) * 1.05
        const y = (m: number) => f.y((hi - m) / (hi - lo))
        const line = (ms: number[]) =>
          ms.map((m, i) => `${i ? 'L' : 'M'}${f.x(i + 1)},${y(m)}`).join('')
        const above = (ms: number[]) =>
          `M${f.x(1)},${y(1)}${ms
            .map((m, i) => `L${f.x(i + 1)},${y(Math.max(m, 1))}`)
            .join('')}L${f.x(n)},${y(1)}Z`
        const cur = Math.max(1, sel === LIVE ? n : sel + 1)
        // Labels at the right, kept at least 15 px apart.
        const wm = ws[cur - 1]
        const bm = bs[cur - 1]
        let wy = y(wm) + 4
        let by = y(bm) + 4
        if (Math.abs(wy - by) < 15) {
          const mid = (wy + by) / 2
          if (wm >= bm) {
            wy = mid - 7.5
            by = mid + 7.5
          } else {
            by = mid - 7.5
            wy = mid + 7.5
          }
        }
        const label = (
          id: 'gukesh' | 'sindarov',
          m: number,
          ty: number,
          ink: string,
        ) => (
          <text x={w - PAD.r + 10} y={ty} fontSize={12} fontWeight={600}>
            <tspan fill={ink}>{surname(id)}</tspan>
            <tspan fill={m > 1.25 ? '#f46d43' : 'rgba(255,255,255,0.45)'}>
              {' '}
              {m > 1.25 ? `${m.toFixed(1)}×` : 'usual'}
            </tspan>
          </text>
        )
        return (
          <svg
            width={w}
            height={h}
            className="cursor-pointer"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              onSelect(
                Math.max(-1, Math.min(LIVE, f.index(e.clientX, r.left) - 1)),
              )
            }}
          >
            <title>
              Risk of a blunder in the next few moves, against each
              player&apos;s usual rate (experimental)
            </title>
            {[1, 2].map((m) => (
              <g key={m}>
                <line
                  x1={PAD.l}
                  x2={w - PAD.r}
                  y1={y(m)}
                  y2={y(m)}
                  stroke={
                    m === 1
                      ? 'rgba(255,255,255,0.35)'
                      : 'rgba(255,255,255,0.07)'
                  }
                  strokeDasharray={m === 1 ? '3 4' : undefined}
                />
                <text
                  x={PAD.l - 6}
                  y={y(m) + 4}
                  fontSize={11}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.45)"
                >
                  {m === 1 ? 'usual' : '2×'}
                </text>
              </g>
            ))}
            <path d={above(ws)} fill="rgba(215,48,39,0.3)" />
            <path d={above(bs)} fill="rgba(215,48,39,0.3)" />
            <path
              d={line(ws)}
              fill="none"
              stroke={WHITE_INK}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <path
              d={line(bs)}
              fill="none"
              stroke={BLACK_INK}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <line
              x1={f.x(cur)}
              x2={f.x(cur)}
              y1={PAD.t}
              y2={f.bottom}
              stroke="white"
              opacity={0.5}
            />
            {label(WHITE, wm, wy, WHITE_INK)}
            {label(BLACK, bm, by, BLACK_INK)}
            <text
              x={w - PAD.r - 4}
              y={PAD.t + 10}
              fontSize={10}
              textAnchor="end"
              fill="rgba(255,255,255,0.35)"
            >
              experimental
            </text>
            <MoveTicks x={f.x} y={h - 2} />
          </svg>
        )
      }}
    </Sized>
  )
}

/**
 * Time spent on each move: White's above the line, Black's below, square
 * root scaled so a 10-minute think doesn't flatten the rest.
 */
/** Seconds as m:ss, or h:mm:ss from an hour. */
const fmtDuration = (sec: number) => {
  const t = Math.max(0, Math.round(sec))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const ss = String(t % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** A chance as a short percentage: "<0.1%", "0.4%", "8%". */
const riskPct = (v: number) =>
  v < 0.001
    ? '<0.1%'
    : v < 0.1
      ? `${(v * 100).toFixed(1)}%`
      : `${Math.round(v * 100)}%`

/**
 * The research feed's blunder risk: at each position, the chance the player
 * to move errs there (a move losing over 10 points of expected score), from
 * his own model, with his usual level for that stage of the game as a dashed
 * line. Absolute chances: most positions are near zero and a few spike.
 */
const FeedRiskChart: React.FC<{
  sel: number
  onSelect: (i: number) => void
}> = ({ sel, onSelect }) => {
  const { plies, next, LIVE, white, black, pregame } = useWch()
  return (
    <Sized>
      {(w, h) => {
        const n = Math.max(LIVE, 1)
        const f = frame(w, h, n)
        // Position i: before move i (plies[i]), or the one on the board now.
        const at = (i: number) =>
          i < LIVE ? (plies[i]?.risk ?? null) : (next.risk ?? null)
        const sideAt = (i: number): Side => (i % 2 === 0 ? 'white' : 'black')
        const idOf = (side: Side) => (side === 'white' ? white : black)
        const all = Array.from({ length: LIVE + 1 }, (_, i) => at(i))
        const usual = (side: Side, i: number) =>
          usualRisk(pregame, idOf(side), i)
        const usuals = Array.from({ length: LIVE + 1 }, (_, i) =>
          usual(sideAt(i), i),
        )
        const top =
          Math.max(
            0.02,
            ...all.map((v) => v ?? 0),
            ...usuals.map((v) => (v ?? 0) * 2),
          ) * 1.1
        const y = (v: number) => f.y(1 - Math.min(v, top) / top)
        const step = top / 3 < 0.02 ? 0.01 : top / 3 < 0.05 ? 0.02 : 0.05
        const grid = [step, 2 * step, 3 * step].filter((g) => g < top)
        const barW = Math.max(1.5, Math.min(6, (f.plotW / n) * 0.7))
        // A player's usual level, stage by stage, over his own positions.
        const usualPath = (side: Side) => {
          let d = ''
          for (let i = 0; i <= LIVE; i++) {
            if (sideAt(i) !== side) continue
            const u = usual(side, i)
            if (u === null) continue
            d += `${d ? 'L' : 'M'}${f.x(Math.max(0, i - 1))},${y(u)}L${f.x(Math.min(n, i + 1))},${y(u)}`
          }
          return d
        }
        const cur = sel >= LIVE ? LIVE : Math.max(0, sel + 1)
        const latest = (side: Side) => {
          for (let i = cur; i >= 0; i--)
            if (sideAt(i) === side && at(i) !== null) return { i, v: at(i)! }
          return null
        }
        const label = (side: Side, ty: number) => {
          const l = latest(side)
          const u = l ? usual(side, l.i) : null
          const ink = side === 'white' ? WHITE_INK : BLACK_INK
          return (
            <text x={w - PAD.r + 10} y={ty} fontSize={12} fontWeight={600}>
              <tspan fill={ink}>{surname(idOf(side))}</tspan>
              <tspan
                fill={
                  l && u !== null && l.v > Math.max(2 * u, 0.02)
                    ? '#f46d43'
                    : 'rgba(255,255,255,0.6)'
                }
              >
                {' '}
                {l ? riskPct(l.v) : '–'}
              </tspan>
              {u !== null ? (
                <tspan
                  x={w - PAD.r + 10}
                  dy={13}
                  fontSize={10}
                  fontWeight={400}
                  fill="rgba(255,255,255,0.4)"
                >
                  usual {riskPct(u)}
                </tspan>
              ) : null}
            </text>
          )
        }
        return (
          <svg
            width={w}
            height={h}
            className="cursor-pointer"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              onSelect(Math.min(LIVE, f.index(e.clientX, r.left)) - 1)
            }}
          >
            <title>
              The chance the player to move blunders in each position (a move
              that loses over 10 points of expected score), from his own model;
              dashed: his usual chance at that stage of the game. Even in the
              riskiest positions most moves are fine.
            </title>
            <line
              x1={PAD.l}
              x2={w - PAD.r}
              y1={y(0)}
              y2={y(0)}
              stroke="rgba(255,255,255,0.15)"
            />
            {grid.map((g) => (
              <g key={g}>
                <line
                  x1={PAD.l}
                  x2={w - PAD.r}
                  y1={y(g)}
                  y2={y(g)}
                  stroke="rgba(255,255,255,0.07)"
                />
                <text
                  x={PAD.l - 6}
                  y={y(g) + 4}
                  fontSize={11}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.45)"
                >
                  {Math.round(g * 100)}%
                </text>
              </g>
            ))}
            {all.map((v, i) =>
              v === null ? null : (
                <rect
                  key={i}
                  x={f.x(i) - barW / 2}
                  y={y(v)}
                  width={barW}
                  height={Math.max(0.5, y(0) - y(v))}
                  rx={1}
                  fill={sideAt(i) === 'white' ? WHITE_INK : BLACK_INK}
                  opacity={i === cur ? 1 : 0.75}
                />
              ),
            )}
            <path
              d={usualPath('white')}
              fill="none"
              stroke={WHITE_INK}
              strokeOpacity={0.6}
              strokeDasharray="3 3"
            />
            <path
              d={usualPath('black')}
              fill="none"
              stroke={BLACK_INK}
              strokeOpacity={0.6}
              strokeDasharray="3 3"
            />
            <line
              x1={f.x(cur)}
              x2={f.x(cur)}
              y1={PAD.t}
              y2={f.bottom}
              stroke="white"
              opacity={0.5}
            />
            {label('white', PAD.t + 14)}
            {label('black', PAD.t + 50)}
            <MoveTicks x={f.x} y={h - 2} />
          </svg>
        )
      }}
    </Sized>
  )
}

const ClocksChart: React.FC<{ sel: number; startClock: number }> = ({
  sel,
  startClock,
}) => {
  const {
    plies: GAME1,
    next: NEXT,
    LIVE,
    white: WHITE,
    black: BLACK,
    pregame,
  } = useWch()
  return (
    <Sized>
      {(w, h) => {
        if (!GAME1.length)
          return (
            <div
              className="flex h-full items-center justify-center text-xs text-white/40"
              style={{ width: w }}
            >
              Time per move shows once the game starts.
            </div>
          )
        const moves = Math.max(40, GAME1[GAME1.length - 1].moveNumber)
        const f = frame(w, h, moves)
        const mid = PAD.t + (h - PAD.t - PAD.b) / 2
        const half = (h - PAD.t - PAD.b) / 2 - 2
        const maxT = Math.max(60, ...GAME1.map((p) => p.think))
        const len = (t: number) => Math.max(1.5, Math.sqrt(t / maxT) * half)
        const bw = Math.max(3, f.plotW / moves - 3)
        const curMove =
          sel === LIVE ? NEXT.moveNumber : (GAME1[sel]?.moveNumber ?? 1)
        const lastW = [...GAME1].reverse().find((p) => p.color === 'white')
        const lastB = [...GAME1].reverse().find((p) => p.color === 'black')
        // Against each player's usual pace before move 41: his clock
        // after the move at this time control (pre-game bundle), else an
        // estimate from his usual think times.
        const vsUsual = (
          clock: number,
          id: 'gukesh' | 'sindarov',
          m: number,
        ) => {
          const usual = usualClock(pregame, id, m)
          return Math.round(
            usual !== null
              ? (clock - usual) / 60
              : (clock - clockCurve(id, m) * BASE_SECONDS) / 60 +
                  (startClock - BASE_SECONDS) / 60,
          )
        }
        const wDiff =
          lastW && lastW.moveNumber <= 40
            ? vsUsual(lastW.clockWhite, WHITE, lastW.moveNumber)
            : null
        const bDiff =
          lastB && lastB.moveNumber <= 40
            ? vsUsual(lastB.clockBlack, BLACK, lastB.moveNumber)
            : null
        return (
          <svg width={w} height={h}>
            <line
              x1={PAD.l}
              x2={w - PAD.r}
              y1={mid}
              y2={mid}
              stroke="rgba(255,255,255,0.2)"
            />
            <text
              x={PAD.l - 6}
              y={PAD.t + 10}
              fontSize={11}
              textAnchor="end"
              fill="rgba(255,255,255,0.45)"
            >
              White
            </text>
            <text
              x={PAD.l - 6}
              y={h - PAD.b - 2}
              fontSize={11}
              textAnchor="end"
              fill="rgba(255,255,255,0.45)"
            >
              Black
            </text>
            {GAME1.map((p) => {
              const x = f.x(p.moveNumber - 0.5) - bw / 2
              const l = len(p.think)
              const upper = p.color === 'white'
              const long = p.think >= 300
              // His usual think on this move, as a tick across the bar.
              const usual = usualThink(pregame, p.mover, p.moveNumber)
              const ul = usual !== null ? len(Math.min(usual, maxT)) : null
              return (
                <g key={p.index}>
                  <rect
                    x={x}
                    y={upper ? mid - l : mid}
                    width={bw}
                    height={l}
                    rx={1}
                    fill={upper ? WHITE_INK : BLACK_INK}
                    opacity={p.moveNumber === curMove ? 1 : 0.8}
                  />
                  {ul !== null ? (
                    <line
                      x1={x - 1}
                      x2={x + bw + 1}
                      y1={upper ? mid - ul : mid + ul}
                      y2={upper ? mid - ul : mid + ul}
                      stroke={MAIA}
                      strokeWidth={1.5}
                      opacity={0.85}
                    />
                  ) : null}
                  {long ? (
                    <text
                      x={x + bw / 2}
                      y={upper ? mid - l - 3 : mid + l + 10}
                      fontSize={10}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.7)"
                    >
                      {Math.round(p.think / 60)}m
                    </text>
                  ) : null}
                </g>
              )
            })}
            {pregame ? (
              <text
                x={w - PAD.r + 10}
                y={h - 2}
                fontSize={10}
                fill="rgba(255,255,255,0.45)"
              >
                <tspan fill={MAIA}>—</tspan> his usual think
              </text>
            ) : null}
            {[10, 20, 30, 40].map((m) => (
              <text
                key={m}
                x={f.x(m - 0.5)}
                y={h - 2}
                fontSize={11}
                textAnchor="middle"
                fill="rgba(255,255,255,0.45)"
              >
                {m}
              </text>
            ))}
            <line
              x1={f.x(curMove - 0.5)}
              x2={f.x(curMove - 0.5)}
              y1={PAD.t}
              y2={f.bottom}
              stroke={MAIA}
              opacity={0.7}
            />
            <g fontSize={11}>
              {(
                [
                  [WHITE, wDiff, mid - 34, WHITE_INK],
                  [BLACK, bDiff, mid + 12, BLACK_INK],
                ] as ['gukesh' | 'sindarov', number | null, number, string][]
              ).map(([id, d, y0, ink]) => (
                <g key={id}>
                  <text x={w - PAD.r + 10} y={y0} fill={ink} fontWeight={600}>
                    {surname(id)}
                  </text>
                  {d !== null ? (
                    <>
                      <text
                        x={w - PAD.r + 10}
                        y={y0 + 13}
                        fill={d < 0 ? '#fdae61' : 'rgba(255,255,255,0.7)'}
                      >
                        {Math.abs(d)} min {d < 0 ? 'less' : 'more'} left
                      </text>
                      <text
                        x={w - PAD.r + 10}
                        y={y0 + 25}
                        fill="rgba(255,255,255,0.4)"
                      >
                        than usual
                      </text>
                    </>
                  ) : null}
                </g>
              ))}
            </g>
          </svg>
        )
      }}
    </Sized>
  )
}

interface RatingRow {
  san: string
  shares: number[]
  /** The move he went on to play. */
  played?: boolean
}

const ByRating: React.FC<{
  rows: RatingRow[] | null
  bands: number[]
  note?: string | null
  empty: string
}> = ({ rows, bands, note, empty }) => {
  if (!rows || !rows.length)
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-white/40">
        {empty}
      </div>
    )
  return (
    <div className="grid h-full grid-cols-[84px_repeat(5,1fr)] content-center gap-x-2 gap-y-1 text-xs">
      {note ? (
        <span className="col-span-6 mb-1 text-[11px] text-white/50">
          {note}
        </span>
      ) : null}
      <span />
      {bands.map((r) => (
        <span key={r} className="text-center text-[10px] text-white/40">
          {r}
        </span>
      ))}
      {rows.map((row) => (
        <React.Fragment key={row.san}>
          <span className="flex items-center gap-1 font-medium text-white/90">
            {row.san}
            {row.played ? (
              <span className="rounded-sm bg-white/15 px-1 text-[9px] uppercase leading-[14px] text-white/80">
                played
              </span>
            ) : null}
          </span>
          {row.shares.map((v, k) => (
            <span key={k} className="relative h-4 rounded-sm bg-white/[0.05]">
              <span
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{
                  width: `${v * 100}%`,
                  background:
                    k === bands.length - 1 ? MAIA : 'rgb(254 127 109 / 0.45)',
                }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-1 text-[10px] tabular-nums text-white/70">
                {Math.round(v * 100)}
              </span>
            </span>
          ))}
        </React.Fragment>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Right column                                                         */

const YouTag = () => (
  <span className="rounded-sm bg-white px-1 text-[9px] font-bold uppercase leading-[14px] text-black">
    you
  </span>
)

/** The result in words: "Sindarov won", "a draw". */
const resultText = (result: string, white: PlayerId, black: PlayerId) =>
  result === '1-0'
    ? `${surname(white)} won`
    : result === '0-1'
      ? `${surname(black)} won`
      : /^(1\/2|½)/.test(result)
        ? 'a draw'
        : result

/**
 * A finished game from Maia's point of view (between games, the right panel
 * would otherwise be empty): how often each player's Maia called his move,
 * the moves it least expected, where its win chances swung, the most dangerous
 * positions and the longest thinks. A move opens it on the board.
 */
const GameStory: React.FC<{
  onJump: (index: number) => void
  compact?: boolean
}> = ({ onJump, compact }) => {
  const { plies, white, black } = useWch()
  const s = useMemo(() => summarize(plies), [plies])
  const personal = plies.some((p) => p.personal)
  const maiaOf = (id: PlayerId) => (personal ? `Maia${surname(id)}` : 'Maia')
  const ids = { white, black }

  const row = (p: LivePly, right: React.ReactNode, note?: React.ReactNode) => (
    <button
      key={p.index}
      onClick={() => onJump(p.index)}
      className="flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left hover:bg-glass-stronger"
    >
      <span className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="font-medium text-white">
          {moveNo(p.moveNumber, p.color)}
          {p.san}
        </span>
        {p.mark ? <MarkChip mark={p.mark} /> : null}
        {note ? (
          <span className="truncate text-xs text-white/50">{note}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-white/75">
        {right}
      </span>
    </button>
  )
  const section = (title: string, hint: string, body: React.ReactNode) => (
    <section className={compact ? 'mt-2' : 'mt-3'}>
      <h3
        className="px-2 text-[11px] font-semibold uppercase tracking-wider text-white/45"
        title={hint}
      >
        {title}
      </h3>
      <div className="mt-0.5">{body}</div>
    </section>
  )

  return (
    <div
      className={`red-scrollbar min-h-0 flex-1 overflow-y-auto pb-3 ${
        compact ? 'px-1' : 'px-2'
      }`}
    >
      <p className="px-2 text-xs text-white/50">
        The game through Maia&apos;s eyes. Pick a move to see it on the board.
      </p>
      {section(
        'How often Maia called it',
        "Each player's Maia: how often its first choice was the move he played",
        (['white', 'black'] as const).map((side) => {
          const x = s.sides[side]
          if (!x.moves) return null
          return (
            <div key={side} className="px-2 py-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium" style={{ color: MAIA }}>
                  {maiaOf(ids[side])}
                </span>
                <span className="tabular-nums text-white/80">
                  {x.maiaTop} of {x.moves}{' '}
                  <span className="text-white/45">
                    ({pct(x.maiaTop / x.moves)})
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(x.maiaTop / x.moves) * 100}%`,
                    background: MAIA,
                  }}
                />
              </div>
              {x.sfMoves ? (
                <p className="mt-0.5 text-[11px] text-white/45">
                  Stockfish&apos;s first choice: {x.sfTop} of {x.sfMoves}
                </p>
              ) : null}
            </div>
          )
        }),
      )}
      {s.surprises.length
        ? section(
            "Moves Maia didn't see coming",
            'The moves its Maia gave the least chance',
            s.surprises.map((p) =>
              row(p, `${pct(p.pPlayed)} · #${p.rank}`, surname(p.mover)),
            ),
          )
        : null}
      {s.swings.length
        ? section(
            'Turning points',
            "The moves that changed Maia's win chances the most",
            s.swings.map((w) =>
              row(
                w.ply,
                `${pct(w.before)} → ${pct(w.after)}`,
                `${surname(w.ply.mover)}'s winning chances`,
              ),
            ),
          )
        : null}
      {s.dangerous.length
        ? section(
            'Most dangerous positions',
            'The chance he would blunder there, from his own model, and the move he played',
            s.dangerous.map((r) =>
              row(
                r.ply,
                riskPct(r.risk),
                r.ply.mark ? 'he slipped' : 'he held',
              ),
            ),
          )
        : null}
      {s.thinks.length
        ? section(
            'Longest thinks',
            'The moves he spent the most time on',
            s.thinks.map((p) =>
              row(p, `${Math.round(p.think / 60)} min`, surname(p.mover)),
            ),
          )
        : null}
    </div>
  )
}

const MovePanel: React.FC<{
  ply: LivePly | null
  cands: (Candidate & { before?: number })[]
  sf: string
  signedIn: boolean
  onDemoSignIn: () => void
  guess: string | null
  onGuess?: (san: string) => void
  played: boolean
  onPlay: () => void
  guessCount: number
  liveSan: string
  onShow: (san: string | null) => void
  hoverSan: string | null
  /** Your guess for the move on show (history). */
  myGuess: string | null
  /** Live: your guess for the move just played. */
  lastResult: { san: string; guess: string } | null
  /** Show a move (its index in the game). */
  onJump: (index: number) => void
  /** A finished game, an earlier move on show: back to the summary. */
  onBack?: () => void
}> = ({
  ply,
  cands,
  sf,
  signedIn,
  onDemoSignIn,
  guess,
  onGuess,
  played,
  onPlay,
  guessCount,
  liveSan,
  onShow,
  hoverSan,
  myGuess,
  lastResult,
  onJump,
  onBack,
}) => {
  const data = useWch()
  const { next, personal, hasCrowd } = data
  const live = !ply
  const mover = ply ? ply.mover : next.mover
  const who = surname(mover)
  const playedSan = ply ? ply.san : played ? liveSan : null
  const over = live && next.over
  const ticks = personal && cands.some((c) => Number.isFinite(c.generic))
  const top = Math.max(
    0.01,
    ...cands.map((c) => Math.max(c.maia, ticks ? c.generic : 0)),
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-glass-border bg-glass backdrop-blur-md">
      <div className="px-4 pb-2.5 pt-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="mb-1 flex items-center gap-1 text-xs font-medium text-human-1 hover:text-white"
          >
            <span className="material-symbols-outlined !text-[14px]">
              arrow_back
            </span>
            Back to the game summary
          </button>
        ) : null}
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-white">
          {over
            ? `Game over: ${resultText(String(next.over), data.white, data.black)}`
            : ply
              ? `Here ${who} played ${moveNo(ply.moveNumber, ply.color)}${ply.san}`
              : playedSan
                ? `${who} played ${playedSan}`
                : `What will ${who} play?`}
          {ply?.mark ? <MarkChip mark={ply.mark} size="md" /> : null}
        </h2>
        {ply?.risk != null ? (
          <p className="mt-0.5 text-xs text-white/50">
            <span title="The chance he'd play a move that loses over 10 points of expected score here, from his own model">
              Chance he&apos;d blunder here:{' '}
              <b className="font-semibold text-white/80">{riskPct(ply.risk)}</b>
            </span>
          </p>
        ) : null}
        {live &&
        !playedSan &&
        !over &&
        (next.thinkPred || next.risk != null) ? (
          <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-white/50">
            {next.thinkPred ? (
              <span title="How long he usually takes in a position like this, at these clocks (90% of the time under the second figure)">
                Usually ~{fmtDuration(next.thinkPred.median_s)} here
              </span>
            ) : null}
            {next.risk != null ? (
              <span title="The chance he plays a move that loses over 10 points of expected score here, from his own model. Even in the riskiest positions most moves are fine.">
                Chance he blunders here:{' '}
                <b className="font-semibold text-white/80">
                  {riskPct(next.risk)}
                </b>
              </span>
            ) : null}
          </p>
        ) : null}
        {ply && myGuess ? (
          <p className="mt-0.5 text-sm text-white/60">
            You guessed <b className="text-white">{myGuess}</b>
            {myGuess === ply.san ? (
              <span className="ml-1.5 text-emerald-300">and called it</span>
            ) : null}
          </p>
        ) : live && lastResult && !over ? (
          <p className="mt-0.5 text-sm text-white/60">
            Last move {lastResult.san}: you guessed{' '}
            <b className="text-white">{lastResult.guess}</b>
            {lastResult.guess === lastResult.san ? (
              <span className="ml-1.5 text-emerald-300">and called it</span>
            ) : null}
          </p>
        ) : null}
      </div>

      {over ? (
        <GameStory onJump={onJump} />
      ) : (
        <div className="red-scrollbar min-h-0 flex-1 overflow-y-auto pb-2">
          <div className="grid grid-cols-[72px_1fr_40px_56px] items-end gap-2 px-4 pb-1.5 pt-1 text-[10px] text-white/40">
            <span>Move</span>
            <span className="flex items-baseline justify-between gap-4">
              <span
                className="text-[14px] font-semibold"
                style={{ color: MAIA }}
                title={
                  personal
                    ? undefined
                    : `Maia-3 at ${LIVE_MAIA_ELO}: the players' own models aren't public yet`
                }
              >
                {maiaName(data, mover)}
                {personal ? null : (
                  <span className="ml-1.5 text-[10px] font-normal text-white/45">
                    at {LIVE_MAIA_ELO}
                  </span>
                )}
              </span>
              {ticks ? (
                <span
                  className="flex items-center gap-1"
                  title="What a typical 2750 plays here (generic Maia-3 at 2750)"
                >
                  <span className="inline-block h-2.5 w-px bg-white/70" />
                  typical 2750
                </span>
              ) : null}
            </span>
            <span />
            <span className="text-right" style={{ color: ENGINE }}>
              Stockfish
            </span>
          </div>
          {cands.length === 0 ? (
            <p className="px-4 py-3 text-sm text-white/45">
              Maia is reading the position…
            </p>
          ) : null}
          {cands.map((c, i) => {
            const isPlayed = playedSan === c.san
            const isMine = live && guess === c.san
            const isHover = hoverSan === c.san
            return (
              <button
                key={c.san}
                onMouseEnter={() => onShow(c.san)}
                onMouseLeave={() => onShow(null)}
                onClick={() => onGuess?.(c.san)}
                className={`grid h-7 w-full grid-cols-[72px_1fr_40px_56px] items-center gap-2 px-4 text-left text-sm ${
                  isPlayed
                    ? 'bg-white/[0.09]'
                    : isHover
                      ? 'bg-glass-stronger'
                      : ''
                } ${onGuess ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className="flex items-center gap-1.5 font-medium text-white/90">
                  {c.san}
                  {isMine ? <YouTag /> : null}
                  {isPlayed ? (
                    <span className="rounded-sm bg-white/15 px-1 text-[9px] uppercase leading-[14px] text-white/80">
                      played
                    </span>
                  ) : null}
                </span>
                <span className="relative h-2 rounded-sm bg-white/[0.05]">
                  <span
                    className="block h-2 rounded-sm transition-[width] duration-700"
                    style={{
                      width: `${(c.maia / top) * 100}%`,
                      background: i === 0 ? MAIA : 'rgb(254 127 109 / 0.55)',
                    }}
                  />
                  {ticks ? (
                    <span
                      className="absolute -inset-y-0.5 w-px bg-white/70"
                      style={{ left: `${(c.generic / top) * 100}%` }}
                    />
                  ) : null}
                </span>
                <span className="text-right text-xs tabular-nums text-white/70">
                  {pct(c.maia)}
                </span>
                <span
                  className="text-right font-mono text-xs tabular-nums"
                  style={{
                    color: c.san === sf ? ENGINE : 'rgba(255,255,255,0.55)',
                  }}
                >
                  {fmtEval(c.eval)}
                </span>
              </button>
            )
          })}
          {playedSan && hasCrowd ? (
            <CrowdSplit
              cands={cands}
              played={playedSan}
              guesses={ply ? ply.guesses : guessCount}
              mine={live ? guess : null}
            />
          ) : null}
        </div>
      )}

      {/* Your guess, after Maia's predictions (live only). */}
      {live && !over ? (
        <div className="border-t border-glass-border px-4 py-3">
          <GuessStrip
            signedIn={signedIn}
            onDemoSignIn={onDemoSignIn}
            guess={guess}
            played={played}
            onPlay={onPlay}
            liveSan={liveSan}
            who={who}
            demo={data.mode === 'demo'}
          />
        </div>
      ) : null}
    </div>
  )
}

const GuessStrip: React.FC<{
  signedIn: boolean
  onDemoSignIn: () => void
  guess: string | null
  played: boolean
  onPlay: () => void
  liveSan: string
  who: string
  /** Demo controls (also shown in development, to sign in without Lichess). */
  demo: boolean
}> = ({
  signedIn,
  onDemoSignIn,
  guess,
  played,
  onPlay,
  liveSan,
  who,
  demo,
}) => {
  const demoSignIn = demo || process.env.NODE_ENV !== 'production'
  const right = played && guess === liveSan
  return (
    <div
      className={`flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border px-3 py-2 ${
        played && guess
          ? right
            ? 'border-emerald-300/40 bg-emerald-400/[0.08]'
            : 'border-white/10 bg-white/[0.03]'
          : 'border-white/15 bg-white/[0.05]'
      }`}
    >
      {!signedIn ? (
        <>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">
              Guess {who}&apos;s move
            </p>
            <p className="text-[11px] text-white/45">
              Sign in to keep score
              {demoSignIn ? (
                <button
                  onClick={onDemoSignIn}
                  className="ml-2 hover:text-white/80"
                >
                  demo: sign in
                </button>
              ) : null}
            </p>
          </div>
          <LichessSignInButton source="auth_prompt" className="shrink-0" />
        </>
      ) : (
        <>
          <div className="min-w-0">
            <p className="text-[11px] text-white/45">Your guess</p>
            <p className="text-base font-semibold leading-5 text-white">
              {guess ?? (
                <span className="text-sm font-normal text-white/60">
                  Click a move or play it on the board
                </span>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right text-[11px] leading-4 text-white/45">
            {played ? (
              guess ? (
                <span
                  className={
                    right
                      ? 'text-sm font-semibold text-emerald-200'
                      : 'text-sm text-white/60'
                  }
                >
                  {right ? 'Called it' : 'Missed'}
                </span>
              ) : (
                'No guess'
              )
            ) : (
              <>
                {guess ? 'Change it until he moves' : ''}
                <br />
                {demo ? (
                  <button onClick={onPlay} className="hover:text-white/80">
                    demo: {who} moves
                  </button>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** What visitors guessed, most picked first; shown once the move is in. */
const CrowdSplit: React.FC<{
  cands: Candidate[]
  played: string
  guesses: number
  mine?: string | null
}> = ({ cands, played, guesses, mine }) => {
  // Nobody guessed: no list.
  if (guesses <= 0) return null
  let rows = [...cands].sort((a, b) => b.crowd - a.crowd).slice(0, 4)
  // A guess or two: just those picks (demo shares).
  if (guesses < MIN_SHOWN_GUESSES)
    rows = rows.slice(0, guesses).map((c) => ({ ...c, crowd: 1 / guesses }))
  const top = rows[0].crowd
  return (
    <div className="mt-2 border-t border-glass-border px-4 pt-2.5">
      <p className="text-[11px] text-white/45">
        Visitors&apos; guesses
        {guesses >= MIN_SHOWN_GUESSES ? (
          <>
            {' '}
            (<span className="tabular-nums">{guesses.toLocaleString()}</span>)
          </>
        ) : null}
      </p>
      <div className="mt-1.5 flex flex-col gap-1">
        {rows.map((c) => (
          <div
            key={c.san}
            className="grid grid-cols-[72px_1fr_40px] items-center gap-2 text-sm"
          >
            <span
              className={`flex items-center gap-1.5 ${c.san === played ? 'font-semibold text-white' : 'text-white/70'}`}
            >
              {c.san}
              {mine === c.san ? <YouTag /> : null}
            </span>
            <span className="h-2 rounded-sm bg-white/[0.05]">
              <span
                className="block h-2 rounded-sm"
                style={{
                  width: `${(c.crowd / top) * 100}%`,
                  background:
                    c.san === played ? CROWD : 'rgb(200 194 189 / 0.4)',
                }}
              />
            </span>
            <span className="text-right text-xs tabular-nums text-white/60">
              {pct(c.crowd)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const Leaders: React.FC<{
  score: Tally
  you: { right: number; of: number } | null
}> = ({ score, you }) => {
  const { hasCrowd } = useWch()
  const cells = (
    [
      ['Maia', score.maia, MAIA],
      ['Visitors', score.crowd, CROWD],
      ['Stockfish', score.stockfish, ENGINE],
    ] as [string, number | null, string][]
  ).filter(([, v]) => v !== null) as [string, number, string][]
  return (
    <div className="rounded-md border border-glass-border bg-glass px-4 py-3 backdrop-blur-md">
      <p className="text-[11px] text-white/45">Moves called this game</p>
      <div className="mt-1 flex items-baseline gap-5">
        {cells.map(([name, v, c]) => (
          <p key={name} className="text-sm text-white/55">
            <span
              className="text-lg font-semibold tabular-nums"
              style={{ color: c }}
            >
              {v}
            </span>
            <span className="text-xs text-white/30">/{score.n}</span> {name}
          </p>
        ))}
      </div>
      <div className="mt-2.5 border-t border-glass-border pt-2">
        {hasCrowd
          ? TOP_GUESSERS.map((g, i) => (
              <div
                key={g.name}
                className="grid h-6 grid-cols-[18px_1fr_auto] items-center gap-2 text-sm"
              >
                <span className="text-xs tabular-nums text-white/40">
                  {i + 1}
                </span>
                <span className="truncate text-white/85">{g.name}</span>
                <span className="tabular-nums text-white/70">
                  {g.right}
                  <span className="text-xs text-white/35">/{g.of}</span>
                </span>
              </div>
            ))
          : null}
        <div className="grid h-6 grid-cols-[18px_1fr_auto] items-center gap-2 text-sm">
          <span />
          <span className="text-white/55">You</span>
          <span className="tabular-nums text-white/70">
            {you ? (
              <>
                {you.right}
                <span className="text-xs text-white/35">/{you.of}</span>
              </>
            ) : (
              '–'
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mobile                                                               */

/** One player in the shared row above the board on phones. */
const PlayerHalf: React.FC<{
  id: 'gukesh' | 'sindarov'
  side: Side
  clock: number
  active: boolean
  thinking: number
  alignRight?: boolean
}> = ({ id, side, clock, active, thinking, alignRight = false }) => {
  const p = FIDE[id]
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        alignRight ? 'flex-row-reverse text-right' : ''
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.photo}
        alt={p.name}
        width={34}
        height={34}
        className="h-[34px] w-[34px] shrink-0 rounded-full bg-white/10 object-cover"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`flex items-center gap-1.5 text-[13px] font-semibold leading-4 text-white ${
            alignRight ? 'flex-row-reverse' : ''
          }`}
        >
          <SideMark side={side} />
          <span className="truncate">{surname(id)}</span>
          <Flag fed={p.fed} />
        </p>
        <p
          className={`mt-0.5 flex items-center gap-1.5 ${
            alignRight ? 'flex-row-reverse' : ''
          }`}
        >
          <span
            className={`rounded px-1 font-mono text-[15px] font-semibold tabular-nums leading-5 ${
              active ? 'bg-emerald-400 text-black' : 'text-white/55'
            }`}
          >
            {fmtClock(clock)}
          </span>
          {active ? (
            <span className="text-[10px] tabular-nums text-emerald-300">
              {fmtClock(thinking)}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  )
}

const MobilePrediction: React.FC<{
  ply: LivePly | null
  cands: Candidate[]
  sf: string
  mover: PlayerId
  signedIn: boolean
  onDemoSignIn: () => void
  guess: string | null
  onGuess?: (san: string) => void
  played: boolean
  guessCount: number
  liveSan: string
  shownSan: string | null
  onShow: (san: string | null) => void
  myGuess: string | null
  /** Show a move (its index in the game). */
  onJump: (index: number) => void
  /** A finished game, an earlier move on show: back to the summary. */
  onBack?: () => void
}> = ({
  ply,
  cands,
  sf,
  mover,
  signedIn,
  onDemoSignIn,
  guess,
  onGuess,
  played,
  guessCount,
  liveSan,
  shownSan,
  onShow,
  myGuess,
  onJump,
  onBack,
}) => {
  const data = useWch()
  const { next, personal, hasCrowd } = data
  const [all, setAll] = useState(false)
  const live = !ply
  const who = surname(mover)
  const playedSan = ply ? ply.san : played ? liveSan : null
  const over = live && next.over
  const ticks = personal && cands.some((c) => Number.isFinite(c.generic))
  const top = Math.max(
    0.01,
    ...cands.map((c) => Math.max(c.maia, ticks ? c.generic : 0)),
  )
  let tiles = all ? cands : cands.slice(0, 6)
  if (!all && playedSan && !tiles.find((c) => c.san === playedSan)) {
    const p = cands.find((c) => c.san === playedSan)
    if (p) tiles = [...tiles.slice(0, 5), p]
  }
  const right = played && guess === liveSan
  return (
    <div className="mx-2 rounded-md border border-glass-border bg-glass">
      {onBack ? (
        <div className="px-2.5 pt-1.5">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-xs font-medium text-human-1 hover:text-white"
            >
              <span className="material-symbols-outlined !text-[14px]">
                arrow_back
              </span>
              Back to the game summary
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-1.5">
        <h2 className="truncate text-[15px] font-semibold text-white">
          {over
            ? `Game over: ${resultText(String(next.over), data.white, data.black)}`
            : ply
              ? `Here ${who} played ${moveNo(ply.moveNumber, ply.color)}${ply.san}`
              : playedSan
                ? `${who} played ${playedSan}`
                : `What will ${who} play?`}
        </h2>
        {over ? null : (
          <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-white/45">
            <span
              className="text-[12px] font-semibold"
              style={{ color: MAIA }}
              title={
                personal
                  ? undefined
                  : `Maia-3 at ${LIVE_MAIA_ELO}: the players' own models aren't public yet`
              }
            >
              {personal ? 'Maia %' : `Maia ${LIVE_MAIA_ELO} %`}
            </span>
            <span style={{ color: ENGINE }}>SF</span>
            {ticks ? (
              <span
                className="flex items-center gap-0.5"
                title="The tick: what a typical 2750 plays here"
              >
                <span className="inline-block h-2 w-px bg-white/70" />
                2750
              </span>
            ) : null}
            <button
              onClick={() => setAll((x) => !x)}
              className="ml-1 text-white/55"
            >
              {all ? 'fewer' : `all ${cands.length}`}
            </button>
          </div>
        )}
      </div>
      {ply && myGuess ? (
        <p className="px-2.5 pb-1 text-[12px] text-white/60">
          You guessed <b className="text-white">{myGuess}</b>
          {myGuess === ply.san ? (
            <span className="ml-1.5 text-emerald-300">and called it</span>
          ) : null}
        </p>
      ) : null}
      {over ? (
        <div className="pb-2">
          <GameStory onJump={onJump} compact />
        </div>
      ) : null}
      {!over && cands.length === 0 ? (
        <p className="px-2.5 pb-2 text-[12px] text-white/45">
          Maia is reading the position…
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
        {tiles.map((c, i) => {
          const isPlayed = playedSan === c.san
          const isMine = live && guess === c.san
          return (
            <button
              key={c.san}
              onClick={() =>
                onGuess
                  ? onGuess(c.san)
                  : onShow(shownSan === c.san ? null : c.san)
              }
              className={`relative flex h-8 items-center justify-between gap-0.5 overflow-hidden rounded border px-1 pb-0.5 text-left ${
                isPlayed
                  ? 'border-emerald-300/60 bg-emerald-400/[0.10]'
                  : isMine
                    ? 'border-white/80 bg-white/[0.06]'
                    : shownSan === c.san
                      ? 'border-white/25 bg-glass-stronger'
                      : i === 0
                        ? 'border-human-1/50 bg-white/[0.03]'
                        : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <span className="shrink-0 text-[13px] font-semibold tracking-tight text-white">
                {c.san}
              </span>
              {/* Maia's % never shrinks; a tight chip clips the eval's end. */}
              <span className="ml-auto flex min-w-0 items-baseline gap-2 pl-1 tabular-nums">
                <span
                  className="shrink-0 text-[13px] font-semibold"
                  style={{ color: MAIA }}
                >
                  {pct(c.maia)}
                </span>
                <span
                  className="min-w-0 overflow-hidden whitespace-nowrap font-mono text-[11px] tracking-tight"
                  style={{
                    color: c.san === sf ? ENGINE : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {fmtEval(c.eval)}
                </span>
              </span>
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.06]">
                <span
                  className="block h-full transition-[width] duration-700"
                  style={{
                    width: `${(c.maia / top) * 100}%`,
                    background: i === 0 ? MAIA : 'rgb(254 127 109 / 0.6)',
                  }}
                />
                {ticks ? (
                  <span
                    className="absolute bottom-0 h-[5px] w-px bg-white/80"
                    style={{ left: `${(c.generic / top) * 100}%` }}
                  />
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
      {live && !over && (!signedIn || (played && guess)) ? (
        <div className="flex items-center justify-between gap-2 border-t border-glass-border px-2.5 py-1">
          {!signedIn ? (
            <>
              <p className="text-[11px] leading-4 text-white/55">
                Guess his move
                {data.mode === 'demo' ||
                process.env.NODE_ENV !== 'production' ? (
                  <button
                    onClick={onDemoSignIn}
                    className="ml-2 underline-offset-2 hover:underline"
                  >
                    demo
                  </button>
                ) : null}
              </p>
              <LichessSignInButton
                source="auth_prompt"
                className="shrink-0 !px-2 !py-0.5 !text-[11px]"
              />
            </>
          ) : (
            <>
              <p className="py-1 text-[12px] text-white/85">
                {guess ? (
                  <>
                    Your guess: <b>{guess}</b>
                  </>
                ) : null}
              </p>
              <span
                className={`text-[13px] font-semibold ${right ? 'text-emerald-300' : 'text-white/55'}`}
              >
                {right ? 'Called it' : 'Missed'}
              </span>
            </>
          )}
        </div>
      ) : null}
      {playedSan && hasCrowd ? (
        <CrowdSplit
          cands={cands}
          played={playedSan}
          guesses={ply ? ply.guesses : guessCount}
          mine={live ? guess : null}
        />
      ) : null}
      {playedSan && hasCrowd ? <div className="h-2.5" /> : null}
    </div>
  )
}

/** The moves as a strip that scrolls sideways, with step buttons. */
const MoveStrip: React.FC<{
  /** The last move on the board (-1: the start). */
  sel: number
  live: boolean
  onSelect: (i: number) => void
  played: boolean
  liveSan: string
}> = ({ sel, live, onSelect, played, liveSan }) => {
  const { plies: GAME1, next: NEXT, LIVE } = useWch()
  const ref = useRef<HTMLDivElement>(null)
  // Live: the end of the strip; otherwise the move on the board, centred.
  useKeepInView(
    ref,
    (strip) => {
      if (live) {
        strip.scrollLeft = strip.scrollWidth
        return
      }
      const el = strip.querySelector<HTMLElement>('[data-sel="true"]')
      strip.scrollLeft = el
        ? el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2
        : 0
    },
    [sel, live, LIVE],
  )
  return (
    <div className="mx-2 flex items-center overflow-hidden rounded-md border border-glass-border bg-glass">
      <button
        onClick={() => onSelect(sel - 1)}
        className="flex h-10 w-9 shrink-0 items-center justify-center text-white/70"
      >
        <span className="material-symbols-outlined !text-[16px]">
          arrow_back_ios
        </span>
      </button>
      <div
        ref={ref}
        className="no-scrollbar relative flex flex-1 gap-0.5 overflow-x-auto py-1"
      >
        {GAME1.map((p) => (
          <button
            key={p.index}
            data-sel={!live && sel === p.index}
            onClick={() => onSelect(p.index)}
            className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[13px] ${
              !live && sel === p.index
                ? 'bg-white/15 text-white'
                : 'text-white/80'
            }`}
          >
            {p.color === 'white' ? (
              <span className="text-[11px] text-white/40">{p.moveNumber}.</span>
            ) : null}
            {p.san}
            {p.rank === 1 ? (
              <span className="material-symbols-outlined !text-[13px] text-human-1">
                check
              </span>
            ) : null}
          </button>
        ))}
        <button
          data-sel={live}
          onClick={() => onSelect(LIVE)}
          className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[13px] ${
            live
              ? 'bg-rose-500/20 text-white ring-1 ring-inset ring-rose-400/60'
              : 'text-white/80'
          }`}
        >
          <span className="text-[11px] text-white/40">{NEXT.moveNumber}.</span>
          {played ? (
            liveSan
          ) : (
            <span className="flex items-center gap-1 text-rose-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
              live
            </span>
          )}
        </button>
      </div>
      <button
        onClick={() => onSelect(sel + 1)}
        className="flex h-10 w-9 shrink-0 items-center justify-center text-white/70"
      >
        <span className="material-symbols-outlined !text-[16px]">
          arrow_forward_ios
        </span>
      </button>
    </div>
  )
}
