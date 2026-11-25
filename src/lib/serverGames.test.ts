import { PlayGameConfig } from 'src/types'
import {
  ServerGame,
  describeServerGame,
  hasResignOffer,
  isAskedForGame,
  isRatedServerGame,
  serverClocks,
  serverGameConfig,
  serverGamePage,
  serverGameStart,
  serverGamesFor,
  serverTermination,
} from './serverGames'

const game = (fields: Partial<ServerGame> = {}): ServerGame => ({
  game_id: 'abc123',
  game_type: 'play',
  player_color: 'white',
  maia_name: 'maia_kdd_1500',
  time_control: '5+3',
  sample_moves: true,
  practice: false,
  fen: '',
  moves: ['e2e4', 'e7e5'],
  move_times: [1200, 800],
  ply: 2,
  to_move: 'white',
  state: 'not_over',
  winner: '',
  clock: {
    white_ms: 300000,
    black_ms: 299200,
    increment_ms: 3000,
    running: 'white',
    since_ms: -800,
  },
  bot_move: { uci: 'e7e5', ply: 1, delay: 0.8 },
  rating: null,
  ...fields,
})

const config: PlayGameConfig = {
  playType: 'againstMaia',
  player: 'black',
  maiaVersion: 'maia_kdd_1100',
  timeControl: 'unlimited',
  isBrain: false,
  sampleMoves: false,
}

describe('a game the server holds', () => {
  it('goes on until the server says how it ended', () => {
    expect(serverTermination(game())).toBeUndefined()
    expect(
      serverTermination(game({ state: 'rules', winner: 'white' })),
    ).toEqual({ result: '1-0', winner: 'white', type: 'rules' })
    expect(serverTermination(game({ state: 'time', winner: 'black' }))).toEqual(
      { result: '0-1', winner: 'black', type: 'time' },
    )
    expect(serverTermination(game({ state: 'rules', winner: 'draw' }))).toEqual(
      { result: '1/2-1/2', winner: 'none', type: 'rules' },
    )
  })

  it("tells whether a resignation was Maia's or the player's", () => {
    // The player is white.
    expect(
      serverTermination(
        game({ state: 'resign', winner: 'white', bot_resigned: true }),
      ),
    ).toEqual({
      result: '1-0',
      winner: 'white',
      type: 'resign',
      resignedBy: 'maia',
      condition: 'Black resigned',
    })
    // A server that doesn't say: the player can't win by resigning.
    expect(
      serverTermination(game({ state: 'resign', winner: 'white' })),
    ).toMatchObject({ winner: 'white', resignedBy: 'maia' })
    expect(
      serverTermination(game({ state: 'resign', winner: 'black' })),
    ).toEqual({
      result: '0-1',
      winner: 'black',
      type: 'resign',
      resignedBy: 'player',
      condition: 'White resigned',
    })
    expect(
      serverTermination(
        game({
          player_color: 'black',
          state: 'resign',
          winner: 'black',
          bot_resigned: true,
        }),
      ),
    ).toMatchObject({ result: '0-1', winner: 'black', resignedBy: 'maia' })
  })

  it("has Maia's offer to resign only while the game goes on", () => {
    expect(hasResignOffer(game())).toBe(false)
    expect(hasResignOffer(game({ resign_offer: true }))).toBe(true)
    expect(
      hasResignOffer(
        game({ resign_offer: true, state: 'resign', winner: 'white' }),
      ),
    ).toBe(false)
  })

  it("reads the clocks as the server's, less what the running side has used", () => {
    // Maia's move is still to be shown: nothing used yet.
    expect(serverClocks(game())).toEqual({
      white: 300000,
      black: 299200,
      running: true,
    })
    // Picked up again 12 s into the player's turn.
    const resumed = game({
      clock: { ...game().clock!, since_ms: 12000 },
      bot_move: null,
    })
    expect(serverClocks(resumed)).toEqual({
      white: 288000,
      black: 299200,
      running: true,
    })
    // Before the clocks start, and without clocks.
    const waiting = game({ clock: { ...game().clock!, running: null } })
    expect(serverClocks(waiting)?.running).toBe(false)
    expect(serverClocks(game({ clock: null }))).toBeNull()
    // A clock never reads below zero.
    const late = game({ clock: { ...game().clock!, since_ms: 999999 } })
    expect(serverClocks(late)?.white).toBe(0)
  })

  it("takes its settings from the server's game, not the address", () => {
    expect(serverGameConfig(game({ fen: 'some fen' }), config)).toMatchObject({
      player: 'white',
      maiaVersion: 'maia_kdd_1500',
      timeControl: '5+3',
      sampleMoves: true,
      startFen: 'some fen',
      practice: false,
    })
    expect(serverGameConfig(game(), config).startFen).toBeUndefined()
  })

  it("starts the board without Maia's move that is still to be shown", () => {
    const start = serverGameStart(game(), config)
    expect(start.id).toBe('abc123')
    expect(start.moves).toEqual(['e2e4'])
    expect(start.moveTimes).toEqual([1200])
    expect(start.whiteClock).toBe(300000)
    expect(start.blackClock).toBe(299200)
  })

  it('starts the board with every move when picked up again', () => {
    const start = serverGameStart(game({ bot_move: null }), config)
    expect(start.moves).toEqual(['e2e4', 'e7e5'])
  })

  it('knows a hand or brain game by its type, partner and page', () => {
    const brain = game({
      game_type: 'brain',
      maia_partner_name: 'maia_kdd_1900',
    })
    expect(serverGameConfig(brain, config)).toMatchObject({
      playType: 'handAndBrain',
      isBrain: true,
      maiaPartnerVersion: 'maia_kdd_1900',
    })
    expect(serverGameConfig(game(), config)).toMatchObject({
      playType: 'againstMaia',
      isBrain: false,
    })
    expect(serverGamePage(brain).pathname).toBe('/play/hb')
    expect(serverGamePage(brain).query).toMatchObject({
      isBrain: true,
      maiaPartnerVersion: 'maia_kdd_1900',
    })
    expect(serverGamePage(game()).pathname).toBe('/play/maia')
    expect(describeServerGame(brain)).toBe(
      'Hand & Brain vs Maia 1500, 5+3, move 2',
    )
  })

  it("is the server's decision for each player, once the account request has answered", () => {
    expect(serverGamesFor(null)).toBeUndefined()
    const guest = { clientId: 'c1', displayName: 'Guest' }
    expect(serverGamesFor(guest)).toBe(false)
    expect(serverGamesFor({ ...guest, serverGames: false })).toBe(false)
    expect(serverGamesFor({ ...guest, serverGames: true })).toBe(true)
  })

  it('can be switched on or off for one browser, whatever the server says', () => {
    const guest = { clientId: 'c1', displayName: 'Guest', serverGames: false }
    window.localStorage.setItem('maia.serverGames', '1')
    expect(serverGamesFor(guest)).toBe(true)
    // Known at once: no need to wait for the account request.
    expect(serverGamesFor(null)).toBe(true)
    window.localStorage.setItem('maia.serverGames', '0')
    expect(serverGamesFor({ ...guest, serverGames: true })).toBe(false)
    window.localStorage.removeItem('maia.serverGames')
    expect(serverGamesFor({ ...guest, serverGames: true })).toBe(true)
    expect(serverGamesFor(null)).toBeUndefined()
  })

  it('is the game an address asks for when its settings are the same', () => {
    const asked: PlayGameConfig = {
      ...config,
      player: 'white',
      maiaVersion: 'maia_kdd_1500',
      timeControl: '5+3',
    }
    expect(isAskedForGame(game(), asked)).toBe(true)
    // How far the game has got, or its move sampling, doesn't matter.
    expect(
      isAskedForGame(game({ ply: 40 }), { ...asked, sampleMoves: true }),
    ).toBe(true)

    // A link to another position, opponent, colour or time control doesn't
    // ask for it.
    const endgame = '8/8/8/4k3/8/8/4K3/7R w - - 0 1'
    expect(isAskedForGame(game(), { ...asked, startFen: endgame })).toBe(false)
    expect(
      isAskedForGame(game({ fen: endgame }), { ...asked, startFen: endgame }),
    ).toBe(true)
    expect(
      isAskedForGame(game({ fen: endgame }), {
        ...asked,
        startFen: '8/8/8/4k3/8/8/4K3/7Q w - - 0 1',
      }),
    ).toBe(false)
    expect(isAskedForGame(game(), { ...asked, player: 'black' })).toBe(false)
    expect(
      isAskedForGame(game(), { ...asked, maiaVersion: 'maia_kdd_1900' }),
    ).toBe(false)
    expect(isAskedForGame(game(), { ...asked, timeControl: '3+0' })).toBe(false)
    expect(isAskedForGame(game(), { ...asked, practice: true })).toBe(false)
  })

  it('stores a practice game from the usual position with that position', () => {
    const asked: PlayGameConfig = {
      ...config,
      player: 'white',
      maiaVersion: 'maia_kdd_1500',
      timeControl: '5+3',
      practice: true,
    }
    const stored = game({
      practice: true,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    })
    expect(isAskedForGame(stored, asked)).toBe(true)
  })

  it('is the hand or brain game an address asks for by its role and partner too', () => {
    const asked: PlayGameConfig = {
      ...config,
      playType: 'handAndBrain',
      player: 'white',
      maiaVersion: 'maia_kdd_1500',
      maiaPartnerVersion: 'maia_kdd_1900',
      timeControl: '5+3',
      isBrain: true,
    }
    const brain = game({
      game_type: 'brain',
      maia_partner_name: 'maia_kdd_1900',
    })
    expect(isAskedForGame(brain, asked)).toBe(true)
    expect(isAskedForGame(brain, { ...asked, isBrain: false })).toBe(false)
    expect(
      isAskedForGame(brain, { ...asked, maiaPartnerVersion: 'maia_kdd_1100' }),
    ).toBe(false)
    // A game against Maia alone isn't one, nor the other way round.
    expect(isAskedForGame(game(), asked)).toBe(false)
    expect(isAskedForGame(brain, { ...asked, playType: 'againstMaia' })).toBe(
      false,
    )
  })

  it('is rated unless it is a practice game or starts from a set position', () => {
    expect(isRatedServerGame(game())).toBe(true)
    expect(isRatedServerGame(game({ practice: true }))).toBe(false)
    expect(
      isRatedServerGame(game({ fen: '8/8/8/4k3/8/8/4K3/7R w - - 0 1' })),
    ).toBe(false)
  })

  it('is described for the setup dialog', () => {
    expect(describeServerGame(game())).toBe('Maia 1500, 5+3, move 2')
    expect(
      describeServerGame(game({ time_control: 'unlimited', ply: 23 })),
    ).toBe('Maia 1500, unlimited, move 12')
  })
})
