import { Chess } from 'chess.ts'
import {
  linkedDrillSelection,
  matchOpening,
  openingDrillHref,
  openingLabel,
} from './openingDrillLink'

/** The positions of a game from the start, after each move. */
const fensOf = (moves: string[]) => {
  const chess = new Chess()
  return [
    chess.fen(),
    ...moves.map((move) => {
      chess.move(move)
      return chess.fen()
    }),
  ]
}

const queryOf = (href: string) =>
  Object.fromEntries(new URL(href, 'https://x').searchParams)

describe('matchOpening', () => {
  it('names the deepest variation the game reached', () => {
    const match = matchOpening(
      fensOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'Nf6', 'd3']),
    )
    expect(match?.opening.id).toBe('italian-game')
    expect(match?.variation?.id).toBe('italian-piano')
    expect(openingLabel(match!)).toBe('Giuoco Piano')
  })

  it('names the opening when no variation is reached', () => {
    const match = matchOpening(
      fensOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'h6', 'd3']),
    )
    expect(match?.opening.id).toBe('italian-game')
    expect(match?.variation).toBeNull()
    expect(openingLabel(match!)).toBe('Italian Game')
  })

  it('finds an opening reached by another move order', () => {
    const direct = matchOpening(fensOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']))
    const transposed = matchOpening(fensOf(['Nf3', 'Nc6', 'e4', 'e5', 'Bc4']))
    expect(transposed?.opening.id).toBe(direct?.opening.id)
  })

  it('finds nothing in a game no drill starts from', () => {
    expect(matchOpening(fensOf(['a3', 'h6', 'h3', 'a6']))).toBeNull()
    expect(matchOpening([])).toBeNull()
  })
})

describe('the drill link', () => {
  it('starts the matched drill with the same side and Maia', () => {
    const match = matchOpening(
      fensOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3']),
    )!
    const href = openingDrillHref(match, 'black', 'maia_kdd_1300')
    expect(href.startsWith('/drills?')).toBe(true)

    const selection = linkedDrillSelection(queryOf(href))
    expect(selection).toMatchObject({
      opening: { id: 'italian-game', categoryType: 'opening' },
      variation: { id: 'italian-piano' },
      playerColor: 'black',
      maiaVersion: 'maia_kdd_1300',
      targetMoveNumber: 10,
    })
  })

  it('falls back to the default Maia for one drills do not have', () => {
    const match = matchOpening(fensOf(['d4', 'd5', 'c4']))!
    const selection = linkedDrillSelection(
      queryOf(openingDrillHref(match, 'white', 'maia_old_1900')),
    )
    expect(selection?.maiaVersion).toBe('maia_kdd_1500')
    expect(selection?.variation).toBeNull()
  })

  it('ignores a link to an opening or variation the page lacks', () => {
    expect(linkedDrillSelection({})).toBeNull()
    expect(linkedDrillSelection({ opening: 'nope' })).toBeNull()
    expect(
      linkedDrillSelection({ opening: 'italian-game', variation: 'nope' }),
    ).toBeNull()
    expect(linkedDrillSelection({ customFen: 'x' })).toBeNull()
  })
})
