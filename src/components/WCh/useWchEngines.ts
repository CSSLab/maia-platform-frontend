import { useContext, useEffect, useReducer, useRef } from 'react'
import { Chess } from 'chess.ts'

import { fetchAnyPositionBars } from 'src/api/humanBar'
import {
  MAIA_MODEL_VERSION,
  MaiaEngineContext,
} from 'src/contexts/MaiaEngineContext'
import { StockfishEngineContext } from 'src/contexts/StockfishEngineContext'
import {
  MaiaRead,
  fallbackEngine,
  isAbort,
  plyOf,
  readMaiaAt,
  ANY_POSITION_MIN_PLY,
} from 'src/hooks/useAnyPositionBar/useAnyPositionBar'
import {
  FALLBACK_DEPTH,
  FALLBACK_NODES,
} from 'src/hooks/useHumanBars/useHumanBars'
import { MAIA_PRIORITY } from 'src/lib/engine/maia'
import {
  HUMAN_BAR_ENGINE,
  encodeSideToMoveScore,
} from 'src/lib/engine/stockfishBatch'
import { gameOverEval } from 'src/lib/humanBar'

/**
 * The rating Maia plays at here: the top of the site's Maia. (The players'
 * own models aren't public yet.)
 */
export const LIVE_MAIA_ELO = 2600
export const LIVE_RATING_BANDS = [1100, 1500, 1900, 2300, 2600]

export interface PositionInfo {
  /** Maia's read at LIVE_MAIA_ELO (move probabilities by UCI move). */
  read?: MaiaRead
  /** The node-limited search: side-to-move centipawns and best move. */
  cpStm?: number
  best?: string | null
  /** Maia's chances: White wins, draw, Black wins. */
  bar?: { W: number; D: number; B: number }
}

export interface FocusEval {
  fen: string
  /** Centipawns from White's side, by UCI move. */
  cpVec: Record<string, number>
  best: string | null
  depth: number
}

const BAR_BATCH = 16
const MAIA_BATCH = 8
const FOCUS_DEPTH = 16

/**
 * Maia (in the browser) and Stockfish on the game's positions: the position
 * on screen first, then the rest, latest first. Each position gets Maia's
 * move probabilities, a quick Stockfish search (eval and best move) and
 * Maia's win chances from the bars server; the position on screen also gets
 * a full search of every move. Separately, and with or without the feed,
 * Maia's read of `ratingFen` at each of `ratingBands` (the By rating tab),
 * once the browser has Maia.
 */
export const useWchEngines = (opts: {
  enabled: boolean
  fens: string[]
  focusFen: string | null
  /** "base+inc" for the bars, or null. */
  timeControl: string | null
  /** The position to read at each rating (null: none). */
  ratingFen?: string | null
  ratingBands?: number[]
}) => {
  const { enabled, fens, focusFen, timeControl } = opts
  const ratingFen = opts.ratingFen ?? null
  const ratingBands = opts.ratingBands ?? LIVE_RATING_BANDS
  const ratingKey = (fen: string) => `${fen}|${ratingBands.join(',')}`
  const maia = useContext(MaiaEngineContext)
  const stockfish = useContext(StockfishEngineContext)
  const [version, bump] = useReducer((x: number) => x + 1, 0)
  const info = useRef(new Map<string, PositionInfo>())
  const barFailed = useRef(new Set<string>())
  const focus = useRef<FocusEval | null>(null)
  const byRating = useRef(new Map<string, MaiaRead[]>())
  const maiaReady = maia.status === 'ready' && !!maia.maia
  const fensKey = fens.join('|')

  const get = (fen: string) => {
    let i = info.current.get(fen)
    if (!i) {
      i = {}
      info.current.set(fen, i)
    }
    return i
  }

  // Background: Maia reads, quick searches, bars.
  useEffect(() => {
    if (!enabled) return
    let stopped = false
    const controller = new AbortController()
    const order = () => {
      const rest = [...fens].reverse().filter((f) => f !== focusFen)
      return focusFen ? [focusFen, ...rest] : rest
    }
    const loop = async () => {
      while (!stopped) {
        const all = order()
        try {
          if (maiaReady) {
            const needMaia = all
              .filter((f) => !get(f).read)
              .slice(0, MAIA_BATCH)
            if (needMaia.length) {
              const reads = await readMaiaAt(
                maia.maia!,
                needMaia,
                LIVE_MAIA_ELO,
                {
                  policy: true,
                  priority:
                    needMaia[0] === focusFen
                      ? MAIA_PRIORITY.normal
                      : MAIA_PRIORITY.background,
                  signal: controller.signal,
                },
              )
              reads.forEach((r, k) => (get(needMaia[k]).read = r))
              bump()
              continue
            }
          }
          const needSf = all.find((f) => get(f).cpStm === undefined)
          if (needSf) {
            const over = gameOverEval(needSf)
            if (over !== null) {
              get(needSf).cpStm = over
              get(needSf).best = null
            } else {
              const engine = await fallbackEngine()
              const r = await engine.evaluate(
                needSf,
                FALLBACK_NODES,
                controller.signal,
              )
              get(needSf).cpStm = encodeSideToMoveScore(r)
              get(needSf).best = r.bestmove
            }
            bump()
            continue
          }
          if (maiaReady) {
            const needBar = all
              .filter((f) => {
                const i = get(f)
                return (
                  plyOf(f) >= ANY_POSITION_MIN_PLY &&
                  !i.bar &&
                  i.read &&
                  i.cpStm !== undefined &&
                  !barFailed.current.has(f)
                )
              })
              .slice(0, BAR_BATCH)
            if (needBar.length) {
              try {
                const res = await fetchAnyPositionBars({
                  engine: HUMAN_BAR_ENGINE,
                  maia_model: MAIA_MODEL_VERSION,
                  white_elo: LIVE_MAIA_ELO,
                  black_elo: LIVE_MAIA_ELO,
                  time_control: timeControl,
                  positions: needBar.map((fen) => {
                    const i = get(fen)
                    return {
                      fen,
                      ply: plyOf(fen),
                      cp: i.cpStm!,
                      depth: FALLBACK_DEPTH,
                      value: i.read!.value,
                      repr: i.read!.repr,
                    }
                  }),
                })
                res.positions.forEach((b, k) => {
                  if (b) get(needBar[k]).bar = { W: b.W, D: b.Dr, B: b.L }
                })
              } catch (e) {
                if (isAbort(e)) return
                needBar.forEach((f) => barFailed.current.add(f))
              }
              bump()
              continue
            }
          }
          return
        } catch (e) {
          if (isAbort(e) || stopped) return
          // Leave it for the next change rather than spinning.
          return
        }
      }
    }
    void loop()
    return () => {
      stopped = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fensKey, focusFen, maiaReady, timeControl])

  // The position on screen, at each rating.
  useEffect(() => {
    if (!ratingFen || !maiaReady) return
    const key = ratingKey(ratingFen)
    if (byRating.current.has(key)) return
    const controller = new AbortController()
    void Promise.all(
      ratingBands.map((elo) =>
        readMaiaAt(maia.maia!, [ratingFen], elo, {
          policy: true,
          priority: MAIA_PRIORITY.normal,
          signal: controller.signal,
        }).then((r) => r[0]),
      ),
    )
      .then((reads) => {
        byRating.current.set(key, reads)
        bump()
      })
      .catch(() => {
        // Stopped, or Maia failed: the tab says what it has.
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingFen, ratingBands.join(','), maiaReady])

  // The position on screen: every legal move searched.
  useEffect(() => {
    if (!enabled || !focusFen || stockfish.status !== 'ready') return
    if (focus.current?.fen === focusFen && focus.current.depth >= FOCUS_DEPTH)
      return
    const legal = new Chess(focusFen).moves().length
    if (legal === 0) return
    const stream = stockfish.streamEvaluations(focusFen, legal, FOCUS_DEPTH)
    if (!stream) return
    let stopped = false
    let last = 0
    void (async () => {
      try {
        for await (const ev of stream) {
          if (stopped) break
          focus.current = {
            fen: focusFen,
            cpVec: { ...ev.cp_vec },
            best: ev.model_move ?? null,
            depth: ev.depth,
          }
          const now = Date.now()
          if (now - last > 300) {
            last = now
            bump()
          }
        }
        bump()
      } catch {
        // A stopped search ends here.
      }
    })()
    return () => {
      stopped = true
      stockfish.stopEvaluation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, focusFen, stockfish.status])

  return {
    version,
    maiaStatus: maia.status,
    info: (fen: string) => info.current.get(fen),
    focusEval: (fen: string) =>
      focus.current?.fen === fen ? focus.current : null,
    byRating: (fen: string) => byRating.current.get(ratingKey(fen)) ?? null,
  }
}
