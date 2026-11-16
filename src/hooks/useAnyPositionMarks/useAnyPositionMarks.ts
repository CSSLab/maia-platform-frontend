import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import { fetchAnyPositionBars, getHumanBarBaseUrl } from 'src/api/humanBar'
import {
  MAIA_MODEL_VERSION,
  MaiaEngineContext,
} from 'src/contexts/MaiaEngineContext'
import {
  ANY_POSITION_MIN_PLY,
  fallbackEngine,
  isAbort,
  type MaiaRead,
  plyOf,
  readMaiaAt,
  remember,
} from 'src/hooks/useAnyPositionBar/useAnyPositionBar'
import {
  FALLBACK_DEPTH,
  FALLBACK_NODES,
  kidStage,
  SITE_EVAL_FINAL_DEPTH,
  SITE_EVAL_MIN_DEPTH,
  siteEvalOf,
} from 'src/hooks/useHumanBars/useHumanBars'
import { MAIA_PRIORITY } from 'src/lib/engine/maia'
import {
  HUMAN_BAR_ENGINE,
  encodeSideToMoveScore,
} from 'src/lib/engine/stockfishBatch'
import {
  anyPositionMoveMark,
  evalAfterMoveFromLine,
  fenAfterMove,
  gameOverEval,
  likelyMoves,
  moveMark,
  type MoveMark,
} from 'src/lib/humanBar'
import type { GameNode, GameTree, MaiaEngine } from 'src/types'

/**
 * The move marks (!?, ?!, ?, ??) for any move of any game (practical LOG
 * §98), wherever the players' own bars don't mark it: their practical part
 * from the any-position bar at the rating picked on the page (and the game's
 * time control), after each of the moves priced at the position before the
 * move: Maia's likely moves there, Stockfish's best and the moves played
 * from it. Offline (P99) these marks match the players' bars' on 98% of
 * moves. A move is marked once the site has searched the position before it
 * as deep as the site marks moves; the objective tiers (? and ??) show at
 * once, ?! and !? once the moves are priced. The positions before ply 10
 * keep the objective tiers only: the bar's heads saw no earlier position.
 */

/** The site marks a move once its search of the position before it is this deep (GameNode's own classification). */
const MARK_DEPTH = 12
/** Maia batches for the priced moves, kept small: the site's own Maia request waits for one in flight. */
const KID_MAIA_BATCH = 2
/** The endpoint's limit on positions per request. */
const MAX_POSITIONS = 32
const RETRY_AFTER_MS = 30000
/** Without news, how often the background queue looks again. */
const IDLE_MS = 1500

interface Priced {
  chances: Map<string, number>
  /** The depth of the eval behind each chance (deeper wins: priced again at a later kidStage). */
  depths: Map<string, number>
  likely: string[]
  /** Maia's likely moves are known (the policy was read). */
  hasLikely: boolean
}
// For the session, by the position before the move, rating and time control.
const priced = new Map<string, Priced>()
const failedAt = new Map<string, number>()

const keyOf = (fen: string, rating: number, timeControl: string | null) =>
  `${fen}|${rating}|${timeControl ?? '-'}`

/** The search of `node` deep enough to mark the moves from it, or null. */
const markingSearch = (node: GameNode) => {
  const sf = node.analysis?.stockfish
  return sf && sf.depth >= MARK_DEPTH ? sf : null
}

/**
 * The deepest eval on hand, without searching, of the position after `uci`
 * for its side to move: the position's own site eval if the move was played
 * and searched, or the site's line for the move at the position before it
 * (this page's engine, not the shared cache); null if there is none.
 */
const evalOnHand = (
  parent: GameNode,
  uci: string,
  fen: string,
  child: GameNode | undefined,
): { cp: number; depth: number } | null => {
  const over = gameOverEval(fen)
  if (over !== null) return { cp: over, depth: SITE_EVAL_FINAL_DEPTH }
  let best: { cp: number; depth: number } | null = null
  const own = child ? siteEvalOf(child) : null
  if (own) best = { cp: own.cp, depth: own.depth }
  const sf = parent.analysis?.stockfish
  if (sf && !sf.from_cache && sf.depth >= SITE_EVAL_MIN_DEPTH) {
    const line = sf.cp_vec?.[uci]
    const depth = sf.root_move_depth_vec?.[uci] ?? sf.depth
    if (
      line !== undefined &&
      Number.isFinite(line) &&
      (!best || depth > best.depth)
    ) {
      best = {
        cp: evalAfterMoveFromLine(
          line,
          sf.mate_vec?.[uci],
          fen.split(' ')[1] === 'w',
        ),
        depth,
      }
    }
  }
  return best
}

/**
 * The eval a move is priced from: the deepest on hand when it is at least as
 * deep as the bars' own search (the floor, practical LOG §98), else that
 * search.
 */
const evalAfter = async (
  parent: GameNode,
  uci: string,
  fen: string,
  child: GameNode | undefined,
  signal: AbortSignal,
): Promise<{ cp: number; depth: number }> => {
  const onHand = evalOnHand(parent, uci, fen, child)
  if (onHand && kidStage(onHand.depth) >= 1) return onHand
  const engine = await fallbackEngine()
  const result = await engine.evaluate(fen, FALLBACK_NODES, signal)
  return { cp: encodeSideToMoveScore(result), depth: FALLBACK_DEPTH }
}

/** The depth of the deepest eval on hand after `uci` (as evalOnHand, without building the position); -1 if none. */
const depthOnHand = (parent: GameNode, uci: string) => {
  const child = parent.children.find((c) => c.move === uci)
  let depth = (child ? siteEvalOf(child)?.depth : undefined) ?? -1
  const sf = parent.analysis?.stockfish
  if (sf && !sf.from_cache && sf.depth >= SITE_EVAL_MIN_DEPTH) {
    const line = sf.cp_vec?.[uci]
    if (line !== undefined && Number.isFinite(line)) {
      depth = Math.max(depth, sf.root_move_depth_vec?.[uci] ?? sf.depth)
    }
  }
  return depth
}

/** The moves priced at `parent` with a deeper eval on hand at a later stage than their chance's: priced again (deeper wins). */
const deeperOnHand = (parent: GameNode, entry: Priced) =>
  [...entry.depths].flatMap(([uci, was]) =>
    kidStage(was) < 2 && kidStage(depthOnHand(parent, uci)) > kidStage(was)
      ? [uci]
      : [],
  )

/**
 * Prices at `parent` Maia's likely moves, Stockfish's best and `moves` (those
 * not priced yet, and again those with a deeper eval on hand): their evals,
 * Maia's reads at `rating`, one request. Returns whether it got anything new
 * (the likely moves, a move's chance, or a deeper one).
 */
const priceAt = async (
  maia: NonNullable<MaiaEngine['maia']>,
  parent: GameNode,
  moves: string[],
  rating: number,
  timeControl: string | null,
  signal: AbortSignal,
  /** Resolves once the bar of the position on screen is in (searches and Maia reads wait for it). */
  yieldToBar: () => Promise<void>,
): Promise<boolean> => {
  const key = keyOf(parent.fen, rating, timeControl)
  const entry: Priced = priced.get(key) ?? {
    chances: new Map(),
    depths: new Map(),
    likely: [],
    hasLikely: false,
  }
  let progressed = !entry.hasLikely
  if (!entry.hasLikely) {
    const [read] = await readMaiaAt(maia, [parent.fen], rating, {
      policy: true,
      priority: MAIA_PRIORITY.background,
      signal,
    })
    entry.likely = likelyMoves(read.policy ?? {}).map((m) => m.uci)
    entry.hasLikely = true
  }
  const best = markingSearch(parent)?.model_move
  const again = new Set(deeperOnHand(parent, entry))
  const want = [
    ...new Set([...moves, ...(best ? [best] : []), ...entry.likely]),
  ]
    .filter((uci) => !entry.chances.has(uci) || again.has(uci))
    .slice(0, MAX_POSITIONS)
  const kids = want.flatMap((uci) => {
    const child = parent.children.find((c) => c.move === uci)
    const fen = child?.fen ?? fenAfterMove(parent.fen, uci)
    return fen ? [{ uci, fen, child }] : []
  })
  if (kids.length > 0) {
    const evals: { cp: number; depth: number }[] = []
    for (const k of kids) {
      await yieldToBar()
      evals.push(await evalAfter(parent, k.uci, k.fen, k.child, signal))
    }
    const reads: MaiaRead[] = []
    for (let i = 0; i < kids.length; i += KID_MAIA_BATCH) {
      await yieldToBar()
      reads.push(
        ...(await readMaiaAt(
          maia,
          kids.slice(i, i + KID_MAIA_BATCH).map((k) => k.fen),
          rating,
          { priority: MAIA_PRIORITY.background, signal },
        )),
      )
    }
    if (signal.aborted) return false
    const res = await fetchAnyPositionBars({
      engine: HUMAN_BAR_ENGINE,
      maia_model: MAIA_MODEL_VERSION,
      white_elo: rating,
      black_elo: rating,
      time_control: timeControl,
      positions: kids.map((k, i) => ({
        fen: k.fen,
        ply: plyOf(k.fen),
        ...evals[i],
        value: reads[i].value,
        repr: reads[i].repr,
      })),
    })
    // The bars are White / draw / Black; the mover is the side to move before the move.
    const whiteMoves = parent.fen.split(' ')[1] === 'w'
    res.positions.forEach((bar, i) => {
      if (!kids[i]) return
      const { uci } = kids[i]
      if (
        (entry.depths.get(uci) ?? -1) < evals[i].depth ||
        !entry.chances.has(uci)
      ) {
        progressed = true
      }
      entry.chances.set(uci, 100 * ((whiteMoves ? bar.W : bar.L) + bar.Dr / 2))
      entry.depths.set(uci, evals[i].depth)
    })
  }
  remember(priced, key, entry)
  return progressed
}

/** Every node of the tree, depth first from the start. */
const allNodes = (tree: GameTree) => {
  const out: GameNode[] = []
  const stack = [tree.getRoot()]
  while (stack.length > 0) {
    const node = stack.pop() as GameNode
    out.push(node)
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push(node.children[i])
    }
  }
  return out
}

/**
 * The next position to price: the moves into and out of the position on
 * screen first, then (with `background`) the main line onward from there,
 * then back, then the rest of the tree. A position is due once the site has
 * searched it deep enough to mark its moves and some move to mark there, or
 * Stockfish's best, isn't priced yet.
 */
const nextJob = (
  tree: GameTree,
  current: GameNode | undefined,
  rating: number,
  timeControl: string | null,
  background: boolean,
  covered: (node: GameNode) => boolean,
) => {
  const order: GameNode[] = []
  const seen = new Set<GameNode>()
  const add = (node: GameNode | null | undefined) => {
    if (node && !seen.has(node)) {
      seen.add(node)
      order.push(node)
    }
  }
  if (current) {
    add(current)
    current.children.forEach(add)
  }
  if (background) {
    const main = tree.getMainLine()
    let anchor: GameNode | null | undefined = current
    while (anchor && !anchor.isMainline) anchor = anchor.parent
    const at = anchor ? Math.max(0, main.indexOf(anchor)) : 0
    for (let i = at; i < main.length; i++) add(main[i])
    for (let i = at - 1; i >= 0; i--) add(main[i])
    allNodes(tree).forEach(add)
  }
  const now = Date.now()
  for (const node of order) {
    const parent = node.parent
    const move = node.move
    if (!parent || !move || covered(node)) continue
    if (plyOf(node.fen) < ANY_POSITION_MIN_PLY) continue
    const sf = markingSearch(parent)
    if (!sf) continue
    const key = keyOf(parent.fen, rating, timeControl)
    if ((failedAt.get(key) ?? 0) > now - RETRY_AFTER_MS) continue
    const entry = priced.get(key)
    const due =
      !entry ||
      !entry.hasLikely ||
      !entry.chances.has(move) ||
      (!!sf.model_move && !entry.chances.has(sf.model_move)) ||
      deeperOnHand(parent, entry).length > 0
    if (!due) continue
    // Every move from there that needs a mark, in the one request.
    const moves = parent.children.flatMap((c) =>
      c.move && !covered(c) && !entry?.chances.has(c.move) ? [c.move] : [],
    )
    return { parent, moves, key }
  }
  return null
}

/**
 * The marks of `tree`'s moves at `rating` (both players) and `timeControl`
 * ("base+inc" or null), for the moves `covered` doesn't hand to the players'
 * own bars. `background`: also price the moves away from the position on
 * screen (off on phones, where nothing may slow Stockfish). `hold`: the bar of
 * the position on screen is on its way; nothing new starts until it is in.
 * `markOf(node)` is
 * the move into `node`'s mark, null for none, undefined while the site has
 * not searched the position before it deep enough (then the site's own
 * classification shows, as it would).
 */
export const useAnyPositionMarks = (
  tree: GameTree,
  current: GameNode | undefined,
  rating: number | null,
  timeControl: string | null,
  enabled: boolean,
  background: boolean,
  covered: (node: GameNode) => boolean,
  hold = false,
) => {
  const maia = useContext(MaiaEngineContext)
  const [revision, bump] = useReducer((x: number) => x + 1, 0)
  const on = enabled && !!getHumanBarBaseUrl() && rating !== null
  const maiaReady = maia.status === 'ready' && !!maia.maia
  const currentRef = useRef(current)
  currentRef.current = current
  const coveredRef = useRef(covered)
  coveredRef.current = covered
  const holdRef = useRef(hold)
  holdRef.current = hold
  const wakeRef = useRef<(() => void) | null>(null)
  // Searches finish between renders: look at the queue again on each one.
  useEffect(() => {
    wakeRef.current?.()
  })

  useEffect(() => {
    if (!on || !maiaReady || rating === null || !maia.maia) return
    const engine = maia.maia
    const controller = new AbortController()
    const { signal } = controller
    const idle = () =>
      new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer)
          if (wakeRef.current === done) wakeRef.current = null
          resolve()
        }
        const timer = setTimeout(done, IDLE_MS)
        wakeRef.current = done
      })
    // A job under way pauses between its searches and Maia reads while the
    // bar of the position on screen is on its way (they share the CPU).
    const yieldToBar = async () => {
      while (holdRef.current && !signal.aborted) await idle()
    }
    const loop = async () => {
      while (!signal.aborted) {
        if (holdRef.current) {
          await idle()
          continue
        }
        const job = nextJob(
          tree,
          currentRef.current,
          rating,
          timeControl,
          background,
          coveredRef.current,
        )
        if (!job) {
          await idle()
          continue
        }
        try {
          const progressed = await priceAt(
            engine,
            job.parent,
            job.moves,
            rating,
            timeControl,
            signal,
            yieldToBar,
          )
          if (signal.aborted) return
          // A round that added nothing (a move that makes no position)
          // waits like a failure rather than coming round again at once.
          if (progressed) failedAt.delete(job.key)
          else failedAt.set(job.key, Date.now())
        } catch (error) {
          if (signal.aborted || isAbort(error)) return
          failedAt.set(job.key, Date.now())
          console.warn('[any-position marks] pricing failed:', error)
        }
        bump()
      }
    }
    void loop()
    return () => {
      controller.abort()
      wakeRef.current?.()
    }
  }, [on, maiaReady, maia.maia, rating, timeControl, background, tree])

  const markOf = useCallback(
    (node: GameNode): MoveMark | null | undefined => {
      if (!on || rating === null) return undefined
      const parent = node.parent
      const move = node.move
      if (!parent || !move) return undefined
      const sf = markingSearch(parent)
      const loss = sf?.winrate_loss_vec?.[move]
      if (!sf || loss === undefined || !Number.isFinite(loss)) return undefined
      const objective = Math.abs(loss) * 100
      if (plyOf(node.fen) < ANY_POSITION_MIN_PLY) return moveMark(objective)
      return anyPositionMoveMark(
        objective,
        move,
        sf.model_move,
        priced.get(keyOf(parent.fen, rating, timeControl)),
      )
    },
    // revision: the priced moves change in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [on, rating, timeControl, revision],
  )

  return useMemo(() => ({ on, markOf }), [on, markOf])
}
