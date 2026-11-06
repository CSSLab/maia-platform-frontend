import { Chess } from 'chess.ts'
import { GameTree } from 'src/types'
import {
  formatPgnDate,
  gameTreeToPgn,
  graftVariations,
  hasVariations,
  parsePgnWithVariations,
  pgnPlayerName,
  splitPgnGames,
} from './pgn'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const movetextOf = (pgn: string) => pgn.split('\n\n')[1]

// A tree of the main line, as the backend's games are built.
const mainlineTree = (moves: string[], fen = START) => {
  const tree = new GameTree(fen)
  const chess = new Chess(fen)
  let node = tree.getRoot()
  for (const san of moves) {
    const move = chess.move(san)
    if (!move) throw new Error(san)
    const uci = move.from + move.to + (move.promotion ?? '')
    node = tree.addMainlineNode(node, chess.fen(), uci, move.san)
  }
  return tree
}

describe('gameTreeToPgn', () => {
  it('writes the main line with the Seven Tag Roster first', () => {
    const tree = mainlineTree(['e4', 'e5', 'Nf3'])
    const pgn = gameTreeToPgn(tree, {
      ID: 'abc',
      White: 'Guest',
      Black: 'Maia-3 1500',
      Result: '1-0',
      WhiteElo: 1500,
      BlackElo: undefined,
    })
    expect(pgn.split('\n\n')[0].split('\n')).toEqual([
      '[Event "?"]',
      '[Site "?"]',
      '[Date "????.??.??"]',
      '[Round "?"]',
      '[White "Guest"]',
      '[Black "Maia-3 1500"]',
      '[Result "1-0"]',
      '[ID "abc"]',
      '[WhiteElo "1500"]',
    ])
    expect(movetextOf(pgn)).toBe('1. e4 e5 2. Nf3 1-0')
  })

  it('writes variations with their move numbers', () => {
    const tree = mainlineTree(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
    const [root, e4, e5, nf3] = tree.getMainLine()

    // 1... c5 2. c3, an alternative to Black's first move.
    let chess = new Chess(e4.fen)
    chess.move('c5')
    const c5 = tree.addVariationNode(e4, chess.fen(), 'c7c5', 'c5')
    chess.move('c3')
    tree.addVariationNode(c5, chess.fen(), 'c2c3', 'c3')

    // 2... Nf6 instead of 2... Nc6, then 2. Bc4 (2. d4) for White's second.
    chess = new Chess(nf3.fen)
    chess.move('Nf6')
    tree.addVariationNode(nf3, chess.fen(), 'g8f6', 'Nf6')
    chess = new Chess(e5.fen)
    chess.move('Bc4')
    tree.addVariationNode(e5, chess.fen(), 'f1c4', 'Bc4')

    expect(root.children).toHaveLength(1)
    expect(movetextOf(gameTreeToPgn(tree, {}))).toBe(
      '1. e4 e5 (1... c5 2. c3) 2. Nf3 (2. Bc4) 2... Nc6 (2... Nf6) 3. Bb5 *',
    )
  })

  it('writes the set-up position of a game that starts from one', () => {
    const fen =
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'
    const pgn = gameTreeToPgn(mainlineTree(['Bb5', 'a6'], fen), {})
    expect(pgn).toContain('[SetUp "1"]')
    expect(pgn).toContain(`[FEN "${fen}"]`)
    expect(movetextOf(pgn)).toBe('3. Bb5 a6 *')
  })

  it('starts with "N..." when Black moves first', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    expect(movetextOf(gameTreeToPgn(mainlineTree(['e5'], fen), {}))).toBe(
      '1... e5 *',
    )
  })

  it('escapes quotes in header values', () => {
    const pgn = gameTreeToPgn(new GameTree(START), { Event: 'A "big" game' })
    expect(pgn).toContain('[Event "A \\"big\\" game"]')
  })
})

describe('parsePgnWithVariations', () => {
  const pgn = `[Event "Study"]
[White "A"]

1. e4 {best by test} e5 (1... c5 2. Nf3 (2. c3 d5) d6) 2. Nf3 $1 Nc6!? (2... Nf6 3. Nxe5) 3. Bb5 1-0`

  it('reads headers, the main line and its variations', () => {
    const parsed = parsePgnWithVariations(pgn)
    expect(parsed).not.toBeNull()
    const { headers, tree } = parsed!
    // The result after the moves stands for the missing Result header.
    expect(headers).toEqual({ Event: 'Study', White: 'A', Result: '1-0' })
    expect(tree.getMainLine().map((node) => node.san)).toEqual([
      null,
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'Bb5',
    ])
    expect(hasVariations(tree)).toBe(true)
  })

  it('round-trips through gameTreeToPgn', () => {
    const { tree, headers } = parsePgnWithVariations(pgn)!
    expect(movetextOf(gameTreeToPgn(tree, headers))).toBe(
      '1. e4 e5 (1... c5 2. Nf3 (2. c3 d5) 2... d6) 2. Nf3 Nc6 (2... Nf6 3. Nxe5) 3. Bb5 1-0',
    )
  })

  it('skips the rest of a variation with a move that cannot be played', () => {
    const { tree } = parsePgnWithVariations('1. e4 (1. d4 Ke2 d5) e5')!
    const d4 = tree.getRoot().children.find((child) => child.san === 'd4')
    expect(d4?.children).toHaveLength(0)
    expect(tree.getMainLine()).toHaveLength(3)
  })

  it('gives null when the main line cannot be played', () => {
    expect(parsePgnWithVariations('1. e4 e5 2. Ke3')).toBeNull()
  })

  it('reads castling written with zeros and a set-up position', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'
    const { tree } = parsePgnWithVariations(
      `[SetUp "1"]\n[FEN "${fen}"]\n\n1. 0-0 0-0-0 *`,
    )!
    expect(tree.getMainLine().map((node) => node.move)).toEqual([
      null,
      'e1g1',
      'e8c8',
    ])
  })
})

describe('graftVariations', () => {
  it('adds the variations of a game to its main line', () => {
    const target = mainlineTree(['e4', 'e5', 'Nf3', 'Nc6'])
    const { tree: source } = parsePgnWithVariations(
      '1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 (2... d6) *',
    )!

    expect(graftVariations(target, source)).toBe(3)
    expect(target.getMainLine()).toHaveLength(5)
    expect(movetextOf(gameTreeToPgn(target, {}))).toBe(
      '1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 (2... d6) *',
    )
    // Grafting again adds nothing.
    expect(graftVariations(target, source)).toBe(0)
  })

  it('leaves a game from another position alone', () => {
    const target = mainlineTree(['d4'])
    const source = parsePgnWithVariations(
      '[SetUp "1"]\n[FEN "8/8/8/8/8/8/4K3/k7 w - - 0 1"]\n\n1. Kd2 *',
    )!.tree
    expect(graftVariations(target, source)).toBe(0)
  })
})

describe('splitPgnGames', () => {
  it('splits a file of several games', () => {
    const text = `[Event "One"]

1. e4 *

[Event "Two"]
[FEN "8/8/8/8/8/8/4K3/k7 w - - 0 1"]

*
`
    const games = splitPgnGames(text)
    expect(games).toHaveLength(2)
    expect(games[0]).toBe('[Event "One"]\n\n1. e4 *')
    expect(games[1].startsWith('[Event "Two"]')).toBe(true)
  })
})

describe('pgnPlayerName and formatPgnDate', () => {
  it('names a visitor who is not signed in "Guest"', () => {
    expect(pgnPlayerName(null)).toBe('Guest')
    expect(pgnPlayerName({ clientId: 'x', displayName: 'None' })).toBe('Guest')
    expect(
      pgnPlayerName({ clientId: 'x', displayName: 'Magnus', lichessId: 'm' }),
    ).toBe('Magnus')
    expect(
      pgnPlayerName({ clientId: 'x', displayName: 'None', lichessId: 'm' }),
    ).toBe('m')
  })

  it('formats a date as PGN does', () => {
    expect(formatPgnDate(new Date(2026, 0, 5))).toBe('2026.01.05')
  })
})
