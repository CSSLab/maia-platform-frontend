/* eslint-disable @typescript-eslint/no-explicit-any */
import { readLichessStream } from 'src/lib'
import { StreamedGame, StreamedMove } from 'src/types'

export const fetchLichessTVGame = async () => {
  const res = await fetch('https://lichess.org/api/tv/channels')
  if (!res.ok) {
    throw new Error('Failed to fetch Lichess TV data')
  }
  const data = await res.json()

  // Return the best rapid game (highest rated players)
  const bestChannel = data.rapid
  if (!bestChannel?.gameId) {
    throw new Error('No TV game available')
  }

  return {
    gameId: bestChannel.gameId,
    white: bestChannel.user1,
    black: bestChannel.user2,
  }
}

export const fetchLichessGameInfo = async (gameId: string) => {
  const res = await fetch(`https://lichess.org/api/game/${gameId}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch game info for ${gameId}`)
  }
  return res.json()
}

export const streamLichessGameMoves = async (
  gameId: string,
  onGameInfo: (data: StreamedGame) => void,
  onMove: (data: StreamedMove) => void,
  onComplete: () => void,
  abortSignal?: AbortSignal,
) => {
  const stream = fetch(`https://lichess.org/api/stream/game/${gameId}`, {
    signal: abortSignal,
    headers: {
      Accept: 'application/x-ndjson',
    },
  })

  const onMessage = (message: any) => {
    if (message.id) {
      onGameInfo(message as StreamedGame)
    } else if (message.uci || message.lm) {
      onMove({
        fen: message.fen,
        uci: message.uci || message.lm,
        wc: message.wc,
        bc: message.bc,
      })
    } else {
      console.log('Unknown message format:', message)
    }
  }

  try {
    const response = await stream

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    await readLichessStream(onMessage)(response).then(onComplete)
  } catch (error) {
    if (abortSignal?.aborted) {
      console.log('Stream aborted')
    } else {
      console.error('Stream error:', error)
      throw error
    }
  }
}
