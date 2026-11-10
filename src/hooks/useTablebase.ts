import { useEffect, useState } from 'react'

import {
  isTablebasePosition,
  tablebaseClient,
  TablebaseClient,
  TablebaseResult,
} from 'src/lib/tablebase'

/**
 * Holding an arrow key steps through a position every ~30 ms; only the one
 * the user stops on is looked up.
 */
export const TABLEBASE_DEBOUNCE_MS = 200

/**
 * The Lichess tablebase's result for the position, or null while it loads,
 * when the position has too many pieces, when `enabled` is false, or when
 * the lookup fails (the panel then just shows no tablebase line).
 */
export const useTablebase = (
  fen: string | undefined,
  enabled: boolean,
  client: TablebaseClient = tablebaseClient,
): TablebaseResult | null => {
  const eligible = enabled && !!fen && isTablebasePosition(fen)
  const [fetched, setFetched] = useState<{
    fen: string
    result: TablebaseResult | null
  } | null>(null)

  useEffect(() => {
    if (!eligible || !fen || client.peek(fen) !== undefined) return

    const controller = new AbortController()
    const timer = setTimeout(() => {
      client
        .lookup(fen, controller.signal)
        .then((result) => {
          // A lookup that was already sent finishes (and is cached) even
          // after the position changes; it just isn't shown.
          if (!controller.signal.aborted) setFetched({ fen, result })
        })
        .catch(() => {
          // Offline, rate-limited or a stale lookup: no tablebase line.
        })
    }, TABLEBASE_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [client, eligible, fen])

  if (!eligible || !fen) return null
  if (fetched?.fen === fen) return fetched.result
  // Positions already looked up show at once, without the debounce.
  return client.peek(fen) ?? null
}
