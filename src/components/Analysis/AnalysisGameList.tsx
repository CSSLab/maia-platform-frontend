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
import { getAnalysisGameList } from 'src/api'
import { ensureMigration } from 'src/lib/customAnalysis'
import {
  getFavoritesAsWebGames,
  addFavoriteGame,
  removeFavoriteGame,
  updateFavoriteName,
  isFavoriteGame,
} from 'src/lib/favorites'
import { AnalysisWebGame } from 'src/types'
import { useRouter } from 'next/router'

interface GameData {
  game_id: string
  maia_name: string
  result: string
  player_color: 'white' | 'black'
  is_favorited?: boolean
  custom_name?: string
}

interface AnalysisGameListProps {
  currentId: string[] | null
  loadNewTournamentGame: (
    newId: string[],
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  loadNewLichessGames: (
    id: string,
    pgn: string,
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  loadNewUserGames: (
    id: string,
    type: 'play' | 'hand' | 'brain',
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  loadNewCustomGame: (
    id: string,
    setCurrentMove?: Dispatch<SetStateAction<number>>,
  ) => Promise<void>
  onCustomAnalysis?: () => void
  onGameSelected?: () => void // Called when a game is selected (for mobile popup closing)
  refreshTrigger?: number // Used to trigger refresh when custom analysis is added
}

export const AnalysisGameList: React.FC<AnalysisGameListProps> = ({
  currentId,
  loadNewTournamentGame,
  loadNewLichessGames,
  loadNewUserGames,
  loadNewCustomGame,
  onCustomAnalysis,
  onGameSelected,
  refreshTrigger,
}) => {
  const router = useRouter()
  const {
    analysisPlayList,
    analysisHandList,
    analysisBrainList,
    analysisLichessList,
    analysisTournamentList,
  } = useContext(AnalysisListContext)

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [gamesByPage, setGamesByPage] = useState<{
    [gameType: string]: { [page: number]: AnalysisWebGame[] }
  }>({
    play: {},
    hand: {},
    brain: {},
    favorites: {},
    custom: {},
  })

  const [favoriteGames, setFavoriteGames] = useState<AnalysisWebGame[]>([])
  const [favoritedGameIds, setFavoritedGameIds] = useState<Set<string>>(
    new Set(),
  )
  const [hbSubsection, setHbSubsection] = useState<'hand' | 'brain'>('hand')

  // Modal state for favoriting
  const [favoriteModal, setFavoriteModal] = useState<{
    isOpen: boolean
    game: AnalysisWebGame | null
  }>({ isOpen: false, game: null })

  useEffect(() => {
    // Load favorites asynchronously
    getFavoritesAsWebGames()
      .then((favorites) => {
        setFavoriteGames(favorites)
        setFavoritedGameIds(new Set(favorites.map((f) => f.id)))
      })
      .catch(() => {
        setFavoriteGames([])
        setFavoritedGameIds(new Set())
      })
  }, [refreshTrigger])

  useEffect(() => {
    ensureMigration().catch((error) => {
      console.warn('Failed to migrate custom analyses:', error)
    })
  }, [])

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

        getAnalysisGameList(selected, currentPage)
          .then((data) => {
            let parsedGames: AnalysisWebGame[] = []

            if (selected === 'favorites') {
              // Handle favorites response format
              parsedGames = data.games.map((game: any) => ({
                id: game.game_id || game.id,
                type: game.game_type || game.type || 'custom-pgn',
                label: game.custom_name || game.label || 'Untitled',
                result: game.result || '*',
                pgn: game.pgn,
                is_favorited: true, // All games in favorites are favorited
                custom_name: game.custom_name,
              }))
            } else {
              // Handle regular games response format

              if (selected === 'custom') {
                parsedGames = data.games.map((game: any) => ({
                  id: game.id,
                  label: game.name || 'Custom Game',
                  result: '*',
                  type: game.pgn ? 'custom-pgn' : 'custom-fen',
                  pgn: game.pgn,
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

                  // Use custom name if available, otherwise generate default label
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

            // Update favoritedGameIds from the actual games data
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

  // Separate useEffect for H&B subsections
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

        getAnalysisGameList(gameType, currentPage)
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

              // Use custom name if available, otherwise generate default label
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

            // Update favoritedGameIds from the actual games data
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

  const handleFavoriteGame = (game: AnalysisWebGame) => {
    setFavoriteModal({ isOpen: true, game })
  }

  const handleSaveFavorite = async (customName: string) => {
    if (favoriteModal.game) {
      await addFavoriteGame(favoriteModal.game, customName)
      const updatedFavorites = await getFavoritesAsWebGames()
      setFavoriteGames(updatedFavorites)
      setFavoritedGameIds(new Set(updatedFavorites.map((f) => f.id)))

      // Clear favorites cache to force re-fetch
      setFetchedCache((prev) => ({
        ...prev,
        favorites: {},
      }))
      setGamesByPage((prev) => ({
        ...prev,
        favorites: {},
      }))

      // Also clear current section cache to show updated favorite status
      if (selected !== 'favorites') {
        const currentSection =
          selected === 'hb'
            ? hbSubsection === 'hand'
              ? 'hand'
              : 'brain'
            : selected
        setFetchedCache((prev) => ({
          ...prev,
          [currentSection]: {},
        }))
        setGamesByPage((prev) => ({
          ...prev,
          [currentSection]: {},
        }))
      }
    }
  }

  const handleRemoveFavorite = async () => {
    if (favoriteModal.game) {
      await removeFavoriteGame(favoriteModal.game.id, favoriteModal.game.type)
      const updatedFavorites = await getFavoritesAsWebGames()
      setFavoriteGames(updatedFavorites)
      setFavoritedGameIds(new Set(updatedFavorites.map((f) => f.id)))

      // Clear favorites cache to force re-fetch
      setFetchedCache((prev) => ({
        ...prev,
        favorites: {},
      }))
      setGamesByPage((prev) => ({
        ...prev,
        favorites: {},
      }))

      // Also clear current section cache to show updated favorite status
      if (selected !== 'favorites') {
        const currentSection =
          selected === 'hb'
            ? hbSubsection === 'hand'
              ? 'hand'
              : 'brain'
            : selected
        setFetchedCache((prev) => ({
          ...prev,
          [currentSection]: {},
        }))
        setGamesByPage((prev) => ({
          ...prev,
          [currentSection]: {},
        }))
      }
    }
  }

  const handleDirectUnfavorite = async (game: AnalysisWebGame) => {
    await removeFavoriteGame(game.id, game.type)
    const updatedFavorites = await getFavoritesAsWebGames()
    setFavoriteGames(updatedFavorites)
    setFavoritedGameIds(new Set(updatedFavorites.map((f) => f.id)))

    // Clear favorites cache to force re-fetch
    setFetchedCache((prev) => ({
      ...prev,
      favorites: {},
    }))
    setGamesByPage((prev) => ({
      ...prev,
      favorites: {},
    }))

    // Also clear current section cache to show updated favorite status
    if (selected !== 'favorites') {
      const currentSection =
        selected === 'hb'
          ? hbSubsection === 'hand'
            ? 'hand'
            : 'brain'
          : selected
      setFetchedCache((prev) => ({
        ...prev,
        [currentSection]: {},
      }))
      setGamesByPage((prev) => ({
        ...prev,
        [currentSection]: {},
      }))
    }
  }

  const getCurrentGames = () => {
    if (selected === 'play') {
      return gamesByPage.play[currentPage] || []
    } else if (selected === 'hb') {
      const gameType = hbSubsection === 'hand' ? 'hand' : 'brain'
      return gamesByPage[gameType]?.[currentPage] || []
    } else if (selected === 'custom') {
      return gamesByPage['custom']?.[currentPage] || []
    } else if (selected === 'lichess') {
      return analysisLichessList
    } else if (selected === 'favorites') {
      return gamesByPage.favorites[currentPage] || []
    }
    return []
  }

  const getModalCurrentName = () => {
    if (!favoriteModal.game) return ''

    // If we're in the favorites section, the label is already the custom name
    if (selected === 'favorites') {
      return favoriteModal.game.label
    }

    // For other sections, check if the game is favorited and get its custom name
    const favorite = favoriteGames.find(
      (fav) => fav.id === favoriteModal.game!.id,
    )
    if (favorite) {
      return favorite.label // In AnalysisWebGame, the label contains the custom name
    }

    // Otherwise, use the game's label
    return favoriteModal.game.label
  }

  return analysisTournamentList ? (
    <div
      id="analysis-game-list"
      className="flex h-full flex-col items-start justify-start overflow-hidden bg-background-1 md:rounded"
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex select-none items-center border-b-2 border-white border-opacity-10">
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

        {/* H&B Subsections */}
        {selected === 'hb' && (
          <div className="flex border-b border-white border-opacity-10">
            <button
              onClick={() => setHbSubsection('hand')}
              className={`flex-1 px-3 text-sm ${
                hbSubsection === 'hand'
                  ? 'bg-background-2 text-primary'
                  : 'bg-background-1/50 text-secondary hover:bg-background-2'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="material-symbols-outlined !text-lg">
                  hand_gesture
                </span>
                <span className="text-xs">Hand</span>
              </div>
            </button>
            <button
              onClick={() => setHbSubsection('brain')}
              className={`flex-1 px-3 text-sm ${
                hbSubsection === 'brain'
                  ? 'bg-background-2 text-primary'
                  : 'bg-background-1/50 text-secondary hover:bg-background-2'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="material-symbols-outlined !text-lg">
                  neurology
                </span>
                <span className="text-xs">Brain</span>
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
                      loadNewTournamentGame={loadNewTournamentGame}
                      analysisTournamentList={analysisTournamentList}
                    />
                  ))}
                </>
              ) : (
                <>
                  {getCurrentGames().map((game, index) => {
                    const selectedGame = currentId && currentId[0] === game.id
                    const isFavorited = (game as any).is_favorited || false
                    const displayName = game.label // This now contains the custom name if favorited
                    return (
                      <div
                        key={index}
                        className={`group flex w-full items-center gap-2 ${selectedGame ? 'bg-background-2 font-bold' : index % 2 === 0 ? 'bg-background-1/30 hover:bg-background-2' : 'bg-background-1/10 hover:bg-background-2'}`}
                      >
                        <div
                          className={`flex h-full w-9 items-center justify-center ${selectedGame ? 'bg-background-3' : 'bg-background-2 group-hover:bg-white/5'}`}
                        >
                          <p className="text-sm text-secondary">
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
                            if (game.type === 'pgn') {
                              router.push(`/analysis/${game.id}/pgn`)
                            } else if (
                              game.type === 'custom-pgn' ||
                              game.type === 'custom-fen'
                            ) {
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
                            <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-primary">
                              {displayName}
                            </p>
                            {selected === 'favorites' &&
                              (game.type === 'hand' ||
                                game.type === 'brain') && (
                                <span className="material-symbols-outlined flex-shrink-0 !text-sm text-secondary">
                                  {game.type === 'hand'
                                    ? 'hand_gesture'
                                    : 'neurology'}
                                </span>
                              )}
                          </div>
                          <div className="flex items-center gap-2">
                            {selected === 'favorites' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleFavoriteGame(game)
                                  }}
                                  className="flex items-center justify-center text-secondary transition hover:text-primary"
                                  title="Edit favourite"
                                >
                                  <span className="material-symbols-outlined !text-xs">
                                    edit
                                  </span>
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    await handleDirectUnfavorite(game)
                                  }}
                                  className="flex items-center justify-center text-yellow-400 transition hover:text-yellow-300"
                                  title="Remove from favourites"
                                >
                                  <span className="material-symbols-outlined material-symbols-filled !text-xs">
                                    star
                                  </span>
                                </button>
                              </>
                            )}
                            {selected !== 'favorites' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleFavoriteGame(game)
                                }}
                                className={`flex items-center justify-center transition ${
                                  isFavorited
                                    ? 'text-yellow-400 hover:text-yellow-300'
                                    : 'text-secondary hover:text-primary'
                                }`}
                                title={
                                  isFavorited
                                    ? 'Edit favourite'
                                    : 'Add to favourites'
                                }
                              >
                                <span
                                  className={`material-symbols-outlined !text-xs ${isFavorited ? 'material-symbols-filled' : ''}`}
                                >
                                  star
                                </span>
                              </button>
                            )}
                            <p className="whitespace-nowrap text-sm font-light text-secondary">
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
                          <span className="material-symbols-outlined">
                            first_page
                          </span>
                        </button>
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="flex items-center justify-center text-secondary hover:text-primary disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined">
                            arrow_back_ios
                          </span>
                        </button>
                        <span className="text-sm text-secondary">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="flex items-center justify-center text-secondary hover:text-primary disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined">
                            arrow_forward_ios
                          </span>
                        </button>
                        <button
                          onClick={() => handlePageChange(totalPages)}
                          disabled={currentPage === totalPages}
                          className="flex items-center justify-center text-secondary hover:text-primary disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined">
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
                <p className="text-center text-xs text-secondary">
                  {selected === 'favorites'
                    ? ' ⭐ Hit the star to favourite games...'
                    : 'Play more games... ^. .^₎⟆'}
                </p>
              </div>
            )}
        </div>
        {onCustomAnalysis && (
          <button
            onClick={onCustomAnalysis}
            className="flex w-full items-center gap-2 bg-background-4/40 px-3 py-1.5 transition duration-200 hover:bg-background-4/80"
          >
            <span className="material-symbols-outlined text-xs text-secondary">
              add
            </span>
            <span className="text-xs text-secondary">
              Analyze Custom PGN/FEN
            </span>
          </button>
        )}
      </div>
      <FavoriteModal
        isOpen={favoriteModal.isOpen}
        currentName={getModalCurrentName()}
        onClose={() => setFavoriteModal({ isOpen: false, game: null })}
        onSave={handleSaveFavorite}
        onRemove={
          favoriteModal.game && favoritedGameIds.has(favoriteModal.game.id)
            ? handleRemoveFavorite
            : undefined
        }
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
      className={`relative flex items-center justify-center md:py-1 ${selected === name ? 'bg-human-4/30' : 'bg-background-1/80 hover:bg-background-2'} ${name === 'favorites' ? 'px-3' : ''}`}
    >
      <div className="flex items-center justify-start">
        <p
          className={`text-xs transition duration-200 ${selected === name ? 'text-human-2' : 'text-primary'}`}
        >
          {label}
        </p>
      </div>
      {selected === name && (
        <motion.div
          layoutId="underline"
          className="absolute -bottom-0.5 h-0.5 w-full bg-human-2/80"
        ></motion.div>
      )}
    </button>
  )
}
