import { MaiaGameListEntry } from 'src/types'
import { updateGameMetadata, fetchMaiaGameList } from 'src/api/analysis'

export interface FavoriteGame {
  id: string
  type: MaiaGameListEntry['type']
  originalLabel: string
  customName: string
  result: string
  addedAt: string
  pgn?: string
}

const STORAGE_KEY = 'maia_favorite_games'

const mapGameTypeToApiType = (
  gameType: MaiaGameListEntry['type'],
): 'play' | 'hand' | 'brain' | 'custom' => {
  switch (gameType) {
    case 'play':
      return 'play'
    case 'hand':
      return 'hand'
    case 'brain':
      return 'brain'
    case 'custom':
      return 'custom'
    default:
      return 'custom'
  }
}

export const addFavoriteGame = async (
  game: MaiaGameListEntry,
  customName?: string,
): Promise<FavoriteGame> => {
  try {
    // First try to update via API
    const gameType = mapGameTypeToApiType(game.type)
    await updateGameMetadata(gameType, game.id, {
      is_favorited: true,
      custom_name: customName || game.label,
    })

    // Create the FavoriteGame object for return value
    const favorite: FavoriteGame = {
      id: game.id,
      type: game.type,
      originalLabel: game.label,
      customName: customName || game.label,
      result: game.result,
      addedAt: new Date().toISOString(),
      pgn: game.pgn,
    }

    return favorite
  } catch (error) {
    console.warn(
      'Failed to favorite via API, falling back to localStorage:',
      error,
    )

    // Fallback to localStorage
    const favorites = getFavoriteGamesFromStorage()

    // Check if already favorited
    const existingIndex = favorites.findIndex((fav) => fav.id === game.id)
    if (existingIndex !== -1) {
      // Update existing favorite
      favorites[existingIndex] = {
        ...favorites[existingIndex],
        customName: customName || favorites[existingIndex].customName,
      }
    } else {
      // Add new favorite
      const favorite: FavoriteGame = {
        id: game.id,
        type: game.type,
        originalLabel: game.label,
        customName: customName || game.label,
        result: game.result,
        addedAt: new Date().toISOString(),
        pgn: game.pgn,
      }
      favorites.unshift(favorite)
    }

    // Limit to 100 favorites
    const trimmedFavorites = favorites.slice(0, 100)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedFavorites))

    return favorites[existingIndex] || favorites[0]
  }
}

export const removeFavoriteGame = async (
  gameId: string,
  gameType?: MaiaGameListEntry['type'],
): Promise<void> => {
  try {
    // First try to update via API if game type is provided
    if (gameType) {
      const apiGameType = mapGameTypeToApiType(gameType)
      await updateGameMetadata(apiGameType, gameId, {
        is_favorited: false,
      })
      return
    }

    // If no game type provided, try to find it in localStorage first
    const localFavorites = getFavoriteGamesFromStorage()
    const existingFavorite = localFavorites.find((fav) => fav.id === gameId)

    if (existingFavorite) {
      const apiGameType = mapGameTypeToApiType(existingFavorite.type)
      await updateGameMetadata(apiGameType, gameId, {
        is_favorited: false,
      })
      return
    }

    // If not found in localStorage, we can't determine the game type for API
    throw new Error('Game type required for API call')
  } catch (error) {
    console.warn(
      'Failed to unfavorite via API, falling back to localStorage:',
      error,
    )

    // Fallback to localStorage
    const favorites = getFavoriteGamesFromStorage()
    const filtered = favorites.filter((favorite) => favorite.id !== gameId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  }
}

export const updateFavoriteName = async (
  gameId: string,
  customName: string,
  gameType?: MaiaGameListEntry['type'],
): Promise<void> => {
  try {
    // First try to update via API if game type is provided
    if (gameType) {
      const apiGameType = mapGameTypeToApiType(gameType)
      await updateGameMetadata(apiGameType, gameId, {
        custom_name: customName,
      })
      return
    }

    // If no game type provided, try to find it in localStorage first
    const localFavorites = getFavoriteGamesFromStorage()
    const existingFavorite = localFavorites.find((fav) => fav.id === gameId)

    if (existingFavorite) {
      const apiGameType = mapGameTypeToApiType(existingFavorite.type)
      await updateGameMetadata(apiGameType, gameId, {
        custom_name: customName,
      })
      return
    }

    // If not found in localStorage, we can't determine the game type for API
    throw new Error('Game type required for API call')
  } catch (error) {
    console.warn(
      'Failed to update name via API, falling back to localStorage:',
      error,
    )

    // Fallback to localStorage
    const favorites = getFavoriteGamesFromStorage()
    const favoriteIndex = favorites.findIndex((fav) => fav.id === gameId)

    if (favoriteIndex !== -1) {
      favorites[favoriteIndex].customName = customName
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
    }
  }
}

// Helper function to get favorites from localStorage only
const getFavoriteGamesFromStorage = (): FavoriteGame[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.warn('Failed to parse stored favorite games:', error)
    return []
  }
}

export const getFavoriteGames = async (): Promise<FavoriteGame[]> => {
  try {
    // Fetch favorites using the special "favorites" game type endpoint
    const response = await fetchMaiaGameList('favorites', 1)

    // Convert API response to FavoriteGame format
    if (response.games && Array.isArray(response.games)) {
      const favorites = response.games.map(
        (game: any) =>
          ({
            id: game.id,
            type: game.game_type || game.type,
            originalLabel: game.label || game.custom_name || 'Untitled',
            customName: game.custom_name || game.label || 'Untitled',
            result: game.result || '*',
            addedAt: game.created_at || new Date().toISOString(),
            pgn: game.pgn,
          }) as FavoriteGame,
      )

      return favorites
    }

    return []
  } catch (error) {
    console.warn(
      'Failed to fetch favorites from API, falling back to localStorage:',
      error,
    )
    return getFavoriteGamesFromStorage()
  }
}

export const isFavoriteGame = async (gameId: string): Promise<boolean> => {
  const favorites = await getFavoriteGames()
  return favorites.some((favorite) => favorite.id === gameId)
}

export const getFavoriteGame = async (
  gameId: string,
): Promise<FavoriteGame | undefined> => {
  const favorites = await getFavoriteGames()
  return favorites.find((favorite) => favorite.id === gameId)
}

export const convertFavoriteToWebGame = (
  favorite: FavoriteGame,
): MaiaGameListEntry => {
  return {
    id: favorite.id,
    type: favorite.type,
    label: favorite.customName,
    result: favorite.result,
    pgn: favorite.pgn,
  }
}

export const getFavoritesAsWebGames = async (): Promise<
  MaiaGameListEntry[]
> => {
  const favorites = await getFavoriteGames()
  return favorites.map(convertFavoriteToWebGame)
}
