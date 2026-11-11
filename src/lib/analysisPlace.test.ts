import {
  openedByPageLoad,
  placeKey,
  restoreAnalysisPlace,
  saveAnalysisPlace,
} from './analysisPlace'
import { gameTreeToPgn, parsePgnWithVariations } from './pgn'

// The game as the page builds it when it opens.
const gameTree = (pgn = '1. e4 e5 2. Nf3 Nc6 *') =>
  parsePgnWithVariations(pgn)!.tree

const movetext = (tree: ReturnType<typeof gameTree>) =>
  gameTreeToPgn(tree, {}).split('\n\n')[1]

describe('analysis place', () => {
  beforeEach(() => window.sessionStorage.clear())

  const game = placeKey({ type: 'lichess', id: 'abc' })

  it('puts back the lines tried and the move on show', () => {
    const tree = gameTree()
    // A line tried after 1... e5, and the main line played on past its end.
    const afterE5 = tree.getMainLine()[2]
    const nc3 = tree.addVariationNode(afterE5, afterE5.fen, 'b1c3', 'Nc3')
    const last = tree.getLastMainlineNode()
    tree.addMainlineNode(last, last.fen, 'f1b5', 'Bb5')
    saveAnalysisPlace(game, tree, nc3)

    const reopened = gameTree()
    const node = restoreAnalysisPlace(game, reopened)
    expect(node?.move).toBe('b1c3')
    expect(node?.parent?.move).toBe('e7e5')
    expect(movetext(reopened)).toBe(
      '1. e4 e5 2. Nf3 (2. Nc3) 2... Nc6 3. Bb5 *',
    )
    expect(reopened.getLastMainlineNode().move).toBe('f1b5')
  })

  it('opens a game of its own at the start', () => {
    const tree = gameTree()
    saveAnalysisPlace(game, tree, tree.getLastMainlineNode())

    const other = gameTree('1. d4 d5 *')
    expect(
      restoreAnalysisPlace(placeKey({ type: 'play', id: 'xyz' }), other),
    ).toBeNull()
    expect(movetext(other)).toBe('1. d4 d5 *')
  })

  it('keeps the games of one match apart', () => {
    // The games of a world championship match share the match's id. Game 2,
    // an Open Ruy Lopez, was kept, then the page was loaded at game 1.
    const match = { type: 'tournament', id: '0KNdpNQd' }
    const second = gameTree('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 *')
    saveAnalysisPlace(
      placeKey({ ...match, gameIndex: '2' }),
      second,
      second.getLastMainlineNode(),
    )

    const first = gameTree('1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O d6 *')
    expect(
      restoreAnalysisPlace(placeKey({ ...match, gameIndex: '1' }), first),
    ).toBeNull()
    // Game 2's moves used to be grafted in as a line after 3. Bb5.
    expect(movetext(first)).toBe('1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O d6 *')

    const again = gameTree('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 *')
    expect(
      restoreAnalysisPlace(placeKey({ ...match, gameIndex: '2' }), again)?.move,
    ).toBe('g8f6')
  })

  it('names a game by its type and id, and a match game by its number too', () => {
    expect(placeKey({ type: 'lichess', id: 'abc' })).toBe('lichess/abc')
    expect(placeKey({ type: 'tournament', id: 'm', gameIndex: '3' })).toBe(
      'tournament/m/3',
    )
  })

  it('goes as far as the moves kept still fit', () => {
    const tree = gameTree()
    saveAnalysisPlace(game, tree, tree.getLastMainlineNode())
    const stored = JSON.parse(
      window.sessionStorage.getItem('maia.analysisPlace')!,
    )
    stored.moves[2] = 'a2a3'
    window.sessionStorage.setItem('maia.analysisPlace', JSON.stringify(stored))

    expect(restoreAnalysisPlace(game, gameTree())?.move).toBe('e7e5')
  })

  it('opens at the start when nothing usable was kept', () => {
    window.sessionStorage.setItem('maia.analysisPlace', '{not json')
    expect(restoreAnalysisPlace(game, gameTree())).toBeNull()
  })

  it('tells a page load from moving between pages in the app', () => {
    // jsdom has no navigation entries: a page with none isn't a page load.
    expect(openedByPageLoad('/analysis/abc/lichess')).toBe(false)
    Object.defineProperty(performance, 'getEntriesByType', {
      configurable: true,
      value: () => [{ name: 'https://www.maiachess.com/analysis/abc/lichess' }],
    })
    expect(openedByPageLoad('/analysis/abc/lichess')).toBe(true)
    expect(openedByPageLoad('/analysis/def/play')).toBe(false)
    delete (performance as { getEntriesByType?: unknown }).getEntriesByType
  })
})
