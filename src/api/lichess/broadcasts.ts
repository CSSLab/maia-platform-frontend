import { Chess } from 'chess.ts'
import {
  Broadcast,
  BroadcastGame,
  PGNParseResult,
  TopBroadcastsResponse,
  TopBroadcastItem,
} from 'src/types'

const readStream = (processLine: (data: any) => void) => (response: any) => {
  const stream = response.body.getReader()
  const matcher = /\r?\n/
  const decoder = new TextDecoder()
  let buf = ''

  const loop = () =>
    stream.read().then(({ done, value }: { done: boolean; value: any }) => {
      if (done) {
        if (buf.length > 0) processLine(JSON.parse(buf))
      } else {
        const chunk = decoder.decode(value, {
          stream: true,
        })
        buf += chunk

        const parts = (buf || '').split(matcher)
        buf = parts.pop() as string
        for (const i of parts.filter((p) => p)) processLine(JSON.parse(i))

        return loop()
      }
    })

  return loop()
}

export const getLichessBroadcasts = async (): Promise<Broadcast[]> => {
  const response = await fetch('https://lichess.org/api/broadcast', {
    headers: {
      Accept: 'application/x-ndjson',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const broadcasts: Broadcast[] = []

  return new Promise((resolve, reject) => {
    const onMessage = (message: any) => {
      try {
        broadcasts.push(message as Broadcast)
      } catch (error) {
        console.error('Error parsing broadcast message:', error)
      }
    }

    const onComplete = () => {
      resolve(broadcasts)
    }

    readStream(onMessage)(response).then(onComplete).catch(reject)
  })
}

export const getLichessBroadcastById = async (
  broadcastId: string,
): Promise<Broadcast | null> => {
  try {
    console.log('Fetching broadcast by ID:', broadcastId)
    const response = await fetch(
      `https://lichess.org/api/broadcast/${broadcastId}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    )

    if (!response.ok) {
      console.error(`Failed to fetch broadcast: ${response.status}`)
      return null
    }

    const data = await response.json()
    console.log('Broadcast data received:', {
      name: data.tour?.name,
      rounds: data.rounds?.length,
      roundNames: data.rounds?.map((r: any) => r.name),
    })

    // Validate that this looks like broadcast data
    if (data.tour && data.rounds) {
      return data as Broadcast
    }

    console.error('Invalid broadcast data structure')
    return null
  } catch (error) {
    console.error('Error fetching broadcast by ID:', error)
    return null
  }
}

export const getLichessTopBroadcasts =
  async (): Promise<TopBroadcastsResponse> => {
    const response = await fetch('https://lichess.org/api/broadcast/top', {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

export const convertTopBroadcastToBroadcast = (
  item: TopBroadcastItem,
): Broadcast => {
  return {
    tour: item.tour,
    rounds: [item.round],
    defaultRoundId: item.round.id,
  }
}

export const getBroadcastRoundPGN = async (
  roundId: string,
): Promise<string> => {
  const response = await fetch(
    `https://lichess.org/api/broadcast/round/${roundId}.pgn`,
    {
      headers: {
        Accept: 'application/x-chess-pgn',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return await response.text()
}

export const streamBroadcastRound = async (
  roundId: string,
  onPGNUpdate: (pgn: string) => void,
  onComplete: () => void,
  abortSignal?: AbortSignal,
) => {
  const stream = fetch(
    `https://lichess.org/api/stream/broadcast/round/${roundId}.pgn`,
    {
      signal: abortSignal,
      headers: {
        Accept: 'application/x-chess-pgn',
      },
    },
  )

  const onMessage = (data: string) => {
    if (data.trim()) {
      onPGNUpdate(data)
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

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        if (buffer.trim()) {
          onMessage(buffer)
        }
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk

      // Split on double newlines to separate PGN games
      const parts = buffer.split('\n\n\n')
      buffer = parts.pop() || ''

      for (const part of parts) {
        if (part.trim()) {
          onMessage(part)
        }
      }
    }

    onComplete()
  } catch (error) {
    if (abortSignal?.aborted) {
      console.log('Broadcast stream aborted')
    } else {
      console.error('Broadcast stream error:', error)
      throw error
    }
  }
}

export const parsePGNData = (pgnData: string): PGNParseResult => {
  const games: BroadcastGame[] = []
  const errors: string[] = []

  try {
    // Split the PGN data into individual games
    const gameStrings = pgnData
      .split(/\n\n\[Event/)
      .filter((game) => game.trim())

    for (let i = 0; i < gameStrings.length; i++) {
      let gameString = gameStrings[i]

      // Add back the [Event header if it was removed by split
      if (i > 0 && !gameString.startsWith('[Event')) {
        gameString = '[Event' + gameString
      }

      try {
        const game = parseSinglePGN(gameString)
        if (game) {
          games.push(game)
        }
      } catch (error) {
        errors.push(`Error parsing game ${i + 1}: ${error}`)
      }
    }
  } catch (error) {
    errors.push(`Error splitting PGN data: ${error}`)
  }

  return { games, errors }
}

const parseSinglePGN = (pgnString: string): BroadcastGame | null => {
  const lines = pgnString.trim().split('\n')
  const headers: Record<string, string> = {}
  let movesSection = ''
  let inMoves = false

  // Parse headers and moves
  for (const line of lines) {
    const trimmedLine = line.trim()

    if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
      // Parse header
      const match = trimmedLine.match(/^\[(\w+)\s+"([^"]*)"\]$/)
      if (match) {
        headers[match[1]] = match[2]
      }
    } else if (trimmedLine && !inMoves) {
      inMoves = true
      movesSection = trimmedLine
    } else if (inMoves && trimmedLine) {
      movesSection += ' ' + trimmedLine
    }
  }

  // Extract essential data
  const white = headers.White || 'Unknown'
  const black = headers.Black || 'Unknown'
  const result = headers.Result || '*'
  const event = headers.Event || ''
  const site = headers.Site || ''
  const date = headers.Date || headers.UTCDate || ''
  const round = headers.Round || ''

  // Parse moves and clock information from full PGN
  console.log(`Parsing PGN for ${white} vs ${black}`)
  const parseResult = parseMovesAndClocksFromPGN(pgnString)
  const moves = parseResult.moves
  const { whiteClock, blackClock } = parseResult
  const fen = extractFENFromMoves()

  // Debug clock parsing
  if (whiteClock || blackClock) {
    console.log(`Clock data for ${white} vs ${black}:`, {
      whiteClock,
      blackClock,
      movesSection: movesSection.substring(0, 200) + '...',
    })
  }

  const game: BroadcastGame = {
    id: generateGameId(white, black, event, site),
    white,
    black,
    result,
    moves,
    pgn: pgnString,
    fen: fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    event,
    site,
    date,
    round,
    eco: headers.ECO,
    opening: headers.Opening,
    whiteElo: headers.WhiteElo ? parseInt(headers.WhiteElo) : undefined,
    blackElo: headers.BlackElo ? parseInt(headers.BlackElo) : undefined,
    timeControl: headers.TimeControl,
    termination: headers.Termination,
    annotator: headers.Annotator,
    studyName: headers.StudyName,
    chapterName: headers.ChapterName,
    utcDate: headers.UTCDate,
    utcTime: headers.UTCTime,
    whiteClock,
    blackClock,
  }

  // Note: Last move extraction would need proper move parsing to convert SAN to UCI
  // For now, we'll leave it undefined and handle in the controller

  return game
}

const parseMovesAndClocksFromPGN = (
  pgnString: string,
): {
  moves: string[]
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
} => {
  const moves: string[] = []
  let whiteClock:
    | { timeInSeconds: number; isActive: boolean; lastUpdateTime: number }
    | undefined
  let blackClock:
    | { timeInSeconds: number; isActive: boolean; lastUpdateTime: number }
    | undefined

  try {
    // Use chess.js to parse the full PGN
    const chess = new Chess()
    const success = chess.loadPgn(pgnString)

    if (!success) {
      console.warn(
        'Failed to parse PGN with chess.js, falling back to manual parsing',
      )
      return { moves }
    }

    // Get all moves from the game history
    const history = chess.history({ verbose: true })
    for (const move of history) {
      moves.push(move.san)
    }

    // Get comments which contain clock information
    const comments = chess.getComments()
    let lastWhiteClock: any = null
    let lastBlackClock: any = null

    for (const commentData of comments) {
      const comment = commentData.comment

      // Extract clock from comment using regex
      const clockMatch = comment.match(/\[%clk\s+(\d+):(\d+)(?::(\d+))?\]/)
      if (clockMatch) {
        const hours = clockMatch[3] ? parseInt(clockMatch[1]) : 0
        const minutes = clockMatch[3]
          ? parseInt(clockMatch[2])
          : parseInt(clockMatch[1])
        const seconds = clockMatch[3]
          ? parseInt(clockMatch[3])
          : parseInt(clockMatch[2])

        const timeInSeconds = hours * 3600 + minutes * 60 + seconds
        const clockData = {
          timeInSeconds,
          isActive: false,
          lastUpdateTime: Date.now(),
        }

        // Determine if this is white or black's move based on the FEN
        const chess_temp = new Chess(commentData.fen)
        const isWhiteToMove = chess_temp.turn() === 'b' // After white's move, it's black's turn

        if (isWhiteToMove) {
          lastWhiteClock = clockData
        } else {
          lastBlackClock = clockData
        }

        console.log(
          `Found clock for ${isWhiteToMove ? 'white' : 'black'}: ${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} = ${timeInSeconds}s`,
        )
      }
    }

    whiteClock = lastWhiteClock
    blackClock = lastBlackClock

    // Determine which clock is active based on current turn
    if (moves.length > 0) {
      const finalPosition = new Chess()
      finalPosition.loadPgn(pgnString)
      const isCurrentlyWhiteTurn = finalPosition.turn() === 'w'

      if (whiteClock) {
        whiteClock.isActive = isCurrentlyWhiteTurn
      }
      if (blackClock) {
        blackClock.isActive = !isCurrentlyWhiteTurn
      }
    }
  } catch (error) {
    console.warn('Error parsing PGN with chess.js:', error)
  }

  return { moves, whiteClock, blackClock }
}

const extractFENFromMoves = (): string | null => {
  // This would require a full chess engine to calculate the FEN from moves
  // For now, return null and handle in the controller with chess.js
  return null
}

const generateGameId = (
  white: string,
  black: string,
  event: string,
  site: string,
): string => {
  const baseString = `${white}-${black}-${event}-${site}`
  // Use a simple hash instead of deprecated btoa for better compatibility
  let hash = 0
  for (let i = 0; i < baseString.length; i++) {
    const char = baseString.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 12)
}
