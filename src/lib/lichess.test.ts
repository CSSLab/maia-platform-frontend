import { parseLichessPgn } from './lichess'

const HEADERS = `[Event "rated blitz game"]
[Site "https://lichess.org/game/AAAAAAAA"]
[White "alex_ast"]
[Black "GeVe38"]
[Result "1/2-1/2"]
[WhiteElo "1812"]
[BlackElo "?"]
[WhiteTitle "GM"]
[Variant "Standard"]
[TimeControl "180+2"]
[Termination "Normal"]
`

describe('parseLichessPgn', () => {
  it('reads players and the result as the backend does', () => {
    const game = parseLichessPgn('AAAAAAAA', `${HEADERS}\n1. e4 e5 1/2-1/2`)
    expect(game?.whitePlayer).toEqual({
      name: 'alex_ast',
      rating: 1812,
      title: 'GM',
    })
    // The backend reports an unknown rating as 0.
    expect(game?.blackPlayer).toEqual({ name: 'GeVe38', rating: 0 })
    expect(game?.termination).toEqual({
      result: '1/2-1/2',
      winner: 'none',
      condition: 'Normal',
    })
  })

  it('gives a game without a result no ending', () => {
    const game = parseLichessPgn(
      'AAAAAAAA',
      `${HEADERS.replace('1/2-1/2', '*')}\n1. e4 e5 *`,
    )
    expect(game?.termination).toBeUndefined()
  })

  it('skips clocks, comments, glyphs, NAGs and variations', () => {
    const game = parseLichessPgn(
      'AAAAAAAA',
      `${HEADERS}\n1. e4?! { [%clk 0:03:00] } $6 (1. d4 d5 (1... Nf6)) 1... e5!! { [%eval 0.2] } 2. Nf3 *`,
    )
    expect(
      game?.tree
        .getMainLine()
        .slice(1)
        .map((node) => [node.move, node.san]),
    ).toEqual([
      ['e2e4', 'e4'],
      ['e7e5', 'e5'],
      ['g1f3', 'Nf3'],
    ])
  })

  it('writes an en passant square only when the capture is legal', () => {
    const game = parseLichessPgn('AAAAAAAA', `${HEADERS}\n1. e4 d5 2. e5 f5 *`)
    expect(game?.tree.getMainLine().map((node) => node.fen)).toEqual([
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
      'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
    ])
  })

  it('keeps the promotion piece in the move', () => {
    const game = parseLichessPgn(
      'AAAAAAAA',
      `${HEADERS}\n1. e4 d5 2. exd5 c6 3. dxc6 Qb6 4. cxb7 Qxb2 5. bxa8=Q *`,
    )
    const last = game?.tree.getMainLine().at(-1)
    expect(last?.move).toBe('b7a8q')
    expect(last?.san).toBe('bxa8=Q')
    expect(last?.fen).toBe(
      'Qnb1kbnr/p3pppp/8/8/8/8/PqPP1PPP/RNBQKBNR b KQk - 0 5',
    )
  })

  it('leaves variants, set-up positions and illegal moves to the backend', () => {
    expect(
      parseLichessPgn(
        'AAAAAAAA',
        HEADERS.replace('Standard', 'Chess960') + '\n1. e4 *',
      ),
    ).toBeNull()
    expect(
      parseLichessPgn(
        'AAAAAAAA',
        `${HEADERS}[SetUp "1"]\n[FEN "8/P6k/8/8/8/8/8/K7 w - - 0 1"]\n\n1. a8=Q *`,
      ),
    ).toBeNull()
    expect(
      parseLichessPgn('AAAAAAAA', `${HEADERS}\n1. e4 e5 2. Ke3 *`),
    ).toBeNull()
  })
})
