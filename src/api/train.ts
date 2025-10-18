/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildUrl } from './utils'
import { MoveValueMapping, GameTree } from 'src/types'
import { AvailableMoves, PuzzleGame } from 'src/types/puzzle'

export const fetchPuzzle = async () => {
  const res = await fetch(buildUrl('puzzle/new_puzzle'))
  const data = await res.json()
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
