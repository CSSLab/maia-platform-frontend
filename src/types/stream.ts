import { AnalyzedGame } from './analysis'

export interface LiveGame extends AnalyzedGame {
  loadedFen: string
  loaded: boolean
}

export interface LiveGameData {
  gameId: string
  white: {
    name: string
    rating?: number
  }
  black: {
    name: string
    rating?: number
  }
  lastMoveFen?: string
  isLive: boolean
}

export interface StreamedGame {
  id: string
  fen: string
  initialFen: string
  players: {
    white: {
      rating: number
      user: {
        id: string
        name: string
      }
    }
    black: {
      rating: number
      user: {
        id: string
        name: string
      }
    }
  }
  winner?: 'white' | 'black'
  status?: {
    id: number
    name: string
  }
}

export interface StreamedMove {
  fen: string
  uci: string
  wc: number
  bc: number
}

export interface StreamState {
  isConnected: boolean
  isConnecting: boolean
  isLive: boolean
  error: string | null
  gameStarted: boolean
  gameEnded: boolean
}

export interface ClockState {
  whiteTime: number
  blackTime: number
  activeColor: 'white' | 'black' | null
  lastUpdateTime: number
}
