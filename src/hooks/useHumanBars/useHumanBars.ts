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
  likelyMoves,
} from 'src/lib/humanBar'
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
  /** The move played in the game: its inputs are the next ply's own. */
  played: boolean
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
  /** The depth of the site's search behind the likely moves' evals sent (0: the bars' own searches). */
  kidDepth: number[]
  /** Plies whose bars on hand include the mix. */
  mixDone: number
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
): { kids: HumanBarKidInput[]; depth: number } | null => {
  const ks = run.kids[p]
  if (!ks || ks.length === 0) return null
  const lines = siteLinesOf(node)
  const whiteAfter = run.fens[p].split(' ')[1] === 'b'
  const kids: HumanBarKidInput[] = []
  let depth = 0
  for (const k of ks) {
    if (k.played) {
      const q = p + 1
      if (!hasInputs(run, q)) return null
      kids.push({
        fen: run.fens[q],
        cp: run.cp[q] as number,
        depth: run.cpDepth[q] || FALLBACK_DEPTH,
        value: run.value[q] as [number, number, number],
        repr: run.repr[q] as string,
        prob: k.prob,
      })
      continue
    }
    if (!k.value || !k.repr) return null
    const line = lines?.cp_vec?.[k.uci]
    if (lines && line !== undefined && Number.isFinite(line)) {
      const d = lines.root_move_depth_vec?.[k.uci] ?? lines.depth
      depth = Math.max(depth, d)
      kids.push({
        fen: k.fen,
        cp: evalAfterMoveFromLine(line, lines.mate_vec?.[k.uci], whiteAfter),
        depth: d,
        value: k.value,
        repr: k.repr,
        prob: k.prob,
      })
    } else if (k.cp !== null) {
      kids.push({
        fen: k.fen,
        cp: k.cp,
        depth: FALLBACK_DEPTH,
        value: k.value,
        repr: k.repr,
        prob: k.prob,
      })
    } else {
      return null
    }
  }
  return { kids, depth }
}

/** The likely moves of ply p that still need the bars' own search (no site line for them). */
const kidsToSearch = (run: GameRun, p: number, node: GameNode | undefined) => {
  const ks = run.kids[p]
  if (!ks) return []
  const lines = siteLinesOf(node)
  return ks.filter(
    (k) =>
      !k.played &&
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
  (!run.mixed[p] && kidInputs(run, p, node) !== null)

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
      const ready: number[] = []
      for (const p of candidates) {
        const k =
          kids.size < MIX_PLIES_PER_REQUEST
            ? kidInputs(target, p, nodes[p])
            : null
        if (k) {
          kids.set(p, k.kids)
          kidDepth.set(p, k.depth)
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
        // The site's own eval when it has one. The position on screen waits
        // for it while the site is analysing it (its engine may still be
        // starting on a phone); it searches itself only if the site is not
        // analysing it at all (analysis hidden).
        let site = siteEvalOf(mainlineRef.current[p])
        if (!site && p === run.target) {
          const since = performance.now()
          const siteBusy = () =>
            siteAnalysingRef.current ||
            (mainlineRef.current[p]?.analysis?.stockfish !== undefined &&
              !mainlineRef.current[p]?.analysis?.stockfish?.from_cache) ||
            performance.now() - since < SITE_EVAL_WAIT_MS
          while (!site && live() && p === run.target && siteBusy()) {
            await pause(run, 100)
            site = siteEvalOf(mainlineRef.current[p])
          }
          if (!live()) return
          if (!site && p !== run.target) continue
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
          while (live() && !idle() && run.target === t) await pause(run, 500)
          if (!live()) return
          if (run.target !== t) continue
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

    const runMaia = async () => {
      while (live()) {
        const engine =
          maiaRef.current.status === 'ready' ? maiaRef.current.maia : null
        if (!engine) {
          await pause(run, 250)
          continue
        }
        mark(run, 'Maia ready')
        // The likely moves of the position on screen come right after its
        // own Maia outputs; those of the other plies once every position
        // has its own.
        const kidTodo = (p: number) =>
          (run.kids[p] ?? []).filter((k) => !k.played && k.value === null)
        const kidsOnScreen =
          run.value[run.target] !== null ? kidTodo(run.target) : []
        const ownLeft = run.value.some((v) => v === null)
        const kidPly = kidsOnScreen.length
          ? run.target
          : ownLeft
            ? undefined
            : order().find((p) => kidTodo(p).length > 0)
        if (kidPly !== undefined) {
          const onScreen = kidPly === run.target
          const ks = kidTodo(kidPly).slice(
            0,
            onScreen ? KID_MAIA_BATCH_SIZE : MAIA_BATCH_SIZE,
          )
          // The side to move after the move is the other player.
          const whiteAfter = run.fens[kidPly].split(' ')[1] === 'b'
          const self = whiteAfter ? run.game.white_elo : run.game.black_elo
          const oppo = whiteAfter ? run.game.black_elo : run.game.white_elo
          const outputs = await engine.batchEvaluateMaia3Raw(
            ks.map((k) => k.fen),
            ks.map(() => self),
            ks.map(() => oppo),
            {
              priority: onScreen
                ? MAIA_PRIORITY.normal
                : MAIA_PRIORITY.background,
            },
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
          bump()
          send(run, token)
          wake(run)
          continue
        }
        // Maia is about ten times faster than Stockfish: keep it on the
        // positions Stockfish has done or is doing, plus the one on screen.
        const todo = order()
          .filter(
            (i) =>
              run.value[i] === null &&
              (i === run.target || run.cp[i] !== null || i === run.sfJob?.ply),
          )
          .slice(0, MAIA_BATCH_SIZE)
        if (todo.length === 0) {
          if (!ownLeft && run.kids.every((ks) => ks !== undefined)) return
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
          run.kids[i] = likelyMoves(out.policy ?? {}).flatMap(
            ({ uci, prob }) => {
              const fen =
                uci === played
                  ? run.fens[i + 1]
                  : fenAfterMove(run.fens[i], uci)
              return fen === null
                ? []
                : [
                    {
                      uci,
                      prob,
                      fen,
                      played: uci === played,
                      cp: null,
                      value: null,
                      repr: null,
                    },
                  ]
            },
          )
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
