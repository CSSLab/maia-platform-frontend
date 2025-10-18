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
import { AvailableMoves } from 'src/types/puzzle'
import { Chess } from 'chess.ts'

export const fetchWorldChampionshipGameList = async (): Promise<
  Map<string, WorldChampionshipGameListEntry[]>
> => {
  const res = await fetch(buildUrl('analysis/list'))
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

export const fetchPgnOfLichessGame = async (id: string): Promise<string> => {
  const res = await fetch(`https://lichess.org/game/export/${id}`, {
    headers: {
      Accept: 'application/x-chess-pgn',
    },
  })
  return res.text()
}

export const fetchAnalyzedWorldChampionshipGame = async (
  gameId = ['FkgYSri1'],
) => {
  const res = await fetch(
    buildUrl(`analysis/analysis_list/${gameId.join('/')}`),
  )

  const data = await res.json()

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
  insertBackendStockfishEvalToGameTree(tree, moves, stockfishEvaluations)

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

  const data = await res.json()

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

  const data = await res.json()

  const termination = {
    ...data['termination'],
    condition: 'Normal',
  }

  const gameType = 'blitz'
  const blackPlayer = data['black_player'] as Player
  const whitePlayer = data['white_player'] as Player

  const maiaPattern = /maia_kdd_1\d00/

  if (blackPlayer.name && maiaPattern.test(blackPlayer.name)) {
    blackPlayer.name = blackPlayer.name.replace('maia_kdd_', 'Maia ')
  }

  if (whitePlayer.name && maiaPattern.test(whitePlayer.name)) {
    whitePlayer.name = whitePlayer.name.replace('maia_kdd_', 'Maia ')
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

  if (!res.ok) {
    console.error(`Failed to store custom game: ${await res.text()}`)
  }

  return res.json()
}

export const deleteCustomGame = async (gameId: string): Promise<void> => {
  const res = await fetch(buildUrl(`analysis/delete_custom_game/${gameId}`), {
    method: 'DELETE',
  })

  if (!res.ok) {
    console.error(`Failed to delete custom game: ${await res.text()}`)
  }
}
