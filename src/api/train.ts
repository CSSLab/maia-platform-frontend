/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildUrl } from './utils'
import { fetchAsGuest } from './guest'
import { MoveValueMapping, GameTree } from 'src/types'
import { AvailableMoves, PuzzleGame } from 'src/types/puzzle'

declare global {
  interface Window {
    /** The first puzzle, asked for by the page's HTML (see _document.tsx). */
    __puzzle?: Promise<any>
  }
}

/**
 * Why no puzzle came: the visitor has attempted every puzzle there is
 * ('exhausted'), or the request failed ('error'), which another try may fix.
 */
export type PuzzleUnavailableReason = 'exhausted' | 'error'

export class PuzzleUnavailableError extends Error {
  constructor(
    readonly reason: PuzzleUnavailableReason,
    message: string,
  ) {
    super(message)
    this.name = 'PuzzleUnavailableError'
  }
}

/**
 * The puzzle in a new_puzzle response, or a PuzzleUnavailableError. A player
 * who had attempted ~1000 puzzles got a response without one, which the page
 * read as a puzzle, failed on, and sent them to /401, whose "Try again" asked
 * for the same missing puzzle. What the server sends when it has no puzzle
 * left for someone isn't known here, so any answer from it without a puzzle
 * (an empty or puzzle-less body, or "not found") counts as having run out;
 * other failures (server errors, a lost session, no connection) as errors.
 */
export const checkPuzzleResponse = (status: number, data: any) => {
  if (status >= 200 && status < 300 && data?.puzzle_id) return data

  const detail =
    typeof data?.detail === 'string'
      ? data.detail
      : typeof data?.message === 'string'
        ? data.message
        : ''
  // A body that isn't JSON (`undefined` here) is more likely a proxy's error
  // page than the server's answer, except for 204 No Content.
  const outOfPuzzles =
    status === 204 ||
    (status >= 200 && status < 300 && data !== undefined) ||
    status === 404 ||
    /no (more )?puzzles|out of puzzles|exhausted|attempted (all|every)/i.test(
      detail,
    )
  throw new PuzzleUnavailableError(
    outOfPuzzles ? 'exhausted' : 'error',
    `new_puzzle: HTTP ${status}${detail ? ` (${detail})` : ''}`,
  )
}

export const fetchPuzzleData = async () => {
  // The first call takes the request the page's HTML started, which fails
  // (and is asked again here) unless the server answered 2xx.
  const early = typeof window !== 'undefined' ? window.__puzzle : undefined
  if (early) {
    delete window.__puzzle
    const data = await early.catch(() => null)
    if (data) return checkPuzzleResponse(200, data)
  }
  let res: Response
  try {
    res = await fetchAsGuest(buildUrl('puzzle/new_puzzle'))
  } catch (error) {
    throw new PuzzleUnavailableError('error', String(error))
  }
  const data = await res.json().catch(() => undefined)
  return checkPuzzleResponse(res.status, data)
}

export const fetchPuzzle = async () => {
  const data = await fetchPuzzleData()
  const id =
    data['puzzle_id']['game_source'] +
    '-' +
    data['puzzle_id']['game_id'] +
    '-' +
    data['puzzle_id']['move_ply']

  const puzzle_elo = data['puzzle_elo']

  const gameType = 'train'

  const termination = {
    ...data['termination'],
    condition: 'Normal',
  }

  const blackPlayer = {
    name: data['black_player']['name'],
    rating: data['black_player']['rating'],
  }

  const whitePlayer = {
    name: data['white_player']['name'],
    rating: data['white_player']['rating'],
  }

  const gameStates = data['game_states']
  const sanMoves = gameStates.map(({ last_move: lastMove }: any) =>
    (lastMove ?? []).join('-'),
  )

  const moves = gameStates.map((gameState: any, index: number) => {
    const { last_move: lastMove, fen, check, last_move_san: san } = gameState
    const move = sanMoves[index]

    return {
      board: fen,
      lastMove,
      movePlayed: move,
      san,
      uci: lastMove ? lastMove.join('') : undefined,
      check,
    }
  })

  // Build game tree from moves
  if (moves.length === 0) {
    throw new Error('Moves array is empty. Cannot initialize GameTree.')
  }
  const gameTree = new GameTree(moves[0].board)
  let currentNode = gameTree.getRoot()

  for (let i = 1; i < moves.length; i++) {
    const move = moves[i]
    if (move.uci && move.san) {
      currentNode = gameTree
        .getLastMainlineNode()
        .addChild(move.board, move.uci, move.san, true)
    }
  }

  const moveMap = data['target_move_map']

  const stockfishEvaluation: MoveValueMapping = {}
  const maiaEvaluation: MoveValueMapping = {}
  const availableMoves: AvailableMoves = {}

  moveMap.forEach(
    ({
      check,
      fen,
      maia_eval: maiaEval,
      move,
      move_san: san,
      stockfish_eval: stockfishEval,
    }: any) => {
      const moveString = move.join('')
      stockfishEvaluation[moveString] =
        stockfishEval === -1000 ? -50 : stockfishEval
      maiaEvaluation[moveString] = maiaEval
      availableMoves[moveString] = {
        board: fen,
        lastMove: move,
        san,
        check,
      }
    },
  )

  return {
    id: id,
    puzzle_elo,
    whitePlayer,
    blackPlayer,
    moves,
    tree: gameTree,
    maiaEvaluation,
    stockfishEvaluation,
    gameType,
    termination,
    availableMoves,
    targetIndex: data['target_move_index'],
  } as any as PuzzleGame
}

export const logPuzzleGuesses = async (
  puzzleId: string,
  guesses: string[],
  gaveUp: boolean,
) => {
  const idParts = puzzleId.split('-')
  const puzzleIdObj = {
    game_source: idParts[0],
    game_id: idParts[1],
    move_ply: Number.parseInt(idParts[2]),
  }

  const res = await fetch(
    buildUrl(
      'puzzle/log_puzzle_guesses?' +
        new URLSearchParams({
          gave_up: gaveUp ? 'true' : 'false',
        }),
    ),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        puzzle_id: puzzleIdObj,
        user_guesses: guesses,
      }),
    },
  )

  return res.json()
}

export const fetchTrainingPlayerStats = async () => {
  const res = await fetch(buildUrl('puzzle/get_player_stats'))
  const data = await res.json()
  return {
    totalPuzzles: data.total_puzzles as number,
    puzzlesSolved: data.puzzles_solved as number,
    rating: data.puzzle_elo as number,
  }
}
