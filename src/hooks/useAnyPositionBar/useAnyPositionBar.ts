import { useContext, useEffect, useReducer } from 'react'
import { fetchAnyPositionBars, getHumanBarBaseUrl } from 'src/api/humanBar'
import {
  MAIA_MODEL_VERSION,
  MaiaEngineContext,
} from 'src/contexts/MaiaEngineContext'
import {
  FALLBACK_DEPTH,
  FALLBACK_NODES,
  SITE_EVAL_FINAL_DEPTH,
  siteEvalOf,
} from 'src/hooks/useHumanBars/useHumanBars'
import { MAIA_PRIORITY } from 'src/lib/engine/maia'
import {
  HUMAN_BAR_ENGINE,
  encodeSideToMoveScore,
  getBatchStockfish,
} from 'src/lib/engine/stockfishBatch'
import { float32ToBase64LE, gameOverEval } from 'src/lib/humanBar'
import type { AnyPositionBar, GameNode } from 'src/types'

/**
 * The any-position bar (practical LOG §96-97): Maia's chances of White, a
 * draw and Black for players of the rating picked on the page, from the
 * position alone (its eval, move number and material, and Maia's read at
 * that rating) plus the game's time control when it has one. No clocks and
 * no player history, so it works for any game and any position; the page
 * shows it wherever the players' own bars (useHumanBars) don't run.
 */

/** The bar's heads saw no earlier position; the page keeps its opening rule there. */
export const ANY_POSITION_MIN_PLY = 10
/** How long the position on screen waits for the site's own search before searching itself. */
const SITE_EVAL_WAIT_MS = 2000
/** After a failed request, how long before the same position is asked for again. */
const RETRY_AFTER_MS = 30000
const MAX_CACHED = 2000

interface Entry {
  bar: AnyPositionBar
  /** The depth of the eval behind it (FALLBACK_DEPTH for the bar's own search). */
  depth: number
}
// For the session: by position, rating and time control (bars), and by
// position and rating (Maia's read), so stepping back or changing the
// rating back finds them at once.
const bars = new Map<string, Entry>()
const maiaReads = new Map<
  string,
  { value: [number, number, number]; repr: string }
>()
const failedAt = new Map<string, number>()

const remember = <V>(map: Map<string, V>, key: string, value: V) => {
  map.delete(key)
  map.set(key, value)
  if (map.size > MAX_CACHED) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
}

let fallbackReady: Promise<void> | null = null
const fallbackEngine = async () => {
  const engine = getBatchStockfish()
  if (!fallbackReady) fallbackReady = engine.newGame()
  await fallbackReady
  return engine
}

/**
 * Plies from the start, from the FEN's full-move number and side to move.
 * (Not GameNode.moveNumber: that is the number of the move just played, so
 * with White to move it is one less than the FEN's.)
 */
export const plyOf = (fen: string) => {
  const [, turn, , , , full] = fen.split(' ')
  const n = Number.parseInt(full ?? '', 10)
  return (Number.isFinite(n) && n > 0 ? n - 1 : 0) * 2 + (turn === 'b' ? 1 : 0)
}

/**
 * The site won't search a position whose cached eval is at its final depth,
 * and the bars don't take cached evals (the cache doesn't say which engine
 * made them): such a position gets the bar's own search.
 */
const cachedOnly = (node: GameNode) => {
  const sf = node.analysis?.stockfish
  return !!sf?.from_cache && !sf.partial && sf.depth >= SITE_EVAL_FINAL_DEPTH
}

const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

/**
 * The any-position bar of `node` at `rating`, with `timeControl` ("base+inc",
 * or null). `bar` is null until it is in; `expected` says one is on its way
 * (the page then keeps its last reading rather than showing another
 * model's number).
 */
export const useAnyPositionBar = (
  node: GameNode | undefined,
  rating: number | null,
  timeControl: string | null,
  enabled: boolean,
) => {
  const maia = useContext(MaiaEngineContext)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const fen = node?.fen
  const ply = node ? plyOf(node.fen) : -1
  const key =
    enabled &&
    getHumanBarBaseUrl() &&
    node &&
    rating !== null &&
    ply >= ANY_POSITION_MIN_PLY
      ? `${fen}|${rating}|${timeControl ?? '-'}`
      : null
  const site = key ? siteEvalOf(node) : null
  // Asked for again once the site's eval reaches its final depth.
  const siteStage = site ? (site.depth >= SITE_EVAL_FINAL_DEPTH ? 2 : 1) : 0
  const searchHere = key && node ? cachedOnly(node) : false
  const maiaReady = maia.status === 'ready' && !!maia.maia

  useEffect(() => {
    if (!key || !node || !fen || rating === null || !maiaReady) return
    const have = bars.get(key)
    if (have && (have.depth >= SITE_EVAL_FINAL_DEPTH || !site)) return
    if (have && site && site.depth <= have.depth) return
    if ((failedAt.get(key) ?? 0) > Date.now() - RETRY_AFTER_MS) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async (evaluation: { cp: number; depth: number }) => {
      try {
        const readKey = `${fen}|${rating}`
        let read = maiaReads.get(readKey)
        if (!read) {
          const [out] = await maia.maia!.batchEvaluateMaia3Raw(
            [fen],
            [rating],
            [rating],
            { priority: MAIA_PRIORITY.normal, signal: controller.signal },
          )
          if (!out?.repr) throw new Error('The Maia model has no repr output')
          read = { value: out.value, repr: float32ToBase64LE(out.repr) }
          remember(maiaReads, readKey, read)
        }
        if (controller.signal.aborted) return
        const res = await fetchAnyPositionBars({
          engine: HUMAN_BAR_ENGINE,
          maia_model: MAIA_MODEL_VERSION,
          white_elo: rating,
          black_elo: rating,
          time_control: timeControl,
          positions: [{ fen, ply, ...evaluation, ...read }],
        })
        const bar = res.positions[0]
        if (!bar) throw new Error('No bar in the answer')
        // Kept even if the page has moved on: stepping back finds it.
        remember(bars, key, { bar, depth: evaluation.depth })
        failedAt.delete(key)
        bump()
      } catch (error) {
        if (isAbort(error)) return
        failedAt.set(key, Date.now())
        bump()
      }
    }

    const searchItself = async () => {
      try {
        const engine = await fallbackEngine()
        const result = await engine.evaluate(
          fen,
          FALLBACK_NODES,
          controller.signal,
        )
        if (!controller.signal.aborted)
          await run({
            cp: encodeSideToMoveScore(result),
            depth: FALLBACK_DEPTH,
          })
      } catch (error) {
        if (!isAbort(error)) {
          failedAt.set(key, Date.now())
          bump()
        }
      }
    }

    const over = gameOverEval(fen)
    if (over !== null) void run({ cp: over, depth: SITE_EVAL_FINAL_DEPTH })
    else if (site) void run({ cp: site.cp, depth: site.depth })
    else if (!have) {
      if (searchHere) void searchItself()
      else timer = setTimeout(() => void searchItself(), SITE_EVAL_WAIT_MS)
    }
    return () => {
      controller.abort()
      if (timer !== undefined) clearTimeout(timer)
    }
    // `site` is read through siteStage: a deeper eval within a stage isn't asked for again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, siteStage, searchHere, maiaReady, maia.maia, timeControl, rating])

  const entry = key ? bars.get(key) : undefined
  const failed = key
    ? (failedAt.get(key) ?? 0) > Date.now() - RETRY_AFTER_MS
    : false
  return {
    bar: entry?.bar ?? null,
    expected: !!key && !entry && !failed && maia.status !== 'error',
  }
}
