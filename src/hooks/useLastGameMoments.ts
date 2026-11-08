import { useContext, useEffect, useRef, useState } from 'react'
import { MaiaEngineContext } from 'src/contexts/MaiaEngineContext'
import { StockfishEngineContext } from 'src/contexts/StockfishEngineContext'
import { retrieveGameAnalysisCache } from 'src/api/analysis'
import { applyEngineAnalysisData } from 'src/lib/analysis'
import { parseLichessPgn } from 'src/lib/lichess'
import { GameNode, GameTree } from 'src/types'
import {
  LastLichessGame,
  fetchLastLichessGame,
} from 'src/lib/personal/lastLichessGame'
import {
  KeyMoment,
  findKeyMoments,
  nearestMaiaRating,
  playerMoveNodes,
  isAnalysed,
  withMaiaShares,
} from 'src/lib/personal/keyMoments'
import {
  AnalysisProgress,
  addMaiaAnalysis,
  analysePlayerMoves,
  saveGameAnalysis,
} from 'src/lib/personal/analyzeGame'
import {
  GameMoments,
  loadGameMoments,
  saveGameMoments,
} from 'src/lib/personal/momentStore'

export type LastGameState =
  | { status: 'loading' }
  | { status: 'no_game' }
  | { status: 'error' }
  | { status: 'analyzing'; game: LastLichessGame; progress: AnalysisProgress }
  | { status: 'engine_error'; game: LastLichessGame }
  | { status: 'done'; game: LastLichessGame; entry: GameMoments }

const momentsWithMaia = (
  tree: GameTree,
  moments: KeyMoment[],
  rating: number,
) => {
  const mainLine = tree.getMainLine()
  return moments.map((moment) =>
    withMaiaShares(
      moment,
      mainLine[moment.moveIndex - 1]?.analysis.maia,
      rating,
    ),
  )
}

/**
 * The visitor's last Lichess game and its key moments: from this browser's
 * copy when the game was analysed before, else from the analysis saved with
 * the backend, else analysed here with Stockfish (the positions before the
 * visitor's moves only) and saved. With Maia's model in this browser, each
 * moment also says what players at the visitor's rating play there; a game
 * analysed without it gets that once the model is there.
 */
export const useLastGameMoments = (lichessId: string | undefined) => {
  const stockfish = useContext(StockfishEngineContext)
  const maia = useContext(MaiaEngineContext)
  const [state, setState] = useState<LastGameState>({ status: 'loading' })
  const [game, setGame] = useState<LastLichessGame | null>(null)
  const tree = useRef<{ gameId: string; tree: GameTree } | null>(null)

  useEffect(() => {
    if (!lichessId) return
    let canceled = false
    fetchLastLichessGame(lichessId)
      .then((found) => {
        if (canceled) return
        if (!found) setState({ status: 'no_game' })
        setGame(found)
      })
      .catch(() => {
        if (!canceled) setState({ status: 'error' })
      })
    return () => {
      canceled = true
    }
  }, [lichessId])

  const maiaSettled = maia.status !== 'loading' && maia.status !== 'downloading'
  const maiaReady = maia.status === 'ready' && !!maia.maia

  useEffect(() => {
    if (!game) return
    const controller = new AbortController()
    const { signal } = controller
    const rating = nearestMaiaRating(game.userRating)

    const run = async () => {
      const kept = loadGameMoments(game.id)
      if (kept && (kept.usedMaia || !maiaReady)) {
        setState({ status: 'done', game, entry: kept })
        return
      }

      if (!tree.current || tree.current.gameId !== game.id) {
        const parsed = parseLichessPgn(game.id, game.pgn)
        if (!parsed) {
          setState({ status: 'no_game' })
          return
        }
        tree.current = { gameId: game.id, tree: parsed.tree }
        const stored = await retrieveGameAnalysisCache(game.id).catch(
          () => null,
        )
        if (signal.aborted) return
        if (stored?.positions?.length) {
          applyEngineAnalysisData(parsed.tree, stored.positions)
        }
      }
      const gameTree = tree.current.tree
      const nodes = playerMoveNodes(gameTree, game.userColor)
      let changed = false

      if (!nodes.every((node) => isAnalysed(node))) {
        if (stockfish.status === 'error') {
          setState({ status: 'engine_error', game })
          return
        }
        setState({
          status: 'analyzing',
          game,
          progress: {
            done: nodes.filter((node) => isAnalysed(node)).length,
            total: nodes.length,
          },
        })
        if (!stockfish.isReady()) return // runs again when it is
        const complete = await analysePlayerMoves(
          gameTree,
          game.userColor,
          stockfish,
          {
            signal,
            onProgress: (progress) => {
              if (!signal.aborted) {
                setState({ status: 'analyzing', game, progress })
              }
            },
          },
        )
        if (!complete || signal.aborted) return
        changed = true
      }

      // What players at the visitor's level do, once Maia has settled (its
      // model loads from this browser, or isn't there).
      if (!maiaSettled) return
      let moments = findKeyMoments(gameTree, game.userColor)
      if (maiaReady && maia.maia) {
        const mainLine = gameTree.getMainLine()
        await addMaiaAnalysis(
          moments.map((m) => mainLine[m.moveIndex - 1] as GameNode),
          maia.maia,
        )
        if (signal.aborted) return
        moments = momentsWithMaia(gameTree, moments, rating)
        changed = true
      }

      const entry: GameMoments = {
        gameId: game.id,
        gameType: 'lichess',
        color: game.userColor,
        moments,
        usedMaia: maiaReady,
        opponentRating: game.opponentRating,
        savedAt: Date.now(),
      }
      saveGameMoments(entry)
      setState({ status: 'done', game, entry })
      if (changed) {
        saveGameAnalysis(game.id, gameTree).catch((error) =>
          console.warn('Failed to save the game analysis:', error),
        )
      }
    }

    run().catch((error) => {
      if (signal.aborted) return
      console.error('Last game analysis failed:', error)
      setState({ status: 'engine_error', game })
    })

    return () => {
      controller.abort()
      stockfish.stopEvaluation()
    }
  }, [game, stockfish.status, maiaSettled, maiaReady])

  return { state, maia }
}
