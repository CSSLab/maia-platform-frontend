import { Color, TuringGame, TuringSubmissionResult, GameTree } from 'src/types'
import { buildUrl } from 'src/api'

export const getTuringGame = async () => {
  const res = await fetch(buildUrl('turing/new_game'))

  if (res.status === 401) {
    throw new Error('Unauthorized')
  }

  const data = await res.json()

  const termination = {
    ...data['termination'],
    condition: 'Normal',
  }

  const gameStates = data['game_states']
  const id = data.id
  const moves = gameStates.map(
    (gameState: {
      last_move: [string, string]
      fen: string
      last_move_san: string
      check: boolean
    }) => {
      const { last_move: lastMove, fen, check, last_move_san: san } = gameState

      return {
        board: fen,
        lastMove,
        san,
        uci: lastMove ? lastMove.join('') : undefined,
        check,
      }
    },
  )

  // Build game tree from moves
  if (moves.length === 0) {
    throw new Error('No moves available to initialize the game tree')
  }
  const gameTree = new GameTree(moves[0].board)
  let currentNode = gameTree.getRoot()

  for (let i = 1; i < moves.length; i++) {
    const move = moves[i]
    if (move.uci && move.san) {
      currentNode = gameTree.addMainMove(
        currentNode,
        move.board,
        move.uci,
        move.san,
      )
    }
  }

  return {
    termination,
    id,
    gameStates,
    moves,
    tree: gameTree,
  } as TuringGame
}

export const submitTuringGuess = async (
  id: string,
  guess: Color,
  comment = '',
) => {
  const res = await fetch(buildUrl('turing/game_guess'), {
    body: JSON.stringify({
      id,
      white_is_bot: guess === 'white',
      black_is_bot: guess === 'black',
      comment,
    }),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const data = await res.json()
  const bot = data['black_is_bot'] ? 'black' : 'white'

  const blackPlayer = {
    name: data['black_name'],
    rating: data['black_rating'],
  }

  const whitePlayer = {
    name: data['white_name'],
    rating: data['white_rating'],
  }

  const correct = data['guess_correct']
  const gameType = data['game_type']
  const rawTimeControl = data['time_control']
  const split = rawTimeControl.split('+')
  const baseTimeInMinutes = parseInt(split[0], 10) / 60
  const timeControl = `${baseTimeInMinutes}+${split[1]}`
  const turingElo = data['turing_elo']

  return {
    bot,
    blackPlayer,
    whitePlayer,
    correct,
    gameType,
    timeControl,
    turingElo,
  } as TuringSubmissionResult
}

export const getTuringPlayerStats = async () => {
  const res = await fetch(buildUrl('turing/get_player_stats'))
  const data = await res.json()
  return {
    correctGuesses: data.correct_guesses as number,
    wrongGuesses: data.wrong_guesses as number,
    rating: data.turing_elo as number,
  }
}
