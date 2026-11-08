import { useContext, useEffect, useState } from 'react'
import { AuthContext } from 'src/contexts/AuthContext'
import { StockfishEngineContext } from 'src/contexts/StockfishEngineContext'
import { MaiaEngineContext } from 'src/contexts/MaiaEngineContext'
import {
  fetchAnalyzedMaiaGame,
  fetchPgnOfLichessGame,
  retrieveGameAnalysisCache,
} from 'src/api/analysis'
import { applyEngineAnalysisData } from 'src/lib/analysis'
import { parseLichessPgn } from 'src/lib/lichess'
import { GameTree } from 'src/types'
import { MAX_KEPT_MISTAKES, findKeyMoments } from 'src/lib/personal/keyMoments'
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
import { PracticeDay, loadPracticeDay } from 'src/lib/personal/practiceStore'
import { addMaiaViews, gatherEarlierGames } from 'src/lib/personal/practice'

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
      /**
       * Maia's model isn't in this browser, so the positions weren't checked
       * for being fixable at the visitor's level.
       */
      withoutMaia: boolean
    }
  | { status: 'error' }

const loadGame = async (
  source: PracticeSource,
): Promise<{ tree: GameTree; playerRating?: number } | null> => {
  if (source.gameType === 'lichess') {
    const pgn = await fetchPgnOfLichessGame(source.gameId)
    const tree = parseLichessPgn(source.gameId, pgn)?.tree
    return tree ? { tree } : null
  }
  const game = await fetchAnalyzedMaiaGame(source.gameId, source.gameType)
  const player = source.color === 'white' ? game.whitePlayer : game.blackPlayer
  return { tree: game.tree, playerRating: player?.rating }
}

/**
 * Today's practice positions, from as many of the visitor's games as there
 * are. A game named in the address (the end of a game against Maia) is
 * analysed first, here, and leads; a Lichess-linked visitor's earlier games
 * with saved analysis are looked through once a day. With Maia's model in
 * this browser, only mistakes players at the visitor's level can fix.
 */
export const usePracticeDay = (source: PracticeSource | null | undefined) => {
  const stockfish = useContext(StockfishEngineContext)
  const maia = useContext(MaiaEngineContext)
  const { user } = useContext(AuthContext)
  const [state, setState] = useState<PracticeDayState>({
    status: 'preparing',
  })

  // `undefined`: the address isn't read yet.
  const sourceKey = source === undefined ? undefined : JSON.stringify(source)
  const lichessId = user?.lichessId
  const accountKnown = !!user
  const maiaSettled = maia.status !== 'loading' && maia.status !== 'downloading'
  const maiaReady = maia.status === 'ready' && !!maia.maia

  useEffect(() => {
    if (sourceKey === undefined || !accountKnown) return
    const controller = new AbortController()
    const { signal } = controller

    const prepareSource = async (): Promise<GameMoments | undefined> => {
      if (!source) return undefined
      const kept = loadGameMoments(source.gameId)
      if (kept) return kept
      const loaded = await loadGame(source)
      if (!loaded || signal.aborted) return undefined
      const { tree } = loaded
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
        moments: findKeyMoments(tree, source.color, MAX_KEPT_MISTAKES),
        usedMaia: false,
        playerRating: loaded.playerRating,
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
      if (lichessId) {
        await gatherEarlierGames(lichessId).catch((error) =>
          console.warn('Earlier games could not be looked through:', error),
        )
        if (signal.aborted) return
      }
      // Maia's model loads from this browser, or isn't there.
      if (!maiaSettled) return
      if (maiaReady && maia.maia) {
        await addMaiaViews(maia.maia, first, signal)
        if (signal.aborted) return
      }
      const fresh = first ? (loadGameMoments(first.gameId) ?? first) : first
      setState({
        status: 'ready',
        day: loadPracticeDay(fresh),
        source: fresh,
        withoutMaia: !maiaReady,
      })
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
  }, [
    sourceKey,
    accountKnown,
    lichessId,
    stockfish.status,
    maiaSettled,
    maiaReady,
  ])

  return { state, maia }
}
