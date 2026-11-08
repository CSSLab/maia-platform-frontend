import { useContext, useEffect, useRef, useState } from 'react'
import { MaiaEngineContext } from 'src/contexts/MaiaEngineContext'
import { StockfishEngineContext } from 'src/contexts/StockfishEngineContext'
import { retrieveGameAnalysisCache } from 'src/api/analysis'
import { applyEngineAnalysisData } from 'src/lib/analysis'
import { parseLichessPgn } from 'src/lib/lichess'
import { GameTree } from 'src/types'
import {
  LastLichessGame,
  fetchLastLichessGame,
} from 'src/lib/personal/lastLichessGame'
import {
  KeyMoment,
  MAX_KEPT_MISTAKES,
  findKeyMoments,
  isAnalysed,
  nearestMaiaRating,
  playerMoveNodes,
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
  /** Not analysed yet: the card offers to. */
  | { status: 'not_analysed'; game: LastLichessGame }
  | { status: 'done'; game: LastLichessGame; entry: GameMoments }

// The game's moves with the analysis the backend has saved for it, read once
// a page.
const trees = new Map<string, Promise<GameTree | null>>()

const loadGameTree = (game: LastLichessGame) => {
  let tree = trees.get(game.id)
  if (!tree) {
    tree = (async () => {
      const parsed = parseLichessPgn(game.id, game.pgn)
      if (!parsed) return null
      const stored = await retrieveGameAnalysisCache(game.id).catch(() => null)
      if (stored?.positions?.length) {
        applyEngineAnalysisData(parsed.tree, stored.positions)
      }
      return parsed.tree
    })()
    tree.catch(() => trees.delete(game.id))
    trees.set(game.id, tree)
  }
  return tree
}

/**
 * The game's mistakes from its analysis, with what players at the visitor's
 * rating play there where Maia's analysis is in it.
 */
const entryOf = (game: LastLichessGame, tree: GameTree): GameMoments => {
  const rating = nearestMaiaRating(game.userRating)
  const mainLine = tree.getMainLine()
  const moments = findKeyMoments(tree, game.userColor, MAX_KEPT_MISTAKES).map(
    (moment) =>
      withMaiaShares(
        moment,
        mainLine[moment.moveIndex - 1]?.analysis.maia,
        rating,
      ),
  )
  return {
    gameId: game.id,
    gameType: 'lichess',
    color: game.userColor,
    moments,
    usedMaia: moments.length > 0 && moments.every((m) => !!m.maia),
    opponentRating: game.opponentRating,
    playerRating: game.userRating,
    savedAt: Date.now(),
  }
}

/**
 * The visitor's last Lichess game and its key moments, without analysing
 * anything: from this browser's copy, or from the analysis saved with the
 * backend (the analysis page's, or this card's on another device). A game
 * analysed in neither is `not_analysed`, for the card to offer it.
 */
export const useLastGame = (lichessId: string | undefined) => {
  const [state, setState] = useState<LastGameState>({ status: 'loading' })

  useEffect(() => {
    if (!lichessId) return
    let canceled = false
    const run = async () => {
      const game = await fetchLastLichessGame(lichessId)
      if (canceled) return
      if (!game) return setState({ status: 'no_game' })
      const kept = loadGameMoments(game.id)
      if (kept) return setState({ status: 'done', game, entry: kept })
      const tree = await loadGameTree(game)
      if (canceled) return
      if (!tree) return setState({ status: 'no_game' })
      const analysed = playerMoveNodes(tree, game.userColor).every((node) =>
        isAnalysed(node),
      )
      if (!analysed) return setState({ status: 'not_analysed', game })
      const entry = entryOf(game, tree)
      saveGameMoments(entry)
      setState({ status: 'done', game, entry })
    }
    run().catch(() => {
      if (!canceled) setState({ status: 'error' })
    })
    return () => {
      canceled = true
    }
  }, [lichessId])

  const update = (game: LastLichessGame, entry: GameMoments) => {
    saveGameMoments(entry)
    setState({ status: 'done', game, entry })
  }

  return { state, update }
}

export type FinderState =
  | { status: 'analyzing'; progress: AnalysisProgress }
  | { status: 'engine_error' }
  /** Maia's model isn't in this browser: the card asks to download it. */
  | { status: 'needs_maia' }

/**
 * Analyses the game when asked (inside PersonalEngines): Stockfish on the
 * positions before the visitor's moves, then, with Maia's model in this
 * browser, what players at their rating play at each mistake. `addMaia`:
 * only the latter, for moments found before without it; it waits for the
 * download (`needs_maia`) when the model isn't here.
 */
export const useMomentFinder = (
  game: LastLichessGame,
  entry: GameMoments | null,
  addMaia: boolean,
  onDone: (entry: GameMoments) => void,
) => {
  const stockfish = useContext(StockfishEngineContext)
  const maia = useContext(MaiaEngineContext)
  const [state, setState] = useState<FinderState>({
    status: 'analyzing',
    progress: { done: 0, total: 0 },
  })
  const finished = useRef(false)

  const maiaSettled = maia.status !== 'loading' && maia.status !== 'downloading'
  const maiaReady = maia.status === 'ready' && !!maia.maia

  useEffect(() => {
    if (finished.current) return
    const controller = new AbortController()
    const { signal } = controller
    const rating = nearestMaiaRating(game.userRating)

    const finish = (result: GameMoments) => {
      finished.current = true
      onDone(result)
    }

    const withMaia = async (moments: KeyMoment[]) => {
      if (!maia.maia) return moments
      const nodes = moments.map((m) => new GameTree(m.fen).getRoot())
      await addMaiaAnalysis(nodes, maia.maia)
      return moments.map((m, i) =>
        withMaiaShares(m, nodes[i].analysis.maia, rating),
      )
    }

    const run = async () => {
      if (addMaia && entry) {
        if (!maiaSettled) return
        if (!maiaReady) return setState({ status: 'needs_maia' })
        const moments = await withMaia(entry.moments)
        if (signal.aborted) return
        finish({ ...entry, moments, usedMaia: true, savedAt: Date.now() })
        return
      }

      const tree = await loadGameTree(game)
      if (signal.aborted) return
      if (!tree) throw new Error('The game could not be read')
      const nodes = playerMoveNodes(tree, game.userColor)
      let analysed = false
      if (!nodes.every((node) => isAnalysed(node))) {
        if (stockfish.status === 'error') {
          return setState({ status: 'engine_error' })
        }
        setState({
          status: 'analyzing',
          progress: {
            done: nodes.filter((node) => isAnalysed(node)).length,
            total: nodes.length,
          },
        })
        if (!stockfish.isReady()) return // runs again when it is
        const complete = await analysePlayerMoves(
          tree,
          game.userColor,
          stockfish,
          {
            signal,
            onProgress: (progress) => {
              if (!signal.aborted) setState({ status: 'analyzing', progress })
            },
          },
        )
        if (!complete || signal.aborted) return
        analysed = true
      }
      // Maia's view too when its model is in this browser (it loads from
      // here, or isn't there).
      if (!maiaSettled) return
      const found = entryOf(game, tree)
      const moments = maiaReady ? await withMaia(found.moments) : found.moments
      if (signal.aborted) return
      finish({ ...found, moments, usedMaia: maiaReady || found.usedMaia })
      if (analysed) {
        saveGameAnalysis(game.id, tree).catch((error) =>
          console.warn('Failed to save the game analysis:', error),
        )
      }
    }

    run().catch((error) => {
      if (signal.aborted) return
      console.error('Last game analysis failed:', error)
      setState({ status: 'engine_error' })
    })

    return () => {
      controller.abort()
      stockfish.stopEvaluation()
    }
  }, [game.id, addMaia, stockfish.status, maiaSettled, maiaReady])

  return { state, maia }
}
