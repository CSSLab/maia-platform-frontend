import { useContext, useEffect, useState } from 'react'
import { AuthContext } from 'src/contexts/AuthContext'
import { StockfishEngineContext } from 'src/contexts/StockfishEngineContext'
import {
  fetchAnalyzedMaiaGame,
  fetchPgnOfLichessGame,
  retrieveGameAnalysisCache,
} from 'src/api/analysis'
import { applyEngineAnalysisData } from 'src/lib/analysis'
import { parseLichessPgn } from 'src/lib/lichess'
import { GameTree } from 'src/types'
import { findKeyMoments } from 'src/lib/personal/keyMoments'
import {
  AnalysisProgress,
  analysePlayerMoves,
  saveGameAnalysis,
} from 'src/lib/personal/analyzeGame'
import {
  GameMoments,
  loadGameMoments,
  saveGameMoments,
} from 'src/lib/personal/momentStore'
import {
  POSITIONS_PER_DAY,
  PracticeDay,
  loadPracticeDay,
  practicePool,
} from 'src/lib/personal/practiceStore'
import { gatherEarlierGames } from 'src/lib/personal/practice'

export interface PracticeSource {
  gameId: string
  gameType: 'play' | 'hand' | 'brain' | 'lichess'
  color: 'white' | 'black'
}

export type PracticeDayState =
  | { status: 'preparing'; progress?: AnalysisProgress }
  | {
      status: 'ready'
      day: PracticeDay
      /** The game named in the address, once analysed. */
      source?: GameMoments
    }
  | { status: 'error' }

const loadTree = async (source: PracticeSource): Promise<GameTree | null> => {
  if (source.gameType === 'lichess') {
    const pgn = await fetchPgnOfLichessGame(source.gameId)
    return parseLichessPgn(source.gameId, pgn)?.tree ?? null
  }
  return (await fetchAnalyzedMaiaGame(source.gameId, source.gameType)).tree
}

/**
 * Today's practice positions. A game named in the address (the end of a game
 * against Maia) is analysed first, here, and its mistakes come first; for a
 * Lichess-linked visitor short of positions, earlier games with saved
 * analysis are looked through.
 */
export const usePracticeDay = (source: PracticeSource | null | undefined) => {
  const stockfish = useContext(StockfishEngineContext)
  const { user } = useContext(AuthContext)
  const [state, setState] = useState<PracticeDayState>({
    status: 'preparing',
  })

  // `undefined`: the address isn't read yet.
  const sourceKey = source === undefined ? undefined : JSON.stringify(source)
  const lichessId = user?.lichessId
  const accountKnown = !!user

  useEffect(() => {
    if (sourceKey === undefined || !accountKnown) return
    const controller = new AbortController()
    const { signal } = controller

    const prepareSource = async (): Promise<GameMoments | undefined> => {
      if (!source) return undefined
      const kept = loadGameMoments(source.gameId)
      if (kept) return kept
      const tree = await loadTree(source)
      if (!tree || signal.aborted) return undefined
      const stored = await retrieveGameAnalysisCache(source.gameId).catch(
        () => null,
      )
      if (stored?.positions?.length) {
        applyEngineAnalysisData(tree, stored.positions)
      }
      if (stockfish.status === 'error')
        throw new Error("Stockfish couldn't load")
      if (!stockfish.isReady()) throw new Error('waiting for Stockfish')
      const complete = await analysePlayerMoves(tree, source.color, stockfish, {
        signal,
        onProgress: (progress) => {
          if (!signal.aborted) setState({ status: 'preparing', progress })
        },
      })
      if (!complete || signal.aborted) return undefined
      const entry: GameMoments = {
        gameId: source.gameId,
        gameType: source.gameType,
        color: source.color,
        moments: findKeyMoments(tree, source.color),
        usedMaia: false,
        savedAt: Date.now(),
      }
      saveGameMoments(entry)
      saveGameAnalysis(source.gameId, tree).catch((error) =>
        console.warn('Failed to save the game analysis:', error),
      )
      return entry
    }

    const run = async () => {
      const first = await prepareSource()
      if (signal.aborted) return
      if (lichessId && practicePool(first).length < POSITIONS_PER_DAY) {
        await gatherEarlierGames(lichessId).catch((error) =>
          console.warn('Earlier games could not be looked through:', error),
        )
        if (signal.aborted) return
      }
      setState({ status: 'ready', day: loadPracticeDay(first), source: first })
    }

    run().catch((error) => {
      if (signal.aborted) return
      // Stockfish still loading: this runs again when it's ready.
      if (error instanceof Error && error.message === 'waiting for Stockfish') {
        return
      }
      console.error('Practice could not be prepared:', error)
      setState({ status: 'error' })
    })

    return () => {
      controller.abort()
      stockfish.stopEvaluation()
    }
  }, [sourceKey, accountKnown, lichessId, stockfish.status])

  return state
}
