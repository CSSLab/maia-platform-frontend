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
