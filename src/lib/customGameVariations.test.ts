import {
  applyImportedVariations,
  forgetImportedVariations,
  saveImportedVariations,
} from './customGameVariations'
import { gameTreeToPgn, parsePgnWithVariations } from './pgn'

// The game as the backend sends it back: its main line only.
const mainLineOf = (pgn: string) => {
  const { tree } = parsePgnWithVariations(pgn.replace(/\([^()]*\)/g, ''))!
  return tree
}

describe('imported variations of custom games', () => {
  beforeEach(() => window.localStorage.clear())

  const pgn = '[Event "Lesson"]\n\n1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *'

  it('adds an imported game’s variations back when it opens', () => {
    saveImportedVariations('game-1', pgn)

    const tree = mainLineOf(pgn)
    expect(applyImportedVariations('game-1', tree)).toBe(2)
    expect(gameTreeToPgn(tree, {}).split('\n\n')[1]).toBe(
      '1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *',
    )
  })

  it('keeps nothing for a game without variations, or once deleted', () => {
    saveImportedVariations('game-2', '1. e4 e5 *')
    expect(window.localStorage.length).toBe(0)

    saveImportedVariations('game-1', pgn)
    forgetImportedVariations('game-1')
    expect(applyImportedVariations('game-1', mainLineOf(pgn))).toBe(0)
  })
})
