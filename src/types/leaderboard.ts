export interface LeaderboardEntry {
  display_name: string
  elo: number
}

export interface LeaderboardData {
  play_leaders: LeaderboardEntry[]
  puzzles_leaders: LeaderboardEntry[]
  turing_leaders: LeaderboardEntry[]
  hand_leaders: LeaderboardEntry[]
  brain_leaders: LeaderboardEntry[]
  last_updated: string
  // Days within which each board's players last played, by backend mode.
  // Empty until the backend's first rebuild of the boards that records it.
  window_days?: Partial<Record<RatedMode, number>>
}

// The backend's names for the modes a player is rated in.
export type RatedMode = 'play' | 'hand' | 'brain' | 'puzzles' | 'turing'

export type GameType = 'regular' | 'train' | 'turing' | 'hand' | 'brain'

export interface LeaderboardPosition {
  gameType: GameType
  gameName: string
  position: number
  elo: number
}

export interface LeaderboardStatus {
  isOnLeaderboard: boolean
  positions: LeaderboardPosition[]
  totalLeaderboards: number
}
