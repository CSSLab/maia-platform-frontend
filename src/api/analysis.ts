/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Player,
  AnalyzedGame,
  MoveValueMapping,
  CachedEngineAnalysisEntry,
  WorldChampionshipGameListEntry,
  RawMove,
} from 'src/types'
import {
  readLichessStream,
  buildGameTreeFromMoveList,
  buildMovesListFromGameStates,
  insertBackendStockfishEvalToGameTree,
} from 'src/lib'
import { buildUrl } from './utils'
import { formatMaiaName } from 'src/lib/maiaNames'
import { AvailableMoves } from 'src/types/puzzle'
import { Chess } from 'chess.ts'

export const fetchWorldChampionshipGameList = async (): Promise<
  Map<string, WorldChampionshipGameListEntry[]>
> => {
  const res = await fetch(buildUrl('analysis/list'))
  if (!res.ok) throw new Error(`Game list request failed (HTTP ${res.status})`)
  const data = await res.json()

  return data
}

export const fetchMaiaGameList = async (
  type = 'play',
  page = 1,
  lichessId?: string,
) => {
  const url = buildUrl(`analysis/user/list/${type}/${page}`)
  const searchParams = new URLSearchParams()

  if (lichessId) {
    searchParams.append('lichess_id', lichessId)
  }

  const fullUrl = searchParams.toString()
    ? `${url}?${searchParams.toString()}`
    : url
  const res = await fetch(fullUrl)

  const data = await res.json()

  return data
}

export const streamLichessGames = async (
  username: string,
  onMessage: (data: any) => void,
) => {
  const stream = fetch(
    `https://lichess.org/api/games/user/${username}?max=100&pgnInJson=true`,
    {
      headers: {
        Accept: 'application/x-ndjson',
      },
    },
  )
  stream.then(readLichessStream(onMessage))
}

const looksLikePgn = (text: string) => /^\s*\[\w+\s+"/.test(text)

/**
 * A game for the analysis page couldn't be loaded. `status`: the HTTP status
 * of the reply (404 for a Lichess game that doesn't exist).
 */
export class GameLoadError extends Error {
  constructor(readonly status: number) {
    super(`Game request failed (HTTP ${status})`)
    this.name = 'GameLoadError'
  }
}

/** No game behind the link: a 4xx reply, rather than a server failure. */
export const isGameNotFound = (error: unknown) =>
  error instanceof GameLoadError && error.status >= 400 && error.status < 500

const readGameReply = async (res: Response) => {
  if (!res.ok) throw new GameLoadError(res.status)
  return res.json()
}

/**
 * `early`: the same request already started by the page's HTML (see
 * _document.tsx), used instead of a new one.
 */
export const fetchPgnOfLichessGame = async (
  id: string,
  early?: Promise<string>,
): Promise<string> => {
  try {
    const text = await (early ??
      fetch(`https://lichess.org/game/export/${id}`, {
        headers: {
          Accept: 'application/x-chess-pgn',
        },
      }).then((res) => (res.ok ? res.text() : '')))
    if (looksLikePgn(text)) return text
  } catch (error) {
    console.warn('Lichess game export failed, trying the export by id:', error)
  }

  // Lichess redirects anonymous exports of older games to its sign-up page,
  // which fails CORS. Its export by ids still serves them, and with these
  // options returns the same PGN as the single-game export.
  const res = await fetch(
    'https://lichess.org/api/games/export/_ids?clocks=true&evals=true&opening=true',
    {
      method: 'POST',
      headers: {
        Accept: 'application/x-chess-pgn',
      },
      body: id,
    },
  )
  if (!res.ok) throw new GameLoadError(res.status)
  // An id that matches no game gets an empty reply.
  const text = await res.text()
  if (!looksLikePgn(text)) throw new GameLoadError(404)
  return text
}

export const fetchAnalyzedWorldChampionshipGame = async (
  gameId = ['FkgYSri1'],
) => {
  const res = await fetch(
    buildUrl(`analysis/analysis_list/${gameId.join('/')}`),
  )

  const data = await readGameReply(res)

  const id = data['id']
  const termination = {
    ...data['termination'],
    condition: 'Normal',
  }

  const gameType = 'blitz'
  const blackPlayer = data['black_player'] as Player
  const whitePlayer = data['white_player'] as Player

  const maiaEvals: {
    [model: string]: MoveValueMapping[]
  } = {}
  const stockfishEvaluations: MoveValueMapping[] = data['stockfish_evals']
  // How far the mates are, where the stored analysis recorded it (absent from
  // older backends).
  const stockfishMates: MoveValueMapping[] | undefined = data['stockfish_mates']

  const availableMoves: AvailableMoves[] = []

  for (const model of data['maia_versions']) {
    maiaEvals[model] = data['maia_evals'][model]
  }

  for (const position of data['move_maps']) {
    const moves: AvailableMoves = {}
    for (const move of position) {
      const fromTo = move.move.join('')
      const san = move['move_san']
      const { check, fen } = move

      moves[fromTo] = {
        board: fen,
        check,
        san,
        lastMove: move.move,
      } as RawMove
    }
    availableMoves.push(moves)
  }

  const gameStates = data['game_states']

  const moves = buildMovesListFromGameStates(gameStates)
  const tree = buildGameTreeFromMoveList(moves, moves[0].board)
  insertBackendStockfishEvalToGameTree(
    tree,
    moves,
    stockfishEvaluations,
    stockfishMates,
  )

  return {
    id,
    blackPlayer,
    whitePlayer,
    availableMoves,
    gameType,
    termination,
    tree,
  } as AnalyzedGame
}

export const fetchAnalyzedPgnGame = async (id: string, pgn: string) => {
  const res = await fetch(buildUrl('analysis/analyze_user_game'), {
    method: 'POST',
    body: pgn,
    headers: {
      'Content-Type': 'text/plain',
    },
  })

  const data = await readGameReply(res)

  const termination = {
    ...data['termination'],
    condition: 'Normal',
  }

  const gameType = 'blitz'
  const blackPlayer = data['black_player'] as Player
  const whitePlayer = data['white_player'] as Player

  const maiaEvals: { [model: string]: MoveValueMapping[] } = {}
  const availableMoves: AvailableMoves[] = []

  for (const model of data['maia_versions']) {
    maiaEvals[model] = data['maia_evals'][model]
  }

  for (const position of data['move_maps']) {
    const moves: AvailableMoves = {}
    for (const move of position) {
      const fromTo = move.move.join('')
      const san = move['move_san']
      const { check, fen } = move

      moves[fromTo] = {
        board: fen,
        check,
        san,
        lastMove: move.move,
      } as RawMove
    }
    availableMoves.push(moves)
  }

  const gameStates = data['game_states']

  const moves = buildMovesListFromGameStates(gameStates)
  const tree = buildGameTreeFromMoveList(moves, moves[0].board)

  return {
    id,
    blackPlayer,
    whitePlayer,
    availableMoves,
    gameType,
    termination,
    tree,
  } as AnalyzedGame
}

/**
 * Sends a PGN to `analyze_user_game` without reading the reply, for games the
 * page builds itself (see parseLichessPgn), in case the backend records it.
 */
export const sendPgnGame = (pgn: string) => {
  fetch(buildUrl('analysis/analyze_user_game'), {
    method: 'POST',
    body: pgn,
    headers: {
      'Content-Type': 'text/plain',
    },
  }).catch(() => undefined)
}

export const fetchAnalyzedMaiaGame = async (
  id: string,
  game_type: 'play' | 'hand' | 'brain' | 'custom',
) => {
  const res = await fetch(
    buildUrl(
      `analysis/user/analyze_user_maia_game/${id}?` +
        new URLSearchParams({
          game_type,
        }),
    ),
    {
      method: 'GET',
      headers: {
        'Content-Type': 'text/plain',
      },
    },
  )

  const data = await readGameReply(res)

  const termination = {
    ...data['termination'],
    condition: 'Normal',
  }

  const gameType = 'blitz'
  const blackPlayer = data['black_player'] as Player
  const whitePlayer = data['white_player'] as Player

  const maiaPattern = /maia_kdd_\d{3,4}/

  if (blackPlayer.name && maiaPattern.test(blackPlayer.name)) {
    blackPlayer.name = formatMaiaName(blackPlayer.name, data['created_time'])
  }

  if (whitePlayer.name && maiaPattern.test(whitePlayer.name)) {
    whitePlayer.name = formatMaiaName(whitePlayer.name, data['created_time'])
  }

  const maiaEvals: { [model: string]: MoveValueMapping[] } = {}
  const availableMoves: AvailableMoves[] = []

  for (const model of data['maia_versions']) {
    maiaEvals[model] = data['maia_evals'][model]
  }

  for (const position of data['move_maps']) {
    const moves: AvailableMoves = {}
    for (const move of position) {
      const fromTo = move.move.join('')
      const san = move['move_san']
      const { check, fen } = move

      moves[fromTo] = {
        board: fen,
        check,
        san,
        lastMove: move.move,
      } as RawMove
    }
    availableMoves.push(moves)
  }

  const gameStates = data['game_states']

  const moves = buildMovesListFromGameStates(gameStates)
  const tree = buildGameTreeFromMoveList(
    moves,
    moves.length ? moves[0].board : new Chess().fen(),
  )

  return {
    id,
    type: game_type,
    blackPlayer,
    whitePlayer,
    moves,
    availableMoves,
    gameType,
    termination,
    tree,
    // Anyone with a stored game's link can open it; only its owner's analysis
    // is saved. (A reply without is_owner, from before the backend sent it,
    // counts as the owner's, as every game opened then was.)
    isOwner: data['is_owner'] !== false,
  } as AnalyzedGame
}

export const storeGameAnalysisCache = async (
  gameId: string,
  analysisData: CachedEngineAnalysisEntry[],
): Promise<void> => {
  const res = await fetch(
    buildUrl(`analysis/store_engine_analysis/${gameId}`),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analysisData),
    },
  )

  if (!res.ok) {
    console.error('Failed to cache engine analysis')
  }
}

export const retrieveGameAnalysisCache = async (
  gameId: string,
): Promise<{ positions: CachedEngineAnalysisEntry[] } | null> => {
  const res = await fetch(buildUrl(`analysis/get_engine_analysis/${gameId}`))

  if (res.status === 404) {
    return null
  }

  if (!res.ok) {
    console.error('Failed to retrieve engine analysis')
  }

  const data = await res.json()

  return data
}

export const updateGameMetadata = async (
  gameType: 'custom' | 'play' | 'hand' | 'brain',
  gameId: string,
  metadata: {
    custom_name?: string
    is_favorited?: boolean
  },
): Promise<void> => {
  const res = await fetch(
    buildUrl(`analysis/update_metadata/${gameType}/${gameId}`),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    },
  )

  if (!res.ok) {
    console.error('Failed to update game metadata')
  }
}

export const storeCustomGame = async (data: {
  name?: string
  pgn?: string
  fen?: string
}): Promise<{
  game_id: string
}> => {
  const res = await fetch(buildUrl('analysis/store_custom_game'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const bodyText = await res.text()

  if (!res.ok) {
    console.error(`Failed to store custom game: ${bodyText}`)
    throw new Error(
      `Failed to store custom game (${res.status} ${res.statusText})${
        bodyText ? `: ${bodyText}` : ''
      }`,
    )
  }

  return JSON.parse(bodyText)
}

export const deleteCustomGame = async (gameId: string): Promise<void> => {
  const res = await fetch(buildUrl(`analysis/delete_custom_game/${gameId}`), {
    method: 'DELETE',
  })

  if (!res.ok) {
    console.error(`Failed to delete custom game: ${await res.text()}`)
  }
}
