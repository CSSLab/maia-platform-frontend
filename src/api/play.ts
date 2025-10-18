import { buildUrl } from './utils'
import { Color, TimeControl } from 'src/types'

export const startGame = async (
  playerColor: Color,
  maiaVersion: string,
  gameType: 'play' | 'hand' | 'brain',
  sampleMoves: boolean,
  timeControl: TimeControl,
  maiaPartnerVersion: string | undefined = undefined,
) => {
  const params: Record<string, string> = maiaPartnerVersion
    ? {
        maia_name: maiaVersion,
        maia_friendly_name: maiaPartnerVersion,
        player_color: playerColor,
        game_type: gameType,
        sample_moves: sampleMoves.toString(),
        time_control: timeControl,
      }
    : {
        maia_name: maiaVersion,
        player_color: playerColor,
        game_type: gameType,
        sample_moves: sampleMoves.toString(),
        time_control: timeControl,
      }

  const res = await fetch(
    buildUrl('play/start_game?' + new URLSearchParams(params)),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    },
  )

  if (res.status === 401) {
    throw new Error('Unauthorized')
  }

  const data = await res.json()

  return {
    gameId: data['game_id'] as string,
    opponentElo: data['opponent_elo'] as number,
  }
}

export const fetchGameMove = async (
  moves: string[],
  maiaVersion = 'maia_kdd_1900',
  fen: string | null = null,
  piece: string | null = null,
  initial_clock = 0,
  current_clock = 0,
) => {
  const res = await fetch(
    buildUrl(
      'play/get_move?' +
        new URLSearchParams(
          piece
            ? fen
              ? {
                  fen: fen || '',
                  maia_name: maiaVersion,
                  piece: piece || '',
                  initial_clock: initial_clock.toString(),
                  current_clock: current_clock.toString(),
                  maia_version: 'maia2rapid',
                }
              : {
                  maia_name: maiaVersion,
                  piece: piece || '',
                  initial_clock: initial_clock.toString(),
                  current_clock: current_clock.toString(),
                  maia_version: 'maia2rapid',
                }
            : fen
              ? {
                  fen: fen || '',
                  maia_name: maiaVersion,
                  initial_clock: initial_clock.toString(),
                  current_clock: current_clock.toString(),
                  maia_version: 'maia2rapid',
                }
              : {
                  maia_name: maiaVersion,
                  initial_clock: initial_clock.toString(),
                  current_clock: current_clock.toString(),
                  maia_version: 'maia2rapid',
                },
        ),
    ),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(moves),
    },
  )

  return res.json()
}

export const fetchOpeningBookMoves = async (fen: string) => {
  const res = await fetch(buildUrl(`play/get_book_moves?fen=${fen}`), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      moves: [],
      maia_names: [
        'maia_kdd_1100',
        'maia_kdd_1200',
        'maia_kdd_1300',
        'maia_kdd_1400',
        'maia_kdd_1500',
        'maia_kdd_1600',
        'maia_kdd_1700',
        'maia_kdd_1800',
        'maia_kdd_1900',
      ],
    }),
  })

  return res.json()
}

export const logGameMove = async (
  gameId: string,
  moves: string[],
  moveTimes: number[],
  gameOverState: 'not_over' | 'rules' | 'resign' | 'time',
  gameType: 'play' | 'hand' | 'brain',
  fen: string | undefined = undefined,
  winner: string | undefined = undefined,
  brainMoves: string[] = [],
) => {
  const res = await fetch(buildUrl('play/submit_move'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      game_id: gameId,
      moves: moves,
      game_over_state: gameOverState,
      game_type: gameType,
      move_times: moveTimes,
      fen: fen,
      brain_moves: brainMoves,

      ...(winner && winner !== 'none' ? { winner: winner } : {}),
    }),
  })

  return res.json()
}

export const fetchPlayPlayerStats = async () => {
  const res = await fetch(buildUrl('play/get_player_stats'))
  const data = await res.json()
  return {
    playGamesPlayed: data.play_games_played as number,
    handGamesPlayed: data.hand_games_played as number,
    brainGamesPlayed: data.brain_games_played as number,
    playWon: data.play_won as number,
    playDrawn: data.play_drawn as number,
    handWon: data.hand_won as number,
    handDrawn: data.hand_drawn as number,
    brainWon: data.brain_won as number,
    brainDrawn: data.brain_drawn as number,
    playElo: data.play_elo as number,
    handElo: data.hand_elo as number,
    brainElo: data.brain_elo as number,
  }
}
