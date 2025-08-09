export interface BroadcastTour {
  id: string
  name: string
  slug: string
  info: Record<string, any>
  createdAt: number
  url: string
  tier: number
  dates: number[]
}

export interface BroadcastRound {
  id: string
  name: string
  slug: string
  createdAt: number
  ongoing: boolean
  startsAt: number
  rated: boolean
  url: string
}

export interface Broadcast {
  tour: BroadcastTour
  rounds: BroadcastRound[]
  defaultRoundId: string
}

export interface BroadcastGame {
  id: string
  white: string
  black: string
  result: string
  moves: string[]
  pgn: string
  fen: string
  lastMove?: [string, string]
  event: string
  site: string
  date: string
  round: string
  eco?: string
  opening?: string
  whiteElo?: number
  blackElo?: number
  timeControl?: string
  termination?: string
  annotator?: string
  studyName?: string
  chapterName?: string
  utcDate?: string
  utcTime?: string
  whiteClock?: {
    timeInSeconds: number
    isActive: boolean
    lastUpdateTime: number
  }
  blackClock?: {
    timeInSeconds: number
    isActive: boolean
    lastUpdateTime: number
  }
}

export interface BroadcastRoundData {
  roundId: string
  broadcastId: string
  games: Map<string, BroadcastGame>
  lastUpdate: number
}

export interface BroadcastState {
  isConnected: boolean
  isConnecting: boolean
  isLive: boolean
  error: string | null
  roundStarted: boolean
  roundEnded: boolean
  gameEnded: boolean
}

export interface TopBroadcastItem {
  tour: BroadcastTour
  round: BroadcastRound
}

export interface TopBroadcastsResponse {
  active: TopBroadcastItem[]
  upcoming: TopBroadcastItem[]
  past: {
    currentPage: number
    maxPerPage: number
    currentPageResults: TopBroadcastItem[]
    previousPage: number | null
    nextPage: number | null
  }
}

export interface BroadcastSection {
  title: string
  broadcasts: Broadcast[]
  type:
    | 'official-active'
    | 'unofficial-active'
    | 'official-upcoming'
    | 'unofficial-upcoming'
    | 'past'
}

export interface BroadcastStreamController {
  broadcastSections: BroadcastSection[]
  currentBroadcast: Broadcast | null
  currentRound: BroadcastRound | null
  currentGame: BroadcastGame | null
  currentLiveGame: unknown | null
  roundData: BroadcastRoundData | null
  broadcastState: BroadcastState
  loadBroadcasts: () => Promise<void>
  selectBroadcast: (broadcastId: string) => Promise<void>
  selectRound: (roundId: string) => void
  selectGame: (gameId: string) => void
  startRoundStream: (roundId: string) => void
  stopRoundStream: () => void
  reconnect: () => void
}

export interface PGNParseResult {
  games: BroadcastGame[]
  errors: string[]
}
