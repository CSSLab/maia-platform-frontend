import { Chess } from 'chess.ts'
import { GameNode, GameTree, User } from 'src/types'

/**
 * PGN with variations, both ways. chess.ts reads and writes only a game's main
 * line (it drops anything in parentheses), so the analysis tree's variations,
 * the user's own and those of an imported game, are read and written here.
 */

const STANDARD_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// The Seven Tag Roster, which PGN puts first and in this order.
const SEVEN_TAG_ROSTER = [
  'Event',
  'Site',
  'Date',
  'Round',
  'White',
  'Black',
  'Result',
] as const

const SEVEN_TAG_DEFAULTS: Record<string, string> = {
  Event: '?',
  Site: '?',
  Date: '????.??.??',
  Round: '?',
  White: '?',
  Black: '?',
  Result: '*',
}

const RESULT_TOKENS = ['1-0', '0-1', '1/2-1/2', '*']

export type PgnHeaders = Record<string, string | number | undefined | null>

// The position without the move clocks, which don't change what's on the board.
const positionKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ')

const escapeHeaderValue = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

/** "2026.11.06", PGN's form of a date (in the player's time zone). */
export const formatPgnDate = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('.')

/**
 * The name a PGN gives the person playing: their Lichess name when signed in,
 * or "Guest". The account of a visitor who isn't signed in has no name worth
 * writing (a user saw their opponent's name exported as missing).
 */
export const pgnPlayerName = (user: User | null | undefined): string => {
  if (!user?.lichessId) return 'Guest'
  return pgnNameOr(user.displayName, user.lichessId)
}

/**
 * A stored player's name for a PGN, or `fallback` when there's none: games
 * played by a visitor who wasn't signed in are stored without a name, or with
 * "None".
 */
export const pgnNameOr = (
  name: string | null | undefined,
  fallback: string,
) => {
  const trimmed = name?.trim()
  return trimmed && !/^(none|null|undefined)$/i.test(trimmed)
    ? trimmed
    : fallback
}

const sanOf = (parent: GameNode, child: GameNode): string => {
  if (child.san) return child.san
  const move = child.move
    ? new Chess(parent.fen).move(child.move, { sloppy: true })
    : null
  return move?.san ?? child.move ?? ''
}

/**
 * The move from `parent` to `child` as PGN writes it: with its number before
 * White's moves, and before Black's when it starts a line or follows a
 * variation ("5... Nf6").
 */
const moveToken = (parent: GameNode, child: GameNode, withNumber: boolean) => {
  const [, side, , , , fullMove] = parent.fen.split(' ')
  const number = parseInt(fullMove, 10) || 1
  const san = sanOf(parent, child)
  if (side !== 'b') return `${number}. ${san}`
  return withNumber ? `${number}... ${san}` : san
}

/**
 * The moves from `start` on: its main continuation, each alternative in
 * parentheses right after the move it replaces. A node off the main line keeps
 * its continuation as its first child (see GameTree.addVariationNode).
 */
const writeLine = (start: GameNode, numberFirst: boolean, out: string[]) => {
  let node = start
  let withNumber = numberFirst
  for (;;) {
    const children = node.children
    if (children.length === 0) return
    const main = node.mainChild ?? children[0]

    out.push(moveToken(node, main, withNumber))
    withNumber = false

    for (const alternative of children) {
      if (alternative === main) continue
      const line = [moveToken(node, alternative, true)]
      writeLine(alternative, false, line)
      out.push(`(${line.join(' ')})`)
      // Black's next move after a variation needs its number again.
      withNumber = true
    }

    node = main
  }
}

/**
 * The game as PGN, with every variation in the tree. Headers left out of the
 * Seven Tag Roster get PGN's "unknown" values, and a game from a set-up
 * position gets its SetUp and FEN headers.
 */
export const gameTreeToPgn = (tree: GameTree, headers: PgnHeaders): string => {
  const root = tree.getRoot()
  const values = new Map<string, string>()
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text) values.set(key, text)
  }

  const isStandardStart =
    positionKey(root.fen) === positionKey(STANDARD_START_FEN)
  values.delete('SetUp')
  values.delete('FEN')

  const lines: string[] = []
  const writeHeader = (key: string, value: string) =>
    lines.push(`[${key} "${escapeHeaderValue(value)}"]`)

  for (const key of SEVEN_TAG_ROSTER) {
    writeHeader(key, values.get(key) ?? SEVEN_TAG_DEFAULTS[key])
  }
  if (!isStandardStart) {
    writeHeader('SetUp', '1')
    writeHeader('FEN', root.fen)
  }
  values.forEach((value, key) => {
    if (!(SEVEN_TAG_ROSTER as readonly string[]).includes(key)) {
      writeHeader(key, value)
    }
  })

  const moves: string[] = []
  writeLine(root, true, moves)
  const result = values.get('Result') ?? '*'
  moves.push(RESULT_TOKENS.includes(result) ? result : '*')

  return `${lines.join('\n')}\n\n${moves.join(' ')}`
}

export interface ParsedPgn {
  headers: Record<string, string>
  tree: GameTree
}

const HEADER_REGEX = /^\s*\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/

const parseHeaders = (pgn: string) => {
  const headers: Record<string, string> = {}
  const lines = pgn.replace(/\r\n?/g, '\n').split('\n')
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '' && Object.keys(headers).length === 0) {
      index++
      continue
    }
    const match = line.match(HEADER_REGEX)
    if (!match) break
    headers[match[1]] = match[2].replace(/\\(["\\])/g, '$1')
    index++
  }
  return { headers, movetext: lines.slice(index).join('\n') }
}

type Token =
  | { type: 'move'; san: string }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'result'; result: string }

const tokenizeMovetext = (movetext: string): Token[] => {
  const tokens: Token[] = []
  let i = 0
  while (i < movetext.length) {
    const char = movetext[i]
    const rest = movetext.slice(i)

    if (/\s/.test(char)) {
      i++
    } else if (char === '{') {
      const end = movetext.indexOf('}', i)
      i = end === -1 ? movetext.length : end + 1
    } else if (char === ';') {
      const end = movetext.indexOf('\n', i)
      i = end === -1 ? movetext.length : end + 1
    } else if (char === '(') {
      tokens.push({ type: 'open' })
      i++
    } else if (char === ')') {
      tokens.push({ type: 'close' })
      i++
    } else {
      const result = rest.match(/^(1-0|0-1|1\/2-1\/2|\*)(?=[\s)]|$)/)
      const number = rest.match(/^\d+\s*\.+/)
      const nag = rest.match(/^\$\d+/)
      if (result) {
        tokens.push({ type: 'result', result: result[1] })
        i += result[0].length
      } else if (number) {
        i += number[0].length
      } else if (nag) {
        i += nag[0].length
      } else {
        const word = rest.match(/^[^\s(){};]+/)?.[0] ?? char
        i += word.length
        // Annotation glyphs ("!?") aren't part of the move; old PGNs write
        // castling with zeros.
        const san = word
          .replace(/[!?]+$/g, '')
          .replace(/^0-0-0/, 'O-O-O')
          .replace(/^0-0/, 'O-O')
        if (san && !/^([!?]+|e\.p\.?)$/.test(word)) {
          tokens.push({ type: 'move', san })
        }
      }
    }
  }
  return tokens
}

/**
 * One game of PGN as a tree, its variations included. A move that can't be
 * played ends its variation (the rest of it is skipped), but in the main line
 * it makes the whole game unreadable: null.
 */
export const parsePgnWithVariations = (pgn: string): ParsedPgn | null => {
  const { headers, movetext } = parseHeaders(pgn.trim())

  let rootFen = STANDARD_START_FEN
  if (headers.FEN) {
    const validation = new Chess().validateFen(headers.FEN)
    if (!validation.valid) return null
    rootFen = headers.FEN
  }

  const tree = new GameTree(rootFen)
  Object.entries(headers).forEach(([key, value]) => tree.setHeader(key, value))

  interface Line {
    // The position after the line's last move, and the one before it, where
    // a variation (an alternative to that move) starts.
    node: GameNode
    before: GameNode | null
    mainline: boolean
    broken: boolean
  }
  const stack: Line[] = [
    { node: tree.getRoot(), before: null, mainline: true, broken: false },
  ]

  for (const token of tokenizeMovetext(movetext)) {
    const line = stack[stack.length - 1]

    if (token.type === 'open') {
      stack.push({
        node: line.before ?? line.node,
        before: null,
        mainline: false,
        broken: line.broken || !line.before,
      })
      continue
    }

    if (token.type === 'close') {
      if (stack.length > 1) stack.pop()
      continue
    }

    // The result after the moves stands for a missing Result header.
    if (token.type === 'result') {
      if (stack.length === 1 && !headers.Result) headers.Result = token.result
      continue
    }

    if (line.broken) continue

    const chess = new Chess(line.node.fen)
    const move = chess.move(token.san, { sloppy: true })
    if (!move) {
      if (line.mainline) return null
      line.broken = true
      continue
    }

    const uci = move.from + move.to + (move.promotion ?? '')
    const existing = line.node.children.find((child) => child.move === uci)
    const child =
      existing ??
      (line.mainline
        ? tree.addMainlineNode(line.node, chess.fen(), uci, move.san)
        : tree.addVariationNode(line.node, chess.fen(), uci, move.san))
    line.before = line.node
    line.node = child
  }

  return { headers, tree }
}

/** Whether the tree has a move off its main line. */
export const hasVariations = (tree: GameTree): boolean => {
  const visit = (node: GameNode): boolean =>
    node.children.some((child) => !child.isMainline || visit(child))
  return visit(tree.getRoot())
}

/**
 * Adds the moves of `source` that `target` lacks to `target`, as variations.
 * The trees are matched move by move from the start, so `target` gets the
 * variations of a game whose main line it already has. A main line that goes
 * on past the end of `target`'s stays the main line. Returns the number of
 * moves added (0 when the games start from different positions).
 */
export const graftVariations = (target: GameTree, source: GameTree): number => {
  const targetRoot = target.getRoot()
  const sourceRoot = source.getRoot()
  if (positionKey(targetRoot.fen) !== positionKey(sourceRoot.fen)) return 0

  let added = 0
  const visit = (into: GameNode, from: GameNode) => {
    for (const child of from.children) {
      let match = into.children.find(
        (existing) =>
          existing.move === child.move ||
          positionKey(existing.fen) === positionKey(child.fen),
      )
      if (!match) {
        if (!child.move || !child.san) continue
        match =
          child.isMainline && into.isMainline && !into.mainChild
            ? target.addMainlineNode(into, child.fen, child.move, child.san)
            : target.addVariationNode(into, child.fen, child.move, child.san)
        added++
      }
      visit(match, child)
    }
  }
  visit(targetRoot, sourceRoot)
  return added
}

/**
 * The games in a PGN file with several (a Lichess study's chapters, say),
 * split where a header block starts after moves.
 */
export const splitPgnGames = (text: string): string[] => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const games: string[][] = []
  let current: string[] = []
  let seenMoves = false

  for (const line of lines) {
    const isHeader = HEADER_REGEX.test(line)
    if (isHeader && seenMoves) {
      games.push(current)
      current = []
      seenMoves = false
    }
    if (!isHeader && line.trim()) seenMoves = true
    current.push(line)
  }
  games.push(current)

  return games.map((game) => game.join('\n').trim()).filter((game) => !!game)
}

/** A PGN's headers, read without its moves. */
export const readPgnHeaders = (pgn: string): Record<string, string> =>
  parseHeaders(pgn.trim()).headers
