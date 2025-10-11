import React, {
  useRef,
  useMemo,
  Dispatch,
  useState,
  useEffect,
  useContext,
  SetStateAction,
} from 'react'
import { motion } from 'framer-motion'
import { Tournament } from 'src/components'
import { FavoriteModal } from 'src/components/Common/FavoriteModal'
import { AnalysisListContext } from 'src/contexts'
import { fetchMaiaGameList, deleteCustomGame } from 'src/api'
import {
  getFavoritesAsWebGames,
  addFavoriteGame,
  removeFavoriteGame,
  updateFavoriteName,
} from 'src/lib/favorites'
import { MaiaGameListEntry } from 'src/types'
import { useRouter } from 'next/router'

interface GameData {
  game_id: string
  maia_name: string
  result: string
  player_color: 'white' | 'black'
  is_favorited?: boolean
  custom_name?: string
}

type CachedGameEntry = MaiaGameListEntry & {
  is_favorited?: boolean
  custom_name?: string
}

interface AnalysisGameListProps {
  currentId: string[] | null
  loadNewWorldChampionshipGame: (
    newId: string[],
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  loadNewLichessGame: (
    id: string,
    pgn: string,
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  loadNewMaiaGame: (
    id: string,
    type: 'play' | 'hand' | 'brain',
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  onCustomAnalysis?: () => void
  onGameSelected?: () => void // Called when a game is selected (for mobile popup closing)
  refreshTrigger?: number // Used to trigger refresh when custom analysis is added
  embedded?: boolean // Render without outer card container
}

export const AnalysisGameList: React.FC<AnalysisGameListProps> = ({
  currentId,
  onCustomAnalysis,
  onGameSelected,
  refreshTrigger,
  loadNewWorldChampionshipGame,
  embedded = false,
}) => {
  const router = useRouter()
  const { analysisLichessList, analysisTournamentList } =
    useContext(AnalysisListContext)

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [gamesByPage, setGamesByPage] = useState<{
    [gameType: string]: { [page: number]: CachedGameEntry[] }
  }>({
    play: {},
    hand: {},
    brain: {},
    favorites: {},
    custom: {},
  })

  const [favoritedGameIds, setFavoritedGameIds] = useState<Set<string>>(
    new Set(),
  )
  const [customNameOverrides, setCustomNameOverrides] = useState<
    Record<string, string>
  >({})
  const [favoritesInitialized, setFavoritesInitialized] = useState(false)
  const [hbSubsection, setHbSubsection] = useState<'hand' | 'brain'>('hand')

  const [editModal, setEditModal] = useState<{
    isOpen: boolean
    game: CachedGameEntry | null
  }>({ isOpen: false, game: null })

  useEffect(() => {
    getFavoritesAsWebGames()
      .then((favorites) => {
        setFavoritedGameIds(new Set(favorites.map((f) => f.id)))
        setFavoritesInitialized(true)
      })
      .catch(() => {
        setFavoritedGameIds(new Set())
        setFavoritesInitialized(true)
      })
  }, [refreshTrigger])

  useEffect(() => {
    if (currentId?.[1] === 'custom') {
      setSelected('custom')
    }
  }, [currentId])

  const [fetchedCache, setFetchedCache] = useState<{
    [key: string]: { [page: number]: boolean }
  }>({
    play: {},
    hand: {},
    brain: {},
    custom: {},
    lichess: {},
    tournament: {},
    favorites: {},
  })

  const [totalPagesCache, setTotalPagesCache] = useState<{
    [key: string]: number
  }>({})

  const [currentPagePerTab, setCurrentPagePerTab] = useState<{
    [key: string]: number
  }>({
    play: 1,
    hand: 1,
    brain: 1,
    custom: 1,
    lichess: 1,
    tournament: 1,
    favorites: 1,
  })

  const listKeys = useMemo(() => {
    return analysisTournamentList
      ? Array.from(analysisTournamentList.keys()).sort(
          (a, b) =>
            b?.split('---')?.[1]?.localeCompare(a?.split('---')?.[1] ?? '') ??
            0,
        )
      : []
  }, [analysisTournamentList])

  const initialOpenIndex = useMemo(() => {
    if (analysisTournamentList && currentId) {
      return listKeys.map((m) => m?.split('---')?.[0]).indexOf(currentId[0])
    } else {
      return null
    }
  }, [analysisTournamentList, currentId, listKeys])

  const [selected, setSelected] = useState<
    'tournament' | 'lichess' | 'play' | 'hb' | 'custom' | 'favorites'
  >(() => {
    if (currentId?.[1] === 'custom') {
      return 'custom'
    } else if (currentId?.[1] === 'lichess') {
      return 'lichess'
    } else if (currentId?.[1] === 'play') {
      return 'play'
    } else if (currentId?.[1] === 'hand') {
      return 'hb'
    } else if (currentId?.[1] === 'brain') {
      return 'hb'
    }
    return 'tournament'
  })
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(initialOpenIndex)

  const openElement = useRef<HTMLDivElement>(null)
  const selectedGameElement = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setLoadingIndex(null)
  }, [selected])

  useEffect(() => {
    if (selected === 'custom') {
      setFetchedCache((prev) => ({
        ...prev,
        custom: {},
      }))
    }
  }, [refreshTrigger, selected])

  useEffect(() => {
    if (
      selected !== 'tournament' &&
      selected !== 'lichess' &&
      selected !== 'hb'
    ) {
      const isAlreadyFetched = fetchedCache[selected]?.[currentPage]

      if (!isAlreadyFetched) {
        setLoading(true)

        setFetchedCache((prev) => ({
          ...prev,
          [selected]: { ...prev[selected], [currentPage]: true },
        }))

        fetchMaiaGameList(selected, currentPage)
          .then((data) => {
            console.log(data)
            let parsedGames: CachedGameEntry[] = []

            if (selected === 'favorites') {
              parsedGames = data.games.map((game: any) => ({
                id: game.game_id || game.id,
                type: game.game_type || game.type,
                label: game.custom_name || game.label || 'Untitled',
                result: game.result || '*',
                pgn: game.pgn,
                is_favorited: true, // All games in favorites are favorited
                custom_name: game.custom_name,
              }))
            } else {
              if (selected === 'custom') {
                parsedGames = data.games.map((game: any) => ({
                  id: game.game_id || game.id,
                  type: 'custom',
                  label: game.custom_name || 'Custom Game',
                  result: game.result || '*',
                  is_favorited: game.is_favorited,
                  custom_name: game.custom_name,
                }))
              } else {
                const parse = (
                  game: {
                    game_id: string
                    maia_name: string
                    result: string
                    player_color: 'white' | 'black'
                    is_favorited?: boolean
                    custom_name?: string
                  },
                  type: string,
                ) => {
                  const raw = game.maia_name.replace('_kdd_', ' ')
                  const maia = raw.charAt(0).toUpperCase() + raw.slice(1)

                  const defaultLabel =
                    game.player_color === 'white'
                      ? `You vs. ${maia}`
                      : `${maia} vs. You`

                  return {
                    id: game.game_id,
                    label: game.custom_name || defaultLabel,
                    result: game.result,
                    type,
                    is_favorited: game.is_favorited || false,
                    custom_name: game.custom_name,
                  }
                }

                parsedGames = data.games.map((game: GameData) =>
                  parse(game, selected),
                )
              }
            }
            const calculatedTotalPages =
              data.total_pages || Math.ceil(data.total_games / 25)

            setTotalPagesCache((prev) => ({
              ...prev,
              [selected]: calculatedTotalPages,
            }))

            setGamesByPage((prev) => ({
              ...prev,
              [selected]: {
                ...prev[selected],
                [currentPage]: parsedGames,
              },
            }))

            const favoritedIds = new Set<string>(
              parsedGames
                .filter((game: any) => game.is_favorited)
                .map((game: any) => game.id as string),
            )
            setFavoritedGameIds(
              (prev) => new Set<string>([...prev, ...favoritedIds]),
            )

            setLoading(false)
          })
          .catch(() => {
            setFetchedCache((prev) => {
              const newCache = { ...prev }
              delete newCache[selected][currentPage]
              return newCache
            })
            setLoading(false)
          })
      }
    }
  }, [selected, currentPage, fetchedCache])

  useEffect(() => {
    if (selected === 'hb') {
      const gameType = hbSubsection === 'hand' ? 'hand' : 'brain'
      const isAlreadyFetched = fetchedCache[gameType]?.[currentPage]

      if (!isAlreadyFetched) {
        setLoading(true)

        setFetchedCache((prev) => ({
          ...prev,
          [gameType]: { ...prev[gameType], [currentPage]: true },
        }))

        fetchMaiaGameList(gameType, currentPage)
          .then((data) => {
            const parse = (
              game: {
                game_id: string
                maia_name: string
                result: string
                player_color: 'white' | 'black'
                is_favorited?: boolean
                custom_name?: string
              },
              type: string,
            ) => {
              const raw = game.maia_name.replace('_kdd_', ' ')
              const maia = raw.charAt(0).toUpperCase() + raw.slice(1)

              const defaultLabel =
                game.player_color === 'white'
                  ? `You vs. ${maia}`
                  : `${maia} vs. You`

              return {
                id: game.game_id,
                label: game.custom_name || defaultLabel,
                result: game.result,
                type,
                is_favorited: game.is_favorited || false,
                custom_name: game.custom_name,
              }
            }

            const parsedGames = data.games.map((game: GameData) =>
              parse(game, gameType),
            )
            const calculatedTotalPages =
              data.total_pages || Math.ceil(data.total_games / 25)

            setTotalPagesCache((prev) => ({
              ...prev,
              [gameType]: calculatedTotalPages,
            }))

            setGamesByPage((prev) => ({
              ...prev,
              [gameType]: {
                ...prev[gameType],
                [currentPage]: parsedGames,
              },
            }))

            const favoritedIds = new Set<string>(
              parsedGames
                .filter((game: any) => game.is_favorited)
                .map((game: any) => game.id as string),
            )
            setFavoritedGameIds(
              (prev) => new Set<string>([...prev, ...favoritedIds]),
            )

            setLoading(false)
          })
          .catch(() => {
            setFetchedCache((prev) => {
              const newCache = { ...prev }
              delete newCache[gameType][currentPage]
              return newCache
            })
            setLoading(false)
          })
      }
    }
  }, [selected, hbSubsection, currentPage, fetchedCache])

  useEffect(() => {
    if (selected === 'hb') {
      const gameType = hbSubsection === 'hand' ? 'hand' : 'brain'
      if (totalPagesCache[gameType]) {
        setTotalPages(totalPagesCache[gameType])
      } else {
        setTotalPages(1)
      }
      setCurrentPage(currentPagePerTab[gameType] || 1)
    } else if (totalPagesCache[selected]) {
      setTotalPages(totalPagesCache[selected])
      setCurrentPage(currentPagePerTab[selected] || 1)
    } else if (selected === 'lichess' || selected === 'tournament') {
      setTotalPages(1)
      setCurrentPage(1)
    } else if (selected === 'custom') {
      setTotalPages(totalPagesCache['custom'] || 1)
      setCurrentPage(currentPagePerTab['custom'] || 1)
    } else {
      setTotalPages(1)
      setCurrentPage(currentPagePerTab[selected] || 1)
    }
  }, [selected, hbSubsection, totalPagesCache, currentPagePerTab])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      if (selected === 'hb') {
        const gameType = hbSubsection === 'hand' ? 'hand' : 'brain'
        setCurrentPagePerTab((prev) => ({
          ...prev,
          [gameType]: newPage,
        }))
      } else {
        setCurrentPagePerTab((prev) => ({
          ...prev,
          [selected]: newPage,
        }))
      }
    }
  }

  const handleTabChange = (
    newTab: 'tournament' | 'play' | 'hb' | 'custom' | 'lichess' | 'favorites',
  ) => {
    setSelected(newTab)
  }

  const getDisplayName = (game: CachedGameEntry) => {
    return customNameOverrides[game.id] ?? game.custom_name ?? game.label
  }

  const openEditModal = (game: CachedGameEntry) => {
    const displayName = getDisplayName(game)
    setEditModal({
      isOpen: true,
      game: {
        ...game,
        custom_name: displayName,
        label: displayName,
      },
    })
  }

  const handleToggleFavorite = async (game: CachedGameEntry) => {
    const isCurrentlyFavorited = favoritedGameIds.has(game.id)
    const effectiveName = getDisplayName(game)

    setFavoritedGameIds((prev) => {
      const next = new Set(prev)
      if (isCurrentlyFavorited) {
        next.delete(game.id)
      } else {
        next.add(game.id)
      }
      return next
    })

    try {
      if (isCurrentlyFavorited) {
        await removeFavoriteGame(game.id, game.type)
      } else {
        await addFavoriteGame(
          {
            ...game,
            label: effectiveName,
          },
          effectiveName,
        )
      }
    } catch (error) {
      console.error('Failed to toggle favourite', error)
    }

    const reconcileFavoriteIds = () => {
      setFavoritedGameIds((prev) => {
        const next = new Set(prev)
        if (isCurrentlyFavorited) {
          next.delete(game.id)
        } else {
          next.add(game.id)
        }
        return next
      })
    }

    try {
      const updatedFavorites = await getFavoritesAsWebGames()
      const favoriteIds = new Set(updatedFavorites.map((f) => f.id))

      if (isCurrentlyFavorited) {
        favoriteIds.delete(game.id)
      } else {
        favoriteIds.add(game.id)
      }

      setFavoritedGameIds(favoriteIds)
      setFavoritesInitialized(true)
    } catch (error) {
      console.error('Failed to refresh favourites', error)
      reconcileFavoriteIds()
      setFavoritesInitialized(true)
    }

    const currentSectionKey =
      selected === 'hb'
        ? hbSubsection === 'hand'
          ? 'hand'
          : 'brain'
        : selected

    if (
      currentSectionKey === 'play' ||
      currentSectionKey === 'hand' ||
      currentSectionKey === 'brain' ||
      currentSectionKey === 'custom'
    ) {
      setGamesByPage((prev) => {
        const sectionPages = prev[currentSectionKey]
        if (!sectionPages) return prev

        const updatedSectionPages: { [page: number]: CachedGameEntry[] } = {}
        let sectionMutated = false

        Object.entries(sectionPages).forEach(([pageKey, gameList]) => {
          if (!gameList) return

          const index = gameList.findIndex((entry) => entry.id === game.id)
          if (index !== -1) {
            sectionMutated = true
            const newList = [...gameList]
            newList[index] = {
              ...newList[index],
              is_favorited: !isCurrentlyFavorited,
            }
            updatedSectionPages[Number(pageKey)] = newList
          } else {
            updatedSectionPages[Number(pageKey)] = gameList
          }
        })

        if (!sectionMutated) {
          return prev
        }

        return {
          ...prev,
          [currentSectionKey]: updatedSectionPages,
        }
      })
    }

    if (isCurrentlyFavorited) {
      setGamesByPage((prev) => {
        const favoritesPages = prev.favorites
        if (!favoritesPages) return prev

        const updatedFavorites: { [page: number]: CachedGameEntry[] } = {}
        let favoritesMutated = false

        Object.entries(favoritesPages).forEach(([pageKey, gameList]) => {
          if (!gameList) return
          const filtered = gameList.filter((entry) => entry.id !== game.id)
          if (filtered.length !== gameList.length) {
            favoritesMutated = true
          }
          updatedFavorites[Number(pageKey)] = filtered
        })

        if (!favoritesMutated) {
          return prev
        }

        return {
          ...prev,
          favorites: updatedFavorites,
        }
      })
    } else {
      setGamesByPage((prev) => ({
        ...prev,
        favorites: {},
      }))
    }

    setFetchedCache((prev) => ({
      ...prev,
      favorites: {},
    }))
  }

  const updateCachedGameNames = (gameId: string, newName: string) => {
    setGamesByPage((prev) => {
      let mutated = false
      const next = { ...prev }

      Object.entries(prev).forEach(([sectionKey, pages]) => {
        const sectionPages = { ...pages }
        let sectionMutated = false

        Object.entries(pages).forEach(([pageKey, gameList]) => {
          if (!gameList) return
          let pageMutated = false

          const updatedList = gameList.map((entry) => {
            if (entry.id === gameId) {
              pageMutated = true
              return {
                ...entry,
                label: newName,
                custom_name: newName,
              }
            }
            return entry
          })

          if (pageMutated) {
            sectionMutated = true
            mutated = true
            sectionPages[Number(pageKey)] = updatedList
          }
        })

        if (sectionMutated) {
          next[sectionKey] = sectionPages
        }
      })

      return mutated ? next : prev
    })
  }

  const handleSaveGameName = async (newName: string) => {
    if (!editModal.game) return
    const trimmedName = newName.trim()
    if (!trimmedName) return

    try {
      await updateFavoriteName(
        editModal.game.id,
        trimmedName,
        editModal.game.type,
      )
    } catch (error) {
      console.error('Failed to update game name', error)
      return
    }

    setCustomNameOverrides((prev) => ({
      ...prev,
      [editModal.game!.id]: trimmedName,
    }))

    updateCachedGameNames(editModal.game.id, trimmedName)
    setEditModal({ isOpen: false, game: null })
  }

  const handleDeleteCustomGame = async () => {
    if (!editModal.game || editModal.game.type !== 'custom') return
    const deletedGameId = editModal.game.id

    try {
      await deleteCustomGame(editModal.game.id)
    } catch (error) {
      console.error('Failed to delete custom game', error)
      return
    }

    setGamesByPage((prev) => {
      const next = { ...prev }
      let mutated = false

      ;['custom', 'favorites'].forEach((sectionKey) => {
        const pages = prev[sectionKey]
        if (!pages) return

        const updatedPages: { [page: number]: CachedGameEntry[] } = {}
        let sectionMutated = false

        Object.entries(pages).forEach(([pageKey, gameList]) => {
          if (!gameList) return
          const filtered = gameList.filter(
            (entry) => entry.id !== deletedGameId,
          )
          if (filtered.length !== gameList.length) {
            sectionMutated = true
            mutated = true
          }
          updatedPages[Number(pageKey)] = filtered
        })

        if (sectionMutated) {
          next[sectionKey] = updatedPages
        }
      })

      return mutated ? next : prev
    })

    setCustomNameOverrides((prev) => {
      if (!(deletedGameId in prev)) {
        return prev
      }
      const { [deletedGameId]: _removed, ...rest } = prev
      return rest
    })

    setFavoritedGameIds((prev) => {
      if (!prev.has(deletedGameId)) {
        return prev
      }
      const next = new Set(prev)
      next.delete(deletedGameId)
      return next
    })

    setFetchedCache((prev) => ({
      ...prev,
      custom: {},
      favorites: {},
    }))

    try {
      const updatedFavorites = await getFavoritesAsWebGames()
      const favoriteIds = new Set(updatedFavorites.map((f) => f.id))
      favoriteIds.delete(deletedGameId)
      setFavoritedGameIds(favoriteIds)
      setFavoritesInitialized(true)
    } catch (error) {
      console.error('Failed to refresh favourites after deletion', error)
      setFavoritesInitialized(true)
    }

    setEditModal({ isOpen: false, game: null })
  }

  const getCurrentGames = (): CachedGameEntry[] => {
    if (selected === 'play') {
      return gamesByPage.play[currentPage] || []
    } else if (selected === 'hb') {
      const gameType = hbSubsection === 'hand' ? 'hand' : 'brain'
      return gamesByPage[gameType]?.[currentPage] || []
    } else if (selected === 'custom') {
      return gamesByPage['custom']?.[currentPage] || []
    } else if (selected === 'lichess') {
      return analysisLichessList as CachedGameEntry[]
    } else if (selected === 'favorites') {
      return gamesByPage.favorites[currentPage] || []
    }
    return []
  }

  return analysisTournamentList ? (
    <div
      id="analysis-game-list"
      className={
        embedded
          ? 'relative flex h-full flex-col items-start justify-start overflow-hidden border-b border-t border-glassBorder bg-transparent'
          : 'relative flex h-full flex-col items-start justify-start overflow-hidden rounded-md border border-glassBorder bg-glass backdrop-blur-md'
      }
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex select-none items-center border-b border-white/10">
          <Header
            label="★"
            name="favorites"
            selected={selected}
            setSelected={handleTabChange}
          />
          <div className="grid flex-1 grid-cols-5">
            <Header
              label="Play"
              name="play"
              selected={selected}
              setSelected={handleTabChange}
            />
            <Header
              label="H&B"
              name="hb"
              selected={selected}
              setSelected={handleTabChange}
            />
            <Header
              label="Custom"
              name="custom"
              selected={selected}
              setSelected={handleTabChange}
            />
            <Header
              label="Lichess"
              name="lichess"
              selected={selected}
              setSelected={handleTabChange}
            />
            <Header
              label="WC"
              name="tournament"
              selected={selected}
              setSelected={handleTabChange}
            />
          </div>
        </div>

        {selected === 'custom' && onCustomAnalysis && (
          <div className="flex border-b border-white/10">
            <button
              onClick={onCustomAnalysis}
              className="flex w-full items-center gap-2 bg-white/5 px-3 py-1.5 text-white/80 transition duration-200 hover:bg-white/10"
            >
              <span className="material-symbols-outlined text-xs text-white/70">
                add
              </span>
              <span className="text-xs text-white/80">
                Analyze Custom PGN/FEN
              </span>
            </button>
          </div>
        )}

        {/* H&B Subsections */}
        {selected === 'hb' && (
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setHbSubsection('hand')}
              className={`flex-1 px-3 text-sm transition-colors ${
                hbSubsection === 'hand'
                  ? 'bg-white/10 text-white'
                  : 'bg-white/5 text-white/80 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="material-symbols-outlined material-symbols-filled !text-base text-white/80">
                  back_hand
                </span>
                <span className="text-xs text-white/90">Hand</span>
              </div>
            </button>
            <button
              onClick={() => setHbSubsection('brain')}
              className={`flex-1 px-3 text-sm transition-colors ${
                hbSubsection === 'brain'
                  ? 'bg-white/10 text-white'
                  : 'bg-white/5 text-white/80 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="material-symbols-outlined !text-lg text-white/80">
                  neurology
                </span>
                <span className="text-xs text-white/90">Brain</span>
              </div>
            </button>
          </div>
        )}

        <div className="red-scrollbar flex h-full flex-col overflow-y-scroll">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
            </div>
          ) : (
            <>
              {selected === 'tournament' ? (
                <>
                  {listKeys.map((id, i) => (
                    <Tournament
                      key={i}
                      id={id}
                      index={i}
                      openIndex={openIndex}
                      currentId={currentId}
                      openElement={
                        openElement as React.RefObject<HTMLDivElement>
                      }
                      setOpenIndex={setOpenIndex}
                      loadingIndex={loadingIndex}
                      setLoadingIndex={setLoadingIndex}
                      selectedGameElement={
                        selectedGameElement as React.RefObject<HTMLButtonElement>
                      }
                      analysisTournamentList={analysisTournamentList}
                    />
                  ))}
                </>
              ) : (
                <>
                  {getCurrentGames().map((game, index) => {
                    const selectedGame = currentId && currentId[0] === game.id
                    const isFavorited =
                      favoritedGameIds.has(game.id) ||
                      (!favoritesInitialized && Boolean(game.is_favorited))
                    const displayName = getDisplayName(game)
                    return (
                      <div
                        key={index}
                        className={`group flex w-full items-center gap-2 ${selectedGame ? 'bg-glass-strong' : 'hover:bg-glass-hover'}`}
                      >
                        <div
                          className={`flex h-full w-10 items-center justify-center ${selectedGame ? 'bg-glass-strong' : 'group-hover:bg-glass-hover'}`}
                        >
                          <p className="text-sm text-white/70">
                            {selected === 'play' ||
                            selected === 'hb' ||
                            selected === 'favorites'
                              ? (currentPage - 1) * 25 + index + 1
                              : index + 1}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setLoadingIndex(index)
                            if (game.type === 'lichess') {
                              router.push(`/analysis/${game.id}/lichess`)
                            } else if (game.type === 'custom') {
                              router.push(`/analysis/${game.id}/custom`)
                            } else {
                              router.push(`/analysis/${game.id}/${game.type}`)
                            }
                            // Call the callback if provided (for mobile popup closing)
                            onGameSelected?.()
                          }}
                          className="flex flex-1 cursor-pointer items-center justify-between overflow-hidden py-1"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-white/90">
                              {displayName}
                            </p>
                            {selected === 'favorites' &&
                              (game.type === 'hand' ||
                                game.type === 'brain') && (
                                <span className="material-symbols-outlined flex-shrink-0 !text-sm text-white/70">
                                  {game.type === 'hand'
                                    ? 'hand_gesture'
                                    : 'neurology'}
                                </span>
                              )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleToggleFavorite(game)
                              }}
                              className={`flex items-center justify-center transition ${
                                isFavorited
                                  ? 'text-yellow-400 hover:text-yellow-300'
                                  : 'text-secondary hover:text-primary'
                              }`}
                              title={
                                isFavorited
                                  ? 'Remove from favourites'
                                  : 'Add to favourites'
                              }
                            >
                              <span
                                className={`material-symbols-outlined !text-xs ${isFavorited ? 'material-symbols-filled' : ''}`}
                              >
                                star
                              </span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditModal(game)
                              }}
                              className="flex items-center justify-center text-white/70 transition hover:text-white"
                              title="Rename game"
                            >
                              <span className="material-symbols-outlined !text-xs">
                                edit
                              </span>
                            </button>
                            <p className="whitespace-nowrap text-sm font-light text-white/70">
                              {game.result
                                .replace('1/2', '½')
                                .replace('1/2', '½')}
                            </p>
                          </div>
                        </button>
                      </div>
                    )
                  })}
                  {(selected === 'play' ||
                    selected === 'hb' ||
                    selected === 'favorites') &&
                    totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 py-2">
                        <button
                          onClick={() => handlePageChange(1)}
                          disabled={currentPage === 1}
                          className="flex items-center justify-center text-secondary hover:text-primary disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined !text-lg">
                            first_page
                          </span>
                        </button>
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="flex items-center justify-center text-secondary hover:text-primary disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined !text-xs">
                            arrow_back_ios
                          </span>
                        </button>
                        <span className="text-xs text-secondary">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="flex items-center justify-center text-secondary hover:text-primary disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined !text-xs">
                            arrow_forward_ios
                          </span>
                        </button>
                        <button
                          onClick={() => handlePageChange(totalPages)}
                          disabled={currentPage === totalPages}
                          className="flex items-center justify-center text-secondary hover:text-primary disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined !text-lg">
                            last_page
                          </span>
                        </button>
                      </div>
                    )}
                </>
              )}
            </>
          )}
          {!((selected === 'play' || selected === 'hb') && totalPages > 1) &&
            getCurrentGames().length === 0 &&
            !loading && (
              <div className="flex flex-1 items-start justify-center gap-1 py-2 md:items-center">
                <p className="text-center text-xs text-white/70">
                  {selected === 'favorites'
                    ? ' ⭐ Hit the star to favourite games...'
                    : 'Play more games... ^. .^₎⟆'}
                </p>
              </div>
            )}
        </div>
        {/* Removed bottom "Analyze Custom" button; now shown only under Custom tab */}
      </div>
      <FavoriteModal
        isOpen={editModal.isOpen}
        currentName={editModal.game ? getDisplayName(editModal.game) : ''}
        onClose={() => setEditModal({ isOpen: false, game: null })}
        onSave={handleSaveGameName}
        onDelete={
          editModal.game && editModal.game.type === 'custom'
            ? handleDeleteCustomGame
            : undefined
        }
        title="Edit Game"
      />
    </div>
  ) : null
}

function Header({
  name,
  label,
  selected,
  setSelected,
}: {
  label: string
  name: 'tournament' | 'play' | 'hb' | 'custom' | 'lichess' | 'favorites'
  selected: 'tournament' | 'play' | 'hb' | 'custom' | 'lichess' | 'favorites'
  setSelected: (
    name: 'tournament' | 'play' | 'hb' | 'custom' | 'lichess' | 'favorites',
  ) => void
}) {
  return (
    <button
      onClick={() => setSelected(name)}
      className={`relative flex items-center justify-center md:py-1 ${selected === name ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'} ${name === 'favorites' ? 'px-3' : ''}`}
    >
      <div className="flex items-center justify-start">
        <p
          className={`text-xs transition duration-200 ${selected === name ? 'text-white' : 'text-white/90'}`}
        >
          {label}
        </p>
      </div>
      {selected === name && (
        <motion.div
          layoutId="underline"
          className="absolute -bottom-0.5 h-0.5 w-full bg-white/70"
        ></motion.div>
      )}
    </button>
  )
}
