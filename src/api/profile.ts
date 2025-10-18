import { buildUrl } from './utils'
import { PlayerStats } from 'src/types'

export const fetchPlayerStats = async (name?: string): Promise<PlayerStats> => {
  const res = await fetch(
    buildUrl(`auth/get_player_stats${name ? `/${name}` : ''}`),
  )
  const data = await res.json()
  return {
    regularRating: data.play_elo as number,
    regularWins: data.play_won as number,
    regularDraws: data.play_drawn as number,
    regularGames: data.play_games_played as number,
    regularMax: data.play_elo_max as number,
    regularMin: data.play_elo_min as number,
    regularHours: data.play_game_time as number,

    handRating: data.hand_elo as number,
    handWins: data.hand_won as number,
    handDraws: data.hand_drawn as number,
    handGames: data.hand_games_played as number,
    handMax: data.hand_elo_max as number,
    handMin: data.hand_elo_min as number,
    handHours: data.hand_game_time as number,

    brainRating: data.brain_elo as number,
    brainWins: data.brain_won as number,
    brainDraws: data.brain_drawn as number,
    brainGames: data.brain_games_played as number,
    brainMax: data.brain_elo_max as number,
    brainMin: data.brain_elo_min as number,
    brainHours: data.brain_game_time as number,

    trainRating: data.puzzles_elo as number,
    trainCorrect: data.puzzles_correct as number,
    trainGames: data.puzzles_played as number,
    trainMax: data.puzzles_elo_max as number,
    trainMin: data.puzzles_elo_min as number,
    trainHours: data.puzzle_game_time as number,

    botNotRating: data.turing_elo as number,
    botNotCorrect: data.turing_guesses_correct as number,
    botNotWrong: data.turing_guesses_wrong as number,
    botNotGames: (data.turing_guesses_correct +
      data.turing_guesses_wrong) as number,
    botNotMax: data.turing_elo_max as number,
    botNotMin: data.turing_elo_min as number,
    botNotHours: data.turing_game_time as number,
  }
}
