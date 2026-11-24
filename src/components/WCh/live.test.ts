import {
  barTimeControl,
  isOurGame,
  parseLiveGame,
  splitGames,
} from './live'

const GAME_1 = `[Event "FIDE World Chess Championship 2026"]
[White "Sindarov, Javokhir"]
[Black "Gukesh D"]
[Result "*"]
[WhiteFideId "14205483"]
[BlackFideId "46616543"]
[TimeControl "40/7200:20/3600:900+30"]
[GameURL "https://lichess.org/broadcast/x/game-1/xLgOJ6cb/j7pdr7s2"]

1. e4 { [%eval 0.18] [%clk 1:59:50] } 1... e5 { [%clk 1:58:00] } 2. Nf3 { [%eval #3] [%clk 1:59:20] } *`

const OTHER = `[Event "Some Open"]
[White "Carlsen, Magnus"]
[Black "Nakamura, Hikaru"]
[Result "1-0"]
[GameURL "https://lichess.org/broadcast/y/round-1/abcd1234/zzzz9999"]

1. d4 1-0`

describe('the World Championship broadcast parser', () => {
  it('reads moves, clocks, evals and time spent', () => {
    const g = parseLiveGame(GAME_1)!
    expect(g.white).toBe('sindarov')
    expect(g.black).toBe('gukesh')
    expect(g.result).toBe('*')
    expect(g.gameId).toBe('j7pdr7s2')
    expect(g.moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3'])
    expect(g.moves[0]).toMatchObject({
      uci: 'e2e4',
      color: 'white',
      moveNumber: 1,
      clock: 7190,
      eval: 0.18,
      think: 10,
    })
    expect(g.moves[1]).toMatchObject({ clock: 7080, eval: null, think: 120 })
    // A mate score is shown as a full bar.
    expect(g.moves[2]).toMatchObject({ eval: 10, think: 30 })
  })

  it('reads a game with no moves yet', () => {
    const g = parseLiveGame(GAME_1.replace(/\n\n1\. [\s\S]*$/, '\n\n*'))!
    expect(g.moves).toEqual([])
    expect(g.white).toBe('sindarov')
  })

  it('finds the match game in a round', () => {
    const games = splitGames(`${OTHER}\n\n\n${GAME_1}`)
    expect(games).toHaveLength(2)
    expect(games.filter((g) => isOurGame(g))).toHaveLength(1)
    expect(games.filter((g) => isOurGame(g, 'zzzz9999'))).toHaveLength(1)
    expect(isOurGame(games[0], 'j7pdr7s2')).toBe(false)
  })

  it('turns a FIDE time control into base+increment', () => {
    expect(barTimeControl('40/7200:20/3600:900+30')).toBe('7200+30')
    expect(barTimeControl('900+10')).toBe('900+10')
    expect(barTimeControl(null)).toBeNull()
  })
})
