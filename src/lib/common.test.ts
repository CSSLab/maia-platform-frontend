import { buildGameTreeFromMoveList } from './common'

describe('buildGameTreeFromMoveList', () => {
  const start = '7k/P7/8/8/8/8/8/K7 w - - 0 1'

  it('keeps an underpromotion the backend sent as [from, to]', () => {
    const tree = buildGameTreeFromMoveList(
      [
        { board: start },
        {
          board: 'R6k/8/8/8/8/8/8/K7 b - - 0 1',
          lastMove: ['a7', 'a8'],
          san: 'a8=R+',
        },
      ],
      start,
    )
    expect(tree.toMoveArray()).toEqual(['a7a8r'])
  })

  it('recovers the promotion piece from the position when SAN is missing', () => {
    const tree = buildGameTreeFromMoveList(
      [
        { board: start },
        { board: 'N6k/8/8/8/8/8/8/K7 b - - 0 1', lastMove: ['a7', 'a8'] },
      ],
      start,
    )
    expect(tree.toMoveArray()).toEqual(['a7a8n'])
  })

  it('leaves ordinary moves alone', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const tree = buildGameTreeFromMoveList(
      [
        { board: fen },
        {
          board: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          lastMove: ['e2', 'e4'],
          san: 'e4',
        },
      ],
      fen,
    )
    expect(tree.toMoveArray()).toEqual(['e2e4'])
  })
})
