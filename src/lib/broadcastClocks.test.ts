import { parsePGNData } from 'src/api/broadcasts'
import {
  formatClock,
  getClocksAtPly,
  parseClockComment,
} from './broadcastClocks'

describe('parseClockComment', () => {
  it('reads h:mm:ss, m:ss and tenths', () => {
    expect(parseClockComment('[%clk 1:30:15]')).toBe(5415)
    expect(parseClockComment('[%clk 0:00:09.5]')).toBe(9.5)
    expect(parseClockComment('[%clk 4:05]')).toBe(245)
  })

  it('finds the clock among other commands', () => {
    expect(parseClockComment('[%eval 0.3] [%clk 0:59:30] good move')).toBe(3570)
  })

  it('has nothing for a comment without a clock', () => {
    expect(parseClockComment('a fine move')).toBeUndefined()
    expect(parseClockComment('[%eval 0.3]')).toBeUndefined()
  })
})

describe('getClocksAtPly', () => {
  // White's clocks are on even indices, black's on odd ones.
  const moveClocks = [5400, 5390, 5300, null, 5200]

  it('has no clocks at the start', () => {
    expect(getClocksAtPly(moveClocks, 0)).toEqual({})
  })

  it("takes each player's clock after their latest move", () => {
    expect(getClocksAtPly(moveClocks, 1)).toEqual({ white: 5400 })
    expect(getClocksAtPly(moveClocks, 2)).toEqual({ white: 5400, black: 5390 })
    expect(getClocksAtPly(moveClocks, 3)).toEqual({ white: 5300, black: 5390 })
  })

  it('looks back past a move without a clock', () => {
    expect(getClocksAtPly(moveClocks, 4)).toEqual({ white: 5300, black: 5390 })
    expect(getClocksAtPly(moveClocks, 5)).toEqual({ white: 5200, black: 5390 })
  })

  it('stops at the last move', () => {
    expect(getClocksAtPly(moveClocks, 99)).toEqual({
      white: 5200,
      black: 5390,
    })
    expect(getClocksAtPly(undefined, 3)).toEqual({})
  })
})

describe('formatClock', () => {
  it('shows hours only when there are some', () => {
    expect(formatClock(5415)).toBe('1:30:15')
    expect(formatClock(3600)).toBe('1:00:00')
    expect(formatClock(245)).toBe('4:05')
    expect(formatClock(9.9)).toBe('0:09')
    expect(formatClock(-3)).toBe('0:00')
  })
})

describe('parsePGNData clocks', () => {
  const pgn = `[Event "Test Open"]
[Site "https://lichess.org/broadcast/test"]
[White "Alpha"]
[Black "Beta"]
[Result "*"]

1. e4 { [%clk 1:30:00] } 1... e5 { [%clk 1:29:50] } 2. Nf3 { [%eval 0.2] [%clk 1:28:00] } 2... Nc6 3. Bb5 { [%clk 1:20:05] } *`

  it("records each move's clock and the latest clocks", () => {
    const { games, errors } = parsePGNData(pgn)
    expect(errors).toEqual([])
    expect(games).toHaveLength(1)
    const [game] = games
    expect(game.moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
    expect(game.moveClocks).toEqual([5400, 5390, 5280, null, 4805])
    expect(game.whiteClock?.timeInSeconds).toBe(4805)
    expect(game.blackClock?.timeInSeconds).toBe(5390)
    // Black is to move.
    expect(game.blackClock?.isActive).toBe(true)
    expect(game.whiteClock?.isActive).toBe(false)
  })
})
