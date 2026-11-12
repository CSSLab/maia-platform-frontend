import { backOff } from 'exponential-backoff'
import { Color } from 'src/types'
import { ServerGame } from 'src/lib/serverGames'
import { buildUrl } from './utils'
import { fetchAsGuest } from './guest'
import { MoveRequestError, retryUnlessRejected } from './play'

/**
 * The request doesn't fit the game as the server holds it (409): the game has
 * moved on, is over, or it isn't the player's turn. `game` is its state, to
 * catch up from.
 */
export class ServerGameConflict extends MoveRequestError {
  constructor(
    readonly code: string,
    readonly game: ServerGame,
  ) {
    super(409, `play/games: ${code}`)
  }
}

const request = async (
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  keepalive = false,
) => {
  const res = await fetchAsGuest(buildUrl(path), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive,
  })
  const data = await res.json().catch(() => null)
  return { res, data }
}

const gameFrom = (
  what: string,
  { res, data }: { res: Response; data: unknown },
): ServerGame => {
  const game = data as ServerGame | null
  if (res.status === 409 && (data as { game?: ServerGame })?.game) {
    const conflict = data as { code?: string; game: ServerGame }
    throw new ServerGameConflict(conflict.code || 'conflict', conflict.game)
  }
  if (!res.ok || typeof game?.game_id !== 'string') {
    throw new MoveRequestError(res.status, `${what}: HTTP ${res.status}`)
  }
  return game
}

const retried = <T>(call: () => Promise<T>, attempts: number) =>
  backOff(call, {
    jitter: 'full',
    numOfAttempts: attempts,
    retry: retryUnlessRejected,
  })

export interface NewServerGame {
  gameType?: 'play' | 'hand' | 'brain'
  playerColor: Color
  maiaVersion: string
  // The Maia playing with the player, in a hand or brain game.
  maiaPartnerVersion?: string
  timeControl: string
  sampleMoves: boolean
  startFen?: string
  practice?: boolean
  instant: boolean
}

/**
 * Starts a game. If the player has a game in progress the server answers
 * with that one instead (inProgress), to be resumed or resigned first.
 */
export const createServerGame = (settings: NewServerGame) =>
  retried(async () => {
    const gameType = settings.gameType ?? 'play'
    const answer = await request('play/games', 'POST', {
      game_type: gameType,
      player_color: settings.playerColor,
      maia_name: settings.maiaVersion,
      ...(gameType === 'play'
        ? { practice: !!settings.practice }
        : { maia_friendly_name: settings.maiaPartnerVersion }),
      time_control: settings.timeControl,
      sample_moves: settings.sampleMoves,
      fen: settings.startFen || null,
      instant: settings.instant,
    })
    try {
      return { game: gameFrom('play/games', answer), inProgress: false }
    } catch (error) {
      if (
        error instanceof ServerGameConflict &&
        error.code === 'game_in_progress'
      ) {
        return { game: error.game, inProgress: true }
      }
      throw error
    }
  }, 4)

/**
 * The player's move at `ply`; the answer has Maia's reply. Retried a few
 * times unless the server rejected it: sending a move again is safe, the
 * server answers with the reply it already made.
 */
export const sendServerMove = (
  gameId: string,
  ply: number,
  move: string,
  thinkMs: number,
  instant: boolean,
) =>
  retried(
    async () =>
      gameFrom(
        'play/games move',
        await request(`play/games/${gameId}/moves`, 'POST', {
          ply,
          move,
          think_ms: thinkMs,
          instant,
        }),
      ),
    6,
  )

/**
 * Brain games: the type of piece the player names for their move at `ply`.
 * The answer has the move the partner Maia made with it (player_move) and the
 * opponent's reply.
 */
export const sendServerPiece = (
  gameId: string,
  ply: number,
  piece: string,
  thinkMs: number,
  instant: boolean,
) =>
  retried(
    async () =>
      gameFrom(
        'play/games move',
        await request(`play/games/${gameId}/moves`, 'POST', {
          ply,
          piece,
          think_ms: thinkMs,
          instant,
        }),
      ),
    6,
  )

/** Practice games: takes back the player's last move and Maia's reply. */
export const takeBackServerGame = (gameId: string) =>
  retried(
    async () =>
      gameFrom(
        'play/games takeback',
        await request(`play/games/${gameId}/takeback`, 'POST'),
      ),
    4,
  )

/** Practice games: more time on the player's clock. */
export const addTimeServerGame = (gameId: string) =>
  retried(
    async () =>
      gameFrom(
        'play/games add_time',
        await request(`play/games/${gameId}/add_time`, 'POST'),
      ),
    4,
  )

/**
 * Maia's move was shown before its thinking delay was over (thinking time
 * switched off meanwhile): Maia gets the unused time back, and the player's
 * clock starts now.
 */
export const skipDelayServerGame = (gameId: string) =>
  retried(
    async () =>
      gameFrom(
        'play/games skip_delay',
        await request(`play/games/${gameId}/skip_delay`, 'POST'),
      ),
    3,
  )

export const resignServerGame = (gameId: string) =>
  retried(
    async () =>
      gameFrom(
        'play/games resign',
        await request(`play/games/${gameId}/resign`, 'POST'),
      ),
    4,
  )

/** Tells the server the player's clock has run out; it answers with its own view. */
export const flagServerGame = (gameId: string) =>
  retried(
    async () =>
      gameFrom(
        'play/games flag',
        await request(`play/games/${gameId}/flag`, 'POST'),
      ),
    4,
  )

export const fetchServerGame = (gameId: string) =>
  retried(
    async () =>
      gameFrom('play/games', await request(`play/games/${gameId}`, 'GET')),
    4,
  )

/** The player's game in progress, or null. */
export const fetchCurrentServerGame = async (): Promise<ServerGame | null> => {
  const { res, data } = await request('play/games/current', 'GET')
  if (!res.ok) {
    throw new MoveRequestError(
      res.status,
      `play/games/current: HTTP ${res.status}`,
    )
  }
  return (data as { game: ServerGame | null })?.game ?? null
}
