import { backOff } from 'exponential-backoff'
import { buildUrl } from './utils'
import { fetchAsGuest } from './guest'
import { Color, TimeControl } from 'src/types'

const normalizeOpeningBookFen = (fen: string) => {
  const parts = fen.trim().split(/\s+/)
  if (parts.length >= 4) {
    return parts.slice(0, 4).join(' ')
  }
  return fen.trim()
}

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

  const res = await fetchAsGuest(
    buildUrl('play/start_game?' + new URLSearchParams(params)),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    },
  )

  const data = await res.json().catch(() => null)
  if (!res.ok || typeof data?.game_id !== 'string') {
    // A 401 here: the guest cookie couldn't be set (see fetchAsGuest).
    throw new MoveRequestError(res.status, `start_game: HTTP ${res.status}`)
  }

  return {
    gameId: data['game_id'] as string,
    opponentElo: data['opponent_elo'] as number,
  }
}

/**
 * startGame, retried a few times (a second or two in all) unless the server
 * rejected the request: most failed starts fail at once, on phones, which is
 * what a dropped connection looks like. Throws if it still fails.
 */
export const startGameWithRetry = (...args: Parameters<typeof startGame>) =>
  backOff(() => startGame(...args), {
    jitter: 'full',
    numOfAttempts: 4,
    retry: retryUnlessRejected,
  })

// A game against Maia started by the setup dialog as the visitor chose a
// side, so that start_game runs while /play/maia loads and renders rather
// than after. /play/maia takes it if its settings match, or starts its own.
let earlyStart: {
  key: string
  response: ReturnType<typeof startGame>
} | null = null

export const startGameEarly = (
  playerColor: Color,
  maiaVersion: string,
  sampleMoves: boolean,
  timeControl: TimeControl,
) => {
  const response = startGame(
    playerColor,
    maiaVersion,
    'play',
    sampleMoves,
    timeControl,
  )
  response.catch(() => undefined)
  earlyStart = {
    key: JSON.stringify([playerColor, maiaVersion, sampleMoves, timeControl]),
    response,
  }
}

export const takeEarlyGame = (
  playerColor: Color,
  maiaVersion: string,
  sampleMoves: boolean,
  timeControl: TimeControl,
) => {
  const key = JSON.stringify([
    playerColor,
    maiaVersion,
    sampleMoves,
    timeControl,
  ])
  if (!earlyStart || earlyStart.key !== key) return null
  const { response } = earlyStart
  earlyStart = null
  return response
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
                  maia_version: 'maia3',
                }
              : {
                  maia_name: maiaVersion,
                  piece: piece || '',
                  initial_clock: initial_clock.toString(),
                  current_clock: current_clock.toString(),
                  maia_version: 'maia3',
                }
            : fen
              ? {
                  fen: fen || '',
                  maia_name: maiaVersion,
                  initial_clock: initial_clock.toString(),
                  current_clock: current_clock.toString(),
                  maia_version: 'maia3',
                }
              : {
                  maia_name: maiaVersion,
                  initial_clock: initial_clock.toString(),
                  current_clock: current_clock.toString(),
                  maia_version: 'maia3',
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

  const body = await res.json().catch(() => null)
  if (!res.ok || typeof body?.top_move !== 'string') {
    const detail = body?.detail
    throw new MoveRequestError(
      res.status,
      `Maia's move: HTTP ${res.status}${
        detail
          ? ` ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
          : ''
      }`,
    )
  }
  return body
}

/** The server answered, but not with a move (or a new game). */
export class MoveRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * For `backOff`: a request the server rejected (an illegal move list, for
 * example) would be rejected again, so only other failures are retried.
 */
export const retryUnlessRejected = (error: unknown) =>
  !(
    error instanceof MoveRequestError &&
    error.status >= 400 &&
    error.status < 500
  )

export const fetchOpeningBookMoves = async (fen: string) => {
  const normalizedFen = normalizeOpeningBookFen(fen)
  const res = await fetch(
    buildUrl(
      'play/get_book_moves?' +
        new URLSearchParams({
          fen: normalizedFen,
        }),
    ),
    {
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
    },
  )

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

/**
 * fetchGameMove, retried a few times (a few seconds in all) unless the server
 * rejected the request. Throws if it still fails.
 */
export const fetchMaiaMove = (...args: Parameters<typeof fetchGameMove>) =>
  backOff(() => fetchGameMove(...args), {
    jitter: 'full',
    numOfAttempts: 6,
    retry: retryUnlessRejected,
  })
