import { Color, PlayGameConfig, Termination, TimeControl } from 'src/types'
import { UnfinishedGame } from 'src/lib/unfinishedGame'

/**
 * Games the server holds (the backend's /play/games): the browser sends each
 * of the player's moves and is sent Maia's reply, the clocks and the result.
 * Switched on by NEXT_PUBLIC_SERVER_GAMES=1; otherwise games are run by the
 * browser and reported to the server, as before.
 */
export const SERVER_GAMES = process.env.NEXT_PUBLIC_SERVER_GAMES === '1'

/**
 * Whether a game with these settings is held by the server. Play games only:
 * hand and brain games, and practice games (takebacks, extra time), aren't
 * yet.
 */
export const usesServerGame = (config: PlayGameConfig) =>
  SERVER_GAMES && config.playType === 'againstMaia' && !config.practice

export interface ServerClock {
  white_ms: number
  black_ms: number
  increment_ms: number
  // The side whose clock is running, if one is.
  running: Color | null
  // How long it had been running when the server answered; negative while
  // Maia's move is still to be shown.
  since_ms: number
}

/** A game as the server reports it (the backend's game_state). */
export interface ServerGame {
  game_id: string
  player_color: Color
  maia_name: string
  time_control: string
  sample_moves: boolean
  practice: boolean
  fen: string
  moves: string[]
  move_times: number[]
  ply: number
  to_move: Color
  state: 'not_over' | 'rules' | 'resign' | 'time'
  winner: '' | 'white' | 'black' | 'draw'
  clock: ServerClock | null
  // Maia's move made in this answer, to show after `delay` seconds.
  bot_move: { uci: string; ply: number; delay: number } | null
  // The ratings after the game, in the answer that ended it.
  rating: {
    player_elo: number
    opponent_elo: number
    player_provisional: boolean | null
  } | null
}

/** How the game ended, as the board shows it; undefined while it goes on. */
export const serverTermination = (
  game: ServerGame,
): Termination | undefined => {
  if (game.state === 'not_over') return undefined
  if (game.winner === 'white' || game.winner === 'black') {
    return {
      result: game.winner === 'white' ? '1-0' : '0-1',
      winner: game.winner,
      type: game.state,
    }
  }
  return { result: '1/2-1/2', winner: 'none', type: game.state }
}

/**
 * Each clock's time left (ms) now, and whether one is running, from the
 * server's answer: the running side has already used `since_ms`.
 */
export const serverClocks = (game: ServerGame) => {
  if (!game.clock) return null
  const { white_ms, black_ms, running, since_ms } = game.clock
  const used = Math.max(0, since_ms)
  return {
    white: Math.max(0, running === 'white' ? white_ms - used : white_ms),
    black: Math.max(0, running === 'black' ? black_ms - used : black_ms),
    running: running !== null,
  }
}

/** The settings of a game the server holds, as /play/maia's address has them. */
export const serverGameConfig = (
  game: ServerGame,
  base: PlayGameConfig,
): PlayGameConfig => ({
  ...base,
  playType: 'againstMaia',
  player: game.player_color,
  maiaVersion: game.maia_name,
  timeControl: game.time_control as TimeControl,
  sampleMoves: game.sample_moves,
  startFen: game.fen || undefined,
  practice: game.practice,
})

/**
 * The game as the board starts from it. A move of Maia's that is still to be
 * shown (bot_move) is left off: the controller plays it after its delay.
 */
export const serverGameStart = (
  game: ServerGame,
  config: PlayGameConfig,
): UnfinishedGame => {
  const shown = game.bot_move ? game.bot_move.ply : game.moves.length
  const clocks = serverClocks(game)
  return {
    id: game.game_id,
    config,
    moves: game.moves.slice(0, shown),
    moveTimes: game.move_times.slice(0, shown),
    whiteClock: clocks?.white ?? 0,
    blackClock: clocks?.black ?? 0,
    savedAt: Date.now(),
  }
}

/** "Maia 1500, 5+3, move 12": an open game, for the setup dialog. */
export const describeServerGame = (game: ServerGame) => {
  const rating = game.maia_name.replace('maia_kdd_', '')
  const control =
    game.time_control === 'unlimited' ? 'unlimited' : game.time_control
  const move = Math.floor(game.ply / 2) + 1
  return `Maia ${rating}, ${control}, move ${move}`
}
