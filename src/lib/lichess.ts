import { Chess, type Move, type PartialMove, type PieceSymbol } from 'chess.ts'
import {
  GameTree,
  StreamedMove,
  type AnalyzedGame,
  type LiveGame,
  type Player,
  type AvailableMoves,
  type Termination,
} from 'src/types'
import { parsePgnTime } from './relativeTime'

/**
 * A FEN as python-chess writes it (and so as the backend stores positions):
 * the en passant square only when a capture there is legal.
 */
const fenWithLegalEnPassant = (chess: Chess) => {
  const fen = chess.fen()
  const fields = fen.split(' ')
  const target = fields[3]
  if (target === '-') return fen

  // Only the pawns beside the one that just moved two squares can capture.
  const rank = chess.turn() === 'w' ? '5' : '4'
  const file = 'abcdefgh'.indexOf(target[0])
  const canCapture = [file - 1, file + 1].some(
    (neighbour) =>
      neighbour >= 0 &&
      neighbour < 8 &&
      chess
        .moves({ square: `${'abcdefgh'[neighbour]}${rank}`, verbose: true })
        .some((move) => move.flags.includes('e')),
  )
  if (canCapture) return fen
  fields[3] = '-'
  return fields.join(' ')
}

const pgnPlayer = (name?: string, elo?: string, title?: string): Player => {
  const rating = Number(elo)
  return {
    name: name ?? '?',
    rating: Number.isFinite(rating) ? rating : 0,
    title,
  }
}

const SAN_PATTERN = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=([NBRQ]))?$/
const withoutCheck = (san: string) => san.replace(/[+#]$/, '')

/**
 * Plays a SAN move, trying only the pieces that could make it. chess.ts
 * reading SAN itself computes the SAN of every legal move (about 1 ms per
 * move, 70-140 ms for a long game); the SAN of the move played still has to
 * match.
 */
const playSan = (chess: Chess, san: string): Move | null => {
  const target = withoutCheck(san)
  const color = chess.turn()
  const candidates: PartialMove[] = []

  if (target === 'O-O' || target === 'O-O-O') {
    const rank = color === 'w' ? '1' : '8'
    candidates.push({
      from: `e${rank}`,
      to: `${target === 'O-O' ? 'g' : 'c'}${rank}`,
    })
  } else {
    const match = SAN_PATTERN.exec(target)
    if (!match) return null
    const [, piece = 'P', file, rank, to, promotion] = match
    chess.board().forEach((row, rowIndex) =>
      row.forEach((square, fileIndex) => {
        if (square?.color !== color || square.type !== piece.toLowerCase()) {
          return
        }
        const from = `${'abcdefgh'[fileIndex]}${8 - rowIndex}`
        if ((file && from[0] !== file) || (rank && from[1] !== rank)) return
        candidates.push({
          from,
          to,
          promotion: promotion?.toLowerCase() as PieceSymbol | undefined,
        })
      }),
    )
  }

  for (const candidate of candidates) {
    const move = chess.move(candidate)
    if (!move) continue
    if (withoutCheck(move.san) === target) return move
    chess.undo()
  }
  return null
}

const readPgnHeaders = (pgn: string) => {
  const headers: Record<string, string> = {}
  for (const [, key, value] of pgn.matchAll(/^\[(\w+)\s+"(.*)"\]\s*$/gm)) {
    headers[key] = value.replace(/\\(["\\])/g, '$1')
  }
  return headers
}

/**
 * When a PGN's game was started, in epoch milliseconds, from the `UTCDate`
 * and `UTCTime` headers Lichess writes; null without them.
 */
export const readPgnTime = (pgn: string): number | null => {
  const headers = readPgnHeaders(pgn)
  return parsePgnTime(headers.UTCDate, headers.UTCTime)?.getTime() ?? null
}

/** The SAN moves of a PGN's main line, without comments, variations or NAGs. */
const readPgnMoves = (pgn: string) => {
  let text = pgn
    .replace(/^\[.*\]\s*$/gm, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\n]*/g, ' ')
    .replace(/\$\d+/g, ' ')
  for (let previous = ''; previous !== text; ) {
    previous = text
    text = text.replace(/\([^()]*\)/g, ' ')
  }
  return text
    .split(/\s+/)
    .map((token) => token.replace(/^\d+\.+/, '').replace(/[!?]+$/, ''))
    .filter((token) => token && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token))
}

/**
 * Builds a Lichess game from its PGN as the backend's `analyze_user_game`
 * does (same players, result and FENs), so the board need not wait for that
 * request. Returns null for games left to the backend: variants, games from a
 * set-up position and PGNs this cannot read.
 */
export const parseLichessPgn = (
  id: string,
  pgn: string,
): Omit<AnalyzedGame, 'type'> | null => {
  const headers = readPgnHeaders(pgn)
  if (
    (headers.Variant && headers.Variant !== 'Standard') ||
    headers.SetUp ||
    headers.FEN
  ) {
    return null
  }

  const chess = new Chess()
  const tree = new GameTree(chess.fen())
  for (const san of readPgnMoves(pgn)) {
    const move = playSan(chess, san)
    if (!move) return null
    tree
      .getLastMainlineNode()
      .addChild(
        fenWithLegalEnPassant(chess),
        `${move.from}${move.to}${move.promotion ?? ''}`,
        move.san,
        true,
      )
  }

  // "*": the game isn't over (or its result is unknown), so it has no
  // ending to show, rather than a draw.
  const result = headers.Result ?? '*'
  const termination: Termination | undefined =
    result === '*'
      ? undefined
      : {
          result,
          winner:
            result === '1-0' ? 'white' : result === '0-1' ? 'black' : 'none',
          condition: 'Normal',
        }

  return {
    id,
    whitePlayer: pgnPlayer(headers.White, headers.WhiteElo, headers.WhiteTitle),
    blackPlayer: pgnPlayer(headers.Black, headers.BlackElo, headers.BlackTitle),
    // Not read for Lichess games (the page lists moves from the tree).
    availableMoves: [],
    gameType: 'blitz',
    termination,
    tree,
    createdAt: readPgnTime(pgn),
  }
}

export const readLichessStream =
  (processLine: (data: any) => void) => (response: any) => {
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

export const convertLichessStreamToLiveGame = (gameData: any): LiveGame => {
  const { players, id } = gameData

  const whitePlayer: Player = {
    name: players?.white?.user?.id || 'White',
    rating: players?.white?.rating,
  }

  const blackPlayer: Player = {
    name: players?.black?.user?.id || 'Black',
    rating: players?.black?.rating,
  }

  const startingFen =
    gameData.initialFen ||
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  const gameStates = [
    {
      board: startingFen,
      lastMove: undefined as [string, string] | undefined,
      san: undefined as string | undefined,
      check: false as const,
      maia_values: {},
    },
  ]

  const tree = new GameTree(startingFen)

  return {
    id,
    blackPlayer,
    whitePlayer,
    gameType: 'stream',
    type: 'stream' as const,
    moves: gameStates,
    availableMoves: new Array(gameStates.length).fill({}) as AvailableMoves[],
    termination: undefined,
    maiaEvaluations: [],
    stockfishEvaluations: [],
    loadedFen: gameData.fen,
    loaded: false,
    tree,
  } as LiveGame
}

export const handleLichessStreamMove = (
  moveData: StreamedMove,
  currentGame: LiveGame,
) => {
  const { uci, fen } = moveData

  if (!uci || !fen || !currentGame.tree) {
    return currentGame
  }

  let san = uci
  try {
    let beforeMoveNode = currentGame.tree.getRoot()
    while (beforeMoveNode.mainChild) {
      beforeMoveNode = beforeMoveNode.mainChild
    }

    const chess = new Chess(beforeMoveNode.fen)
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] ? (uci[4] as any) : undefined,
    })

    if (move) {
      san = move.san
    }
  } catch (error) {
    console.warn('Could not convert UCI to SAN:', error)
  }

  let currentNode = currentGame.tree.getRoot()
  while (currentNode.mainChild) {
    currentNode = currentNode.mainChild
  }

  try {
    currentGame.tree.getLastMainlineNode().addChild(fen, uci, san, true)
  } catch (error) {
    console.error('Error adding move to tree:', error)
    return currentGame
  }

  const updatedAvailableMoves = [...currentGame.availableMoves, {}]

  return {
    ...currentGame,
    availableMoves: updatedAvailableMoves,
  }
}
