import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  fetchHumanBars,
  getHumanBarBaseUrl,
  HumanBarServerError,
  prepareHumanBars,
  waitForHumanBarForm,
} from 'src/api/humanBar'
import {
  MAIA_MODEL_VERSION,
  MaiaEngineContext,
} from 'src/contexts/MaiaEngineContext'
import { MAIA_PRIORITY } from 'src/lib/engine/maia'
import {
  encodeSideToMoveScore,
  getBatchStockfish,
  HUMAN_BAR_ENGINE,
} from 'src/lib/engine/stockfishBatch'
import {
  buildHumanBarSetup,
  evalAfterMoveFromLine,
  evaluationOrder,
  fenAfterMove,
  float32ToBase64LE,
  gameOverEval,
  likelyMoves,
  moveMark,
} from 'src/lib/humanBar'
import type { MoveMark } from 'src/lib/humanBar'
import type {
  AnalyzedGame,
  GameNode,
  HumanBarGameInfo,
  HumanBarKidInput,
  HumanBarPly,
  HumanBarRequest,
} from 'src/types'

/** Positions after the current one evaluated next (stepping forward). */
const LOOKAHEAD = 2
/**
 * After the positions around the current one, evaluate the rest of the game
 * in the background (fills the game chart). The position on screen always
 * comes first.
 */
const BACKGROUND_FILL = true
/**
 * Maia positions per call: small, so the site's own Maia requests and the
 * position on screen never wait long behind a batch.
 */
const MAIA_BATCH_SIZE = 4
const RETRY_DELAY_MS = 5000
const MAX_FAILURES = 3
/**
 * The bars take the site's own analysis eval of a position (the engine the
 * page already runs): a first answer from depth 10 (the result bar loses
 * nothing there, the danger meter a little), asked for again when the
 * site's eval reaches its final depth. Each eval goes with its depth, since
 * the server's map onto the bars' scale depends on it (practical LOG §86,
 * P87, P89).
 */
const SITE_EVAL_MIN_DEPTH = 10
const SITE_EVAL_FINAL_DEPTH = 18
/** How long the position on screen waits for the site's eval before searching itself. */
const SITE_EVAL_WAIT_MS = 1500
/** A site search that has not finished by now is taken to have stopped. */
const SITE_SEARCH_GIVE_UP_MS = 60000
/**
 * Positions the site has not analysed (the rest of the game, for the chart)
 * get a small search of their own: about what depth 12 costs (median 14k
 * nodes), and the server maps its eval as depth 12.
 */
const FALLBACK_NODES = 14000
const FALLBACK_DEPTH = 12
/**
 * The bar shown looks one move ahead (practical LOG §90): half the
 * position's own bar, half the Maia-weighted average of the bars after
 * Maia's likely moves there, which the server computes when a ply's request
 * carries those moves. Their evals come from the site's search of the
 * position (it scores every legal move) or, for plies it has not analysed,
 * a small search of each; their Maia outputs from the same Maia file at the
 * players' ratings. Plies whose likely moves are all in go at most this many
 * to a request, so one request never holds the server long.
 */
const MIX_PLIES_PER_REQUEST = 8
/** Maia positions per call for the likely moves of the position on screen. */
const KID_MAIA_BATCH_SIZE = 6

/** One of Maia's likely moves at a ply, and the inputs of the position after it. */
interface KidRun {
  uci: string
  prob: number
  fen: string
  /** The move played in the game: the next ply's own inputs once it has them. */
  played: boolean
  /**
   * Not one of Maia's likely moves (the move played, Stockfish's best): sent
   * with prob 0, priced for the marks but not in the mix.
   */
  extra: boolean
  /** The bars' own small search (for plies the site has not analysed). */
  cp: number | null
  value: [number, number, number] | null
  repr: string | null
}

export type HumanBarStatus =
  | 'off'
  | 'unavailable'
  | 'waiting-maia'
  | 'running'
  | 'done'
  | 'error'

/** Everything computed for one game; kept for the session in `runCache`. */
interface GameRun {
  key: string
  fens: string[]
  game: HumanBarGameInfo
  clocks: number[]
  cp: (number | null)[]
  /** The depth of the site eval behind cp[p]; 0 for the bars' own fallback search. */
  cpDepth: number[]
  value: ([number, number, number] | null)[]
  repr: (string | null)[]
  bars: (HumanBarPly | undefined)[]
  /** The players' form each ply's bars were computed with ("prof", "g50"). */
  barsForm: (string | undefined)[]
  /**
   * The form the server settled on for this game; bars computed with any
   * other form are asked for again. Null until it is known.
   */
  form: string | null
  /** The server is still fetching the players' recent games. */
  upgradePending: boolean
  /** A POST /v1/form wait is in flight. */
  formWait: boolean
  /** Bumped whenever `bars` changes (it is updated in place). */
  barsRevision: number
  /** Plies sent to the server and not answered yet. */
  inFlight: Set<number>
  /** Plies whose eval deepened after their bars came back: asked for again, shown until then. */
  stale: Set<number>
  /**
   * Maia's likely moves at each ply (undefined until Maia has run there;
   * empty when there are none, e.g. the game is over).
   */
  kids: (KidRun[] | undefined)[]
  /** The ply's bars on hand were asked for with its likely moves (the mix). */
  mixed: boolean[]
  /** The shallowest of the site's lines behind the likely moves' evals sent (0: none of the site's). */
  kidDepth: number[]
  /** Plies whose bars on hand include the mix. */
  mixDone: number
  /** The bars after each move priced at a ply (W, Dr, L), by UCI move: the marks' practical cost. */
  afterBy: (Record<string, [number, number, number]> | undefined)[]
  /** The ply's last mix also priced the move played and Stockfish's best (the marks need both). */
  mixFull: boolean[]
  model: string | null
  maiaDone: number
  stockfishDone: number
  barsDone: number
  /** Last failed request to the server (cleared by a later success). */
  error: string | null
  /** Consecutive failed requests. */
  failures: number
  /** The browser-side computation failed; needs a retry. */
  fatal: string | null
  /** Increments for each pipeline launch; older launches stop writing. */
  token: number
  sending: boolean
  /** POST /v1/prepare was sent for this game. */
  prepared: boolean
  /** The ply on screen, and when it was opened without bars. */
  target: number
  targetSince: number | null
  /** The Stockfish search running now (stopped on a jump elsewhere). */
  sfJob: { ply: number; controller: AbortController } | null
  /** Loops sleeping in `pause`, woken early by `wake`. */
  waiters: Set<() => void>
  /** When each startup step first happened (ms since the page started). */
  marks: Record<string, number>
}

const runCache = new Map<string, GameRun>()

/** Resolves after `ms`, or earlier on `wake(run)`. */
const pause = (run: GameRun, ms: number) =>
  new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer)
      run.waiters.delete(done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    run.waiters.add(done)
  })

const wake = (run: GameRun) => {
  for (const done of Array.from(run.waiters)) done()
}

/** Records the first time a startup step happens (logged with the first bars). */
const mark = (run: GameRun, step: string) => {
  if (run.marks[step] === undefined) run.marks[step] = performance.now()
}

const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

/**
 * Waits (up to a few minutes) for the server to finish fetching the players'
 * recent games; the form its bars use from then on, or null if still waiting.
 */
const settleForm = async (game: HumanBarGameInfo): Promise<string | null> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = await waitForHumanBarForm(game)
    if (!answer.pending) return answer.form
  }
  return null
}

/**
 * The site analysis engine's eval of a position for the side to move, once
 * it is at least SITE_EVAL_MIN_DEPTH deep (model_optimal_cp is from White's
 * side); mates as sign * (10000 - N), like encodeSideToMoveScore.
 */
const siteEvalOf = (node: GameNode | undefined) => {
  const sf = node?.analysis?.stockfish
  // The shared cache does not say which engine made its evals (Stockfish 17's
  // are on another scale), so the bars take only this page's own.
  if (!node || !sf || sf.from_cache || !(sf.depth >= SITE_EVAL_MIN_DEPTH)) {
    return null
  }
  const white = sf.model_optimal_cp
  if (!Number.isFinite(white)) return null
  const sideToMove = node.fen.split(' ')[1] === 'b' ? -white : white
  if (Math.abs(white) >= 10000) {
    const n = Math.abs(sf.mate_vec?.[sf.model_move] ?? 1)
    return {
      cp: Math.sign(sideToMove) * (10000 - n),
      depth: sf.depth,
      settled: !sf.partial,
    }
  }
  return { cp: Math.round(sideToMove), depth: sf.depth, settled: !sf.partial }
}

const hasInputs = (run: GameRun, p: number) =>
  run.cp[p] !== null && run.value[p] !== null && run.repr[p] !== null

/**
 * The site's search of a ply as far as the likely moves need it: its line
 * for every legal move, from this page's engine, once it is deep enough.
 */
const siteLinesOf = (node: GameNode | undefined) => {
  const sf = node?.analysis?.stockfish
  if (!sf || sf.from_cache || !(sf.depth >= SITE_EVAL_MIN_DEPTH)) return null
  return sf
}

/**
 * The likely moves of ply p as the server wants them, or null while any of
 * their inputs is missing: the move played takes the next ply's inputs, the
 * others their own Maia outputs and the site's line for the move (else their
 * own small search).
 */
const kidInputs = (
  run: GameRun,
  p: number,
  node: GameNode | undefined,
): {
  kids: HumanBarKidInput[]
  ucis: string[]
  depth: number
  /** Every extra (the move played, Stockfish's best) is in. */
  full: boolean
} | null => {
  addBestMoveKid(run, p, node)
  const ks = run.kids[p]
  if (!ks || ks.length === 0) return null
  const lines = siteLinesOf(node)
  const ucis: string[] = []
  let full = true
  const whiteAfter = run.fens[p].split(' ')[1] === 'b'
  const kids: HumanBarKidInput[] = []
  // The shallowest of the site's lines used (a later, deeper search asks again).
  let depth = Infinity
  for (const k of ks) {
    // The move played: whatever the next ply already has (its Maia outputs,
    // its eval), else what any likely move uses (its own Maia outputs, the
    // site's line for it), so the mix never waits for the next ply.
    const q = p + 1
    const value = k.played ? (run.value[q] ?? k.value) : k.value
    const repr = k.played ? (run.repr[q] ?? k.repr) : k.repr
    // A likely move missing an input holds the request; an extra waits for
    // a later one (the mix does not need it).
    const missing = () => {
      if (!k.extra) return true
      full = false
      return false
    }
    if (!value || !repr) {
      if (missing()) return null
      continue
    }
    const line = lines?.cp_vec?.[k.uci]
    let cp: number
    let d: number
    if (k.played && run.cp[q] !== null) {
      cp = run.cp[q] as number
      d = run.cpDepth[q] || FALLBACK_DEPTH
    } else if (lines && line !== undefined && Number.isFinite(line)) {
      d = lines.root_move_depth_vec?.[k.uci] ?? lines.depth
      depth = Math.min(depth, d)
      cp = evalAfterMoveFromLine(line, lines.mate_vec?.[k.uci], whiteAfter)
    } else if (k.cp !== null) {
      cp = k.cp
      d = FALLBACK_DEPTH
    } else {
      if (missing()) return null
      continue
    }
    kids.push({ fen: k.fen, cp, depth: d, value, repr, prob: k.prob })
    ucis.push(k.uci)
  }
  return { kids, ucis, depth: Number.isFinite(depth) ? depth : 0, full }
}

/**
 * Once the site has searched ply p (depth 12, as the site marks moves): its
 * best move among the moves priced there (an extra, prob 0, when Maia's
 * likely set lacks it), for the marks.
 */
const addBestMoveKid = (
  run: GameRun,
  p: number,
  node: GameNode | undefined,
) => {
  const ks = run.kids[p]
  // The move only (a cached search's too: its eval comes from the bars' own
  // search then, like any likely move without a line of this page's engine).
  const sf = node?.analysis?.stockfish
  const best = sf && sf.depth >= 12 ? sf.model_move : undefined
  if (!ks || ks.length === 0 || !best || ks.some((k) => k.uci === best)) return
  const fen = fenAfterMove(run.fens[p], best)
  if (!fen) return
  ks.push({
    uci: best,
    prob: 0,
    fen,
    played: false,
    extra: true,
    cp: null,
    value: null,
    repr: null,
  })
}

/**
 * The shallowest line taken for the next position: the site's staged search
 * scores every move at a screening depth (about 6) before deepening some, and
 * such an eval is only shown until the site's own search of that position
 * replaces it (the bars' map treats it as depth 8, the shallowest it has).
 */
const PARENT_LINE_MIN_DEPTH = 6

/**
 * Ply p's eval from the site's search of the ply before it: that search's
 * line for the move played (side to move at p), once the line is at least
 * PARENT_LINE_MIN_DEPTH deep (and the search at least SITE_EVAL_MIN_DEPTH);
 * null otherwise.
 */
const evalFromParentLine = (
  run: GameRun,
  p: number,
  nodes: GameNode[],
): { cp: number; depth: number } | null => {
  const lines = siteLinesOf(nodes[p - 1])
  const move = nodes[p]?.move
  if (!lines || !move) return null
  const line = lines.cp_vec?.[move]
  const depth = lines.root_move_depth_vec?.[move] ?? lines.depth
  if (line === undefined || !Number.isFinite(line)) return null
  if (!(depth >= PARENT_LINE_MIN_DEPTH)) return null
  return {
    cp: evalAfterMoveFromLine(
      line,
      lines.mate_vec?.[move],
      run.fens[p].split(' ')[1] !== 'b',
    ),
    depth,
  }
}

/** The likely moves of ply p that still need the bars' own search (no site line for them). */
const kidsToSearch = (run: GameRun, p: number, node: GameNode | undefined) => {
  const ks = run.kids[p]
  if (!ks) return []
  const lines = siteLinesOf(node)
  return ks.filter(
    (k) =>
      !(k.played && run.cp[p + 1] !== null) &&
      k.cp === null &&
      !(lines && Number.isFinite(lines.cp_vec?.[k.uci] ?? NaN)),
  )
}

/** Ply p's mix is in, or it has no likely moves to look through. */
const mixSettled = (run: GameRun, p: number) =>
  run.mixed[p] || (run.kids[p] !== undefined && run.kids[p]?.length === 0)

/**
 * No bars yet, bars computed before the server had the players' recent
 * games (their profiles only), or bars without the one-move mix while the
 * ply's likely moves are all in.
 */
const needsBars = (run: GameRun, p: number, node: GameNode | undefined) =>
  run.bars[p] === undefined ||
  run.stale.has(p) ||
  (run.form !== null && run.barsForm[p] !== run.form) ||
  (!run.mixed[p] && kidInputs(run, p, node) !== null) ||
  (run.mixed[p] && !run.mixFull[p] && !!kidInputs(run, p, node)?.full)

/** The request for the given plies (each with its index p). */
export const buildHumanBarRequest = (
  run: Pick<
    GameRun,
    'game' | 'fens' | 'cp' | 'cpDepth' | 'value' | 'repr' | 'clocks'
  >,
  plies: number[],
  /** Each ply's likely moves, for the plies sent with them (the mix). */
  kids: Map<number, HumanBarKidInput[]> = new Map(),
): HumanBarRequest => ({
  game: run.game,
  // The site's own engine: its analysis evals, or the bars' small fallback
  // search with the same engine.
  engine: HUMAN_BAR_ENGINE,
  maia_model: MAIA_MODEL_VERSION,
  positions: plies.map((p) => ({
    p,
    fen: run.fens[p],
    cp: run.cp[p] as number,
    depth: run.cpDepth[p] || FALLBACK_DEPTH,
    value: run.value[p] as [number, number, number],
    repr: run.repr[p] as string,
    ...(kids.has(p) ? { kids: kids.get(p) } : {}),
  })),
  clocks: run.clocks,
})

/**
 * Human bars for a Lichess game, one position at a time: the browser runs
 * Maia3 (value + repr at the players' ratings) and takes Stockfish's eval
 * from the site's own analysis (from depth 12, refreshed at its final depth;
 * a small search of its own only for positions the site has not analysed)
 * on the position on screen first, then the next ones, then the rest of the
 * game, and sends the raw outputs to the human-bar server, which answers
 * with the bars for those plies.
 */
export const useHumanBars = (
  analyzedGame: AnalyzedGame,
  currentNode: GameNode | null | undefined,
  enabled: boolean,
  /** The site's analysis is running on the position on screen (not hidden). */
  siteAnalysing = true,
) => {
  const maia = useContext(MaiaEngineContext)
  const maiaRef = useRef(maia)
  maiaRef.current = maia

  const [, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const [launch, setLaunch] = useState(0)

  const serverConfigured = getHumanBarBaseUrl() !== null
  const isLichess = analyzedGame.type === 'lichess'

  const mainline = useMemo(
    () => analyzedGame.tree.getMainLine(),
    [analyzedGame.tree],
  )
  // The site's analysis writes its evals into these nodes as it goes.
  const mainlineRef = useRef(mainline)
  mainlineRef.current = mainline
  const siteAnalysingRef = useRef(siteAnalysing)
  siteAnalysingRef.current = siteAnalysing

  const setup = useMemo(() => {
    if (!isLichess) return null
    return buildHumanBarSetup(
      analyzedGame.pgn,
      analyzedGame.id,
      mainline.length - 1,
      mainline[0]?.fen ?? '',
      {
        white: analyzedGame.whitePlayer.rating,
        black: analyzedGame.blackPlayer.rating,
      },
    )
  }, [analyzedGame, mainline, isLichess])

  const run = useMemo(() => {
    if (!setup?.ok) return null
    const fens = mainline.map((node) => node.fen)
    const key = `${analyzedGame.id}:${fens.length}:${fens[fens.length - 1]}`
    const cached = runCache.get(key)
    if (cached) return cached
    const fresh: GameRun = {
      key,
      fens,
      game: setup.game,
      clocks: setup.clocks,
      cp: fens.map(() => null),
      cpDepth: fens.map(() => 0),
      value: fens.map(() => null),
      repr: fens.map(() => null),
      bars: fens.map(() => undefined),
      barsForm: fens.map(() => undefined),
      form: null,
      upgradePending: false,
      formWait: false,
      barsRevision: 0,
      inFlight: new Set(),
      stale: new Set(),
      kids: fens.map(() => undefined),
      mixed: fens.map(() => false),
      kidDepth: fens.map(() => 0),
      mixDone: 0,
      afterBy: fens.map(() => undefined),
      mixFull: fens.map(() => false),
      model: null,
      maiaDone: 0,
      stockfishDone: 0,
      barsDone: 0,
      error: null,
      failures: 0,
      fatal: null,
      token: 0,
      sending: false,
      prepared: false,
      target: 0,
      targetSince: null,
      sfJob: null,
      waiters: new Set(),
      marks: {},
    }
    runCache.set(key, fresh)
    return fresh
  }, [setup, mainline, analyzedGame.id])

  // The ply to show: the current node if it is on the main line, else its
  // closest main-line ancestor (variations have no bars of their own).
  const { ply, inVariation } = useMemo(() => {
    let node: GameNode | null | undefined = currentNode
    let variation = false
    while (node && !node.isMainline) {
      node = node.parent
      variation = true
    }
    const index = node ? mainline.indexOf(node) : -1
    return { ply: index >= 0 ? index : null, inVariation: variation }
  }, [currentNode, mainline])

  const send = useCallback(
    (target: GameRun, token: number) => {
      if (target.sending || target.token !== token || target.fatal) return
      const total = target.fens.length
      const nodes = mainlineRef.current
      // Everything evaluated and not answered yet, in one request; plies
      // whose likely moves are all in go with them (a few per request).
      const candidates = evaluationOrder(
        target.target,
        total,
        LOOKAHEAD,
      ).filter(
        (p) =>
          needsBars(target, p, nodes[p]) &&
          !target.inFlight.has(p) &&
          hasInputs(target, p),
      )
      const kids = new Map<number, HumanBarKidInput[]>()
      const kidDepth = new Map<number, number>()
      const kidMoves = new Map<number, { ucis: string[]; full: boolean }>()
      const ready: number[] = []
      for (const p of candidates) {
        const k =
          kids.size < MIX_PLIES_PER_REQUEST
            ? kidInputs(target, p, nodes[p])
            : null
        if (k) {
          kids.set(p, k.kids)
          kidDepth.set(p, k.depth)
          kidMoves.set(p, { ucis: k.ucis, full: k.full })
        } else if (
          target.bars[p] !== undefined &&
          !target.stale.has(p) &&
          !(target.form !== null && target.barsForm[p] !== target.form)
        ) {
          // Here only for its mix, which waits for the next request.
          continue
        }
        ready.push(p)
      }
      if (ready.length === 0) return

      target.sending = true
      ready.forEach((p) => target.inFlight.add(p))
      mark(target, 'request sent')
      bump()
      fetchHumanBars(buildHumanBarRequest(target, ready, kids))
        .then((response) => {
          if (target.marks['first bars'] === undefined) {
            mark(target, 'first bars')
            const { started, ready } = getBatchStockfish().setupTimes
            if (started !== undefined)
              target.marks['bar Stockfish setup started'] = started
            if (ready !== undefined)
              target.marks['bar Stockfish set up'] = ready
            console.info(
              `[human bars] startup (ms since the page started): ${Object.entries(
                target.marks,
              )
                .sort((a, b) => a[1] - b[1])
                .map(([step, t]) => `${step} ${Math.round(t)}`)
                .join(
                  ', ',
                )}; engine ${HUMAN_BAR_ENGINE}, Maia ${MAIA_MODEL_VERSION}`,
            )
          }
          for (const bar of response.plies) {
            if (bar && bar.p >= 0 && bar.p < total) {
              // With its likely moves sent, the ply shows the one-move mix;
              // its own bar stays in `own`.
              const mix =
                bar.MW !== undefined &&
                bar.MDr !== undefined &&
                bar.ML !== undefined
              target.bars[bar.p] = mix
                ? {
                    ...bar,
                    own: [bar.W, bar.Dr, bar.L],
                    W: bar.MW as number,
                    Dr: bar.MDr as number,
                    L: bar.ML as number,
                  }
                : bar
              target.barsForm[bar.p] = response.form
              target.stale.delete(bar.p)
              if (kids.has(bar.p)) {
                target.mixed[bar.p] = true
                target.kidDepth[bar.p] = kidDepth.get(bar.p) ?? 0
                const sent = kidMoves.get(bar.p)
                target.mixFull[bar.p] = sent?.full ?? false
                if (
                  sent &&
                  bar.after &&
                  bar.after.length === sent.ucis.length
                ) {
                  target.afterBy[bar.p] = Object.fromEntries(
                    sent.ucis.map((uci, i) => [uci, bar.after?.[i]]),
                  ) as Record<string, [number, number, number]>
                }
              } else {
                target.mixed[bar.p] = false
              }
            }
          }
          target.mixDone = target.mixed.filter(Boolean).length
          if (response.upgrade_pending) {
            target.upgradePending = true
            if (!target.formWait) {
              // These bars use the players' profiles; the server is still
              // fetching their recent games. Redo the bars once it has them.
              target.formWait = true
              settleForm(target.game)
                .then((form) => {
                  if (form) target.form = form
                  console.info(
                    `[human bars] players' recent games in at ${Math.round(
                      performance.now(),
                    )} ms: bars redone with form "${form}"`,
                  )
                })
                .catch((error) =>
                  console.warn('[human bars] form lookup failed:', error),
                )
                .finally(() => {
                  target.formWait = false
                  target.upgradePending = false
                  bump()
                  send(target, target.token)
                })
            }
          } else if (response.form) {
            target.form = response.form
          }
          target.barsRevision++
          target.barsDone = target.bars.filter(Boolean).length
          target.model = response.model ?? null
          target.error = null
          target.failures = 0
          const t = target.target
          if (target.targetSince !== null && target.bars[t]) {
            console.info(
              `[human bars] ply ${t}: bars ${Math.round(
                performance.now() - target.targetSince,
              )} ms after it was opened`,
            )
            target.targetSince = null
          }
        })
        .catch((error) => {
          console.warn('[human bars] request failed:', error)
          if (error instanceof HumanBarServerError && error.refused) {
            // The server refuses these inputs: asking again will not help.
            target.fatal = error.message
            return
          }
          target.error =
            error instanceof Error ? error.message : 'Request failed'
          target.failures++
          if (target.failures < MAX_FAILURES) {
            setTimeout(() => send(target, token), RETRY_DELAY_MS)
          }
        })
        .finally(() => {
          ready.forEach((p) => target.inFlight.delete(p))
          target.sending = false
          bump()
          // Evals that finished while this request was in flight.
          if (target.failures === 0) send(target, token)
        })
    },
    [bump],
  )

  // Follow the position on screen: if it still needs Stockfish, stop the
  // search running elsewhere; wake the loops either way.
  useEffect(() => {
    if (!run || ply === null) return
    run.target = ply
    if (run.bars[ply] === undefined) {
      run.targetSince = performance.now()
      const job = run.sfJob
      if (job && job.ply !== ply && run.cp[ply] === null) {
        job.controller.abort()
      }
    } else {
      run.targetSince = null
    }
    wake(run)
  }, [run, ply])

  // The site's eval of the position on screen deepens while its search runs:
  // take it at its final depth (or as soon as it replaces a fallback search)
  // and when the search finishes, and ask for that ply's bars again if the
  // eval moved.
  const siteDepth = currentNode?.analysis?.stockfish?.depth ?? 0
  const siteSearching = !!currentNode?.analysis?.stockfish?.partial
  useEffect(() => {
    if (!enabled || !run || ply === null || run.cp[ply] === null) return
    const site = siteEvalOf(mainline[ply])
    if (!site || site.depth < run.cpDepth[ply]) return
    if (!site.settled) {
      if (site.depth === run.cpDepth[ply]) return
      if (run.cpDepth[ply] > 0 && site.depth < SITE_EVAL_FINAL_DEPTH) return
    }
    const moved = run.cp[ply] !== site.cp
    run.cp[ply] = site.cp
    run.cpDepth[ply] = site.depth
    // The likely moves' evals come from the same search: a mix made from
    // shallower lines is asked for again too.
    const linesDeeper = run.mixed[ply] && run.kidDepth[ply] < site.depth
    if ((moved || linesDeeper) && run.bars[ply] !== undefined) {
      run.stale.add(ply)
    }
    if (needsBars(run, ply, mainline[ply])) send(run, run.token)
  }, [enabled, run, ply, siteDepth, siteSearching, mainline, send])

  useEffect(() => {
    if (!enabled || !run || !serverConfigured) return
    const total = run.fens.length
    if (run.barsDone === total && run.fens.every((_, p) => mixSettled(run, p)))
      return

    const token = ++run.token
    const live = () => run.token === token
    run.failures = 0
    mark(run, 'panel started')
    if (!run.prepared) {
      // Lets the server start its slow lookups (the players' recent games)
      // while the browser computes the first evals.
      run.prepared = true
      prepareHumanBars(run.game)
    }
    const order = () => {
      const all = evaluationOrder(run.target, total, LOOKAHEAD)
      return BACKGROUND_FILL ? all : all.slice(0, LOOKAHEAD + 2)
    }

    const runStockfish = async () => {
      // The bars' own engine is only for positions the site has not
      // analysed: set up on first need, so it never delays the site's eval
      // of the position on screen (or competes with it on a phone).
      let engine: ReturnType<typeof getBatchStockfish> | null = null
      const fallbackEngine = async () => {
        if (!engine) {
          engine = getBatchStockfish()
          await engine.newGame()
          mark(run, 'bar Stockfish ready')
        }
        return engine
      }
      /**
       * Waits while the site's engine is searching the position on screen
       * (so the two never share the CPU); false if the position on screen
       * changed meanwhile.
       */
      const waitSiteIdle = async () => {
        const t = run.target
        const since = performance.now()
        const idle = () => {
          const sf = mainlineRef.current[t]?.analysis?.stockfish
          // `partial` clears when the site's search of the position is done,
          // well after its best line reaches the final depth.
          return (
            !siteAnalysingRef.current ||
            (sf !== undefined && !sf.partial) ||
            performance.now() - since > SITE_SEARCH_GIVE_UP_MS
          )
        }
        while (live() && !idle() && run.target === t) await pause(run, 500)
        return live() && run.target === t
      }
      /**
       * The likely moves left for the bars' own search: those of plies the
       * site has not analysed (the position on screen waits for the site's
       * lines while the site is analysing it).
       */
      const nextKidSearch = () => {
        for (const p of order()) {
          const sf = mainlineRef.current[p]?.analysis?.stockfish
          if (
            p === run.target &&
            siteAnalysingRef.current &&
            (sf === undefined || sf.partial)
          )
            continue
          const k = kidsToSearch(run, p, mainlineRef.current[p])[0]
          if (k) return { p, k }
        }
        return null
      }
      const allKidsKnown = () => run.kids.every((ks) => ks !== undefined)
      while (live()) {
        const p = order().find((i) => run.cp[i] === null)
        if (p === undefined) {
          if (!BACKGROUND_FILL) {
            await pause(run, 60000)
            continue
          }
          const next = nextKidSearch()
          if (!next) {
            // Done once every ply's likely moves are known and none waits
            // for a search (the position on screen may still be waiting for
            // the site's lines, which may lack one of them).
            const waiting = kidsToSearch(
              run,
              run.target,
              mainlineRef.current[run.target],
            ).length
            if (
              allKidsKnown() &&
              run.value.every((v) => v !== null) &&
              waiting === 0
            )
              return
            await pause(run, 500)
            continue
          }
          if (!(await waitSiteIdle())) continue
          if (
            kidsToSearch(run, next.p, mainlineRef.current[next.p])[0] !== next.k
          )
            continue
          const sf = await fallbackEngine()
          if (!live()) return
          const job = { ply: next.p, controller: new AbortController() }
          run.sfJob = job
          try {
            const evaluation = await sf.evaluate(
              next.k.fen,
              FALLBACK_NODES,
              job.controller.signal,
            )
            if (!live()) return
            next.k.cp = encodeSideToMoveScore(evaluation)
          } catch (error) {
            if (isAbort(error)) continue
            throw error
          } finally {
            if (run.sfJob === job) run.sfJob = null
          }
          send(run, token)
          wake(run)
          continue
        }
        // A finished game (mate, stalemate): its exact eval at once, since
        // no search of it reaches a depth to wait for.
        const over = gameOverEval(run.fens[p])
        if (over !== null) {
          run.cp[p] = over
          run.cpDepth[p] = 0
          run.stockfishDone = run.cp.filter((v) => v !== null).length
          bump()
          send(run, token)
          wake(run)
          continue
        }
        // The site's own eval when it has one. The position on screen waits
        // for it while the site is analysing it (its engine may still be
        // starting on a phone); it searches itself only if the site is not
        // analysing it at all (analysis hidden).
        let site = siteEvalOf(mainlineRef.current[p])
        if (!site && p === run.target) {
          const since = performance.now()
          // The site does not search a position whose cached eval is at its
          // final depth, and the bars do not take cached evals (the cache
          // does not say which engine made them): then search it here.
          const cachedOnly = () => {
            const sf = mainlineRef.current[p]?.analysis?.stockfish
            return (
              !!sf?.from_cache &&
              !sf.partial &&
              sf.depth >= SITE_EVAL_FINAL_DEPTH
            )
          }
          const siteBusy = () =>
            !cachedOnly() &&
            (siteAnalysingRef.current ||
              (mainlineRef.current[p]?.analysis?.stockfish !== undefined &&
                !mainlineRef.current[p]?.analysis?.stockfish?.from_cache) ||
              performance.now() - since < SITE_EVAL_WAIT_MS)
          while (!site && live() && p === run.target && siteBusy()) {
            await pause(run, 100)
            site = siteEvalOf(mainlineRef.current[p])
          }
          if (!live()) return
          if (!site && p !== run.target) continue
        }
        // A position right after one the site has searched (the next move
        // from the one on screen, as you step forward): its eval from that
        // search's line for the move played, at once and without a search of
        // its own; the site's own search of it replaces it once it is shown.
        const parent =
          !site && p > 0
            ? evalFromParentLine(run, p, mainlineRef.current)
            : null
        if (parent) {
          run.cp[p] = parent.cp
          run.cpDepth[p] = parent.depth
          mark(run, 'first Stockfish eval')
          run.stockfishDone = run.cp.filter((v) => v !== null).length
          bump()
          send(run, token)
          wake(run)
          continue
        }
        if (!site && p !== run.target) {
          // Another position (the rest of the game, for the chart): search it
          // only while the site's engine is idle, i.e. once the position on
          // screen has its final eval, so the two never share the CPU.
          const t = run.target
          const since = performance.now()
          const idle = () => {
            const sf = mainlineRef.current[t]?.analysis?.stockfish
            // `partial` clears when the site's search of the position is done,
            // well after its best line reaches the final depth.
            return (
              !siteAnalysingRef.current ||
              (sf !== undefined && !sf.partial) ||
              performance.now() - since > SITE_SEARCH_GIVE_UP_MS
            )
          }
          // (Until the site's line for the move into it arrives, which takes
          // it without a search: see above.)
          const lineIn = () => !!evalFromParentLine(run, p, mainlineRef.current)
          while (live() && !idle() && run.target === t && !lineIn())
            await pause(run, 200)
          if (!live()) return
          if (run.target !== t || lineIn()) continue
          site = siteEvalOf(mainlineRef.current[p])
        }
        if (site) {
          run.cp[p] = site.cp
          run.cpDepth[p] = site.depth
          mark(run, 'first Stockfish eval')
          run.stockfishDone = run.cp.filter((v) => v !== null).length
          bump()
          send(run, token)
          wake(run)
          continue
        }
        const sf = await fallbackEngine()
        if (!live()) return
        const job = { ply: p, controller: new AbortController() }
        run.sfJob = job
        wake(run) // Maia can start on this position
        try {
          const evaluation = await sf.evaluate(
            run.fens[p],
            FALLBACK_NODES,
            job.controller.signal,
          )
          if (!live()) return
          run.cp[p] = encodeSideToMoveScore(evaluation)
          run.cpDepth[p] = 0
          mark(run, 'first Stockfish eval')
        } catch (error) {
          if (isAbort(error)) continue
          throw error
        } finally {
          if (run.sfJob === job) run.sfJob = null
        }
        run.stockfishDone = run.cp.filter((v) => v !== null).length
        bump()
        send(run, token)
        wake(run)
      }
    }

    /** Plies whose likely moves are with Maia now. */
    const kidsInFlight = new Set<number>()
    /**
     * Maia on some of a ply's likely moves (at most `size`), at background
     * priority: after the site's own Maia work for the position on screen.
     */
    const kidMaia = async (
      engine: NonNullable<typeof maiaRef.current.maia>,
      p: number,
      size: number,
    ) => {
      const ks = (run.kids[p] ?? [])
        .filter(
          (k) => k.value === null && !(k.played && run.value[p + 1] !== null),
        )
        .slice(0, size)
      if (ks.length === 0) return
      kidsInFlight.add(p)
      try {
        // The side to move after the move is the other player.
        const whiteAfter = run.fens[p].split(' ')[1] === 'b'
        const self = whiteAfter ? run.game.white_elo : run.game.black_elo
        const oppo = whiteAfter ? run.game.black_elo : run.game.white_elo
        const outputs = await engine.batchEvaluateMaia3Raw(
          ks.map((k) => k.fen),
          ks.map(() => self),
          ks.map(() => oppo),
          { priority: MAIA_PRIORITY.background },
        )
        if (!live()) return
        outputs.forEach((out, j) => {
          if (!out.repr) {
            throw new Error(
              'The cached Maia model has no repr output; reload the page to refresh it.',
            )
          }
          ks[j].value = out.value
          ks[j].repr = float32ToBase64LE(out.repr)
        })
      } finally {
        kidsInFlight.delete(p)
      }
      bump()
      send(run, token)
      wake(run)
    }

    const runMaia = async () => {
      while (live()) {
        const engine =
          maiaRef.current.status === 'ready' ? maiaRef.current.maia : null
        if (!engine) {
          await pause(run, 250)
          continue
        }
        mark(run, 'Maia ready')
        const kidTodo = (p: number) =>
          !kidsInFlight.has(p) &&
          (run.kids[p] ?? []).some(
            (k) => k.value === null && !(k.played && run.value[p + 1] !== null),
          )
        // The likely moves of the position on screen go to Maia as soon as
        // its own outputs are in, without holding up the next positions'
        // own (so stepping forward still finds their bars ready).
        if (run.value[run.target] !== null && kidTodo(run.target)) {
          kidMaia(engine, run.target, KID_MAIA_BATCH_SIZE).catch((error) =>
            console.warn('[human bars] likely moves failed:', error),
          )
        }
        const ownLeft = run.value.some((v) => v === null)
        // Those of the other plies once every position has its own.
        const kidPly = ownLeft ? undefined : order().find((p) => kidTodo(p))
        if (kidPly !== undefined) {
          await kidMaia(engine, kidPly, MAIA_BATCH_SIZE)
          if (!live()) return
          continue
        }
        // Maia is about ten times faster than Stockfish: keep it on the
        // positions Stockfish has done or is doing, plus the one on screen and
        // the next ones (their evals come from the site's line for the move
        // as soon as you reach the one before, so their bars are ready when
        // you step forward).
        const todo = order()
          .filter(
            (i) =>
              run.value[i] === null &&
              (i === run.target ||
                run.cp[i] !== null ||
                i === run.sfJob?.ply ||
                (i > run.target && i <= run.target + LOOKAHEAD)),
          )
          .slice(0, MAIA_BATCH_SIZE)
        if (todo.length === 0) {
          if (
            !ownLeft &&
            kidsInFlight.size === 0 &&
            run.kids.every((ks) => ks !== undefined)
          )
            return
          await pause(run, 1000)
          continue
        }
        // The position on screen alone, for the quickest answer, at the
        // priority of the site's own analysis; the rest behind it.
        const onScreen = todo[0] === run.target
        const idx = onScreen ? [todo[0]] : todo
        const whiteToMove = idx.map((i) => run.fens[i].split(' ')[1] !== 'b')
        const outputs = await engine.batchEvaluateMaia3Raw(
          idx.map((i) => run.fens[i]),
          whiteToMove.map((w) => (w ? run.game.white_elo : run.game.black_elo)),
          whiteToMove.map((w) => (w ? run.game.black_elo : run.game.white_elo)),
          {
            priority: onScreen
              ? MAIA_PRIORITY.normal
              : MAIA_PRIORITY.background,
            // Maia's likely moves at the position (the one-move mix).
            policy: true,
          },
        )
        if (!live()) return
        mark(run, 'first Maia eval')
        outputs.forEach((out, j) => {
          const i = idx[j]
          if (!out.repr) {
            throw new Error(
              'The cached Maia model has no repr output; reload the page to refresh it.',
            )
          }
          run.value[i] = out.value
          run.repr[i] = float32ToBase64LE(out.repr)
          const played = mainlineRef.current[i + 1]?.move ?? null
          const likely = likelyMoves(out.policy ?? {})
          run.kids[i] = likely.flatMap(({ uci, prob }) => {
            const fen =
              uci === played ? run.fens[i + 1] : fenAfterMove(run.fens[i], uci)
            return fen === null
              ? []
              : [
                  {
                    uci,
                    prob,
                    fen,
                    played: uci === played,
                    extra: false,
                    cp: null,
                    value: null,
                    repr: null,
                  },
                ]
          })
          // The move played, priced for its mark even when it is not one of
          // Maia's likely moves (not in the mix).
          if (
            played &&
            run.kids[i]?.length &&
            !likely.some((m) => m.uci === played)
          ) {
            run.kids[i]?.push({
              uci: played,
              prob: 0,
              fen: run.fens[i + 1],
              played: true,
              extra: true,
              cp: null,
              value: null,
              repr: null,
            })
          }
        })
        run.maiaDone = run.value.filter((v) => v !== null).length
        bump()
        send(run, token)
      }
    }

    Promise.all([runMaia(), runStockfish()])
      .then(() => {
        if (live()) send(run, token)
      })
      .catch((error) => {
        console.error('[human bars] pipeline failed:', error)
        if (live()) {
          run.fatal =
            error instanceof Error ? error.message : 'Human bars failed'
          bump()
        }
      })

    return () => {
      // Stop this launch; whatever it computed stays in the cache.
      if (run.token === token) run.token++
      run.sfJob?.controller.abort()
      wake(run)
    }
  }, [enabled, run, serverConfigured, send, bump, launch])

  const retry = useCallback(() => {
    if (!run) return
    run.error = null
    run.fatal = null
    run.failures = 0
    setLaunch((n) => n + 1)
  }, [run])

  // A new array whenever the bars change, so consumers can memoize on it.
  const barsRevision = run?.barsRevision ?? 0
  const bars = useMemo(() => (run ? [...run.bars] : []), [run, barsRevision])

  /**
   * The mark of the move played from ply p (practical LOG §91, moveMark):
   * its objective cost from the site's own search of p (the win-rate loss the
   * site marks by), its practical cost from the bars after the moves priced
   * there (none until they are in: then only the objective tiers). undefined
   * while the site has not searched p deep enough to mark it.
   */
  const markOf = useCallback(
    (p: number): MoveMark | null | undefined => {
      const move = mainline[p + 1]?.move
      const sf = mainline[p]?.analysis?.stockfish
      if (!run || !move || !sf || !(sf.depth >= 12)) return undefined
      const loss = sf.winrate_loss_vec?.[move]
      if (loss === undefined || !Number.isFinite(loss)) return undefined
      const after = run.afterBy[p]
      const white = run.fens[p].split(' ')[1] !== 'b'
      const chance = (a: [number, number, number]) =>
        100 * (white ? a[0] + a[1] / 2 : a[2] + a[1] / 2)
      const mine = after?.[move]
      const best = after?.[sf.model_move]
      return moveMark(
        Math.abs(loss) * 100,
        after && mine
          ? {
              move: chance(mine),
              top: Math.max(...Object.values(after).map(chance)),
              best: best ? chance(best) : undefined,
            }
          : undefined,
      )
    },
    // barsRevision: afterBy is updated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, mainline, barsRevision],
  )

  let status: HumanBarStatus
  if (!enabled || !isLichess || !serverConfigured) status = 'off'
  else if (!setup || !setup.ok || !run) status = 'unavailable'
  else if (run.barsDone === run.fens.length) status = 'done'
  else if (run.fatal || (run.failures >= MAX_FAILURES && !run.sending))
    status = 'error'
  else if (maia.status !== 'ready' && (ply === null || !run.value[ply]))
    status = 'waiting-maia'
  else status = 'running'

  return {
    status,
    available: isLichess && serverConfigured,
    reason: setup && !setup.ok ? setup.reason : null,
    error: run?.fatal ?? run?.error ?? null,
    model: run?.model ?? null,
    bars,
    markOf,
    total: run?.fens.length ?? 0,
    progress: {
      maia: run?.maiaDone ?? 0,
      stockfish: run?.stockfishDone ?? 0,
      bars: run?.barsDone ?? 0,
      /** Plies whose bars look one move ahead (the mix). */
      mix: run?.mixDone ?? 0,
    },
    /** A /v1/bars request is in flight. */
    waitingForServer: run?.sending ?? false,
    /**
     * No bars have come back for this game yet: the server's first answer
     * waits for the players' Lichess profiles.
     */
    firstAnswerPending: (run?.barsDone ?? 0) === 0,
    /**
     * The bars shown use the players' profiles; they are redone once the
     * server has fetched the players' recent games.
     */
    upgradePending: run?.upgradePending ?? false,
    /**
     * The players' form behind the bars on screen: "none" when the server
     * could not get their Lichess profiles in time (it keeps trying while
     * upgradePending), "prof", "g50".
     */
    shownForm: (ply !== null && run?.barsForm[ply]) || null,
    ply,
    inVariation,
    mainline,
    timeControl: setup?.ok ? setup.game.time_control : undefined,
    whiteName: setup?.ok ? setup.game.white : analyzedGame.whitePlayer.name,
    blackName: setup?.ok ? setup.game.black : analyzedGame.blackPlayer.name,
    retry,
  }
}

export type HumanBarsState = ReturnType<typeof useHumanBars>
