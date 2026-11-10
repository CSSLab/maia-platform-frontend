import { render, screen } from '@testing-library/react'
import { Chess } from 'chess.ts'
import { GameTree } from 'src/types'
import { ExportGame } from './ExportGame'

const buildTree = () => {
  const tree = new GameTree(new Chess().fen())
  const e4 = tree.addMoveToMainLine('e2e4')!
  tree.addMoveToMainLine('e7e5')
  // A variation the player explored: 1... c5.
  const chess = new Chess(e4.fen)
  chess.move('c5')
  tree.addVariationNode(e4, chess.fen(), 'c7c5', 'c5')
  return tree
}

describe('ExportGame', () => {
  it('writes the game’s details and variations in its PGN', () => {
    const tree = buildTree()
    render(
      <ExportGame
        game={{
          id: 'g1',
          turn: 'white',
          tree,
          termination: { result: '0-1', winner: 'black', condition: 'Resign' },
        }}
        gameTree={tree}
        currentNode={tree.getRoot()}
        whitePlayer="Guest"
        blackPlayer="Maia-3 1500"
        event="Play vs. Maia-3 1500"
        type="play"
        date="2026.11.06"
        timeControl="300+3"
        whiteElo={1432}
        blackElo={1500}
      />,
    )

    const pgn = screen.getByText(/\[Event/).textContent ?? ''
    expect(pgn).toContain('[Date "2026.11.06"]')
    expect(pgn).toContain('[White "Guest"]')
    expect(pgn).toContain('[Black "Maia-3 1500"]')
    expect(pgn).toContain('[WhiteElo "1432"]')
    expect(pgn).toContain('[BlackElo "1500"]')
    expect(pgn).toContain('[TimeControl "300+3"]')
    expect(pgn).toContain('[Termination "Resign"]')
    expect(pgn).toContain('1. e4 e5 (1... c5) 0-1')
  })
})
