import { act, fireEvent, render, screen } from '@testing-library/react'

import { AnalysisGameList } from './AnalysisGameList'
import { fetchMaiaGameList } from 'src/api'

jest.mock('src/api', () => ({
  fetchMaiaGameList: jest.fn(),
  deleteCustomGame: jest.fn(),
}))
jest.mock('src/components', () => ({ Tournament: () => null }))
jest.mock('src/lib/favorites', () => ({
  getFavoritesAsWebGames: jest.fn().mockResolvedValue([]),
  addFavoriteGame: jest.fn(),
  removeFavoriteGame: jest.fn(),
  updateFavoriteName: jest.fn(),
}))
jest.mock('src/contexts', () => {
  const { createContext } = jest.requireActual('react')
  const now = Date.UTC(2026, 10, 10, 12, 0, 0)
  return {
    AuthContext: createContext({
      user: { clientId: 'c', displayName: 'alice', lichessId: 'alice' },
      connectLichess: jest.fn(),
    }),
    AnalysisListContext: createContext({
      analysisTournamentList: new Map(),
      // As AnalysisListContext builds them from the Lichess stream.
      analysisLichessList: [
        {
          id: 'HqjDTU4A',
          type: 'lichess',
          label: 'alice vs. bob',
          result: '0-1',
          createdAt: now - 21 * 24 * 60 * 60 * 1000,
          endedAt: now - 21 * 24 * 60 * 60 * 1000 + 360000,
        },
        {
          id: 'iVshKPMF',
          type: 'lichess',
          label: 'bob vs. alice',
          result: '*',
        },
      ],
    }),
  }
})

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0)
const listGames = fetchMaiaGameList as jest.Mock

const game = (id: string, extra: object) => ({
  game_id: id,
  maia_name: 'maia_kdd_1500',
  player_color: 'white',
  result: '1-0',
  custom_name: null,
  is_favorited: false,
  ...extra,
})

// A row's leading cell (the time, or the row's number) and its name.
const rows = () =>
  Array.from(document.querySelectorAll('#analysis-game-list .group')).map(
    (element) => [
      element.firstElementChild?.textContent,
      element.querySelector('button p')?.textContent,
    ],
  )

const renderList = async (type: string) => {
  await act(async () => {
    render(
      <AnalysisGameList
        currentId={['x', type]}
        loadNewWorldChampionshipGame={jest.fn()}
        loadNewLichessGame={jest.fn()}
        loadNewMaiaGame={jest.fn()}
      />,
    )
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
  listGames.mockReset()
  // The rows' star and rename buttons sit inside the row's own button, which
  // React warns about on every render.
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('AnalysisGameList', () => {
  it('leads each played game with when it was played, or its number', async () => {
    listGames.mockResolvedValue({
      total_pages: 1,
      games: [
        // Today's production: UTC without a zone.
        game('a', { created_time: '2026-11-10T09:00:00.051000' }),
        // After the backend change.
        game('b', {
          created_time: '2026-11-07T11:00:00.051Z',
          ended_time: '2026-11-07T11:09:00Z',
          player_color: 'black',
        }),
        game('c', { created_time: '2025-01-01T00:00:00', custom_name: 'Old' }),
        game('d', { created_time: '????.??.??', custom_name: 'Unknown' }),
        game('e', { created_time: null, custom_name: 'Null' }),
        game('f', { custom_name: 'Missing' }),
      ],
    })
    await renderList('play')

    expect(listGames).toHaveBeenCalledWith('play', 1)
    expect(rows()).toEqual([
      ['2h', 'You vs. Maia-3 1500'],
      ['3d', 'Maia-3 1500 vs. You'],
      ['1y', 'Old'],
      ['4', 'Unknown'],
      ['5', 'Null'],
      ['6', 'Missing'],
    ])

    const time = document.querySelector('#analysis-game-list time')
    expect(time).toHaveAttribute('datetime', '2026-11-10T09:00:00.051Z')
    expect(time?.getAttribute('title')).toMatch(/^2 hours ago · /)
  })

  it('says when custom games were imported and favourites played', async () => {
    listGames.mockImplementation(async (type: string) => ({
      total_pages: 1,
      games:
        type === 'custom'
          ? [
              {
                game_id: 'custom_1',
                custom_name: 'Imported',
                result: '*',
                created_time: '2026-11-09T12:00:00Z',
              },
              { game_id: 'custom_2', custom_name: 'Undated', result: '*' },
            ]
          : [
              {
                game_id: 'fav',
                game_type: 'play',
                custom_name: 'Favourite',
                result: '1-0',
                created_time: '2026-10-27T12:00:00.000000',
              },
            ],
    }))
    await renderList('custom')
    expect(rows()).toEqual([
      ['1d', 'Imported'],
      ['2', 'Undated'],
    ])

    await act(async () => {
      fireEvent.click(screen.getByText('★'))
    })
    expect(rows()).toEqual([['2w', 'Favourite']])
  })

  it('says when Lichess games were played', async () => {
    await renderList('lichess')
    expect(rows()).toEqual([
      ['3w', 'alice vs. bob'],
      ['2', 'bob vs. alice'],
    ])
  })
})
