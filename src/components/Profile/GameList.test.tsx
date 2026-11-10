import { act, fireEvent, render, screen } from '@testing-library/react'

import { GameList } from './GameList'
import { fetchMaiaGameList, streamLichessGames } from 'src/api'

jest.mock('src/api', () => ({
  fetchMaiaGameList: jest.fn(),
  streamLichessGames: jest.fn(),
}))
jest.mock('src/contexts', () => {
  const { createContext } = jest.requireActual('react')
  return {
    AuthContext: createContext({
      user: { clientId: 'c', displayName: 'alice', lichessId: 'alice' },
    }),
  }
})

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0)
const HOUR = 60 * 60 * 1000

const listGames = fetchMaiaGameList as jest.Mock
const streamGames = streamLichessGames as jest.Mock

const game = (id: string, extra: object) => ({
  game_id: id,
  maia_name: 'maia_kdd_1500',
  player_color: 'white',
  result: '1-0',
  custom_name: null,
  is_favorited: false,
  game_type: 'play',
  ...extra,
})

const row = (name: string) => screen.getByText(name).closest('a') as HTMLElement

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
  listGames.mockReset()
  streamGames.mockReset()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('Profile GameList', () => {
  it('says when each game was played, in whichever form the backend sends', async () => {
    listGames.mockResolvedValue({
      total_pages: 1,
      games: [
        // Today's production: UTC without a zone.
        game('a', {
          custom_name: 'Zoneless',
          created_time: '2026-11-10T09:00:00.051000',
        }),
        // After the backend change: with a zone, and the end of the game.
        game('b', {
          custom_name: 'Zoned',
          created_time: '2026-11-07T11:00:00.051Z',
          ended_time: '2026-11-07T11:09:00Z',
        }),
        game('c', { custom_name: 'Unknown', created_time: '????.??.??' }),
        game('d', { custom_name: 'Null', created_time: null }),
        game('e', { custom_name: 'Missing' }),
      ],
    })

    await act(async () => {
      render(<GameList showCustom={false} showLichess={false} />)
    })

    expect(listGames).toHaveBeenCalledWith('play', 1, undefined)

    const zoneless = row('Zoneless').querySelector('time')
    expect(zoneless).toHaveAttribute('datetime', '2026-11-10T09:00:00.051Z')
    // Both forms are there; the width picks one.
    expect(zoneless).toHaveTextContent('2h')
    expect(zoneless).toHaveTextContent('2 hours ago')

    const zoned = row('Zoned').querySelector('time')
    expect(zoned).toHaveAttribute('datetime', '2026-11-07T11:00:00.051Z')
    expect(zoned).toHaveTextContent('3 days ago')
    expect(zoned?.title).toMatch(/^3 days ago · /)

    for (const name of ['Unknown', 'Null', 'Missing']) {
      expect(row(name).querySelector('time')).toBeNull()
      expect(row(name)).toHaveTextContent(`${name}1-0`)
    }
  })

  it('carries the time Lichess gives its games', async () => {
    listGames.mockResolvedValue({ total_pages: 1, games: [] })
    streamGames.mockImplementation((_, onGame) => {
      onGame({
        id: 'HqjDTU4A',
        createdAt: NOW - 5 * HOUR,
        lastMoveAt: NOW - 5 * HOUR + 6 * 60 * 1000,
        players: { white: { user: { id: 'alice' } }, black: {} },
        pgn: '[Result "0-1"]\n\n1. e4 e5 0-1',
      })
      // An older reply without times.
      onGame({
        id: 'iVshKPMF',
        players: { white: {}, black: { user: { id: 'alice' } } },
        pgn: '[Result "1-0"]\n\n1. e4 e5 1-0',
      })
      // An error object instead of a game.
      onGame({ error: 'Not found' })
    })

    await act(async () => {
      render(<GameList />)
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Lichess'))
    })

    expect(streamGames).toHaveBeenCalledWith('alice', expect.any(Function))
    const time = row('alice vs. Unknown').querySelector('time')
    expect(time).toHaveAttribute(
      'datetime',
      new Date(NOW - 5 * HOUR).toISOString(),
    )
    expect(time).toHaveTextContent('5 hours ago')
    expect(row('Unknown vs. alice').querySelector('time')).toBeNull()
  })
})
