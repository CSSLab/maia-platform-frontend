/** Game header sent to the human-bar server (POST /v1/bars). */
export interface HumanBarGameInfo {
  white: string
  black: string
  white_elo: number
  black_elo: number
  /** Lichess TimeControl tag, e.g. "180+2". */
  time_control: string
  /** Event tag, e.g. "Rated Blitz game". */
  event: string
  /** UTCDate + UTCTime as epoch milliseconds (null if the PGN lacks them). */
  start_ms: number | null
  site: string
}

/** One position of the game's main line. */
export interface HumanBarPositionInput {
  /** Ply: 0 = the start position, k = the position after move k. */
  p: number
  fen: string
  /** The site engine's eval for the side to move, centipawns. */
  cp: number
  /** The depth of that eval (the server's map onto the bars' scale uses it). */
  depth: number
  /** Maia3 value softmax [loss, draw, win] for the side to move. */
  value: [number, number, number]
  /** Base64 of the 512 little-endian float32 values of Maia3's repr. */
  repr: string
  /**
   * Maia's likely moves here (to 95% of its probability, at most 12), each as
   * the position after it with the same inputs, and Maia's probability of the
   * move. With them the server also returns the bars after each move and the
   * bar to show, half this position's and half their Maia-weighted average.
   */
  kids?: HumanBarKidInput[]
}

/** The position after one of Maia's likely moves. */
export interface HumanBarKidInput {
  fen: string
  /** Eval for the side to move there (the side that replies), centipawns. */
  cp: number
  depth: number
  value: [number, number, number]
  repr: string
  /** Maia's probability of the move at the position before it. */
  prob: number
}

export interface HumanBarRequest {
  game: HumanBarGameInfo
  /** The engine behind `cp` (HUMAN_BAR_ENGINE). */
  engine: string
  /** The Maia file behind `value` and `repr` (MAIA_MODEL_VERSION, e.g. "3.1"). */
  maia_model?: string
  /** Any of the game's positions (the browser evaluates them as needed). */
  positions: HumanBarPositionInput[]
  /** The whole game: clocks[i] = seconds left for the mover after move i + 1. */
  clocks: number[]
}

/**
 * Bars for one position (ply p = number of moves played). Probabilities are
 * from White's point of view: W = White wins, Dr = draw, L = Black wins.
 */
export interface HumanBarPly {
  p: number
  W: number
  Dr: number
  L: number
  /** Engine expected score for White (Lichess's curve on the eval). */
  eng_w: number
  /** Eval in centipawns from White's point of view. */
  cpw?: number
  /** Chance White plays a "??" on White's next move. */
  dW_K1_T15?: number
  dB_K1_T15?: number
  /** Chance of a "??" within that player's next 5 moves. */
  dW_K5_T15?: number
  dB_K5_T15?: number
  /** Within 5 moves, a major blunder. */
  dW_K5_T30?: number
  dB_K5_T30?: number
  dW_K10_T15?: number
  dB_K10_T15?: number
  dW_flag5?: number
  dB_flag5?: number
  /**
   * With the position's likely moves sent: the bar to show, half this
   * position's bar (W / Dr / L) and half the Maia-weighted average of the
   * bars after those moves (the server's one-move mix, practical LOG §90).
   */
  MW?: number
  MDr?: number
  ML?: number
  /** The bars after each likely move, in the order sent: [W, Dr, L]. */
  after?: [number, number, number][]
  /** Set in the browser when W / Dr / L show the mix: the position's own bar [W, Dr, L]. */
  own?: [number, number, number]
}

export interface HumanBarResponse {
  model: string
  /**
   * The players' form behind these bars: "prof" (their Lichess profiles),
   * "g50" (also their last 50 games), "none" (neither: the profiles were
   * not in on time, e.g. Lichess slow or down), ...
   */
  form?: string
  /** The server is still fetching the players' recent games (POST /v1/form). */
  upgrade_pending?: boolean
  plies: HumanBarPly[]
}

export interface HumanBarFormResponse {
  form: string
  /** Still fetching after the server's wait; ask again. */
  pending: boolean
}
